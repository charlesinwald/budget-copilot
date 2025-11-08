import { useEffect, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { api } from '../utils/api';

interface PlaidConnectProps {
  onConnected: (accessToken: string) => void;
}

export default function PlaidConnect({ onConnected }: PlaidConnectProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const { data } = await api.post('/api/plaid/create_link_token', {});
        if (mounted) {
          setLinkToken(data.link_token || data.linkToken);
        }
      } catch (e: any) {
        setError('Failed to initialize Plaid. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken || '',
    onSuccess: async (public_token, metadata) => {
      try {
        const { data } = await api.post('/api/plaid/exchange_public_token', {
          public_token
        });
        const accessToken = data.access_token || data.accessToken;
        if (accessToken) {
          localStorage.setItem('access_token', accessToken);
          onConnected(accessToken);
        }
      } catch (e) {
        setError('Failed to exchange Plaid token. Please try again.');
      }
    },
    onExit: (err) => {
      if (err) setError('Plaid Link exited unexpectedly.');
    }
  });

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="card max-w-md w-full text-center">
        <div className="flex items-center justify-center mb-4">
          <img src="https://seeklogo.com/images/P/plaid-logo-5D095B7DCD-seeklogo.com.png" alt="Plaid" className="h-8 mr-2" />
          <h1 className="text-2xl font-bold">Connect Your Bank</h1>
        </div>
        <p className="text-slate-600 mb-6">
          Securely connect your bank account using Plaid. We never store your credentials.
        </p>
        {error && <div className="text-red-600 mb-4">{error}</div>}
        <button
          className="btn-primary w-full disabled:opacity-50"
          onClick={() => open()}
          disabled={!ready || !linkToken || loading}
        >
          {loading ? 'Initializing...' : 'Connect Your Bank Account'}
        </button>
        <p className="text-xs text-slate-500 mt-4">
          Powered by Plaid. Your data is encrypted and handled securely.
        </p>
      </div>
    </div>
  );
}


