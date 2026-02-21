# Mock Mode with Real AI

This guide explains how to use **Mock Plaid** mode while still testing **real Anthropic AI** features.

## What is Mock Mode with AI?

Mock Mode allows you to:
- ✅ Skip real Plaid bank connections
- ✅ Use pre-generated test transactions
- ✅ Process those transactions through **real Anthropic AI**
- ✅ Test AI categorization, chat, and analytics features

This is perfect for:
- Testing AI features without connecting real bank accounts
- Development when you don't have Plaid credentials
- Demonstrating AI capabilities with sample data

## How It Works

1. **Mock Plaid Connection** - Generates 8 realistic test transactions
2. **AI Processing** - Each transaction is sent to real Anthropic Claude API
3. **Smart Categorization** - AI categorizes transactions (Food & Drink, Shopping, etc.)
4. **Full Features** - Chat, analytics, and predictions work with categorized data

## Setup

### 1. Enable Mock Mode in Frontend

Add this to your `client/.env` or `.env.local`:

```env
VITE_PLAID_MOCK=true
```

### 2. Ensure Anthropic API Key is Set

In your backend `.env`:

```env
ANTHROPIC_API_KEY=sk-ant-api03-your-actual-key-here
```

**Important**: You need a **real Anthropic API key** for AI features to work, even in mock mode!

### 3. Start Backend and Frontend

```bash
# Terminal 1: Backend
npm run dev

# Terminal 2: Frontend
cd client && npm run dev
```

## Using Mock Mode

### Connect Mock Account

1. Open http://localhost:5173
2. Click "Connect Your Bank Account"
3. You'll see "Connect Your Bank (Mock)"
4. Click the button to instantly connect

### Automatic AI Processing

When you connect in mock mode, the backend will:

1. Generate 8 mock transactions:
   - Starbucks ($5.67)
   - Amazon ($45.23)
   - Uber ($18.50)
   - Whole Foods ($87.34)
   - Netflix ($15.99)
   - Shell Gas Station ($52.00)
   - Target ($123.45)
   - Chipotle ($12.75)

2. **Automatically categorize** each transaction using real Anthropic AI

3. You'll see in backend logs:
   ```
   [INFO] Processing mock transactions with AI { userId: 'user_123' }
   [INFO] Found 8 transactions to categorize with AI
   [AI] Categorized "STARBUCKS" → Food and Drink (0.95)
   [AI] Categorized "AMAZON.COM" → Shopping (0.88)
   ...
   ```

### Manual AI Processing (Optional)

If you want to manually trigger AI categorization, call this endpoint:

```bash
curl -X POST http://localhost:8787/api/mock/process-transactions \
  -H "Content-Type: application/json" \
  -d '{"userId": "user_123"}'
```

Response:
```json
{
  "success": true,
  "message": "Processed 8 transactions with Anthropic AI",
  "processed": 8,
  "results": [
    {
      "transaction_id": "mock_txn_...",
      "name": "STARBUCKS",
      "category": "Food and Drink",
      "confidence": 0.95
    },
    ...
  ]
}
```

## Testing AI Features

Once transactions are categorized, you can test:

### 1. View Categorized Transactions

```bash
curl "http://localhost:8787/api/transactions?userId=user_123"
```

Each transaction will have `ai_category` and `ai_confidence` fields.

### 2. Get Spending Analysis

```bash
curl "http://localhost:8787/api/analysis/spending?userId=user_123&period=monthly"
```

Returns AI-powered spending breakdown by category.

### 3. Chat with AI Assistant

```bash
curl -X POST http://localhost:8787/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_123",
    "message": "How much did I spend on food?"
  }'
```

The AI will analyze your mock transactions and respond intelligently.

### 4. Get Predictions

```bash
curl "http://localhost:8787/api/analysis/predictions?userId=user_123"
```

AI predicts future spending based on patterns.

## Frontend Integration

Update your `MockPlaidLink` component to call the AI processing endpoint after connecting:

```typescript
// In client/src/components/PlaidConnect.tsx

const handleMockConnect = async () => {
  try {
    setLoading(true);

    // Step 1: Exchange mock token (creates mock transactions)
    const { data } = await api.post("/api/plaid/exchange-token", {
      publicToken: "public-sandbox-mock",
      userId: "user_123",
      institutionId: "mock_bank",
      institutionName: "Mock Bank (AI Testing)"
    });

    const accessToken = data.access_token || data.accessToken || "access-mock";
    localStorage.setItem("access_token", accessToken);

    // Step 2: Process transactions with AI
    console.log("🤖 Processing transactions with AI...");
    const aiResult = await api.post("/api/mock/process-transactions", {
      userId: "user_123"
    });

    console.log(`✅ ${aiResult.data.processed} transactions categorized by AI`);

    onConnected(accessToken);
  } catch (e) {
    console.error("Mock connect failed:", e);
    setError("Failed to mock connect. Please try again.");
  } finally {
    setLoading(false);
  }
};
```

## Checking AI is Working

### Backend Logs

You should see AI-related logs:

```
[INFO] Creating link token { userId: 'user_123', environment: 'sandbox' }
[MOCK DATA] Created 8 mock transactions for AI processing
[INFO] Processing mock transactions with AI { userId: 'user_123' }
[INFO] Categorizing transaction { transactionName: 'STARBUCKS', merchantName: 'Starbucks Coffee' }
[AI] Categorized "STARBUCKS" → Food and Drink (0.95)
[AI] Categorized "AMAZON.COM" → Shopping (0.88)
...
```

### API Responses

Transactions should have AI fields:

```json
{
  "transaction_id": "mock_txn_123",
  "name": "STARBUCKS",
  "amount": 5.67,
  "date": "2025-11-01",
  "ai_category": "Food and Drink",
  "ai_confidence": 0.95
}
```

## Cost Considerations

### Anthropic API Usage

- Each transaction categorization ≈ 1 API call
- 8 mock transactions = 8 API calls
- Cost: ~$0.004 per mock connection (very minimal)

### Free Tier

Anthropic provides free credits for testing. Mock mode is perfect for staying within free limits while fully testing AI features.

## Troubleshooting

### "AI categorization not working"

1. **Check API Key**:
   ```bash
   # In backend root
   cat .env | grep ANTHROPIC_API_KEY
   ```
   Should show: `ANTHROPIC_API_KEY=sk-ant-api03-...`

2. **Check Backend Logs**: Look for AI-related errors
3. **Test API Key**:
   ```bash
   curl http://localhost:8787/api/categories
   ```
   Should return successfully

### "Transactions have no ai_category"

1. **Call process endpoint manually**:
   ```bash
   curl -X POST http://localhost:8787/api/mock/process-transactions \
     -H "Content-Type: application/json" \
     -d '{"userId": "user_123"}'
   ```

2. **Check response**: Should show "processed": 8

### "Mock mode still trying to use real Plaid"

1. Check frontend environment:
   ```bash
   cat client/.env | grep VITE_PLAID_MOCK
   ```
   Should be: `VITE_PLAID_MOCK=true`

2. Restart frontend dev server after changing .env

## Summary

✅ **Mock Plaid** = No real bank connections needed
✅ **Real AI** = Actual Anthropic Claude API calls
✅ **Full Features** = All AI features work (chat, categorization, analytics)
✅ **Low Cost** = Minimal API usage for testing
✅ **Fast Setup** = No waiting for bank connections

Perfect for development, testing, and demos! 🚀
