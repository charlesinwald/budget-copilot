# Budget Copilot Backend Setup Guide

> **🚀 Want to get started quickly?** Check out [QUICKSTART.md](./QUICKSTART.md) for the fastest way to run the backend!

This guide provides detailed information about the Budget Copilot backend architecture, setup, and deployment.

## Architecture

Budget Copilot is built using the **Raindrop Framework** from LiquidMetal AI, which provides:
- Service-oriented architecture
- Queue-based message processing
- SmartSQL database integration
- Built on Cloudflare Workers

### Services

1. **API Gateway** (Public) - Main HTTP API endpoint
2. **Plaid Integration** (Private) - Handles Plaid API communication
3. **AI Analysis** (Private) - AI-powered transaction categorization and insights
4. **Transaction Sync** (Observer) - Syncs transactions from Plaid
5. **Transaction Processor** (Observer) - Enriches transactions with AI

## Prerequisites

- Node.js 18+ and npm/pnpm
- Plaid Developer Account (for API credentials)
- Anthropic API Key (for AI features)
- Raindrop CLI (optional, for deployment)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and add your credentials:

```env
# Get these from https://dashboard.plaid.com/developers/keys
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_sandbox_secret
PLAID_ENVIRONMENT=sandbox

# Get this from https://console.anthropic.com/
ANTHROPIC_API_KEY=your_anthropic_api_key

# Generate a random string for session security
SESSION_SECRET=your_random_secret_string

# Frontend URL (default is correct for local dev)
FRONTEND_URL=http://localhost:5173
```

### 3. Build the Project

```bash
npm run build
```

### 4. Run the Development Server

```bash
npm run dev
```

The API will be available at `http://localhost:8787`

## API Endpoints

### Plaid Integration

- `POST /api/plaid/create-link-token` - Create Plaid Link token
- `POST /api/plaid/exchange-token` - Exchange public token for access token

### Account & Transaction Management

- `GET /api/accounts?userId={userId}` - Get user's connected accounts
- `GET /api/transactions?userId={userId}&startDate={date}&endDate={date}` - Get transactions
- `POST /api/transactions/sync` - Trigger transaction sync

### AI Features

- `POST /api/chat` - Chat with financial AI assistant
- `GET /api/analysis/spending?userId={userId}&period={monthly|weekly}` - Get spending analysis
- `GET /api/analysis/predictions?userId={userId}` - Get spending predictions

### Dashboard

- `GET /api/dashboard?userId={userId}` - Get dashboard summary
- `GET /api/categories` - Get transaction categories

## Development Scripts

```bash
# Build the project
npm run build

# Run development server (with auto-rebuild)
npm run dev

# Run development server (production mode)
npm start

# Run tests
npm test

# Run tests in watch mode
npm test:watch

# Format code
npm run format

# Lint code
npm run lint
```

## Database

The project uses **SmartSQL** (SQLite-compatible) for data storage:

- **Local Development**: Mock database implementation in `dev-server.ts`
- **Production**: Raindrop SmartSQL (Cloudflare D1)

Database schema is defined in `scripts/schema.sql` and includes:
- `plaid_items` - Connected bank accounts
- `transactions` - Financial transactions
- `spending_patterns` - Aggregated spending data
- `chat_history` - AI chat conversations
- `user_sessions` - User sessions
- `users` - User information

## Testing

The project includes comprehensive test coverage:

```bash
# Run all tests
npm test

# Run specific test file
npm test src/api-gateway/index.test.ts

# Watch mode for TDD
npm test:watch
```

Test files are located alongside source files with `.test.ts` extension.

## Deployment

### Option 1: Raindrop CLI (Recommended)

```bash
# Install Raindrop CLI
npm install -g @liquidmetal-ai/raindrop

# Deploy to Raindrop platform
npm run raindrop:deploy
```

### Option 2: Cloudflare Workers

The project can be deployed to Cloudflare Workers using the included `wrangler.toml` configuration:

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy
wrangler deploy
```

## Project Structure

```
budget-copilot/
├── src/
│   ├── api-gateway/          # Main API service
│   ├── plaid-integration/    # Plaid API service
│   ├── ai-analysis/          # AI analysis service
│   ├── transaction-sync/     # Transaction sync observer
│   ├── transaction-processor/# Transaction processor observer
│   ├── dev-server.ts         # Local development server
│   └── sql/                  # Database utilities
├── scripts/
│   ├── schema.sql            # Database schema
│   └── setup-db.js           # Database setup script
├── .env.example              # Environment variables template
├── raindrop.manifest         # Raindrop configuration
├── wrangler.toml             # Cloudflare Workers config
└── package.json              # Project dependencies
```

## Getting API Credentials

### Plaid (Free Sandbox)

1. Sign up at https://dashboard.plaid.com/signup
2. Go to Team Settings > Keys
3. Copy your `client_id` and `sandbox` secret
4. Use `sandbox` environment for development

### Anthropic (Claude AI)

1. Sign up at https://console.anthropic.com/
2. Go to API Keys
3. Create a new API key
4. Add it to your `.env` file

## Troubleshooting

### Port Already in Use

If port 8787 is already in use, you can change it:

```bash
PORT=3000 npm run dev
```

### CORS Issues

Make sure `FRONTEND_URL` in `.env` matches your frontend URL:

```env
FRONTEND_URL=http://localhost:5173
```

### Environment Variables Not Loading

Ensure you've created `.env` file from `.env.example` and it's in the root directory.

### Mock Services in Development

The development server uses mock implementations for:
- Database queries (logs to console)
- Queue messages (logs to console)
- Session cache (returns mock user ID)

This allows frontend development without a full backend setup.

## Integration with Frontend

The frontend (React app in `client/` directory) connects to the backend API:

1. **Start Backend**: `npm run dev` (port 8787)
2. **Start Frontend**: `cd client && npm run dev` (port 5173)
3. Frontend uses Axios to call backend API endpoints

Frontend configuration is in `client/src/config.ts` or similar.

## Next Steps

1. ✅ Set up environment variables
2. ✅ Run the development server
3. ✅ Test API endpoints using curl or Postman
4. 🎯 Connect your frontend application
5. 🚀 Deploy to production when ready

## Support

For issues or questions:
- Check the Raindrop documentation: https://docs.liquidmetal.ai
- Review test files for API usage examples
- Check Plaid API docs: https://plaid.com/docs/

## License

Private - Budget Copilot Application
