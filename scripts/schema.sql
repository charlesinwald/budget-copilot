-- Budget Copilot Database Schema
-- SQLite/D1 Database for Raindrop

-- Plaid Items (Connected Bank Accounts)
CREATE TABLE IF NOT EXISTS plaid_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  item_id TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  institution_id TEXT NOT NULL,
  institution_name TEXT,
  cursor TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_plaid_items_user_id ON plaid_items(user_id);
CREATE INDEX IF NOT EXISTS idx_plaid_items_item_id ON plaid_items(item_id);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL UNIQUE,
  account_id TEXT NOT NULL,
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  authorized_date TEXT,
  name TEXT,
  merchant_name TEXT,
  category TEXT,
  pending INTEGER DEFAULT 0,
  transaction_type TEXT,
  payment_channel TEXT,
  ai_category TEXT,
  ai_confidence REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_transaction_id ON transactions(transaction_id);

-- Spending Patterns (Aggregated Data)
CREATE TABLE IF NOT EXISTS spending_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  category TEXT NOT NULL,
  month TEXT NOT NULL,
  total_amount REAL NOT NULL,
  transaction_count INTEGER NOT NULL,
  avg_transaction REAL NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, category, month)
);

CREATE INDEX IF NOT EXISTS idx_spending_patterns_user_id ON spending_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_spending_patterns_month ON spending_patterns(month);

-- Chat History
CREATE TABLE IF NOT EXISTS chat_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_created_at ON chat_history(created_at);

-- User Sessions
CREATE TABLE IF NOT EXISTS user_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  data TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

-- Users (Basic user information)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL UNIQUE,
  email TEXT,
  name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
