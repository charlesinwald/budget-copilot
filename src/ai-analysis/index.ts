import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen.js';
import {
  CategorizationRequest,
  CategorizationResponse,
  MerchantAnalysisRequest,
  MerchantAnalysisResponse,
  SpendingAnalysisRequest,
  SpendingAnalysisResponse,
  PredictionRequest,
  PredictionsResponse,
  ChatRequest,
  ChatResponse,
  Prediction,
} from './interfaces.js';

export default class AiAnalysis extends Service<Env> {
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

  async categorizeTransaction(request: CategorizationRequest): Promise<CategorizationResponse> {
    if (request.amount < 0) {
      throw new Error('Amount must be positive');
    }

    this.env.logger.info('Categorizing transaction', {
      transactionName: request.transactionName,
      merchantName: request.merchantName,
    });

    try {
      const prompt = this.buildCategorizationPrompt(request);
      const result = await this.callClaudeAPI(prompt);

      const category = this.extractCategoryFromResponse(result, request);
      const confidence = this.calculateConfidence(request, category);

      return {
        category,
        confidence,
      };
    } catch (error) {
      this.env.logger.error('Failed to categorize transaction', { error });
      throw error;
    }
  }

  async analyzeMerchant(request: MerchantAnalysisRequest): Promise<MerchantAnalysisResponse> {
    const normalizedName = this.normalizeMerchantName(request.merchantName);

    const category = this.inferCategoryFromMerchant(normalizedName, request.transactionHistory);
    const confidence = request.transactionHistory && request.transactionHistory.length > 0 ? 0.85 : 0.65;

    return {
      normalizedName,
      category,
      confidence,
    };
  }

  async analyzeSpending(request: SpendingAnalysisRequest): Promise<SpendingAnalysisResponse> {
    this.env.logger.info('Analyzing spending', {
      userId: request.userId,
      period: request.period,
    });

    const dateRange = this.getDateRange(request.period, request.month);

    const [spendingData, merchantData] = await Promise.all([
      this.fetchSpendingByCategory(request.userId, dateRange),
      this.fetchTopMerchants(request.userId, dateRange),
    ]);

    const totalSpending = this.calculateTotalSpending(spendingData);
    const byCategory = this.mapCategoryData(spendingData, totalSpending);
    const topMerchants = this.mapMerchantData(merchantData);
    const insights = this.generateInsights(byCategory, totalSpending, request.period);

    return {
      period: request.period,
      totalSpending,
      byCategory,
      topMerchants,
      insights,
    };
  }

  private async fetchSpendingByCategory(
    userId: string,
    dateRange: { start: string; end: string }
  ): Promise<any[]> {
    return await this.env.FINANCIAL_DB.query(
      `SELECT ai_category as category, SUM(amount) as total_amount, COUNT(*) as transaction_count, AVG(amount) as avg_transaction
       FROM transactions
       WHERE user_id = ? AND date >= ? AND date <= ? AND ai_category IS NOT NULL
       GROUP BY ai_category`,
      [userId, dateRange.start, dateRange.end]
    );
  }

  private async fetchTopMerchants(
    userId: string,
    dateRange: { start: string; end: string }
  ): Promise<any[]> {
    return await this.env.FINANCIAL_DB.query(
      `SELECT merchant_name, SUM(amount) as total_amount, COUNT(*) as transaction_count
       FROM transactions
       WHERE user_id = ? AND date >= ? AND date <= ? AND merchant_name IS NOT NULL
       GROUP BY merchant_name
       ORDER BY total_amount DESC
       LIMIT 10`,
      [userId, dateRange.start, dateRange.end]
    );
  }

  private calculateTotalSpending(spendingData: any[]): number {
    return spendingData.reduce((sum: number, row: any) => sum + (row.total_amount || 0), 0);
  }

  private mapCategoryData(spendingData: any[], totalSpending: number): any[] {
    return spendingData.map((row: any) => ({
      category: row.category,
      amount: row.total_amount || 0,
      percentage: totalSpending > 0 ? (row.total_amount / totalSpending) * 100 : 0,
      transactionCount: row.transaction_count || 0,
      avgTransaction: row.avg_transaction || 0,
    }));
  }

  private mapMerchantData(merchantData: any[]): any[] {
    return merchantData.map((row: any) => ({
      merchantName: row.merchant_name,
      amount: row.total_amount || 0,
      transactionCount: row.transaction_count || 0,
    }));
  }

  async generatePredictions(request: PredictionRequest): Promise<PredictionsResponse> {
    const predictions: Prediction[] = [];

    const recurringTransactions = await this.env.FINANCIAL_DB.query(
      `SELECT merchant_name, category, AVG(amount) as avg_amount, COUNT(*) as count
       FROM transactions
       WHERE user_id = ? AND date >= date('now', '-90 days')
       GROUP BY merchant_name
       HAVING count >= 2
       ORDER BY count DESC`,
      [request.userId]
    );

    for (const row of recurringTransactions) {
      predictions.push({
        type: 'recurring_bill',
        category: row.category || null,
        predictedAmount: row.avg_amount || 0,
        predictedDate: this.predictNextBillDate(row.merchant_name),
        confidence: Math.min(0.9, row.count / 10),
        merchantName: row.merchant_name,
      });
    }

    const currentMonthSpending = await this.env.FINANCIAL_DB.query(
      `SELECT SUM(amount) as total
       FROM transactions
       WHERE user_id = ? AND date >= date('now', 'start of month')`,
      [request.userId]
    );

    const currentTotal = currentMonthSpending[0]?.total || 0;
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const daysElapsed = new Date().getDate();
    const projectedEndOfMonth = (currentTotal / daysElapsed) * daysInMonth;

    predictions.push({
      type: 'end_of_month_projection',
      category: null,
      predictedAmount: projectedEndOfMonth,
      predictedDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
      confidence: Math.min(0.8, daysElapsed / daysInMonth),
    });

    return {
      predictions,
    };
  }

  async chatWithFinancialData(request: ChatRequest): Promise<ChatResponse> {
    this.env.logger.info('Processing chat message', {
      userId: request.userId,
      messageLength: request.message.length,
    });

    const chatHistory = await this.env.FINANCIAL_DB.query(
      `SELECT role, content, created_at
       FROM chat_history
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 10`,
      [request.userId]
    );

    const financialContext = await this.getFinancialContext(request.userId);

    const prompt = this.buildChatPrompt(request.message, chatHistory.reverse(), financialContext, request.personality);
    const response = this.env.ANTHROPIC_API_KEY
      ? await this.callClaudeAPI(prompt)
      : 'Here is a mock response based on your recent activity.';

    await this.env.FINANCIAL_DB.execute(
      'INSERT INTO chat_history (user_id, role, content, created_at) VALUES (?, ?, ?, ?)',
      [request.userId, 'user', request.message, new Date().toISOString()]
    );

    await this.env.FINANCIAL_DB.execute(
      'INSERT INTO chat_history (user_id, role, content, created_at) VALUES (?, ?, ?, ?)',
      [request.userId, 'assistant', response, new Date().toISOString()]
    );

    const references = await this.extractTransactionReferences(request.userId, request.message);

    return {
      response,
      references,
    };
  }

  private async callClaudeAPI(prompt: string): Promise<string> {
    const primaryModel = ((this.env as any).ANTHROPIC_MODEL as string) || 'claude-3-5-sonnet-latest';
    let response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: primaryModel,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      let errText = '';
      try { errText = await response.text(); } catch {}
      // If model not found, try fallback model
      if (response.status === 404 || (errText.includes('not_found_error') && errText.includes('model'))) {
        const fallbackModel = 'claude-3-5-haiku-latest';
        response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: fallbackModel,
            max_tokens: 1024,
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
          }),
        });
        if (!response.ok) {
          const error2 = await response.text().catch(() => '');
          throw new Error(`Claude API error (fallback): ${error2}`);
        }
      } else {
        throw new Error(`Claude API error: ${errText}`);
      }
    }

    const result = await response.json() as { content?: Array<{ text?: string }> };
    return (result.content && result.content[0] && result.content[0].text) || '';
  }

  private buildCategorizationPrompt(request: CategorizationRequest): string {
    return `Categorize this transaction into one of these categories: Food and Drink, Shopping, Transportation, Entertainment, Bills and Utilities, Healthcare, Travel, Personal Care, Education, Investments, Income, Transfer, Other.

Transaction: ${request.transactionName}
${request.merchantName ? `Merchant: ${request.merchantName}` : ''}
Amount: $${request.amount}

Respond with only the category name.`;
  }

  private extractCategoryFromResponse(response: string, request: CategorizationRequest): string {
    const categories = [
      'Food and Drink',
      'Shopping',
      'Transportation',
      'Entertainment',
      'Bills and Utilities',
      'Healthcare',
      'Travel',
      'Personal Care',
      'Education',
      'Investments',
      'Income',
      'Transfer',
      'Other',
    ];

    for (const category of categories) {
      if (response.toLowerCase().includes(category.toLowerCase())) {
        return category;
      }
    }

    const transactionName = request.transactionName.toLowerCase();
    const merchantName = request.merchantName?.toLowerCase() || '';

    if (transactionName.includes('starbucks') || merchantName.includes('starbucks') || transactionName.includes('coffee')) {
      return 'Food and Drink';
    }
    if (transactionName.includes('amazon') || merchantName.includes('amazon')) {
      return 'Shopping';
    }
    if (transactionName.includes('uber') || transactionName.includes('lyft')) {
      return 'Transportation';
    }

    return 'Other';
  }

  private calculateConfidence(request: CategorizationRequest, category: string): number {
    let confidence = 0.7;

    if (request.merchantName) {
      confidence += 0.2;
    }

    const knownMerchants = ['starbucks', 'amazon', 'uber', 'netflix', 'spotify'];
    const merchantLower = (request.merchantName || request.transactionName).toLowerCase();

    if (knownMerchants.some(m => merchantLower.includes(m))) {
      confidence += 0.1;
    }

    return Math.min(1.0, confidence);
  }

  private normalizeMerchantName(merchantName: string): string {
    let normalized = merchantName.toUpperCase();

    normalized = normalized.replace(/^AMZN\*/, '');
    normalized = normalized.replace(/\.COM$/, '');
    normalized = normalized.replace(/[#*]/g, '');
    normalized = normalized.trim();

    if (normalized.includes('AMAZON')) {
      return 'Amazon';
    }
    if (normalized.includes('STARBUCKS')) {
      return 'Starbucks';
    }
    if (normalized.includes('UBER')) {
      return 'Uber';
    }

    return normalized.charAt(0) + normalized.slice(1).toLowerCase();
  }

  private inferCategoryFromMerchant(merchantName: string, history?: Array<{ name: string; amount: number; date: string }>): string {
    const lowerMerchant = merchantName.toLowerCase();

    if (lowerMerchant.includes('amazon') || lowerMerchant.includes('walmart') || lowerMerchant.includes('target')) {
      return 'Shopping';
    }
    if (lowerMerchant.includes('starbucks') || lowerMerchant.includes('coffee') || lowerMerchant.includes('restaurant')) {
      return 'Food and Drink';
    }
    if (lowerMerchant.includes('uber') || lowerMerchant.includes('lyft')) {
      return 'Transportation';
    }
    if (lowerMerchant.includes('netflix') || lowerMerchant.includes('spotify') || lowerMerchant.includes('hulu')) {
      return 'Entertainment';
    }

    return 'Other';
  }

  private getDateRange(period: string, month?: string): { start: string; end: string } {
    const now = new Date();

    if (period === 'monthly') {
      if (month) {
        const [year, monthNum] = month.split('-');
        const start = `${year}-${monthNum}-01`;
        const end = new Date(parseInt(year), parseInt(monthNum), 0).toISOString().split('T')[0];
        return { start, end };
      }
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      return { start, end };
    }

    if (period === 'weekly') {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const end = now.toISOString().split('T')[0];
      return { start, end };
    }

    const start = now.toISOString().split('T')[0];
    const end = now.toISOString().split('T')[0];
    return { start, end };
  }

  private generateInsights(byCategory: any[], totalSpending: number, period: string): string[] {
    const insights: string[] = [];

    if (totalSpending > 0) {
      insights.push(`Total spending for this ${period} period: $${totalSpending.toFixed(2)}`);
    }

    if (byCategory.length > 0) {
      const topCategory = byCategory[0];
      insights.push(`Your largest spending category is ${topCategory.category} at $${topCategory.amount.toFixed(2)}`);
    }

    return insights;
  }

  private predictNextBillDate(merchantName: string): string {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 15);
    return nextMonth.toISOString().split('T')[0];
  }

  private buildChatPrompt(message: string, chatHistory: any[], financialContext: string, personality: string = 'friendly'): string {
    const historyText = chatHistory.map((h: any) => `${h.role}: ${h.content}`).join('\n');

    const personalityMap: Record<string, string> = {
      friendly: 'You are a friendly and warm financial assistant. Be approachable, use encouraging language, and show empathy.',
      grumpy: 'You are a grumpy financial assistant. Be direct, slightly sarcastic, and don\'t sugarcoat things. Use a bit of tough love but still be helpful.',
      professional: 'You are a professional financial advisor. Be formal, precise, and use financial terminology appropriately. Maintain a business-like tone.',
      casual: 'You are a casual financial assistant. Be relaxed, use everyday language, and keep things simple and easy to understand.',
      enthusiastic: 'You are an enthusiastic financial assistant. Be energetic, positive, and use exclamation marks sparingly. Show excitement about helping with finances!'
    };
    const personalityInstructions = personalityMap[personality] || personalityMap.friendly;

    return `${personalityInstructions} Answer the user's question based on their financial data.

${financialContext}

${historyText ? `Previous conversation:\n${historyText}\n` : ''}

User: ${message}

Respond naturally and helpfully.`;
  }

  private async getFinancialContext(userId: string): Promise<string> {
    const recentTransactions = await this.env.FINANCIAL_DB.query(
      `SELECT merchant_name, amount, date, ai_category
       FROM transactions
       WHERE user_id = ?
       ORDER BY date DESC
       LIMIT 20`,
      [userId]
    );

    const totalSpending = await this.env.FINANCIAL_DB.query(
      `SELECT SUM(amount) as total
       FROM transactions
       WHERE user_id = ? AND date >= date('now', 'start of month')`,
      [userId]
    );

    return `Recent transactions: ${JSON.stringify(recentTransactions)}
Total spending this month: $${totalSpending[0]?.total || 0}`;
  }

  private async extractTransactionReferences(userId: string, message: string): Promise<Array<{ transactionId: string; merchantName?: string; amount: number; date: string }>> {
    const transactions = await this.env.FINANCIAL_DB.query(
      `SELECT transaction_id, merchant_name, amount, date
       FROM transactions
       WHERE user_id = ?
       ORDER BY date DESC
       LIMIT 5`,
      [userId]
    );

    return transactions.map((t: any) => ({
      transactionId: t.transaction_id,
      merchantName: t.merchant_name,
      amount: t.amount,
      date: t.date,
    }));
  }
}
