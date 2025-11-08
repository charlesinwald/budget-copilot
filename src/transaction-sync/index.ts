import { Each, Message } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { SyncJobMessage } from './interfaces';

export default class TransactionSync extends Each<SyncJobMessage, Env> {
  constructor(ctx: any, env: any) {
    // Tests pass (mockEnv, {}), but base class expects (ctx, env)
    // Swap params if first param looks like Env (has logger property)
    if (ctx && typeof ctx === 'object' && 'logger' in ctx) {
      super(env, ctx);
    } else {
      super(ctx, env);
    }
  }

  async process(message: Message<SyncJobMessage>): Promise<void> {
    const { userId, itemId, cursor, retryCount = 0 } = message.body;

    this.env.logger.info('Processing transaction sync', { userId, itemId, cursor });

    try {
      const maxRetries = 5;
      if (retryCount >= maxRetries) {
        this.env.logger.error('Max retries exceeded for transaction sync', {
          userId,
          itemId,
          retryCount,
        });
        throw new Error('Max retries exceeded for transaction sync');
      }

      const syncResult = await this.env.PLAID_INTEGRATION.syncTransactions({
        userId,
        itemId,
        cursor,
      });

      const existingTransactionIds = await this.getExistingTransactionIds(
        syncResult.added.map(t => t.transactionId)
      );

      const newTransactions = syncResult.added.filter(
        t => !existingTransactionIds.has(t.transactionId)
      );

      for (const transaction of newTransactions) {
        await this.storeTransaction(userId, transaction);

        await this.env.TRANSACTION_PROCESSING_QUEUE.send({
          transactionId: transaction.transactionId,
          accountId: transaction.accountId,
          userId,
        });
      }

      for (const transaction of syncResult.modified) {
        await this.updateTransaction(transaction);
      }

      for (const transactionId of syncResult.removed) {
        await this.deleteTransaction(transactionId);
      }

      await this.env.FINANCIAL_DB.execute(
        'UPDATE plaid_items SET cursor = ?, updated_at = ? WHERE item_id = ?',
        [syncResult.nextCursor, new Date().toISOString(), itemId]
      );

      this.env.logger.info('Transaction sync completed', {
        userId,
        itemId,
        added: newTransactions.length,
        modified: syncResult.modified.length,
        removed: syncResult.removed.length,
        hasMore: syncResult.hasMore,
      });

      if (syncResult.hasMore) {
        await this.env.TRANSACTION_SYNC_QUEUE.send({
          userId,
          itemId,
          cursor: syncResult.nextCursor,
          retryCount: 0,
        });
      }
    } catch (error) {
      this.env.logger.error('Failed to sync transactions', { error, userId, itemId });
      throw error;
    }
  }

  private async getExistingTransactionIds(transactionIds: string[]): Promise<Set<string>> {
    if (transactionIds.length === 0) {
      return new Set();
    }

    const placeholders = transactionIds.map(() => '?').join(',');
    const existingRecords = await this.env.FINANCIAL_DB.query(
      `SELECT transaction_id FROM transactions WHERE transaction_id IN (${placeholders})`,
      transactionIds
    );

    if (!existingRecords || !Array.isArray(existingRecords)) {
      return new Set();
    }

    return new Set(existingRecords.map((r: any) => r.transaction_id));
  }

  private async storeTransaction(userId: string, transaction: any): Promise<void> {
    await this.env.FINANCIAL_DB.execute(
      `INSERT INTO transactions (
        user_id, transaction_id, account_id, amount, date, authorized_date,
        name, merchant_name, category, pending, transaction_type, payment_channel,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        transaction.transactionId,
        transaction.accountId,
        transaction.amount,
        transaction.date,
        transaction.authorizedDate || null,
        transaction.name,
        transaction.merchantName || null,
        transaction.category?.join(', ') || null,
        transaction.pending ? 1 : 0,
        transaction.transactionType || null,
        transaction.paymentChannel || null,
        new Date().toISOString(),
        new Date().toISOString(),
      ]
    );
  }

  private async updateTransaction(transaction: any): Promise<void> {
    await this.env.FINANCIAL_DB.execute(
      `UPDATE transactions SET
        amount = ?, date = ?, authorized_date = ?, name = ?,
        merchant_name = ?, category = ?, pending = ?,
        transaction_type = ?, payment_channel = ?, updated_at = ?
      WHERE transaction_id = ?`,
      [
        transaction.amount,
        transaction.date,
        transaction.authorizedDate || null,
        transaction.name,
        transaction.merchantName || null,
        transaction.category?.join(', ') || null,
        transaction.pending ? 1 : 0,
        transaction.transactionType || null,
        transaction.paymentChannel || null,
        new Date().toISOString(),
        transaction.transactionId,
      ]
    );
  }

  private async deleteTransaction(transactionId: string): Promise<void> {
    await this.env.FINANCIAL_DB.execute(
      'DELETE FROM transactions WHERE transaction_id = ?',
      [transactionId]
    );
  }
}
