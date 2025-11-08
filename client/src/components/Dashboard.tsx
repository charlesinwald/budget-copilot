import { useMemo } from 'react';
import { Account, Transaction } from '../types';
import AccountCard from './AccountCard';
import CategoryChart from './CategoryChart';
import SpendingTrendChart from './SpendingTrendChart';
import TransactionList from './TransactionList';
import { formatCurrency } from '../utils/formatters';
import { getSummaryStats } from '../utils/transactionHelpers';

interface DashboardProps {
  accounts: Account[];
  transactions: Transaction[];
  isLoadingAccounts: boolean;
  isLoadingTransactions: boolean;
}

export default function Dashboard({
  accounts,
  transactions,
  isLoadingAccounts,
  isLoadingTransactions
}: DashboardProps) {
  const stats = useMemo(() => getSummaryStats(transactions), [transactions]);
  const totalBalance = useMemo(
    () =>
      accounts.reduce((sum, acc) => {
        const bal = acc.currentBalance ?? acc.balances?.current ?? 0;
        return sum + bal;
      }, 0),
    [accounts]
  );

  return (
    <div className="flex-1">
      <div className="max-w-[1400px] mx-auto p-4 lg:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="card">
            <div className="text-slate-500 text-sm">Total Balance</div>
            <div className="text-2xl font-bold font-mono">{formatCurrency(totalBalance)}</div>
          </div>
          <div className="card">
            <div className="text-slate-500 text-sm">Total Spending (30d)</div>
            <div className="text-2xl font-bold font-mono">{formatCurrency(stats.totalSpending)}</div>
          </div>
          <div className="card">
            <div className="text-slate-500 text-sm">Avg Daily Spend</div>
            <div className="text-2xl font-bold font-mono">{formatCurrency(stats.averageDailySpending)}</div>
          </div>
          <div className="card">
            <div className="text-slate-500 text-sm">Largest Expense</div>
            <div className="text-2xl font-bold font-mono">{formatCurrency(stats.largestTransaction)}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <div className="lg:col-span-2">
            {isLoadingTransactions ? (
              <div className="card h-72 animate-pulse" />
            ) : (
              <SpendingTrendChart transactions={transactions} />
            )}
          </div>
          <div>
            {isLoadingTransactions ? (
              <div className="card h-72 animate-pulse" />
            ) : (
              <CategoryChart transactions={transactions} />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            {isLoadingTransactions ? (
              <div className="card h-80 animate-pulse" />
            ) : (
              <TransactionList transactions={transactions} />
            )}
          </div>
          <div className="space-y-4">
            {isLoadingAccounts
              ? [1, 2].map((k) => <div key={k} className="card h-28 animate-pulse" />)
              : accounts.map((acc) => <AccountCard key={acc.accountId || acc.id} account={acc} />)}
          </div>
        </div>
      </div>
    </div>
  );
}


