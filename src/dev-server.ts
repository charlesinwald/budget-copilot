#!/usr/bin/env node
/**
 * Local Development Server for Budget Copilot API Gateway
 *
 * This server runs the API Gateway locally for development and testing.
 * It provides mock implementations of the Raindrop services and queues.
 */

import { createServer } from 'http';
import ApiGateway from './api-gateway/index.js';
import PlaidIntegration from './plaid-integration/index.js';
import AiAnalysis from './ai-analysis/index.js';

const PORT = process.env.PORT || 8787;

// Mock environment for local development
const mockEnv = {
  logger: {
    debug: (...args: any[]) => console.log('[DEBUG]', ...args),
    info: (...args: any[]) => console.log('[INFO]', ...args),
    warn: (...args: any[]) => console.warn('[WARN]', ...args),
    error: (...args: any[]) => console.error('[ERROR]', ...args),
  },

  // Environment variables from .env
  PLAID_CLIENT_ID: process.env.PLAID_CLIENT_ID || '',
  PLAID_SECRET: process.env.PLAID_SECRET || '',
  PLAID_ENVIRONMENT: process.env.PLAID_ENVIRONMENT || 'sandbox',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  SESSION_SECRET: process.env.SESSION_SECRET || 'dev-secret',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Mock service instances
  PLAID_INTEGRATION: null as any,
  AI_ANALYSIS: null as any,

  // Mock database
  FINANCIAL_DB: {
    query: async (sql: string, params?: any[]) => {
      console.log('[DB QUERY]', sql, params);
      return [];
    },
    execute: async (sql: string, params?: any[]) => {
      console.log('[DB EXECUTE]', sql, params);
      return { success: true };
    },
  },

  // Mock session cache
  SESSION_CACHE: {
    get: async (key: string) => {
      console.log('[CACHE GET]', key);
      return 'user_123'; // Mock user session
    },
    put: async (key: string, value: string, options?: any) => {
      console.log('[CACHE PUT]', key, value);
    },
    delete: async (key: string) => {
      console.log('[CACHE DELETE]', key);
    },
  },

  // Mock queues
  TRANSACTION_SYNC_QUEUE: {
    send: async (message: any) => {
      console.log('[QUEUE] Transaction sync queued:', message);
    },
  },

  TRANSACTION_PROCESSING_QUEUE: {
    send: async (message: any) => {
      console.log('[QUEUE] Transaction processing queued:', message);
    },
  },
};

// Initialize service instances
try {
  mockEnv.PLAID_INTEGRATION = new PlaidIntegration(null, mockEnv);
  mockEnv.AI_ANALYSIS = new AiAnalysis(null, mockEnv);
  console.log('[INFO] Services initialized successfully');
} catch (error) {
  console.error('[ERROR] Failed to initialize services:', error);
}

// Create API Gateway instance
const apiGateway = new ApiGateway(null, mockEnv);

// Create HTTP server
const server = createServer(async (req, res) => {
  try {
    // Build Request object from Node.js IncomingMessage
    const url = `http://localhost:${PORT}${req.url}`;
    const headers = new Headers();
    Object.entries(req.headers).forEach(([key, value]) => {
      if (value) {
        headers.set(key, Array.isArray(value) ? value[0] : value);
      }
    });

    // Read request body
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const body = chunks.length > 0 ? Buffer.concat(chunks).toString() : undefined;

    // Create Web API Request
    const request = new Request(url, {
      method: req.method,
      headers,
      body: body && req.method !== 'GET' && req.method !== 'HEAD' ? body : undefined,
    });

    // Process request through API Gateway
    const response = await apiGateway.fetch(request);

    // Send response
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    const responseBody = await response.text();
    res.end(responseBody);

  } catch (error) {
    console.error('[ERROR] Request failed:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }));
  }
});

// Start server
server.listen(PORT, () => {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                                                           ║');
  console.log('║         Budget Copilot API Gateway - DEV SERVER          ║');
  console.log('║                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📡 Frontend URL: ${mockEnv.FRONTEND_URL}`);
  console.log(`🔧 Environment: ${mockEnv.PLAID_ENVIRONMENT}`);
  console.log('');
  console.log('Available endpoints:');
  console.log('  POST   /api/plaid/create-link-token');
  console.log('  POST   /api/plaid/exchange-token');
  console.log('  GET    /api/accounts');
  console.log('  GET    /api/transactions');
  console.log('  POST   /api/transactions/sync');
  console.log('  POST   /api/chat');
  console.log('  GET    /api/analysis/spending');
  console.log('  GET    /api/analysis/predictions');
  console.log('  GET    /api/dashboard');
  console.log('  GET    /api/categories');
  console.log('');
  console.log('Press Ctrl+C to stop');
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n[INFO] SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('[INFO] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n[INFO] SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('[INFO] Server closed');
    process.exit(0);
  });
});
