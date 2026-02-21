import { useEffect, useMemo, useState } from 'react';
import PlaidConnect from './components/PlaidConnect';
import Dashboard from './components/Dashboard';
import ChatSidebar from './components/ChatSidebar';
import { useAccounts } from './hooks/useAccounts';
import { useTransactions } from './hooks/useTransactions';
import { Transaction } from './types';
import { getApiBaseUrl } from './utils/api';

export default function App() {
  const [accessToken, setAccessToken] = useState<string | null>(() => localStorage.getItem('access_token'));
  const [useMock, setUseMock] = useState<boolean>(false);

  useEffect(() => {
    // If backend isn't reachable, allow mock toggle to be enabled quickly
    const baseUrl = getApiBaseUrl();
    if (!baseUrl) setUseMock(true);
  }, []);

  const { data: accounts = [], isLoading: isLoadingAccounts, isError: accountsError } = useAccounts(accessToken);
  const { data: transactions = [], isLoading: isLoadingTransactions, isError: txError } = useTransactions(accessToken, undefined, undefined, useMock);

  const isConnected = !!accessToken;

  const last10Transactions: Transaction[] = useMemo(
    () => transactions.slice(-10).reverse(),
    [transactions]
  );

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between px-4 lg:px-6 h-14">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-emerald-600 flex items-center justify-center text-white font-bold">B</div>
            <div className="text-xl font-bold">Budget Copilot</div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-sm ${isConnected ? 'text-emerald-700' : 'text-slate-500'}`}>
              {isConnected ? 'Connected' : 'Not Connected'}
            </span>
            <button
              className="text-sm px-3 py-1 rounded-lg border border-gray-200 hover:bg-gray-50"
              onClick={() => {
                if (isConnected) {
                  localStorage.removeItem('access_token');
                  setAccessToken(null);
                } else {
                  setUseMock(prev => !prev);
                }
              }}
              title={isConnected ? 'Disconnect' : 'Toggle Mock Data'}
            >
              {/* {isConnected ? 'Disconnect' : (useMock ? 'Mock: On' : 'Mock: Off')} */}
            </button>
          </div>
        </div>
      </header>

      {!isConnected ? (
        <PlaidConnect onConnected={(token) => setAccessToken(token)} />
      ) : (
        <main className="max-w-[1400px] mx-auto p-4 lg:p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <Dashboard
              accounts={accounts}
              transactions={transactions}
              isLoadingAccounts={isLoadingAccounts}
              isLoadingTransactions={isLoadingTransactions}
            />
            <ChatSidebar accounts={accounts} transactions={last10Transactions} />
          </div>
          {(accountsError || txError) && (
            <div className="mt-4 text-red-600">
              There was a problem fetching data. Your session may have expired. Try reconnecting your bank.
            </div>
          )}
        </main>
      )}
    </div>
  );
}


