/**
 * Mock Mode Helper Functions
 *
 * These helpers enable testing AI features with mock Plaid data.
 * When using mock mode, this will:
 * - Generate realistic test transactions
 * - Process them through the REAL Anthropic AI
 * - Return categorized results
 */

import { Env } from './raindrop.gen.js';

/**
 * Process mock transactions through AI categorization
 * This endpoint can be called after mock Plaid connection to categorize transactions
 */
export async function processMockTransactions(env: Env, userId: string): Promise<any> {
  env.logger.info('Processing mock transactions with AI', { userId });

  try {
    // Get all uncategorized transactions for the user
    const transactions = await env.FINANCIAL_DB.query(
      'SELECT transaction_id, name, merchant_name, amount, date FROM transactions WHERE user_id = ? AND ai_category IS NULL',
      [userId]
    );

    env.logger.info(`Found ${transactions.length} transactions to categorize`);

    // Categorize each transaction using REAL Anthropic AI
    const results = [];
    for (const transaction of transactions) {
      try {
        const categorization = await env.AI_ANALYSIS.categorizeTransaction({
          transactionName: transaction.name,
          merchantName: transaction.merchant_name,
          amount: transaction.amount,
        });

        // Update transaction with AI categorization
        await env.FINANCIAL_DB.execute(
          'UPDATE transactions SET ai_category = ?, ai_confidence = ?, updated_at = ? WHERE transaction_id = ?',
          [categorization.category, categorization.confidence, new Date().toISOString(), transaction.transaction_id]
        );

        results.push({
          transaction_id: transaction.transaction_id,
          name: transaction.name,
          category: categorization.category,
          confidence: categorization.confidence,
        });

        env.logger.info(`✅ Categorized: ${transaction.name} → ${categorization.category}`);
      } catch (error) {
        env.logger.error('Failed to categorize transaction', { transaction, error });
      }
    }

    return {
      success: true,
      processed: results.length,
      results,
    };
  } catch (error) {
    env.logger.error('Failed to process mock transactions', { error });
    throw error;
  }
}

/**
 * Get mock accounts for a user
 */
export async function getMockAccounts(userId: string): Promise<any[]> {
  return [
    {
      id: `mock_acc_${userId}`,
      accountId: `mock_acc_${userId}`,
      name: 'Mock Checking Account',
      type: 'depository',
      subtype: 'checking',
      mask: '0000',
      currentBalance: 1500.00,
      availableBalance: 1500.00,
      currencyCode: 'USD',
      institutionName: 'Mock Bank (AI Testing)',
    },
  ];
}
