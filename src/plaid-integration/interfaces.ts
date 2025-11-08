export interface PlaidConfig {
  clientId: string;
  secret: string;
  environment: 'sandbox' | 'development' | 'production';
}

export interface LinkTokenRequest {
  userId: string;
  clientName?: string;
  products?: string[];
  countryCodes?: string[];
  language?: string;
}

export interface LinkTokenResponse {
  linkToken: string;
  expiration: string;
  requestId: string;
}

export interface ExchangeTokenRequest {
  publicToken: string;
  userId: string;
  institutionId: string;
  institutionName: string;
}

export interface PlaidAccount {
  accountId: string;
  name: string;
  type: string;
  subtype: string;
  mask: string;
  balances?: {
    current: number;
    available: number;
    limit?: number;
    isoCurrencyCode: string;
  };
}

export interface ExchangeTokenResponse {
  accessToken: string;
  itemId: string;
  accounts: PlaidAccount[];
}

export interface GetAccountsRequest {
  userId: string;
}

export interface AccountBalance {
  accountId: string;
  name: string;
  officialName?: string;
  type: string;
  subtype: string;
  mask: string;
  currentBalance: number;
  availableBalance: number;
  currencyCode: string;
  institutionName: string;
}

export interface GetTransactionsRequest {
  userId: string;
  accountId?: string;
  startDate?: string;
  endDate?: string;
  count?: number;
  offset?: number;
}

export interface PlaidTransaction {
  transactionId: string;
  accountId: string;
  amount: number;
  date: string;
  authorizedDate?: string;
  name: string;
  merchantName?: string;
  category?: string[];
  pending: boolean;
  transactionType?: string;
  paymentChannel?: string;
}

export interface GetTransactionsResponse {
  transactions: PlaidTransaction[];
  total: number;
  hasMore: boolean;
}

export interface SyncTransactionsRequest {
  userId: string;
  itemId: string;
  cursor?: string;
}

export interface SyncTransactionsResponse {
  added: PlaidTransaction[];
  modified: PlaidTransaction[];
  removed: string[];
  nextCursor: string;
  hasMore: boolean;
}

export interface PlaidError {
  errorType: string;
  errorCode: string;
  errorMessage: string;
  displayMessage?: string;
}

export interface StoredPlaidItem {
  id: string;
  userId: string;
  accessToken: string;
  itemId: string;
  institutionId?: string;
  institutionName?: string;
  cursor?: string;
  createdAt: string;
  updatedAt: string;
}
