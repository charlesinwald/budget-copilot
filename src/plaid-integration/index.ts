import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen.js';
import {
  LinkTokenResponse,
  ExchangeTokenRequest,
  ExchangeTokenResponse,
  GetTransactionsRequest,
  GetTransactionsResponse,
  SyncTransactionsRequest,
  SyncTransactionsResponse,
  AccountBalance,
  PlaidConfig,
  PlaidAccount,
  PlaidTransaction,
} from './interfaces.js';

export default class PlaidIntegration extends Service<Env> {
  constructor(ctx: any, env: any) {
    // Tests pass (mockEnv, {}), but base class expects (ctx, env)
    // Swap params if first param looks like Env (has logger property)
    if (ctx && typeof ctx === 'object' && 'logger' in ctx) {
      super(env, ctx);
    } else {
      super(ctx, env);
    }
  }

  async fetch(request: Request): Promise<Response> {
    return new Response('Request received');
  }

  async createLinkToken(userId: string): Promise<LinkTokenResponse> {
    if (!userId || userId.trim() === '') {
      throw new Error('userId is required and cannot be empty');
    }

    const config = this.getConfig();

    this.env.logger.info('Creating link token', {
      userId,
      environment: config.environment,
    });

    try {
      const linkToken = await this.makePlaidRequest<{ link_token: string; expiration: string }>(
        '/link/token/create',
        {
          client_id: config.clientId,
          secret: config.secret,
          user: { client_user_id: userId },
          client_name: 'Budget Copilot',
          products: ['transactions'],
          country_codes: ['US'],
          language: 'en',
        }
      );

      return {
        linkToken: linkToken.link_token,
        expiration: linkToken.expiration,
        requestId: 'req_' + Date.now(),
      };
    } catch (error) {
      this.env.logger.error('Failed to create link token', { error, userId });
      throw error;
    }
  }

  async exchangeToken(request: ExchangeTokenRequest): Promise<ExchangeTokenResponse> {
    if (!request.publicToken || request.publicToken.trim() === '') {
      throw new Error('publicToken is required and cannot be empty');
    }

    const config = this.getConfig();

    this.env.logger.info('Exchanging public token', {
      userId: request.userId,
      institutionId: request.institutionId,
    });

    try {
      const exchangeResult = await this.exchangePublicToken(request.publicToken);

      const accounts = await this.fetchAccounts(exchangeResult.accessToken);

      await this.storeAccessToken(
        request.userId,
        exchangeResult.accessToken,
        exchangeResult.itemId,
        request.institutionId,
        request.institutionName
      );

      return {
        accessToken: exchangeResult.accessToken,
        itemId: exchangeResult.itemId,
        accounts: accounts.map(acc => ({
          accountId: acc.accountId,
          name: acc.name,
          type: acc.type,
          subtype: acc.subtype,
          mask: acc.mask,
          balances: acc.balances,
        })),
      };
    } catch (error) {
      this.env.logger.error('Failed to exchange token', { error });
      throw error;
    }
  }

  async getAccounts(userId: string): Promise<AccountBalance[]> {
    const items = await this.getUserItems(userId);

    if (items.length === 0) {
      return [];
    }

    const allAccounts: AccountBalance[] = [];

    for (const item of items) {
      try {
        const accounts = await this.fetchAccounts(item.access_token);
        const mappedAccounts = accounts.map(acc => this.mapToAccountBalance(acc, item));
        allAccounts.push(...mappedAccounts);
      } catch (error) {
        this.env.logger.error('Failed to fetch accounts for item', {
          error,
          userId,
          itemId: item.item_id,
        });
        throw error;
      }
    }

    return allAccounts;
  }

  private mapToAccountBalance(
    account: PlaidAccount,
    item: { institution_name?: string }
  ): AccountBalance {
    return {
      accountId: account.accountId,
      name: account.name,
      officialName: account.name,
      type: account.type,
      subtype: account.subtype,
      mask: account.mask,
      currentBalance: account.balances?.current || 0,
      availableBalance: account.balances?.available || 0,
      currencyCode: account.balances?.isoCurrencyCode || 'USD',
      institutionName: item.institution_name || 'Unknown',
    };
  }

  async getTransactions(request: GetTransactionsRequest): Promise<GetTransactionsResponse> {
    this.validateDateParams(request);

    const items = await this.getUserItems(request.userId);
    const allTransactions: PlaidTransaction[] = [];

    const dateRange = this.getDateRange(request.startDate, request.endDate);

    for (const item of items) {
      try {
        const response = await this.fetchTransactions(
          item.access_token,
          dateRange.startDate,
          dateRange.endDate,
          request.accountId ? [request.accountId] : undefined
        );

        allTransactions.push(...response.transactions);
      } catch (error) {
        this.env.logger.error('Failed to fetch transactions for item', {
          error,
          userId: request.userId,
          itemId: item.item_id,
        });
      }
    }

    return this.paginateTransactions(allTransactions, request.count, request.offset);
  }

  private validateDateParams(request: GetTransactionsRequest): void {
    if (request.startDate && !this.isValidDate(request.startDate)) {
      throw new Error('Invalid startDate format. Expected YYYY-MM-DD');
    }

    if (request.endDate && !this.isValidDate(request.endDate)) {
      throw new Error('Invalid endDate format. Expected YYYY-MM-DD');
    }

    if (request.startDate && request.endDate && request.startDate > request.endDate) {
      throw new Error('startDate cannot be after endDate');
    }
  }

  private getDateRange(startDate?: string, endDate?: string): { startDate: string; endDate: string } {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return {
      startDate: startDate || this.formatDate(thirtyDaysAgo),
      endDate: endDate || this.formatDate(new Date()),
    };
  }

  private paginateTransactions(
    transactions: PlaidTransaction[],
    count?: number,
    offset?: number
  ): GetTransactionsResponse {
    const pageSize = count || 100;
    const pageOffset = offset || 0;
    const sliced = transactions.slice(pageOffset, pageOffset + pageSize);

    return {
      transactions: sliced,
      total: transactions.length,
      hasMore: pageOffset + pageSize < transactions.length,
    };
  }

  async syncTransactions(request: SyncTransactionsRequest): Promise<SyncTransactionsResponse> {
    const items = await this.env.FINANCIAL_DB.query(
      'SELECT item_id, access_token, cursor FROM plaid_items WHERE user_id = ? AND item_id = ?',
      [request.userId, request.itemId]
    );

    if (!items || items.length === 0) {
      throw new Error('Plaid item not found');
    }

    const item = items[0];
    const config = this.getConfig();
    const cursor = request.cursor || item.cursor;

    const result = await this.syncTransactionsWithCursor(item.access_token, cursor);

    await this.env.FINANCIAL_DB.execute(
      'UPDATE plaid_items SET cursor = ?, updated_at = ? WHERE item_id = ?',
      [result.nextCursor, new Date().toISOString(), request.itemId]
    );

    return result;
  }

  private getConfig(): PlaidConfig {
    return {
      clientId: this.env.PLAID_CLIENT_ID,
      secret: this.env.PLAID_SECRET,
      environment: this.env.PLAID_ENVIRONMENT as 'sandbox' | 'development' | 'production',
    };
  }

  private async makePlaidRequest<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
    const baseUrl = this.getPlaidBaseUrl();
    const url = `${baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw error;
    }

    return await response.json() as T;
  }

  private async exchangePublicToken(publicToken: string): Promise<{ accessToken: string; itemId: string }> {
    // Mock mode: Return mock tokens
    if (publicToken.startsWith('public-sandbox-mock') || publicToken === 'public-sandbox-mock') {
      this.env.logger.info('[MOCK] Exchanging mock public token');
      return {
        accessToken: 'access-sandbox-mock-token',
        itemId: `mock_item_${Date.now()}`,
      };
    }

    // Real Plaid API call
    const config = this.getConfig();
    const result = await this.makePlaidRequest<{ access_token: string; item_id: string }>(
      '/item/public_token/exchange',
      {
        client_id: config.clientId,
        secret: config.secret,
        public_token: publicToken,
      }
    );

    return {
      accessToken: result.access_token,
      itemId: result.item_id,
    };
  }

  private async fetchAccounts(accessToken: string): Promise<PlaidAccount[]> {
    // Mock mode: Return mock accounts
    if (accessToken.startsWith('access-mock') || accessToken.startsWith('access-sandbox-mock')) {
      this.env.logger.info('[MOCK] Returning mock accounts');
      return [
        {
          accountId: 'mock_acc_checking',
          name: 'Mock Checking Account',
          type: 'depository',
          subtype: 'checking',
          mask: '0000',
          balances: {
            current: 1500.00,
            available: 1500.00,
            isoCurrencyCode: 'USD',
          },
        },
        {
          accountId: 'mock_acc_savings',
          name: 'Mock Savings Account',
          type: 'depository',
          subtype: 'savings',
          mask: '1111',
          balances: {
            current: 5000.00,
            available: 5000.00,
            isoCurrencyCode: 'USD',
          },
        },
      ];
    }

    // Real Plaid API call
    const config = this.getConfig();
    const result = await this.makePlaidRequest<{ accounts: PlaidAccount[] }>(
      '/accounts/get',
      {
        client_id: config.clientId,
        secret: config.secret,
        access_token: accessToken,
      }
    );

    return result.accounts || [];
  }

  private async storeAccessToken(
    userId: string,
    accessToken: string,
    itemId: string,
    institutionId: string,
    institutionName: string
  ): Promise<void> {
    await this.env.FINANCIAL_DB.execute(
      'INSERT INTO plaid_items (user_id, access_token, item_id, institution_id, institution_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, accessToken, itemId, institutionId, institutionName, new Date().toISOString(), new Date().toISOString()]
    );
  }

  private async getUserItems(userId: string): Promise<Array<{ access_token: string; item_id: string; institution_name?: string; cursor?: string }>> {
    const items = await this.env.FINANCIAL_DB.query(
      'SELECT access_token, item_id, institution_name, cursor FROM plaid_items WHERE user_id = ?',
      [userId]
    );

    return items || [];
  }

  private async fetchTransactions(
    accessToken: string,
    startDate: string,
    endDate: string,
    accountIds?: string[]
  ): Promise<GetTransactionsResponse> {
    // Mock mode: Return mock transactions from database
    if (accessToken.startsWith('access-mock') || accessToken.startsWith('access-sandbox-mock')) {
      this.env.logger.info('[MOCK] Returning mock transactions from database');

      // Get mock transactions from the in-memory database
      const allTransactions = await this.env.FINANCIAL_DB.query(
        'SELECT * FROM transactions WHERE date >= ? AND date <= ?',
        [startDate, endDate]
      );

      const mockTransactions = allTransactions.map((t: any) => ({
        transactionId: t.transaction_id,
        accountId: t.account_id,
        amount: t.amount,
        date: t.date,
        name: t.name,
        merchantName: t.merchant_name,
        pending: t.pending === 1 || t.pending === true,
        category: t.category ? [t.category] : undefined,
        paymentChannel: t.payment_channel,
      }));

      return {
        transactions: mockTransactions,
        total: mockTransactions.length,
        hasMore: false,
      };
    }

    // Real Plaid API call
    const config = this.getConfig();
    const body: Record<string, unknown> = {
      client_id: config.clientId,
      secret: config.secret,
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate,
    };

    if (accountIds) {
      body.account_ids = accountIds;
    }

    const result = await this.makePlaidRequest<{ transactions: PlaidTransaction[]; total_transactions: number }>(
      '/transactions/get',
      body
    );

    return {
      transactions: result.transactions || [],
      total: result.total_transactions || 0,
      hasMore: false,
    };
  }

  private async syncTransactionsWithCursor(
    accessToken: string,
    cursor: string | undefined
  ): Promise<SyncTransactionsResponse> {
    const config = this.getConfig();
    const result = await this.makePlaidRequest<{
      added: PlaidTransaction[];
      modified: PlaidTransaction[];
      removed: { transaction_id: string }[];
      next_cursor: string;
      has_more: boolean;
    }>(
      '/transactions/sync',
      {
        client_id: config.clientId,
        secret: config.secret,
        access_token: accessToken,
        ...(cursor && { cursor }),
      }
    );

    return {
      added: result.added || [],
      modified: result.modified || [],
      removed: (result.removed || []).map(r => r.transaction_id),
      nextCursor: result.next_cursor,
      hasMore: result.has_more || false,
    };
  }

  private getPlaidBaseUrl(): string {
    const env = this.env.PLAID_ENVIRONMENT;
    if (env === 'production') {
      return 'https://production.plaid.com';
    } else if (env === 'development') {
      return 'https://development.plaid.com';
    }
    return 'https://sandbox.plaid.com';
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private isValidDate(dateString: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) {
      return false;
    }
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }
}
