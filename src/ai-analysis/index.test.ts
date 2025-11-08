import { describe, test, expect, vi, beforeEach } from 'vitest';
import AiAnalysis from './index';
import { Env } from './raindrop.gen';

describe('AiAnalysis', () => {
  let service: AiAnalysis;
  let mockEnv: Env;

  beforeEach(() => {
    mockEnv = {
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      ANTHROPIC_API_KEY: 'test_api_key',
      FINANCIAL_DB: {
        query: vi.fn(),
        execute: vi.fn(),
      },
    } as unknown as Env;

    service = new AiAnalysis(mockEnv, {});
  });

  describe('categorizeTransaction', () => {
    test('should categorize transaction with high confidence', async () => {
      const result = await service.categorizeTransaction({
        transactionName: 'STARBUCKS',
        merchantName: 'Starbucks',
        amount: 12.5,
      });

      expect(result).toHaveProperty('category');
      expect(result).toHaveProperty('confidence');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(mockEnv.logger.info).toHaveBeenCalled();
    });

    test('should handle missing merchant name', async () => {
      const result = await service.categorizeTransaction({
        transactionName: 'Payment',
        amount: 50.0,
      });

      expect(result).toHaveProperty('category');
      expect(result.confidence).toBeLessThan(1);
    });

    test('should throw error for invalid amount', async () => {
      await expect(
        service.categorizeTransaction({
          transactionName: 'Test',
          amount: -10,
        })
      ).rejects.toThrow();
    });
  });

  describe('analyzeMerchant', () => {
    test('should normalize merchant name', async () => {
      const result = await service.analyzeMerchant({
        merchantName: 'AMZN*AMAZON.COM',
      });

      expect(result).toHaveProperty('normalizedName');
      expect(result).toHaveProperty('category');
      expect(result.normalizedName.toLowerCase()).toContain('amazon');
    });

    test('should use transaction history for better accuracy', async () => {
      const result = await service.analyzeMerchant({
        merchantName: 'Unknown Merchant',
        transactionHistory: [
          { name: 'Coffee', amount: 5, date: '2025-11-01' },
          { name: 'Latte', amount: 6, date: '2025-11-02' },
        ],
      });

      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('analyzeSpending', () => {
    test('should analyze monthly spending', async () => {
      vi.mocked(mockEnv.FINANCIAL_DB.query).mockResolvedValue([
        {
          category: 'Food and Drink',
          total_amount: 342.5,
          transaction_count: 23,
          avg_transaction: 14.89,
        },
      ]);

      const result = await service.analyzeSpending({
        userId: 'user_123',
        period: 'monthly',
        month: '2025-10',
      });

      expect(result).toHaveProperty('period');
      expect(result).toHaveProperty('totalSpending');
      expect(result).toHaveProperty('byCategory');
      expect(result).toHaveProperty('insights');
      expect(Array.isArray(result.byCategory)).toBe(true);
    });

    test('should include AI-generated insights', async () => {
      vi.mocked(mockEnv.FINANCIAL_DB.query).mockResolvedValue([]);

      const result = await service.analyzeSpending({
        userId: 'user_123',
        period: 'monthly',
      });

      expect(Array.isArray(result.insights)).toBe(true);
    });

    test('should handle empty transaction history', async () => {
      vi.mocked(mockEnv.FINANCIAL_DB.query).mockResolvedValue([]);

      const result = await service.analyzeSpending({
        userId: 'user_123',
        period: 'weekly',
      });

      expect(result.totalSpending).toBe(0);
      expect(result.byCategory).toEqual([]);
    });
  });

  describe('generatePredictions', () => {
    test('should predict recurring bills', async () => {
      vi.mocked(mockEnv.FINANCIAL_DB.query).mockResolvedValue([
        {
          merchant_name: 'PG&E',
          amount: 85,
          date: '2025-10-15',
          category: 'Utilities',
        },
        {
          merchant_name: 'PG&E',
          amount: 87,
          date: '2025-09-15',
          category: 'Utilities',
        },
      ]);

      const result = await service.generatePredictions({ userId: 'user_123' });

      expect(result).toHaveProperty('predictions');
      expect(Array.isArray(result.predictions)).toBe(true);
      if (result.predictions.length > 0) {
        expect(result.predictions[0]).toHaveProperty('type');
        expect(result.predictions[0]).toHaveProperty('confidence');
      }
    });

    test('should include end-of-month projection', async () => {
      vi.mocked(mockEnv.FINANCIAL_DB.query).mockResolvedValue([
        { date: '2025-11-01', amount: 100 },
        { date: '2025-11-02', amount: 150 },
      ]);

      const result = await service.generatePredictions({ userId: 'user_123' });

      const projections = result.predictions.filter((p) => p.type === 'end_of_month_projection');
      expect(projections.length).toBeGreaterThan(0);
    });
  });

  describe('chatWithFinancialData', () => {
    test('should respond to spending questions', async () => {
      vi.mocked(mockEnv.FINANCIAL_DB.query).mockResolvedValue([
        { category: 'Food and Drink', total: 342.5, count: 23 },
      ]);

      const result = await service.chatWithFinancialData({
        userId: 'user_123',
        message: 'How much did I spend on dining last month?',
      });

      expect(result).toHaveProperty('response');
      expect(result).toHaveProperty('references');
      expect(typeof result.response).toBe('string');
      expect(result.response.length).toBeGreaterThan(0);
    });

    test('should include transaction references', async () => {
      vi.mocked(mockEnv.FINANCIAL_DB.query)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            transaction_id: 'txn_123',
            merchant_name: 'Starbucks',
            amount: 12.5,
            date: '2025-11-07',
          },
        ]);

      const result = await service.chatWithFinancialData({
        userId: 'user_123',
        message: 'Show me coffee purchases',
      });

      expect(Array.isArray(result.references)).toBe(true);
    });

    test('should save chat history', async () => {
      await service.chatWithFinancialData({
        userId: 'user_123',
        message: 'What is my balance?',
      });

      expect(mockEnv.FINANCIAL_DB.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO chat_history'),
        expect.any(Array)
      );
    });

    test('should use previous chat context', async () => {
      vi.mocked(mockEnv.FINANCIAL_DB.query).mockResolvedValueOnce([
        { role: 'user', content: 'Show my spending', created_at: '2025-11-07' },
        { role: 'assistant', content: 'Here is your spending', created_at: '2025-11-07' },
      ]);

      const result = await service.chatWithFinancialData({
        userId: 'user_123',
        message: 'What about last month?',
      });

      expect(result.response).toBeTruthy();
    });
  });

  describe('Error handling', () => {
    test('should handle Claude API errors', async () => {
      vi.spyOn(service as any, 'callClaudeAPI').mockRejectedValue(new Error('API error'));

      await expect(
        service.categorizeTransaction({
          transactionName: 'Test',
          amount: 10,
        })
      ).rejects.toThrow();
      expect(mockEnv.logger.error).toHaveBeenCalled();
    });

    test('should handle rate limiting', async () => {
      vi.spyOn(service as any, 'callClaudeAPI').mockRejectedValue({
        error: { type: 'rate_limit_error' },
      });

      await expect(
        service.chatWithFinancialData({
          userId: 'user_123',
          message: 'test',
        })
      ).rejects.toThrow();
    });
  });
});
