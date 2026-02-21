export interface ClaudeConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

export interface CategorizationRequest {
  transactionName: string;
  merchantName?: string;
  amount: number;
}

export interface CategorizationResponse {
  category: string;
  confidence: number;
  reasoning?: string;
}

export interface MerchantAnalysisRequest {
  merchantName: string;
  transactionHistory?: Array<{
    name: string;
    amount: number;
    date: string;
  }>;
}

export interface MerchantAnalysisResponse {
  normalizedName: string;
  category: string;
  confidence: number;
}

export interface SpendingAnalysisRequest {
  userId: string;
  period: 'daily' | 'weekly' | 'monthly';
  month?: string;
}

export interface SpendingPattern {
  category: string;
  amount: number;
  percentage: number;
  transactionCount: number;
  avgTransaction: number;
  trend?: 'increasing' | 'decreasing' | 'stable';
}

export interface SpendingAnalysisResponse {
  period: string;
  totalSpending: number;
  byCategory: SpendingPattern[];
  topMerchants: Array<{
    merchantName: string;
    amount: number;
    transactionCount: number;
  }>;
  insights: string[];
}

export interface PredictionRequest {
  userId: string;
}

export interface Prediction {
  type: 'recurring_bill' | 'end_of_month_projection';
  category?: string | null;
  predictedAmount: number;
  predictedDate: string;
  confidence: number;
  merchantName?: string;
  reasoning?: string;
}

export interface PredictionsResponse {
  predictions: Prediction[];
}

export interface ChatRequest {
  userId: string;
  message: string;
  personality?: string;
}

export interface TransactionReference {
  transactionId: string;
  merchantName?: string;
  amount: number;
  date: string;
}

export interface ChatResponse {
  response: string;
  references: TransactionReference[];
}
