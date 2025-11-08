import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Transaction } from '../types';
import { calculateDailySpending } from '../utils/transactionHelpers';
import { useMemo } from 'react';
import { formatCurrency } from '../utils/formatters';

interface SpendingTrendChartProps {
  transactions: Transaction[];
}

export default function SpendingTrendChart({ transactions }: SpendingTrendChartProps) {
  const data = useMemo(() => calculateDailySpending(transactions, 30), [transactions]);
  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4">Spending Over Time</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" />
            <YAxis tickFormatter={(v) => formatCurrency(Number(v))} />
            <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
            <Area type="monotone" dataKey="amount" stroke="#10b981" fillOpacity={1} fill="url(#colorSpend)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}


