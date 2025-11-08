import { z } from 'zod';

// Request schemas
export const CreateLinkTokenSchema = z.object({
  userId: z.string().min(1),
});

export const ExchangeTokenSchema = z.object({
  publicToken: z.string().min(1),
  userId: z.string().min(1),
  institutionId: z.string().min(1),
  institutionName: z.string().min(1),
});

export const SyncTransactionsSchema = z.object({
  userId: z.string().min(1),
  itemId: z.string().min(1),
});

export const ChatMessageSchema = z.object({
  userId: z.string().min(1),
  message: z.string().min(1).max(2000),
});

// Response types
export interface LinkTokenResponse {
  linkToken: string;
  expiration: string;
}

export interface ExchangeTokenResponse {
  success: boolean;
  itemId: string;
  accounts: Account[];
}

export interface Account {
  accountId: string;
  name: string;
  type: string;
  subtype: string;
  mask: string;
}

export interface AccountsResponse {
  accounts: AccountWithBalance[];
}

export interface AccountWithBalance extends Account {
  id: string;
  officialName?: string;
  currentBalance: number;
  availableBalance: number;
  currencyCode: string;
  institutionName: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  amount: number;
  date: string;
  name: string;
  merchantName?: string;
  category?: string;
  aiCategory?: string;
  aiConfidence?: number;
  pending: boolean;
  transactionType?: string;
  paymentChannel?: string;
}

export interface TransactionsResponse {
  transactions: Transaction[];
  total: number;
  hasMore: boolean;
}

export interface SyncResponse {
  success: boolean;
  added: number;
  modified: number;
  removed: number;
}

export interface ChatResponse {
  response: string;
  references: TransactionReference[];
}

export interface TransactionReference {
  transactionId: string;
  merchantName?: string;
  amount: number;
  date: string;
}

export interface SpendingCategory {
  category: string;
  amount: number;
  percentage: number;
  transactionCount: number;
  avgTransaction: number;
}

export interface MerchantSpending {
  merchantName: string;
  amount: number;
  transactionCount: number;
}

export interface SpendingAnalysisResponse {
  period: string;
  totalSpending: number;
  byCategory: SpendingCategory[];
  topMerchants: MerchantSpending[];
}

export interface Prediction {
  type: string;
  category?: string | null;
  predictedAmount: number;
  predictedDate: string;
  confidence: number;
  merchantName?: string;
}

export interface PredictionsResponse {
  predictions: Prediction[];
}

export interface Alert {
  type: string;
  message: string;
  transactionId?: string;
}

export interface MonthlySpending {
  current: number;
  previous: number;
  percentageChange: number;
}

export interface DashboardResponse {
  totalBalance: number;
  accountsCount: number;
  recentTransactions: Transaction[];
  monthlySpending: MonthlySpending;
  topCategories: SpendingCategory[];
  alerts: Alert[];
}

export interface CategoriesResponse {
  categories: string[];
}

export interface ErrorResponse {
  error: string;
  details?: string;
}
