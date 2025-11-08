import { describe, test, expect, vi, beforeEach } from 'vitest';
import ApiGateway from './index';
import { Env } from './raindrop.gen';

describe('ApiGateway', () => {
  let service: ApiGateway;
  let mockEnv: Env;

  beforeEach(() => {
    mockEnv = {
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      PLAID_INTEGRATION: {
        createLinkToken: vi.fn().mockResolvedValue({
          linkToken: 'link-sandbox-test',
          expiration: '2025-11-09T00:00:00Z',
          requestId: 'req_123',
        }),
        exchangeToken: vi.fn().mockResolvedValue({
          accessToken: 'access-sandbox-token',
          itemId: 'item_123',
          accounts: [
            {
              accountId: 'acc_123',
              name: 'Checking',
              type: 'depository',
              subtype: 'checking',
              mask: '0000',
              balances: { current: 1000, available: 1000, isoCurrencyCode: 'USD' },
            },
          ],
        }),
        getAccounts: vi.fn().mockResolvedValue([
          {
            id: 'acc_123',
            accountId: 'acc_123',
            name: 'Checking',
            type: 'depository',
            subtype: 'checking',
            currentBalance: 1000,
            availableBalance: 1000,
            currencyCode: 'USD',
            institutionName: 'Chase',
          },
        ]),
        getTransactions: vi.fn().mockResolvedValue({
          transactions: [
            {
              transactionId: 'txn_123',
              accountId: 'acc_123',
              amount: 10.5,
              date: '2025-11-07',
              name: 'Test Transaction',
            },
          ],
          total: 1,
          hasMore: false,
        }),
        syncTransactions: vi.fn(),
      },
      AI_ANALYSIS: {
        analyzeSpending: vi.fn().mockResolvedValue({
          period: 'monthly',
          totalSpending: 500,
          byCategory: [
            { category: 'Food and Drink', amount: 200, percentage: 40 },
            { category: 'Shopping', amount: 150, percentage: 30 },
          ],
          topMerchants: [{ merchantName: 'Starbucks', amount: 100 }],
          insights: ['Test insight'],
        }),
        generatePredictions: vi.fn().mockResolvedValue({
          predictions: [
            {
              type: 'recurring_bill',
              category: 'Bills',
              predictedAmount: 100,
              predictedDate: '2025-12-01',
              confidence: 0.9,
            },
          ],
        }),
        chatWithFinancialData: vi.fn().mockResolvedValue({
          response: 'You spent $200 on dining last month.',
          references: [],
        }),
        categorizeTransaction: vi.fn(),
        analyzeMerchant: vi.fn(),
      },
      SESSION_CACHE: {
        get: vi.fn().mockResolvedValue('user_123'),
        put: vi.fn(),
        delete: vi.fn(),
      },
      TRANSACTION_SYNC_QUEUE: {
        send: vi.fn().mockResolvedValue(undefined),
      },
      FINANCIAL_DB: {
        query: vi.fn(),
        execute: vi.fn(),
      },
    } as unknown as Env;

    service = new ApiGateway(mockEnv, {});
  });

  describe('POST /api/plaid/create-link-token', () => {
    test('should create link token with valid userId', async () => {
      const request = new Request('http://localhost/api/plaid/create-link-token', {
        method: 'POST',
        body: JSON.stringify({ userId: 'user_123' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await service.fetch(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('linkToken');
      expect(data).toHaveProperty('expiration');
      expect(mockEnv.PLAID_INTEGRATION.createLinkToken).toHaveBeenCalledWith('user_123');
    });

    test('should return 400 when userId is missing', async () => {
      const request = new Request('http://localhost/api/plaid/create-link-token', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await service.fetch(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    test('should return 400 when userId is empty', async () => {
      const request = new Request('http://localhost/api/plaid/create-link-token', {
        method: 'POST',
        body: JSON.stringify({ userId: '' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await service.fetch(request);

      expect(response.status).toBe(400);
    });

    test('should include CORS headers in response', async () => {
      const request = new Request('http://localhost/api/plaid/create-link-token', {
        method: 'POST',
        body: JSON.stringify({ userId: 'user_123' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await service.fetch(request);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    });
  });

  describe('POST /api/plaid/exchange-token', () => {
    test('should exchange public token successfully', async () => {
      const request = new Request('http://localhost/api/plaid/exchange-token', {
        method: 'POST',
        body: JSON.stringify({
          publicToken: 'public-sandbox-xyz',
          userId: 'user_123',
          institutionId: 'ins_109508',
          institutionName: 'Chase',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await service.fetch(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('itemId');
      expect(data).toHaveProperty('accounts');
    });

    test('should return 400 when publicToken is missing', async () => {
      const request = new Request('http://localhost/api/plaid/exchange-token', {
        method: 'POST',
        body: JSON.stringify({
          userId: 'user_123',
          institutionId: 'ins_109508',
          institutionName: 'Chase',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await service.fetch(request);

      expect(response.status).toBe(400);
    });

    test('should return 400 when institutionId is missing', async () => {
      const request = new Request('http://localhost/api/plaid/exchange-token', {
        method: 'POST',
        body: JSON.stringify({
          publicToken: 'public-sandbox-xyz',
          userId: 'user_123',
          institutionName: 'Chase',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await service.fetch(request);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/accounts', () => {
    test('should fetch accounts for valid userId', async () => {
      const request = new Request('http://localhost/api/accounts?userId=user_123');

      const response = await service.fetch(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('accounts');
      expect(Array.isArray(data.accounts)).toBe(true);
    });

    test('should return 400 when userId query param is missing', async () => {
      const request = new Request('http://localhost/api/accounts');

      const response = await service.fetch(request);

      expect(response.status).toBe(400);
    });

    test('should return 401 when session is invalid', async () => {
      const request = new Request('http://localhost/api/accounts?userId=user_123');
      vi.mocked(mockEnv.SESSION_CACHE.get).mockResolvedValue(null);

      const response = await service.fetch(request);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/transactions', () => {
    test('should fetch transactions with filters', async () => {
      const request = new Request(
        'http://localhost/api/transactions?userId=user_123&accountId=acc_xyz&startDate=2025-10-01&endDate=2025-11-08'
      );

      const response = await service.fetch(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('transactions');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('hasMore');
    });

    test('should fetch transactions without optional filters', async () => {
      const request = new Request('http://localhost/api/transactions?userId=user_123');

      const response = await service.fetch(request);

      expect(response.status).toBe(200);
    });

    test('should validate date format for startDate', async () => {
      const request = new Request(
        'http://localhost/api/transactions?userId=user_123&startDate=invalid-date'
      );

      const response = await service.fetch(request);

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/transactions/sync', () => {
    test('should enqueue sync job successfully', async () => {
      const request = new Request('http://localhost/api/transactions/sync', {
        method: 'POST',
        body: JSON.stringify({ userId: 'user_123', itemId: 'item_abc' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await service.fetch(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(mockEnv.TRANSACTION_SYNC_QUEUE.send).toHaveBeenCalled();
    });

    test('should return 400 when itemId is missing', async () => {
      const request = new Request('http://localhost/api/transactions/sync', {
        method: 'POST',
        body: JSON.stringify({ userId: 'user_123' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await service.fetch(request);

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/chat', () => {
    test('should process chat message', async () => {
      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          userId: 'user_123',
          message: 'How much did I spend on dining?',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await service.fetch(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('response');
      expect(data).toHaveProperty('references');
      expect(mockEnv.AI_ANALYSIS.chatWithFinancialData).toHaveBeenCalled();
    });

    test('should return 400 when message is empty', async () => {
      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({ userId: 'user_123', message: '' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await service.fetch(request);

      expect(response.status).toBe(400);
    });

    test('should return 400 when message exceeds 2000 characters', async () => {
      const longMessage = 'a'.repeat(2001);
      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({ userId: 'user_123', message: longMessage }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await service.fetch(request);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/analysis/spending', () => {
    test('should fetch spending analysis', async () => {
      const request = new Request(
        'http://localhost/api/analysis/spending?userId=user_123&period=monthly&month=2025-10'
      );

      const response = await service.fetch(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('period');
      expect(data).toHaveProperty('totalSpending');
      expect(data).toHaveProperty('byCategory');
      expect(data).toHaveProperty('topMerchants');
    });

    test('should use default period when not specified', async () => {
      const request = new Request('http://localhost/api/analysis/spending?userId=user_123');

      const response = await service.fetch(request);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/analysis/predictions', () => {
    test('should fetch predictions', async () => {
      const request = new Request('http://localhost/api/analysis/predictions?userId=user_123');

      const response = await service.fetch(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('predictions');
      expect(Array.isArray(data.predictions)).toBe(true);
    });
  });

  describe('GET /api/dashboard', () => {
    test('should fetch dashboard data', async () => {
      const request = new Request('http://localhost/api/dashboard?userId=user_123');

      const response = await service.fetch(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('totalBalance');
      expect(data).toHaveProperty('accountsCount');
      expect(data).toHaveProperty('monthlySpending');
      expect(data).toHaveProperty('topCategories');
      expect(data).toHaveProperty('alerts');
    });
  });

  describe('GET /api/categories', () => {
    test('should return list of categories', async () => {
      const request = new Request('http://localhost/api/categories');

      const response = await service.fetch(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('categories');
      expect(Array.isArray(data.categories)).toBe(true);
      expect(data.categories.length).toBeGreaterThan(0);
    });
  });

  describe('OPTIONS requests', () => {
    test('should handle CORS preflight requests', async () => {
      const request = new Request('http://localhost/api/accounts', {
        method: 'OPTIONS',
      });

      const response = await service.fetch(request);

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBeTruthy();
      expect(response.headers.get('Access-Control-Allow-Headers')).toBeTruthy();
    });
  });

  describe('Error handling', () => {
    test('should return 404 for unknown routes', async () => {
      const request = new Request('http://localhost/api/unknown');

      const response = await service.fetch(request);

      expect(response.status).toBe(404);
    });

    test('should return 405 for unsupported methods', async () => {
      const request = new Request('http://localhost/api/categories', {
        method: 'POST',
      });

      const response = await service.fetch(request);

      expect(response.status).toBe(405);
    });

    test('should handle service errors gracefully', async () => {
      vi.mocked(mockEnv.PLAID_INTEGRATION.getAccounts).mockRejectedValue(
        new Error('Service unavailable')
      );

      const request = new Request('http://localhost/api/accounts?userId=user_123');

      const response = await service.fetch(request);

      expect(response.status).toBe(500);
      expect(mockEnv.logger.error).toHaveBeenCalled();
    });
  });
});
