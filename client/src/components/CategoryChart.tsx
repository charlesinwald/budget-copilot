import { Pie, PieChart, ResponsiveContainer, Cell, Tooltip, Legend } from 'recharts';
import { Transaction } from '../types';
import { getTopCategories } from '../utils/transactionHelpers';
import { formatCurrency } from '../utils/formatters';
import { useMemo } from 'react';

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#f59e0b', '#14b8a6', '#6366f1'];

interface CategoryChartProps {
  transactions: Transaction[];
}

export default function CategoryChart({ transactions }: CategoryChartProps) {
  const data = useMemo(() => {
    return getTopCategories(transactions).map((c) => ({
      name: c.category,
      value: Number(c.amount.toFixed(2))
    }));
  }, [transactions]);

  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4">Spending by Category</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: any, name: any) => [formatCurrency(Number(value)), name]} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}


