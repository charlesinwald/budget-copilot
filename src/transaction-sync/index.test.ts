import { describe, test, expect, vi, beforeEach } from 'vitest';
import TransactionSync from './index';
import { Env } from './raindrop.gen';
import { Message } from '@liquidmetal-ai/raindrop-framework';
import { SyncJobMessage } from './interfaces';

describe('TransactionSync Observer', () => {
  let observer: TransactionSync;
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
        syncTransactions: vi.fn(),
      },
      FINANCIAL_DB: {
        query: vi.fn(),
        execute: vi.fn(),
      },
      TRANSACTION_PROCESSING_QUEUE: {
        send: vi.fn(),
      },
    } as unknown as Env;

    observer = new TransactionSync(mockEnv, {});
  });

  describe('process', () => {
    test('should process sync job message', async () => {
      const message: Message<SyncJobMessage> = {
        id: 'msg_123',
        timestamp: new Date(),
        body: {
          userId: 'user_123',
          itemId: 'item_abc',
        },
        attempts: 0,
      } as Message<SyncJobMessage>;

      vi.mocked(mockEnv.PLAID_INTEGRATION.syncTransactions).mockResolvedValue({
        added: [{ transactionId: 'txn_1', accountId: 'acc_1', amount: 10, date: '2025-11-01' }],
        modified: [],
        removed: [],
        nextCursor: 'cursor_new',
        hasMore: false,
      });

      await observer.process(message);

      expect(mockEnv.PLAID_INTEGRATION.syncTransactions).toHaveBeenCalledWith({
        userId: 'user_123',
        itemId: 'item_abc',
        cursor: undefined,
      });
      expect(mockEnv.logger.info).toHaveBeenCalled();
    });

    test('should store new transactions in database', async () => {
      const message: Message<SyncJobMessage> = {
        id: 'msg_123',
        timestamp: new Date(),
        body: {
          userId: 'user_123',
          itemId: 'item_abc',
        },
        attempts: 0,
      } as Message<SyncJobMessage>;

      vi.mocked(mockEnv.PLAID_INTEGRATION.syncTransactions).mockResolvedValue({
        added: [
          { transactionId: 'txn_1', accountId: 'acc_1', amount: 10, date: '2025-11-01', name: 'Test', pending: false },
        ],
        modified: [],
        removed: [],
        nextCursor: 'cursor_new',
        hasMore: false,
      });

      await observer.process(message);

      expect(mockEnv.FINANCIAL_DB.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT'),
        expect.any(Array)
      );
    });

    test('should update cursor after successful sync', async () => {
      const message: Message<SyncJobMessage> = {
        id: 'msg_123',
        timestamp: new Date(),
        body: {
          userId: 'user_123',
          itemId: 'item_abc',
          cursor: 'old_cursor',
        },
        attempts: 0,
      } as Message<SyncJobMessage>;

      vi.mocked(mockEnv.PLAID_INTEGRATION.syncTransactions).mockResolvedValue({
        added: [],
        modified: [],
        removed: [],
        nextCursor: 'new_cursor',
        hasMore: false,
      });

      await observer.process(message);

      expect(mockEnv.FINANCIAL_DB.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE plaid_items'),
        expect.arrayContaining(['new_cursor'])
      );
    });

    test('should handle pagination with hasMore flag', async () => {
      const message: Message<SyncJobMessage> = {
        id: 'msg_123',
        timestamp: new Date(),
        body: {
          userId: 'user_123',
          itemId: 'item_abc',
        },
        attempts: 0,
      } as Message<SyncJobMessage>;

      vi.mocked(mockEnv.PLAID_INTEGRATION.syncTransactions).mockResolvedValue({
        added: [],
        modified: [],
        removed: [],
        nextCursor: 'cursor_page2',
        hasMore: true,
      });

      await observer.process(message);

      // Should re-queue for next page
      expect(mockEnv.TRANSACTION_SYNC_QUEUE.send).toHaveBeenCalledWith({
        userId: 'user_123',
        itemId: 'item_abc',
        cursor: 'cursor_page2',
        retryCount: 0,
      });
    });

    test('should notify transaction processor for new transactions', async () => {
      const message: Message<SyncJobMessage> = {
        id: 'msg_123',
        timestamp: new Date(),
        body: {
          userId: 'user_123',
          itemId: 'item_abc',
        },
        attempts: 0,
      } as Message<SyncJobMessage>;

      vi.mocked(mockEnv.PLAID_INTEGRATION.syncTransactions).mockResolvedValue({
        added: [
          { transactionId: 'txn_1', accountId: 'acc_1', amount: 10, date: '2025-11-01' },
          { transactionId: 'txn_2', accountId: 'acc_1', amount: 20, date: '2025-11-02' },
        ],
        modified: [],
        removed: [],
        nextCursor: 'cursor',
        hasMore: false,
      });

      await observer.process(message);

      expect(mockEnv.TRANSACTION_PROCESSING_QUEUE.send).toHaveBeenCalled();
    });

    test('should prevent duplicate transactions', async () => {
      const message: Message<SyncJobMessage> = {
        id: 'msg_123',
        timestamp: new Date(),
        body: {
          userId: 'user_123',
          itemId: 'item_abc',
        },
        attempts: 0,
      } as Message<SyncJobMessage>;

      vi.mocked(mockEnv.FINANCIAL_DB.query).mockResolvedValue([
        { transaction_id: 'txn_1' },
      ]);

      vi.mocked(mockEnv.PLAID_INTEGRATION.syncTransactions).mockResolvedValue({
        added: [
          { transactionId: 'txn_1', accountId: 'acc_1', amount: 10, date: '2025-11-01' },
        ],
        modified: [],
        removed: [],
        nextCursor: 'cursor',
        hasMore: false,
      });

      await observer.process(message);

      // Should not insert duplicate
      const insertCalls = vi.mocked(mockEnv.FINANCIAL_DB.execute).mock.calls.filter(
        call => call[0].includes('INSERT')
      );
      expect(insertCalls.length).toBe(0);
    });

    test('should handle modified transactions', async () => {
      const message: Message<SyncJobMessage> = {
        id: 'msg_123',
        timestamp: new Date(),
        body: {
          userId: 'user_123',
          itemId: 'item_abc',
        },
        attempts: 0,
      } as Message<SyncJobMessage>;

      vi.mocked(mockEnv.PLAID_INTEGRATION.syncTransactions).mockResolvedValue({
        added: [],
        modified: [
          { transactionId: 'txn_1', accountId: 'acc_1', amount: 15, date: '2025-11-01' },
        ],
        removed: [],
        nextCursor: 'cursor',
        hasMore: false,
      });

      await observer.process(message);

      expect(mockEnv.FINANCIAL_DB.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE transactions'),
        expect.any(Array)
      );
    });

    test('should handle removed transactions', async () => {
      const message: Message<SyncJobMessage> = {
        id: 'msg_123',
        timestamp: new Date(),
        body: {
          userId: 'user_123',
          itemId: 'item_abc',
        },
        attempts: 0,
      } as Message<SyncJobMessage>;

      vi.mocked(mockEnv.PLAID_INTEGRATION.syncTransactions).mockResolvedValue({
        added: [],
        modified: [],
        removed: ['txn_deleted'],
        nextCursor: 'cursor',
        hasMore: false,
      });

      await observer.process(message);

      expect(mockEnv.FINANCIAL_DB.execute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM transactions'),
        expect.arrayContaining(['txn_deleted'])
      );
    });
  });

  describe('Error handling', () => {
    test('should retry on transient errors', async () => {
      const message: Message<SyncJobMessage> = {
        id: 'msg_123',
        timestamp: new Date(),
        body: {
          userId: 'user_123',
          itemId: 'item_abc',
          retryCount: 0,
        },
        attempts: 0,
      } as Message<SyncJobMessage>;

      vi.mocked(mockEnv.PLAID_INTEGRATION.syncTransactions).mockRejectedValue(
        new Error('Temporary error')
      );

      await expect(observer.process(message)).rejects.toThrow();
      expect(mockEnv.logger.error).toHaveBeenCalled();
    });

    test('should not retry after max attempts', async () => {
      const message: Message<SyncJobMessage> = {
        id: 'msg_123',
        timestamp: new Date(),
        body: {
          userId: 'user_123',
          itemId: 'item_abc',
          retryCount: 5,
        },
        attempts: 5,
      } as Message<SyncJobMessage>;

      vi.mocked(mockEnv.PLAID_INTEGRATION.syncTransactions).mockRejectedValue(
        new Error('Permanent error')
      );

      await expect(observer.process(message)).rejects.toThrow();
      expect(mockEnv.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Max retries'),
        expect.any(Object)
      );
    });
  });
});
