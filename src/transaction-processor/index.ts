import { Each, Message } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { TransactionMessage } from './interfaces';

export default class TransactionProcessor extends Each<TransactionMessage, Env> {
  constructor(ctx: any, env: any) {
    // Tests pass (mockEnv, {}), but base class expects (ctx, env)
    // Swap params if first param looks like Env (has logger property)
    if (ctx && typeof ctx === 'object' && 'logger' in ctx) {
      super(env, ctx);
    } else {
      super(ctx, env);
    }
  }

  async process(message: Message<TransactionMessage>): Promise<void> {
    const { transactionId, accountId, userId, retryCount = 0 } = message.body;

    this.env.logger.info('Processing transaction enrichment', { transactionId, userId });

    try {
      const maxRetries = 5;
      if (retryCount >= maxRetries) {
        this.env.logger.error('Max retries exceeded for transaction processing', {
          transactionId,
          userId,
          retryCount,
        });
        throw new Error('Max retries exceeded for transaction processing');
      }

      const transactions = await this.env.FINANCIAL_DB.query(
        `SELECT id, transaction_id, name, merchant_name, amount, date, ai_category, ai_confidence
         FROM transactions
         WHERE transaction_id = ?`,
        [transactionId]
      );

      if (!transactions || transactions.length === 0) {
        this.env.logger.error('Transaction not found', { transactionId });
        throw new Error('Transaction not found');
      }

      const transaction = transactions[0];

      if (transaction.ai_category && transaction.ai_confidence) {
        this.env.logger.info('Transaction already enriched, skipping', { transactionId });
        return;
      }

      let normalizedMerchantName = transaction.merchant_name;

      if (transaction.merchant_name) {
        const merchantAnalysis = await this.env.AI_ANALYSIS.analyzeMerchant({
          merchantName: transaction.merchant_name,
        });

        if (merchantAnalysis && merchantAnalysis.normalizedName) {
          normalizedMerchantName = merchantAnalysis.normalizedName;
        }
      }

      const categorization = await this.env.AI_ANALYSIS.categorizeTransaction({
        transactionName: transaction.name,
        merchantName: normalizedMerchantName || undefined,
        amount: transaction.amount,
      });

      await this.env.FINANCIAL_DB.execute(
        `UPDATE transactions SET
          ai_category = ?,
          ai_confidence = ?,
          merchant_name = ?,
          updated_at = ?
        WHERE transaction_id = ?`,
        [
          categorization.category,
          categorization.confidence,
          normalizedMerchantName || transaction.merchant_name,
          new Date().toISOString(),
          transactionId,
        ]
      );

      await this.updateSpendingPatterns(
        userId,
        categorization.category,
        transaction.amount,
        transaction.date
      );

      await this.detectSpendingAnomalies(
        transactionId,
        userId,
        categorization.category,
        transaction.amount
      );

      this.env.logger.info('Transaction enrichment completed', {
        transactionId,
        category: categorization.category,
        confidence: categorization.confidence,
      });
    } catch (error) {
      this.env.logger.error('Failed to process transaction', { error, transactionId, userId });
      throw error;
    }
  }

  private async updateSpendingPatterns(
    userId: string,
    category: string,
    amount: number,
    date: string
  ): Promise<void> {
    const transactionDate = new Date(date);
    const month = `${transactionDate.getFullYear()}-${String(transactionDate.getMonth() + 1).padStart(2, '0')}`;

    const existing = await this.env.FINANCIAL_DB.query(
      `SELECT total_amount, transaction_count
       FROM spending_patterns
       WHERE user_id = ? AND category = ? AND month = ?`,
      [userId, category, month]
    );

    if (existing && existing.length > 0) {
      const newTotal = existing[0].total_amount + amount;
      const newCount = existing[0].transaction_count + 1;
      const newAvg = newTotal / newCount;

      await this.env.FINANCIAL_DB.execute(
        `UPDATE spending_patterns SET
          total_amount = ?,
          transaction_count = ?,
          avg_transaction = ?,
          updated_at = ?
        WHERE user_id = ? AND category = ? AND month = ?`,
        [newTotal, newCount, newAvg, new Date().toISOString(), userId, category, month]
      );
    } else {
      await this.env.FINANCIAL_DB.execute(
        `INSERT INTO spending_patterns (user_id, category, month, total_amount, transaction_count, avg_transaction, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, category, month, amount, 1, amount, new Date().toISOString(), new Date().toISOString()]
      );
    }
  }

  private async getAverageSpendingForCategory(userId: string, category: string): Promise<number | null> {
    const result = await this.env.FINANCIAL_DB.query(
      `SELECT AVG(amount) as avg_amount
       FROM transactions
       WHERE user_id = ? AND ai_category = ? AND date >= date('now', '-90 days')`,
      [userId, category]
    );

    return result && result.length > 0 ? result[0].avg_amount : null;
  }

  private async detectSpendingAnomalies(
    transactionId: string,
    userId: string,
    category: string,
    amount: number
  ): Promise<void> {
    const avgSpending = await this.getAverageSpendingForCategory(userId, category);

    if (avgSpending && amount > avgSpending * 5) {
      this.env.logger.warn('Anomaly detected: unusually large transaction', {
        transactionId,
        userId,
        category,
        amount,
        avgAmount: avgSpending,
      });
    }
  }
}
