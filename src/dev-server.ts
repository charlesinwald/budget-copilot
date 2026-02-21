#!/usr/bin/env node
/**
 * Local Development Server for Budget Copilot API Gateway
 *
 * This server runs the API Gateway locally for development and testing.
 * It provides mock implementations of the Raindrop services and queues.
 */

import { createServer } from 'http';
import ApiGateway from './api-gateway/index.js';
import PlaidIntegration from './plaid-integration/index.js';
import AiAnalysis from './ai-analysis/index.js';

const PORT = process.env.PORT || 8787;

// In-memory storage for local development
const memory = {
  plaidItems: [] as Array<{
    user_id: string;
    access_token: string;
    item_id: string;
    institution_id?: string;
    institution_name?: string;
    cursor?: string;
  }>,
  transactions: [] as Array<{
    id: string;
    user_id: string;
    transaction_id: string;
    account_id: string;
    amount: number;
    date: string;
    name: string;
    merchant_name?: string;
    category?: string;
    pending: boolean;
    ai_category?: string;
    ai_confidence?: number;
  }>,
  accounts: [] as Array<{
    id: string;
    account_id: string;
    user_id: string;
    item_id: string;
    name: string;
    type: string;
    subtype: string;
    mask: string;
    current_balance: number;
    available_balance: number;
    currency_code: string;
  }>,
};

// Generate mock transactions for testing AI features
function generateMockTransactions(userId: string, accountId: string) {
  const mockTransactions = [
    { name: 'STARBUCKS', merchant: 'Starbucks Coffee', amount: 5.67, date: '2025-11-01' },
    { name: 'AMAZON.COM', merchant: 'Amazon', amount: 45.23, date: '2025-11-02' },
    { name: 'UBER TRIP', merchant: 'Uber', amount: 18.50, date: '2025-11-03' },
    { name: 'WHOLE FOODS', merchant: 'Whole Foods Market', amount: 87.34, date: '2025-11-04' },
    { name: 'NETFLIX', merchant: 'Netflix', amount: 15.99, date: '2025-11-05' },
    { name: 'SHELL GAS STATION', merchant: 'Shell', amount: 52.00, date: '2025-11-06' },
    { name: 'TARGET', merchant: 'Target', amount: 123.45, date: '2025-11-07' },
    { name: 'CHIPOTLE', merchant: 'Chipotle Mexican Grill', amount: 12.75, date: '2025-11-07' },
  ];

  return mockTransactions.map((txn, idx) => ({
    id: `mock_txn_${idx}`,
    user_id: userId,
    transaction_id: `mock_txn_${Date.now()}_${idx}`,
    account_id: accountId,
    amount: txn.amount,
    date: txn.date,
    name: txn.name,
    merchant_name: txn.merchant,
    category: undefined,
    pending: false,
    ai_category: undefined,
    ai_confidence: undefined,
  }));
}

// Mock environment for local development
const mockEnv = {
  logger: {
    debug: (...args: any[]) => console.log('[DEBUG]', ...args),
    info: (...args: any[]) => console.log('[INFO]', ...args),
    warn: (...args: any[]) => console.warn('[WARN]', ...args),
    error: (...args: any[]) => console.error('[ERROR]', ...args),
  },

  // Environment variables from .env
  PLAID_CLIENT_ID: process.env.PLAID_CLIENT_ID || '',
  PLAID_SECRET: process.env.PLAID_SECRET || '',
  PLAID_ENVIRONMENT: process.env.PLAID_ENVIRONMENT || 'sandbox',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  SESSION_SECRET: process.env.SESSION_SECRET || 'dev-secret',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Mock service instances
  PLAID_INTEGRATION: null as any,
  AI_ANALYSIS: null as any,

  // Enhanced in-memory database with mock data support
  FINANCIAL_DB: {
    query: async (sql: string, params?: any[]) => {
      console.log('[DB QUERY]', sql, params);
      const q = sql.toLowerCase();

      // Plaid items queries
      if (q.includes('from plaid_items')) {
        if (q.includes('where user_id = ? and item_id = ?')) {
          const [userId, itemId] = params || [];
          return memory.plaidItems
            .filter(i => i.user_id === userId && i.item_id === itemId)
            .map(i => ({
              access_token: i.access_token,
              item_id: i.item_id,
              institution_name: i.institution_name,
              cursor: i.cursor,
            }));
        }
        if (q.includes('where user_id = ?')) {
          const [userId] = params || [];
          return memory.plaidItems
            .filter(i => i.user_id === userId)
            .map(i => ({
              access_token: i.access_token,
              item_id: i.item_id,
              institution_name: i.institution_name,
              cursor: i.cursor,
            }));
        }
      }

      // Transaction queries - return mock transactions for AI processing
      if (q.includes('from transactions')) {
        // Support both user_id filtering and date range filtering
        let filtered = memory.transactions;

        // Filter by date range if provided
        if (q.includes('where date >= ? and date <= ?')) {
          const [startDate, endDate] = params || [];
          filtered = filtered.filter(t => t.date >= startDate && t.date <= endDate);
        } else if (q.includes('where user_id = ?')) {
          const [userId] = params || [];
          filtered = filtered.filter(t => t.user_id === userId);
        }

        // Return transactions with all fields
        return filtered.map(t => ({
          id: t.id,
          transaction_id: t.transaction_id,
          name: t.name,
          merchant_name: t.merchant_name,
          amount: t.amount,
          date: t.date,
          ai_category: t.ai_category,
          ai_confidence: t.ai_confidence,
          account_id: t.account_id,
          pending: t.pending,
          user_id: t.user_id,
          category: t.category,
        }));
      }

      // Chat history queries
      if (q.includes('from chat_history')) {
        return []; // Empty chat history for now
      }

      // Spending patterns queries
      if (q.includes('from spending_patterns')) {
        return []; // Will be calculated from transactions
      }

      return [];
    },
    execute: async (sql: string, params?: any[]) => {
      console.log('[DB EXECUTE]', sql, params);
      const q = sql.toLowerCase();

      // Insert plaid item
      if (q.startsWith('insert into plaid_items')) {
        const [userId, accessToken, itemId, institutionId, institutionName] = params || [];
        memory.plaidItems.push({
          user_id: userId,
          access_token: accessToken,
          item_id: itemId,
          institution_id: institutionId,
          institution_name: institutionName,
          cursor: undefined,
        });

        // Auto-generate mock account and transactions for this item
        const mockAccountId = `mock_acc_${itemId}`;
        memory.accounts.push({
          id: `acc_${Date.now()}`,
          account_id: mockAccountId,
          user_id: userId,
          item_id: itemId,
          name: 'Mock Checking Account',
          type: 'depository',
          subtype: 'checking',
          mask: '0000',
          current_balance: 1500.00,
          available_balance: 1500.00,
          currency_code: 'USD',
        });

        // Generate mock transactions
        const mockTransactions = generateMockTransactions(userId, mockAccountId);
        memory.transactions.push(...mockTransactions);

        console.log(`[MOCK DATA] Created ${mockTransactions.length} mock transactions for AI processing`);

        return { success: true };
      }

      // Update plaid item cursor
      if (q.startsWith('update plaid_items set cursor = ?')) {
        const [cursor, _updatedAt, itemId] = params || [];
        const found = memory.plaidItems.find(i => i.item_id === itemId);
        if (found) {
          found.cursor = cursor;
        }
        return { success: true };
      }

      // Update transaction with AI categorization
      if (q.includes('update transactions') && q.includes('ai_category')) {
        const [aiCategory, aiConfidence, _merchantName, _updatedAt, transactionId] = params || [];
        const transaction = memory.transactions.find(t => t.transaction_id === transactionId);
        if (transaction) {
          transaction.ai_category = aiCategory;
          transaction.ai_confidence = aiConfidence;
          console.log(`[AI] Categorized "${transaction.name}" as "${aiCategory}" (${aiConfidence})`);
        }
        return { success: true };
      }

      // Insert chat history
      if (q.startsWith('insert into chat_history')) {
        console.log('[CHAT] Storing chat message');
        return { success: true };
      }

      // Insert/update spending patterns
      if (q.includes('spending_patterns')) {
        console.log('[ANALYTICS] Updating spending patterns');
        return { success: true };
      }

      return { success: true };
    },
  },

  // Mock session cache
  SESSION_CACHE: {
    get: async (key: string) => {
      console.log('[CACHE GET]', key);
      return 'user_123'; // Mock user session
    },
    put: async (key: string, value: string, options?: any) => {
      console.log('[CACHE PUT]', key, value);
    },
    delete: async (key: string) => {
      console.log('[CACHE DELETE]', key);
    },
  },

  // Mock queues
  TRANSACTION_SYNC_QUEUE: {
    send: async (message: any) => {
      console.log('[QUEUE] Transaction sync queued:', message);
    },
  },

  TRANSACTION_PROCESSING_QUEUE: {
    send: async (message: any) => {
      console.log('[QUEUE] Transaction processing queued:', message);
    },
  },
};

// Initialize service instances
try {
  mockEnv.PLAID_INTEGRATION = new PlaidIntegration(null, mockEnv);
  mockEnv.AI_ANALYSIS = new AiAnalysis(null, mockEnv);
  console.log('[INFO] Services initialized successfully');
} catch (error) {
  console.error('[ERROR] Failed to initialize services:', error);
}

// Create API Gateway instance
const apiGateway = new ApiGateway(null, mockEnv);

// Create HTTP server
const server = createServer(async (req, res) => {
  try {
    // Build Request object from Node.js IncomingMessage
    const url = `http://localhost:${PORT}${req.url}`;
    const headers = new Headers();
    Object.entries(req.headers).forEach(([key, value]) => {
      if (value) {
        headers.set(key, Array.isArray(value) ? value[0] : value);
      }
    });

    // Read request body
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const body = chunks.length > 0 ? Buffer.concat(chunks).toString() : undefined;

    // Create Web API Request
    const request = new Request(url, {
      method: req.method,
      headers,
      body: body && req.method !== 'GET' && req.method !== 'HEAD' ? body : undefined,
    });

    // Process request through API Gateway
    const response = await apiGateway.fetch(request);

    // Send response
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    const responseBody = await response.text();
    res.end(responseBody);

  } catch (error) {
    console.error('[ERROR] Request failed:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }));
  }
});

// Start server
server.listen(PORT, () => {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                                                           ║');
  console.log('║         Budget Copilot API Gateway - DEV SERVER          ║');
  console.log('║                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📡 Frontend URL: ${mockEnv.FRONTEND_URL}`);
  console.log(`🔧 Environment: ${mockEnv.PLAID_ENVIRONMENT}`);
  console.log('');
  console.log('Available endpoints:');
  console.log('  POST   /api/plaid/create-link-token');
  console.log('  POST   /api/plaid/exchange-token');
  console.log('  GET    /api/accounts');
  console.log('  GET    /api/transactions');
  console.log('  POST   /api/transactions/sync');
  console.log('  POST   /api/chat');
  console.log('  GET    /api/analysis/spending');
  console.log('  GET    /api/analysis/predictions');
  console.log('  GET    /api/dashboard');
  console.log('  GET    /api/categories');
  console.log('');
  console.log('Press Ctrl+C to stop');
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n[INFO] SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('[INFO] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n[INFO] SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('[INFO] Server closed');
    process.exit(0);
  });
});
