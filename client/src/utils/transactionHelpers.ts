import { Account, Transaction } from '../types';
import { toISOUTCDateString } from './formatters';

export function categorizeTransactions(transactions: Transaction[]): Record<string, Transaction[]> {
  return transactions.reduce<Record<string, Transaction[]>>((acc, tx) => {
    const key = (tx.category && tx.category[0]) || 'Uncategorized';
    if (!acc[key]) acc[key] = [];
    acc[key].push(tx);
    return acc;
  }, {});
}

export function getTopCategories(transactions: Transaction[], topN: number = 7): Array<{ category: string; amount: number }> {
  const byCat = new Map<string, number>();
  for (const tx of transactions) {
    const isExpense = tx.amount < 0;
    if (!isExpense) continue;
    const key = (tx.category && tx.category[0]) || 'Uncategorized';
    byCat.set(key, (byCat.get(key) || 0) + Math.abs(tx.amount));
  }
  const sorted = Array.from(byCat.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
  return sorted.slice(0, topN);
}

export function calculateDailySpending(transactions: Transaction[], days: number = 30): Array<{ date: string; amount: number }> {
  const today = new Date();
  const start = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
  const totals = new Map<string, number>();
  // seed date keys
  for (let i = 0; i <= days; i++) {
    const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const key = toISOUTCDateString(d);
    totals.set(key, 0);
  }
  for (const tx of transactions) {
    const key = tx.date;
    if (totals.has(key)) {
      const isExpense = tx.amount < 0;
      if (isExpense) {
        totals.set(key, (totals.get(key) || 0) + Math.abs(tx.amount));
      }
    }
  }
  return Array.from(totals.entries())
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function getTopMerchants(transactions: Transaction[], topN: number = 10): Array<{ merchant: string; amount: number; count: number }> {
  const byMerchant = new Map<string, { amount: number; count: number }>();
  for (const tx of transactions) {
    const isExpense = tx.amount < 0;
    if (!isExpense) continue;
    const key = tx.merchant_name || tx.name || 'Unknown';
    const entry = byMerchant.get(key) || { amount: 0, count: 0 };
    entry.amount += Math.abs(tx.amount);
    entry.count += 1;
    byMerchant.set(key, entry);
  }
  return Array.from(byMerchant.entries())
    .map(([merchant, data]) => ({ merchant, ...data }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, topN);
}

export function getSummaryStats(transactions: Transaction[]): {
  totalSpending: number;
  averageDailySpending: number;
  largestTransaction: number;
  numTransactions: number;
} {
  let totalSpending = 0;
  let largest = 0;
  for (const tx of transactions) {
    if (tx.amount < 0) {
      const abs = Math.abs(tx.amount);
      totalSpending += abs;
      if (abs > largest) largest = abs;
    }
  }
  const uniqueDates = new Set(transactions.map(t => t.date));
  const averageDailySpending = uniqueDates.size ? totalSpending / uniqueDates.size : 0;
  return {
    totalSpending,
    averageDailySpending,
    largestTransaction: largest,
    numTransactions: transactions.length
  };
}

export function generateMockTransactions(days: number = 30): Transaction[] {
  const categories = [
    ['Groceries'],
    ['Dining'],
    ['Transport'],
    ['Entertainment'],
    ['Utilities'],
    ['Shopping'],
  ];
  const merchants = {
    Groceries: ['Whole Foods', 'Trader Joe\'s', 'Safeway'],
    Dining: ['Chipotle', 'McDonald\'s', 'Starbucks'],
    Transport: ['Uber', 'Lyft', 'Shell'],
    Entertainment: ['Netflix', 'Steam', 'AMC Theatres'],
    Utilities: ['PG&E', 'Comcast', 'AT&T'],
    Shopping: ['Amazon', 'Target', 'Walmart'],
  } as Record<string, string[]>;

  const today = new Date();
  const out: Transaction[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const date = toISOUTCDateString(d);
    const numTx = Math.floor(Math.random() * 3) + 1;
    for (let j = 0; j < numTx; j++) {
      const cat = categories[Math.floor(Math.random() * categories.length)][0];
      const merchantList = merchants[cat] || ['Unknown'];
      const merchant = merchantList[Math.floor(Math.random() * merchantList.length)];
      const amount = -1 * (Math.random() * 195 + 5); // -$5 to -$200
      out.push({
        id: `${date}-${i}-${j}`,
        date,
        name: merchant,
        merchant_name: merchant,
        amount: parseFloat(amount.toFixed(2)),
        iso_currency_code: 'USD',
        category: [cat]
      });
    }
  }
  // Add some income entries
  out.push({
    id: 'income-1',
    date: toISOUTCDateString(today),
    name: 'ACME Corp Payroll',
    merchant_name: 'ACME Corp',
    amount: 2500,
    iso_currency_code: 'USD',
    category: ['Income']
  });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function buildChatContext(message: string, transactions: Transaction[], accounts: Account[]) {
  return {
    message,
    context: {
      accounts: accounts.map(acc => ({
        name: acc.name,
        balance: acc.balances?.current ?? acc.currentBalance ?? 0,
        type: acc.type
      })),
      transactions: transactions.slice(-100),
      summary: getSummaryStats(transactions),
      topCategories: getTopCategories(transactions)
    }
  };
}


