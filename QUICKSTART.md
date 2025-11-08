# Quick Start Guide - Budget Copilot Backend

This guide will help you get the Budget Copilot backend running **quickly** so your frontend can connect to it.

## Prerequisites

- Node.js 18+ installed
- Raindrop CLI installed (`npm install -g @liquidmetal-ai/raindrop`)
- Plaid account (for bank connections)
- Anthropic API key (for AI features)

## Option 1: Using Raindrop CLI (Recommended)

The Budget Copilot backend is built on the Raindrop Framework, which provides the easiest way to run the application locally.

### Step 1: Set Up Environment Variables

Copy the environment template:

```bash
cp .env.example .env
```

Edit `.env` with your API keys:

```env
PLAID_CLIENT_ID=your_plaid_client_id          # From https://dashboard.plaid.com
PLAID_SECRET=your_plaid_sandbox_secret
PLAID_ENVIRONMENT=sandbox                      # Use sandbox for development

ANTHROPIC_API_KEY=your_anthropic_key          # From https://console.anthropic.com

SESSION_SECRET=random_secret_string           # Generate a random string
FRONTEND_URL=http://localhost:5173            # Your frontend URL
```

### Step 2: Start the Development Server

```bash
raindrop build start --local
```

This command will:
- Start the API Gateway on `http://localhost:8787`
- Start all backend services
- Enable hot reloading for code changes
- Set up mock databases and queues

### Step 3: Test the API

```bash
curl http://localhost:8787/api/categories
```

You should see a list of transaction categories!

### Step 4: Start Your Frontend

In a new terminal:

```bash
cd client
npm install
npm run dev
```

Your frontend will be available at `http://localhost:5173` and will connect to the API at `http://localhost:8787`.

## Option 2: Using NPM Scripts (Alternative)

If you prefer not to use Raindrop CLI, you can use the custom development server:

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Set Up Environment (same as above)

```bash
cp .env.example .env
# Edit .env with your API keys
```

### Step 3: Build and Run

```bash
npm run dev
```

**Note**: This uses a mock development server that simulates the Raindrop environment. Some features may not work exactly as in production.

## API Endpoints

Once running, the following endpoints are available:

### Plaid Integration
- `POST /api/plaid/create-link-token` - Get Plaid Link token
- `POST /api/plaid/exchange-token` - Exchange public token

### Accounts & Transactions
- `GET /api/accounts?userId={userId}` - Get connected accounts
- `GET /api/transactions?userId={userId}` - Get transactions
- `POST /api/transactions/sync` - Sync transactions

### AI Features
- `POST /api/chat` - Chat with AI assistant
- `GET /api/analysis/spending?userId={userId}` - Get spending analysis
- `GET /api/analysis/predictions?userId={userId}` - Get predictions

### Dashboard
- `GET /api/dashboard?userId={userId}` - Get dashboard data
- `GET /api/categories` - Get available categories

## Testing the Backend

### Manual Testing with cURL

```bash
# Get categories
curl http://localhost:8787/api/categories

# Create Plaid Link token
curl -X POST http://localhost:8787/api/plaid/create-link-token \
  -H "Content-Type: application/json" \
  -d '{"userId": "test_user_123"}'
```

### Run Automated Tests

```bash
npm test
```

## Troubleshooting

### "raindrop: command not found"

Install the Raindrop CLI globally:

```bash
npm install -g @liquidmetal-ai/raindrop
```

### "Port 8787 already in use"

Change the port in your Raindrop configuration or kill the process:

```bash
lsof -ti:8787 | xargs kill
```

### Environment Variables Not Loading

Make sure `.env` file exists in the root directory and contains all required variables.

### CORS Errors

Ensure `FRONTEND_URL` in `.env` matches your frontend URL exactly:

```env
FRONTEND_URL=http://localhost:5173
```

## Getting API Keys

### Plaid (Free Sandbox)

1. Sign up at https://dashboard.plaid.com/signup
2. Go to **Team Settings** > **Keys**
3. Copy your `client_id` and `sandbox` secret
4. Use `PLAID_ENVIRONMENT=sandbox` for development

### Anthropic Claude API

1. Sign up at https://console.anthropic.com/
2. Go to **API Keys**
3. Create a new API key
4. Add it to your `.env` file

## Development Workflow

1. **Start Backend**: `raindrop build start --local`
2. **Start Frontend**: `cd client && npm run dev`
3. **Make Changes**: Edit code in `src/` directory
4. **Hot Reload**: Raindrop automatically reloads on changes
5. **Test**: Run `npm test` to ensure everything works

## Next Steps

- ✅ Backend running on http://localhost:8787
- ✅ Frontend running on http://localhost:5173
- 📖 See [BACKEND_SETUP.md](./BACKEND_SETUP.md) for detailed documentation
- 🚀 Ready to start building!

## Common Commands

```bash
# Start local development server
raindrop build start --local

# Stop the development server
# Press Ctrl+C in the terminal

# Run tests
npm test

# Format code
npm run format

# Lint code
npm run lint

# Deploy to Raindrop Cloud
raindrop build deploy
```

## Support

If you encounter issues:

1. Check the [BACKEND_SETUP.md](./BACKEND_SETUP.md) for detailed setup instructions
2. Review the Raindrop documentation: https://docs.liquidmetal.ai
3. Check Plaid API docs: https://plaid.com/docs/
4. Verify all environment variables are set correctly

---

**You're ready to go!** Start the backend and frontend, and begin building your budget copilot application. 🎉
