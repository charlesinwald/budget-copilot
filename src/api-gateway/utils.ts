import { Env } from './raindrop.gen.js';
import {
  LinkTokenResponse,
  ExchangeTokenResponse,
  AccountsResponse,
  TransactionsResponse,
  SyncResponse,
  ChatResponse,
  SpendingAnalysisResponse,
  PredictionsResponse,
  DashboardResponse,
  CategoriesResponse,
  ErrorResponse,
} from './interfaces.js';

// Authentication helpers
export async function authenticateUser(
  request: Request,
  env: Env
): Promise<string | null> {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) {
    return null;
  }

  const cookies = parseCookies(cookieHeader);
  const sessionId = cookies['session'];

  if (!sessionId) {
    return null;
  }

  const userId = await env.SESSION_CACHE.get(`session:${sessionId}`);
  return userId as string | null;
}

function parseCookies(cookieHeader: string): Record<string, string> {
  return cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    if (key && value) {
      acc[key] = value;
    }
    return acc;
  }, {} as Record<string, string>);
}

export async function validateSession(
  sessionId: string,
  env: Env
): Promise<boolean> {
  const userId = await env.SESSION_CACHE.get(`session:${sessionId}`);
  return userId !== null;
}

// Response formatting
export function jsonResponse<T>(data: T, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export function errorResponse(
  message: string,
  status: number = 500,
  details?: string
): Response {
  const errorBody: ErrorResponse = {
    error: message,
    ...(details && { details }),
  };
  return jsonResponse(errorBody, status);
}

// Request parsing
export async function parseJsonBody<T>(request: Request): Promise<T> {
  const text = await request.text();
  if (!text) {
    throw new Error('Request body is empty');
  }
  return JSON.parse(text) as T;
}

export function getQueryParam(url: URL, param: string): string | null {
  return url.searchParams.get(param);
}

export function getRequiredQueryParam(url: URL, param: string): string {
  const value = url.searchParams.get(param);
  if (!value) {
    throw new Error(`Required query parameter '${param}' is missing`);
  }
  return value;
}

// Route handlers
export async function handleCreateLinkToken(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const body = await parseJsonBody<{ userId: string }>(request);

    if (!body.userId || body.userId.trim() === '') {
      return errorResponse('userId is required', 400);
    }

    const result = await env.PLAID_INTEGRATION.createLinkToken(body.userId);
    return jsonResponse(result);
  } catch (error) {
    env.logger.error('Failed to create link token', { error });
    return errorResponse('Failed to create link token', 500);
  }
}

export async function handleExchangeToken(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const body = await parseJsonBody<{
      publicToken: string;
      userId: string;
      institutionId: string;
      institutionName: string;
    }>(request);

    if (!body.publicToken || !body.userId || !body.institutionId || !body.institutionName) {
      return errorResponse('Missing required fields', 400);
    }

    const result = await env.PLAID_INTEGRATION.exchangeToken(body);
    return jsonResponse({
      success: true,
      itemId: result.itemId,
      accounts: result.accounts,
    });
  } catch (error) {
    env.logger.error('Failed to exchange token', { error });
    return errorResponse('Failed to exchange token', 500);
  }
}

// Frontend compatibility: POST /api/plaid/balance
export async function handlePlaidBalance(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const body = await parseJsonBody<{ access_token?: string; userId?: string }>(request);
    const userId = body.userId || (await env.SESSION_CACHE.get('currentUserId')) || 'user_123';
    const accounts = await env.PLAID_INTEGRATION.getAccounts(userId as string);
    return jsonResponse({ accounts });
  } catch (error) {
    env.logger.error('Failed to get Plaid balance', { error });
    return errorResponse('Failed to get Plaid balance', 500);
  }
}

// Frontend compatibility: POST /api/plaid/transactions
export async function handlePlaidTransactions(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const body = await parseJsonBody<{
      access_token?: string;
      userId?: string;
      start_date?: string;
      end_date?: string;
      account_id?: string;
    }>(request);
    const userId = body.userId || (await env.SESSION_CACHE.get('currentUserId')) || 'user_123';
    const result = await env.PLAID_INTEGRATION.getTransactions({
      userId: userId as string,
      accountId: body.account_id,
      startDate: body.start_date,
      endDate: body.end_date,
      count: 100,
      offset: 0,
    });
    // Map to Plaid-like shape if needed
    const transactions = result.transactions.map(t => ({
      transaction_id: t.transactionId,
      id: t.transactionId,
      account_id: t.accountId,
      amount: t.amount,
      date: t.date,
      authorized_date: t.authorizedDate,
      name: t.name,
      merchant_name: t.merchantName,
      category: t.category,
      pending: t.pending,
      transaction_type: t.transactionType,
      payment_channel: t.paymentChannel,
      iso_currency_code: 'USD',
    }));
    return jsonResponse({ transactions, total: result.total, hasMore: result.hasMore });
  } catch (error) {
    env.logger.error('Failed to get Plaid transactions', { error });
    return errorResponse('Failed to get Plaid transactions', 500);
  }
}

// Frontend compatibility: POST /api/ai/chat
export async function handleAiChat(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const body = await parseJsonBody<{ message?: string }>(request);
    const message = (body.message || '').toString();
    if (!message.trim()) {
      return errorResponse('message cannot be empty', 400);
    }
    const userId = (await env.SESSION_CACHE.get('currentUserId')) || 'user_123';
    const result = await env.AI_ANALYSIS.chatWithFinancialData({
      userId: userId as string,
      message,
    });
    // Frontend expects a simple message/content/text string
    return jsonResponse({ message: result.response });
  } catch (error) {
    env.logger.error('Failed to process AI chat', { error });
    return errorResponse('Failed to process AI chat', 500);
  }
}

export async function handleGetAccounts(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const userId = getQueryParam(url, 'userId');

    if (!userId) {
      return errorResponse('userId query parameter is required', 400);
    }

    const isValid = await validateSession(userId, env);
    if (!isValid) {
      return errorResponse('Invalid session', 401);
    }

    const accounts = await env.PLAID_INTEGRATION.getAccounts(userId);
    return jsonResponse({ accounts });
  } catch (error) {
    env.logger.error('Failed to get accounts', { error });
    return errorResponse('Failed to get accounts', 500);
  }
}

export async function handleGetTransactions(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const userId = getQueryParam(url, 'userId');

    if (!userId) {
      return errorResponse('userId query parameter is required', 400);
    }

    const accountId = getQueryParam(url, 'accountId');
    const startDate = getQueryParam(url, 'startDate');
    const endDate = getQueryParam(url, 'endDate');

    const dateValidationError = validateDateRange(startDate, endDate);
    if (dateValidationError) {
      return dateValidationError;
    }

    const result = await env.PLAID_INTEGRATION.getTransactions({
      userId,
      accountId: accountId ?? undefined,
      startDate: startDate ?? undefined,
      endDate: endDate ?? undefined,
    });

    return jsonResponse(result);
  } catch (error) {
    env.logger.error('Failed to get transactions', { error });
    return errorResponse('Failed to get transactions', 500);
  }
}

function validateDateRange(startDate: string | null, endDate: string | null): Response | null {
  if (startDate && !isValidDate(startDate)) {
    return errorResponse('Invalid startDate format', 400);
  }

  if (endDate && !isValidDate(endDate)) {
    return errorResponse('Invalid endDate format', 400);
  }

  return null;
}

export async function handleSyncTransactions(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const body = await parseJsonBody<{ userId: string; itemId: string }>(request);

    if (!body.userId || !body.itemId) {
      return errorResponse('userId and itemId are required', 400);
    }

    await env.TRANSACTION_SYNC_QUEUE.send({
      userId: body.userId,
      itemId: body.itemId,
    });

    return jsonResponse({ success: true });
  } catch (error) {
    env.logger.error('Failed to enqueue sync job', { error });
    return errorResponse('Failed to enqueue sync job', 500);
  }
}

export async function handleChat(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const body = await parseJsonBody<{ userId: string; message: string }>(request);

    if (!body.userId || !body.message) {
      return errorResponse('userId and message are required', 400);
    }

    if (body.message.trim() === '') {
      return errorResponse('message cannot be empty', 400);
    }

    if (body.message.length > 2000) {
      return errorResponse('message exceeds maximum length', 400);
    }

    const result = await env.AI_ANALYSIS.chatWithFinancialData({
      userId: body.userId,
      message: body.message,
    });

    return jsonResponse(result);
  } catch (error) {
    env.logger.error('Failed to process chat message', { error });
    return errorResponse('Failed to process chat message', 500);
  }
}

export async function handleSpendingAnalysis(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const userId = getQueryParam(url, 'userId');
    const period = getQueryParam(url, 'period') || 'monthly';
    const month = getQueryParam(url, 'month');

    if (!userId) {
      return errorResponse('userId query parameter is required', 400);
    }

    const result = await env.AI_ANALYSIS.analyzeSpending({
      userId,
      period: period as 'daily' | 'weekly' | 'monthly',
      month: month ?? undefined,
    });

    return jsonResponse(result);
  } catch (error) {
    env.logger.error('Failed to analyze spending', { error });
    return errorResponse('Failed to analyze spending', 500);
  }
}

export async function handlePredictions(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const userId = getQueryParam(url, 'userId');

    if (!userId) {
      return errorResponse('userId query parameter is required', 400);
    }

    const result = await env.AI_ANALYSIS.generatePredictions({ userId });
    return jsonResponse(result);
  } catch (error) {
    env.logger.error('Failed to generate predictions', { error });
    return errorResponse('Failed to generate predictions', 500);
  }
}

export async function handleDashboard(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const userId = getQueryParam(url, 'userId');

    if (!userId) {
      return errorResponse('userId query parameter is required', 400);
    }

    const [accounts, transactions, spendingAnalysis] = await Promise.all([
      env.PLAID_INTEGRATION.getAccounts(userId),
      env.PLAID_INTEGRATION.getTransactions({ userId, count: 10 }),
      env.AI_ANALYSIS.analyzeSpending({ userId, period: 'monthly' }),
    ]);

    const dashboard: DashboardResponse = {
      totalBalance: calculateTotalBalance(accounts),
      accountsCount: accounts.length,
    recentTransactions: transactions.transactions.slice(0, 10).map(t => ({
      id: t.transactionId,
      accountId: t.accountId,
      amount: t.amount,
      date: t.date,
      name: t.name,
      merchantName: t.merchantName,
      category: t.category ? t.category.join(', ') : undefined,
      pending: t.pending,
      transactionType: t.transactionType,
      paymentChannel: t.paymentChannel,
    })),
      monthlySpending: {
        current: spendingAnalysis.totalSpending,
        previous: 0,
        percentageChange: 0,
      },
      topCategories: spendingAnalysis.byCategory.slice(0, 5),
      alerts: [],
    };

    return jsonResponse(dashboard);
  } catch (error) {
    env.logger.error('Failed to get dashboard data', { error });
    return errorResponse('Failed to get dashboard data', 500);
  }
}

function calculateTotalBalance(accounts: Array<{ currentBalance: number }>): number {
  return accounts.reduce((sum, acc) => sum + acc.currentBalance, 0);
}

export async function handleCategories(
  request: Request,
  env: Env
): Promise<Response> {
  const categories = [
    'Food and Drink',
    'Shopping',
    'Transportation',
    'Entertainment',
    'Bills and Utilities',
    'Healthcare',
    'Travel',
    'Personal Care',
    'Education',
    'Investments',
    'Income',
    'Transfer',
    'Other',
  ];

  return jsonResponse({ categories });
}

function isValidDate(dateString: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) {
    return false;
  }
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}
