import { describe, test, expect, vi, beforeEach } from 'vitest';
import TransactionProcessor from './index';
import { Env } from './raindrop.gen';
import { Message } from '@liquidmetal-ai/raindrop-framework';
import { TransactionMessage } from './interfaces';

describe('TransactionProcessor Observer', () => {
  let observer: TransactionProcessor;
  let mockEnv: Env;

  beforeEach(() => {
    mockEnv = {
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      AI_ANALYSIS: {
        categorizeTransaction: vi.fn(),
        analyzeMerchant: vi.fn(),
      },
      FINANCIAL_DB: {
        query: vi.fn(),
        execute: vi.fn(),
      },
    } as unknown as Env;

    observer = new TransactionProcessor(mockEnv, {});
  });

  describe('process', () => {
    test('should process transaction enrichment message', async () => {
      const message: Message<TransactionMessage> = {
        id: 'msg_123',
        timestamp: new Date(),
        body: {
          transactionId: 'txn_123',
          accountId: 'acc_xyz',
          userId: 'user_123',
        },
        attempts: 0,
      } as Message<TransactionMessage>;

      vi.mocked(mockEnv.FINANCIAL_DB.query).mockResolvedValue([
        {
          id: 'txn_123',
          name: 'STARBUCKS',
          merchant_name: 'Starbucks',
          amount: 12.5,
          date: '2025-11-07',
        },
      ]);

      vi.mocked(mockEnv.AI_ANALYSIS.categorizeTransaction).mockResolvedValue({
        category: 'Food and Drink',
        confidence: 0.95,
      });

      await observer.process(message);

      expect(mockEnv.AI_ANALYSIS.categorizeTransaction).toHaveBeenCalled();
      expect(mockEnv.logger.info).toHaveBeenCalled();
    });

    test('should update transaction with AI categorization', async () => {
      const message: Message<TransactionMessage> = {
        id: 'msg_123',
        timestamp: new Date(),
        body: {
          transactionId: 'txn_123',
          accountId: 'acc_xyz',
          userId: 'user_123',
        },
        attempts: 0,
      } as Message<TransactionMessage>;

      vi.mocked(mockEnv.FINANCIAL_DB.query).mockResolvedValue([
        {
          id: 'txn_123',
          name: 'Payment',
          amount: 50.0,
          date: '2025-11-07',
        },
      ]);

      vi.mocked(mockEnv.AI_ANALYSIS.categorizeTransaction).mockResolvedValue({
        category: 'Shopping',
        confidence: 0.75,
      });

      await observer.process(message);

      expect(mockEnv.FINANCIAL_DB.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE transactions'),
        expect.arrayContaining(['Shopping', 0.75, 'txn_123'])
      );
    });

    test('should normalize merchant name', async () => {
      const message: Message<TransactionMessage> = {
        id: 'msg_123',
        timestamp: new Date(),
        body: {
          transactionId: 'txn_123',
          accountId: 'acc_xyz',
          userId: 'user_123',
        },
        attempts: 0,
      } as Message<TransactionMessage>;

      vi.mocked(mockEnv.FINANCIAL_DB.query).mockResolvedValue([
        {
          id: 'txn_123',
          name: 'AMZN*AMAZON.COM',
          merchant_name: 'AMZN*AMAZON.COM',
          amount: 25.0,
          date: '2025-11-07',
        },
      ]);

      vi.mocked(mockEnv.AI_ANALYSIS.analyzeMerchant).mockResolvedValue({
        normalizedName: 'Amazon',
        category: 'Shopping',
        confidence: 0.98,
      });

      vi.mocked(mockEnv.AI_ANALYSIS.categorizeTransaction).mockResolvedValue({
        category: 'Shopping',
        confidence: 0.95,
      });

      await observer.process(message);

      expect(mockEnv.AI_ANALYSIS.analyzeMerchant).toHaveBeenCalled();
      expect(mockEnv.FINANCIAL_DB.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE transactions'),
        expect.arrayContaining([expect.stringContaining('Amazon')])
      );
    });

    test('should update spending patterns', async () => {
      const message: Message<TransactionMessage> = {
        id: 'msg_123',
        timestamp: new Date(),
        body: {
          transactionId: 'txn_123',
          accountId: 'acc_xyz',
          userId: 'user_123',
        },
        attempts: 0,
      } as Message<TransactionMessage>;

      vi.mocked(mockEnv.FINANCIAL_DB.query).mockResolvedValue([
        {
          id: 'txn_123',
          name: 'Coffee Shop',
          amount: 5.5,
          date: '2025-11-07',
        },
      ]);

      vi.mocked(mockEnv.AI_ANALYSIS.categorizeTransaction).mockResolvedValue({
        category: 'Food and Drink',
        confidence: 0.92,
      });

      await observer.process(message);

      expect(mockEnv.FINANCIAL_DB.execute).toHaveBeenCalledWith(
        expect.stringContaining('spending_patterns'),
        expect.any(Array)
      );
    });

    test('should detect anomalies in spending', async () => {
      const message: Message<TransactionMessage> = {
        id: 'msg_123',
        timestamp: new Date(),
        body: {
          transactionId: 'txn_123',
          accountId: 'acc_xyz',
          userId: 'user_123',
        },
        attempts: 0,
      } as Message<TransactionMessage>;

      vi.mocked(mockEnv.FINANCIAL_DB.query)
        .mockResolvedValueOnce([
          {
            id: 'txn_123',
            name: 'Large Purchase',
            amount: 5000.0,
            date: '2025-11-07',
          },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { avg_amount: 50.0 },
        ]);

      vi.mocked(mockEnv.AI_ANALYSIS.categorizeTransaction).mockResolvedValue({
        category: 'Shopping',
        confidence: 0.85,
      });

      await observer.process(message);

      // Should detect that 5000 is much higher than avg 50
      expect(mockEnv.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Anomaly'),
        expect.any(Object)
      );
    });

    test('should skip already enriched transactions', async () => {
      const message: Message<TransactionMessage> = {
        id: 'msg_123',
        timestamp: new Date(),
        body: {
          transactionId: 'txn_123',
          accountId: 'acc_xyz',
          userId: 'user_123',
        },
        attempts: 0,
      } as Message<TransactionMessage>;

      vi.mocked(mockEnv.FINANCIAL_DB.query).mockResolvedValue([
        {
          id: 'txn_123',
          name: 'Test',
          amount: 10.0,
          date: '2025-11-07',
          ai_category: 'Food and Drink',
          ai_confidence: 0.95,
        },
      ]);

      await observer.process(message);

      // Should not call AI if already enriched
      expect(mockEnv.AI_ANALYSIS.categorizeTransaction).not.toHaveBeenCalled();
    });

    test('should handle missing transactions', async () => {
      const message: Message<TransactionMessage> = {
        id: 'msg_123',
        timestamp: new Date(),
        body: {
          transactionId: 'txn_nonexistent',
          accountId: 'acc_xyz',
          userId: 'user_123',
        },
        attempts: 0,
      } as Message<TransactionMessage>;

      vi.mocked(mockEnv.FINANCIAL_DB.query).mockResolvedValue([]);

      await expect(observer.process(message)).rejects.toThrow('Transaction not found');
      expect(mockEnv.logger.error).toHaveBeenCalled();
    });

    test('should aggregate monthly spending by category', async () => {
      const message: Message<TransactionMessage> = {
        id: 'msg_123',
        timestamp: new Date(),
        body: {
          transactionId: 'txn_123',
          accountId: 'acc_xyz',
          userId: 'user_123',
        },
        attempts: 0,
      } as Message<TransactionMessage>;

      vi.mocked(mockEnv.FINANCIAL_DB.query).mockResolvedValue([
        {
          id: 'txn_123',
          name: 'Test',
          amount: 100.0,
          date: '2025-11-07',
        },
      ]);

      vi.mocked(mockEnv.AI_ANALYSIS.categorizeTransaction).mockResolvedValue({
        category: 'Transportation',
        confidence: 0.88,
      });

      await observer.process(message);

      // Should insert/update spending pattern for November 2025
      expect(mockEnv.FINANCIAL_DB.execute).toHaveBeenCalledWith(
        expect.stringContaining('spending_patterns'),
        expect.arrayContaining(['user_123', 'Transportation', '2025-11'])
      );
    });
  });

  describe('Error handling', () => {
    test('should retry on AI API errors', async () => {
      const message: Message<TransactionMessage> = {
        id: 'msg_123',
        timestamp: new Date(),
        body: {
          transactionId: 'txn_123',
          accountId: 'acc_xyz',
          userId: 'user_123',
          retryCount: 0,
        },
        attempts: 0,
      } as Message<TransactionMessage>;

      vi.mocked(mockEnv.FINANCIAL_DB.query).mockResolvedValue([
        {
          id: 'txn_123',
          name: 'Test',
          amount: 10.0,
          date: '2025-11-07',
        },
      ]);

      vi.mocked(mockEnv.AI_ANALYSIS.categorizeTransaction).mockRejectedValue(
        new Error('AI API error')
      );

      await expect(observer.process(message)).rejects.toThrow();
      expect(mockEnv.logger.error).toHaveBeenCalled();
    });

    test('should not retry after max attempts', async () => {
      const message: Message<TransactionMessage> = {
        id: 'msg_123',
        timestamp: new Date(),
        body: {
          transactionId: 'txn_123',
          accountId: 'acc_xyz',
          userId: 'user_123',
          retryCount: 5,
        },
        attempts: 5,
      } as Message<TransactionMessage>;

      vi.mocked(mockEnv.FINANCIAL_DB.query).mockResolvedValue([
        {
          id: 'txn_123',
          name: 'Test',
          amount: 10.0,
          date: '2025-11-07',
        },
      ]);

      vi.mocked(mockEnv.AI_ANALYSIS.categorizeTransaction).mockRejectedValue(
        new Error('Permanent error')
      );

      await expect(observer.process(message)).rejects.toThrow();
      expect(mockEnv.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Max retries'),
        expect.any(Object)
      );
    });

    test('should handle database errors gracefully', async () => {
      const message: Message<TransactionMessage> = {
        id: 'msg_123',
        timestamp: new Date(),
        body: {
          transactionId: 'txn_123',
          accountId: 'acc_xyz',
          userId: 'user_123',
        },
        attempts: 0,
      } as Message<TransactionMessage>;

      vi.mocked(mockEnv.FINANCIAL_DB.query).mockRejectedValue(new Error('Database error'));

      await expect(observer.process(message)).rejects.toThrow();
      expect(mockEnv.logger.error).toHaveBeenCalled();
    });
  });
});
