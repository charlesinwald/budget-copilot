import { Account } from '../types';
import { formatCurrency } from '../utils/formatters';

interface AccountCardProps {
  account: Account;
}

export default function AccountCard({ account }: AccountCardProps) {
  const balance = account.currentBalance ?? account.balances?.current ?? 0;
  const currency = account.currencyCode ?? account.balances?.isoCurrencyCode ?? 'USD';
  const type = [account.type, account.subtype].filter(Boolean).join(' • ');
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <span className="h-3 w-3 rounded-full bg-emerald-600 mr-2"></span>
          <h3 className="text-lg font-semibold">{account.name}</h3>
        </div>
        <div className="text-slate-500 text-sm">{type}</div>
      </div>
      <div className="mt-4 text-3xl font-bold font-mono">{formatCurrency(balance, currency)}</div>
      {account.institutionName && (
        <div className="mt-2 text-slate-500 text-sm">Bank: {account.institutionName}</div>
      )}
      {account.lastUpdated && (
        <div className="mt-1 text-slate-400 text-xs">Updated: {new Date(account.lastUpdated).toLocaleString()}</div>
      )}
    </div>
  );
}


