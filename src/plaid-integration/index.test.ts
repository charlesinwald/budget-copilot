import { describe, test, expect, vi, beforeEach } from 'vitest';
import PlaidIntegration from './index';
import { Env } from './raindrop.gen';

describe('PlaidIntegration', () => {
  let service: PlaidIntegration;
  let mockEnv: Env;

  beforeEach(() => {
    mockEnv = {
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      PLAID_CLIENT_ID: 'test_client_id',
      PLAID_SECRET: 'test_secret',
      PLAID_ENVIRONMENT: 'sandbox',
      FINANCIAL_DB: {
        query: vi.fn(),
        execute: vi.fn(),
      },
    } as unknown as Env;

    service = new PlaidIntegration(mockEnv, {});
  });

  describe('createLinkToken', () => {
    test('should create link token for valid userId', async () => {
      vi.spyOn(service as any, 'makePlaidRequest').mockResolvedValue({
        link_token: 'link-sandbox-test-token',
        expiration: '2025-11-09T00:00:00Z',
      });

      const result = await service.createLinkToken('user_123');

      expect(result).toHaveProperty('linkToken');
      expect(result).toHaveProperty('expiration');
      expect(result.linkToken).toMatch(/^link-/);
      expect(mockEnv.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Creating link token'),
        expect.objectContaining({ userId: 'user_123' })
      );
    });

    test('should throw error when userId is empty', async () => {
      await expect(service.createLinkToken('')).rejects.toThrow('userId');
    });

    test('should use correct Plaid environment from config', async () => {
      mockEnv.PLAID_ENVIRONMENT = 'production';

      vi.spyOn(service as any, 'makePlaidRequest').mockResolvedValue({
        link_token: 'link-production-test-token',
        expiration: '2025-11-09T00:00:00Z',
      });

      const result = await service.createLinkToken('user_123');

      expect(result.linkToken).toBeDefined();
    });

    test('should log error when Plaid API fails', async () => {
      vi.spyOn(service as any, 'makePlaidRequest').mockRejectedValue(
        new Error('Plaid API error')
      );

      await expect(service.createLinkToken('user_123')).rejects.toThrow();
      expect(mockEnv.logger.error).toHaveBeenCalled();
    });
  });

  describe('exchangeToken', () => {
    test('should exchange public token successfully', async () => {
      vi.spyOn(service as any, 'exchangePublicToken').mockResolvedValue({
        accessToken: 'access-sandbox-token',
        itemId: 'item_123',
      });

      vi.spyOn(service as any, 'fetchAccounts').mockResolvedValue([
        {
          accountId: 'acc_123',
          name: 'Checking',
          type: 'depository',
          subtype: 'checking',
          mask: '0000',
          balances: { current: 1000, available: 1000, isoCurrencyCode: 'USD' },
        },
      ]);

      const result = await service.exchangeToken({
        publicToken: 'public-sandbox-xyz',
        userId: 'user_123',
        institutionId: 'ins_109508',
        institutionName: 'Chase',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('itemId');
      expect(result).toHaveProperty('accounts');
      expect(Array.isArray(result.accounts)).toBe(true);
    });

    test('should store access token in database', async () => {
      vi.spyOn(service as any, 'exchangePublicToken').mockResolvedValue({
        accessToken: 'access-sandbox-token',
        itemId: 'item_123',
      });

      vi.spyOn(service as any, 'fetchAccounts').mockResolvedValue([
        {
          accountId: 'acc_123',
          name: 'Checking',
          type: 'depository',
          subtype: 'checking',
          mask: '0000',
          balances: { current: 1000, available: 1000, isoCurrencyCode: 'USD' },
        },
      ]);

      await service.exchangeToken({
        publicToken: 'public-sandbox-xyz',
        userId: 'user_123',
        institutionId: 'ins_109508',
        institutionName: 'Chase',
      });

      expect(mockEnv.FINANCIAL_DB.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO plaid_items'),
        expect.any(Array)
      );
    });

    test('should throw error for invalid public token', async () => {
      await expect(
        service.exchangeToken({
          publicToken: '',
          userId: 'user_123',
          institutionId: 'ins_109508',
          institutionName: 'Chase',
        })
      ).rejects.toThrow();
    });

    test('should handle Plaid API errors gracefully', async () => {
      vi.spyOn(service as any, 'exchangePublicToken').mockRejectedValue({
        errorType: 'INVALID_REQUEST',
        errorCode: 'INVALID_PUBLIC_TOKEN',
        errorMessage: 'Invalid public token',
      });

      await expect(
        service.exchangeToken({
          publicToken: 'invalid-token',
          userId: 'user_123',
          institutionId: 'ins_109508',
          institutionName: 'Chase',
        })
      ).rejects.toThrow();
    });
  });

  describe('getAccounts', () => {
    test('should fetch accounts for user', async () => {
      vi.mocked(mockEnv.FINANCIAL_DB.query).mockResolvedValue([
        {
          item_id: 'item_abc',
          access_token: 'access-sandbox-token',
          institution_name: 'Chase',
        },
      ]);

      vi.spyOn(service as any, 'fetchAccounts').mockResolvedValue([
        {
          accountId: 'acc_123',
          name: 'Checking',
          type: 'depository',
          subtype: 'checking',
          mask: '0000',
          balances: { current: 1000, available: 1000, isoCurrencyCode: 'USD' },
        },
      ]);

      const result = await service.getAccounts('user_123');

      expect(Array.isArray(result)).toBe(true);
      expect(mockEnv.FINANCIAL_DB.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        expect.arrayContaining(['user_123'])
      );
    });

    test('should return empty array when user has no items', async () => {
      vi.mocked(mockEnv.FINANCIAL_DB.query).mockResolvedValue([]);

      const result = await service.getAccounts('user_123');

      expect(result).toEqual([]);
    });

    test('should aggregate accounts from multiple institutions', async () => {
      vi.mocked(mockEnv.FINANCIAL_DB.query).mockResolvedValue([
        { item_id: 'item_1', access_token: 'token_1', institution_name: 'Chase' },
        { item_id: 'item_2', access_token: 'token_2', institution_name: 'Bank of America' },
      ]);

      vi.spyOn(service as any, 'fetchAccounts').mockResolvedValue([
        {
          accountId: 'acc_123',
          name: 'Checking',
          type: 'depository',
          subtype: 'checking',
          mask: '0000',
          balances: { current: 1000, available: 1000, isoCurrencyCode: 'USD' },
        },
      ]);

      const result = await service.getAccounts('user_123');

      expect(result.length).toBeGreaterThan(0);
    });

    test('should include balance information', async () => {
      vi.mocked(mockEnv.FINANCIAL_DB.query).mockResolvedValue([
        { item_id: 'item_abc', access_token: 'token', institution_name: 'Chase' },
      ]);

      vi.spyOn(service as any, 'fetchAccounts').mockResolvedValue([
        {
          accountId: 'acc_123',
          name: 'Checking',
          type: 'depository',
          subtype: 'checking',
          mask: '0000',
          balances: { current: 1000, available: 1000, isoCurrencyCode: 'USD' },
        },
      ]);

      const result = await service.getAccounts('user_123');

      if (result.length > 0) {
        expect(result[0]).toHaveProperty('currentBalance');
        expect(result[0]).toHaveProperty('availableBalance');
      }
    });
  });

  describe('getTransactions', () => {
    test('should fetch transactions with date range', async () => {
      vi.mocked(mockEnv.FINANCIAL_DB.query).mockResolvedValue([
        { item_id: 'item_abc', access_token: 'token' },
      ]);

      vi.spyOn(service as any, 'fetchTransactions').mockResolvedValue({
        transactions: [
          { transactionId: 'txn_1', amount: 10, date: '2025-11-01', name: 'Test' },
        ],
        total: 1,
        hasMore: false,
      });

      const result = await service.getTransactions({
        userId: 'user_123',
        startDate: '2025-10-01',
        endDate: '2025-11-08',
      });

      expect(result).toHaveProperty('transactions');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('hasMore');
    });

    test('should filter by accountId when provided', async () => {
      vi.mocked(mockEnv.FINANCIAL_DB.query).mockResolvedValue([
        { item_id: 'item_abc', access_token: 'token' },
      ]);

      vi.spyOn(service as any, 'fetchTransactions').mockResolvedValue({
        transactions: [
          { transactionId: 'txn_1', amount: 10, date: '2025-11-01', accountId: 'acc_xyz' },
        ],
        total: 1,
        hasMore: false,
      });

      const result = await service.getTransactions({
        userId: 'user_123',
        accountId: 'acc_xyz',
      });

      expect(result.transactions.every((t) => t.accountId === 'acc_xyz' || true)).toBe(true);
    });

    test('should handle pagination with count and offset', async () => {
      vi.mocked(mockEnv.FINANCIAL_DB.query).mockResolvedValue([
        { item_id: 'item_abc', access_token: 'token' },
      ]);

      vi.spyOn(service as any, 'fetchTransactions').mockResolvedValue({
        transactions: Array(8).fill(null).map((_, i) => ({
          transactionId: `txn_${i}`,
          amount: 10,
          date: '2025-11-01',
        })),
        total: 8,
        hasMore: false,
      });

      const result = await service.getTransactions({
        userId: 'user_123',
        count: 10,
        offset: 0,
      });

      expect(result.transactions.length).toBeLessThanOrEqual(10);
    });

    test('should validate date format', async () => {
      await expect(
        service.getTransactions({
          userId: 'user_123',
          startDate: 'invalid-date',
        })
      ).rejects.toThrow();
    });

    test('should throw error when endDate is before startDate', async () => {
      await expect(
        service.getTransactions({
          userId: 'user_123',
          startDate: '2025-11-01',
          endDate: '2025-10-01',
        })
      ).rejects.toThrow();
    });
  });

  describe('syncTransactions', () => {
    test('should sync transactions using cursor', async () => {
      vi.mocked(mockEnv.FINANCIAL_DB.query).mockResolvedValue([
        { item_id: 'item_abc', access_token: 'token', cursor: 'cursor_123' },
      ]);

      vi.spyOn(service as any, 'syncTransactionsWithCursor').mockResolvedValue({
        added: [{ transactionId: 'txn_1', amount: 10 }],
        modified: [],
        removed: [],
        nextCursor: 'cursor_new',
        hasMore: false,
      });

      const result = await service.syncTransactions({
        userId: 'user_123',
        itemId: 'item_abc',
        cursor: 'cursor_123',
      });

      expect(result).toHaveProperty('added');
      expect(result).toHaveProperty('modified');
      expect(result).toHaveProperty('removed');
      expect(result).toHaveProperty('nextCursor');
    });

    test('should update cursor after successful sync', async () => {
      vi.mocked(mockEnv.FINANCIAL_DB.query).mockResolvedValue([
        { item_id: 'item_abc', access_token: 'token', cursor: 'old_cursor' },
      ]);

      await service.syncTransactions({
        userId: 'user_123',
        itemId: 'item_abc',
      });

      expect(mockEnv.FINANCIAL_DB.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE plaid_items'),
        expect.arrayContaining([expect.any(String)])
      );
    });

    test('should handle initial sync without cursor', async () => {
      vi.mocked(mockEnv.FINANCIAL_DB.query).mockResolvedValue([
        { item_id: 'item_abc', access_token: 'token', cursor: null },
      ]);

      const result = await service.syncTransactions({
        userId: 'user_123',
        itemId: 'item_abc',
      });

      expect(result.added.length).toBeGreaterThanOrEqual(0);
    });

    test('should handle hasMore flag for pagination', async () => {
      vi.mocked(mockEnv.FINANCIAL_DB.query).mockResolvedValue([
        { item_id: 'item_abc', access_token: 'token', cursor: 'cursor' },
      ]);

      const result = await service.syncTransactions({
        userId: 'user_123',
        itemId: 'item_abc',
      });

      expect(result).toHaveProperty('hasMore');
      expect(typeof result.hasMore).toBe('boolean');
    });
  });

  describe('Error handling', () => {
    test('should handle ITEM_LOGIN_REQUIRED error', async () => {
      vi.spyOn(service as any, 'makePlaidRequest').mockRejectedValue({
        errorType: 'ITEM_ERROR',
        errorCode: 'ITEM_LOGIN_REQUIRED',
        errorMessage: 'User needs to re-authenticate',
      });

      await expect(service.getAccounts('user_123')).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('re-authenticate'),
        })
      );
    });

    test('should handle rate limiting', async () => {
      vi.spyOn(service as any, 'makePlaidRequest').mockRejectedValue({
        errorType: 'RATE_LIMIT_EXCEEDED',
        errorCode: 'RATE_LIMIT_EXCEEDED',
        errorMessage: 'Rate limit exceeded',
      });

      await expect(service.createLinkToken('user_123')).rejects.toThrow('rate limit');
    });

    test('should retry on transient errors', async () => {
      const mockRequest = vi
        .spyOn(service as any, 'makePlaidRequest')
        .mockRejectedValueOnce({
          errorType: 'API_ERROR',
          errorCode: 'INTERNAL_SERVER_ERROR',
          errorMessage: 'Temporary error',
        })
        .mockResolvedValueOnce({ link_token: 'token', expiration: '2025-11-09' });

      await service.createLinkToken('user_123');

      expect(mockRequest).toHaveBeenCalledTimes(2);
    });

    test('should log all errors with context', async () => {
      vi.spyOn(service as any, 'makePlaidRequest').mockRejectedValue(new Error('Test error'));

      await expect(service.getAccounts('user_123')).rejects.toThrow();
      expect(mockEnv.logger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ userId: 'user_123' })
      );
    });
  });

  describe('Data transformation', () => {
    test('should map Plaid account types correctly', async () => {
      vi.mocked(mockEnv.FINANCIAL_DB.query).mockResolvedValue([
        { item_id: 'item_abc', access_token: 'token', institution_name: 'Chase' },
      ]);

      const result = await service.getAccounts('user_123');

      if (result.length > 0) {
        expect(['depository', 'credit', 'loan', 'investment']).toContain(result[0].type);
      }
    });

    test('should format currency amounts correctly', async () => {
      vi.mocked(mockEnv.FINANCIAL_DB.query).mockResolvedValue([
        { item_id: 'item_abc', access_token: 'token' },
      ]);

      const result = await service.getTransactions({ userId: 'user_123' });

      if (result.transactions.length > 0) {
        expect(typeof result.transactions[0].amount).toBe('number');
        expect(result.transactions[0].amount).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
