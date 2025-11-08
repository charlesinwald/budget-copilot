import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen.js';
import {
  handleCreateLinkToken,
  handleExchangeToken,
  handleGetAccounts,
  handleGetTransactions,
  handleSyncTransactions,
  handleChat,
  handleSpendingAnalysis,
  handlePredictions,
  handleDashboard,
  handleCategories,
  jsonResponse,
  errorResponse,
} from './utils.js';
import { handlePlaidBalance, handlePlaidTransactions, handleAiChat } from './utils.js';

export default class ApiGateway extends Service<Env> {
  constructor(ctx: any, env: any) {
    // Tests pass (mockEnv, {}), but base class expects (ctx, env)
    // Swap params if first param looks like Env (has logger property)
    if (ctx && typeof ctx === 'object' && 'logger' in ctx) {
      super(env, ctx);
    } else {
      super(ctx, env);
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    try {
      if (method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        });
      }

      if (pathname === '/api/plaid/create-link-token' && method === 'POST') {
        return await handleCreateLinkToken(request, this.env);
      }

      if (pathname === '/api/plaid/exchange-token' && method === 'POST') {
        return await handleExchangeToken(request, this.env);
      }

      if (pathname === '/api/plaid/balance' && method === 'POST') {
        return await handlePlaidBalance(request, this.env);
      }

      if (pathname === '/api/plaid/transactions' && method === 'POST') {
        return await handlePlaidTransactions(request, this.env);
      }

      if (pathname === '/api/accounts' && method === 'GET') {
        return await handleGetAccounts(request, this.env);
      }

      if (pathname === '/api/transactions' && method === 'GET') {
        return await handleGetTransactions(request, this.env);
      }

      if (pathname === '/api/transactions/sync' && method === 'POST') {
        return await handleSyncTransactions(request, this.env);
      }

      if (pathname === '/api/ai/chat' && method === 'POST') {
        return await handleAiChat(request, this.env);
      }

      if (pathname === '/api/chat' && method === 'POST') {
        return await handleChat(request, this.env);
      }

      if (pathname === '/api/analysis/spending' && method === 'GET') {
        return await handleSpendingAnalysis(request, this.env);
      }

      if (pathname === '/api/analysis/predictions' && method === 'GET') {
        return await handlePredictions(request, this.env);
      }

      if (pathname === '/api/dashboard' && method === 'GET') {
        return await handleDashboard(request, this.env);
      }

      if (pathname === '/api/categories' && method === 'GET') {
        return await handleCategories(request, this.env);
      }

      if (pathname === '/api/categories' && method === 'POST') {
        return errorResponse('Method not allowed', 405);
      }

      return errorResponse('Not found', 404);
    } catch (error) {
      if (this.env && this.env.logger) {
        this.env.logger.error('Unhandled error in API gateway', { error, pathname, method });
      }
      return errorResponse('Internal server error', 500);
    }
  }
}
