import { useMemo, useState } from 'react';
import { Transaction } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';

interface TransactionListProps {
  transactions: Transaction[];
}

type SortKey = 'date' | 'amount';

export default function TransactionList({ transactions }: TransactionListProps) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? transactions.filter(t =>
          (t.name || '').toLowerCase().includes(q) ||
          (t.merchant_name || '').toLowerCase().includes(q) ||
          (t.category || []).some(c => c.toLowerCase().includes(q))
        )
      : transactions;
    const sorted = [...base].sort((a, b) => {
      if (sortKey === 'date') {
        const cmp = a.date.localeCompare(b.date);
        return sortDir === 'asc' ? cmp : -cmp;
      } else {
        const cmp = a.amount - b.amount;
        return sortDir === 'asc' ? cmp : -cmp;
      }
    });
    return sorted;
  }, [transactions, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Recent Transactions</h3>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search transactions"
          className="input w-60"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-2 cursor-pointer" onClick={() => toggleSort('date')}>
                Date {sortKey === 'date' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th className="py-2">Merchant</th>
              <th className="py-2">Category</th>
              <th className="py-2 cursor-pointer text-right" onClick={() => toggleSort('amount')}>
                Amount {sortKey === 'amount' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(-50).reverse().map((t) => {
              const isExpense = t.amount < 0;
              const currency = t.iso_currency_code || 'USD';
              return (
                <tr key={t.id || t.transaction_id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="py-2">{formatDate(t.date)}</td>
                  <td className="py-2">{t.merchant_name || t.name}</td>
                  <td className="py-2">{(t.category && t.category[0]) || 'Uncategorized'}</td>
                  <td className={`py-2 text-right font-mono ${isExpense ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(Math.abs(t.amount), currency)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}


