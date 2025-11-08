export interface PlaidBalances {
  current?: number;
  available?: number;
  isoCurrencyCode?: string;
}

export interface Account {
  id?: string;
  accountId?: string;
  name: string;
  officialName?: string;
  type: string;
  subtype?: string;
  mask?: string;
  balances?: PlaidBalances;
  currentBalance?: number;
  availableBalance?: number;
  currencyCode?: string;
  institutionName?: string;
  lastUpdated?: string;
}

export interface Transaction {
  transaction_id?: string;
  id?: string;
  date: string;
  name: string;
  merchant_name?: string;
  amount: number;
  iso_currency_code?: string;
  unofficial_currency_code?: string;
  category?: string[];
  category_id?: string;
  pending?: boolean;
  account_id?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}


