import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CopilotKit } from '@copilotkit/react-core';
import { CopilotSidebar } from '@copilotkit/react-ui';
import '@copilotkit/react-ui/styles.css';
import App from './App';
import './index.css';
import { getApiBaseUrl } from './utils/api';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      refetchInterval: 5 * 60 * 1000
    }
  }
});

const apiBaseUrl = getApiBaseUrl();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <CopilotKit runtimeUrl={`${apiBaseUrl}/api/copilotkit`}>
        <CopilotSidebar>
          <App />
        </CopilotSidebar>
      </CopilotKit>
    </QueryClientProvider>
  </React.StrictMode>
);


