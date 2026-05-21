# 💰 Budget Copilot

**An AI-powered personal finance assistant that connects to your real bank accounts, automatically categorizes your transactions, and gives you an intelligent chat interface to understand and manage your spending.**

---

## Table of Contents

- [Overview](#overview)
- [Real-World Impact](#real-world-impact)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Getting Started](#getting-started)
- [Development Modes](#development-modes)
- [Database Schema](#database-schema)
- [Deployment](#deployment)
- [Environment Variables](#environment-variables)
- [Contributing](#contributing)

---

## Overview

Budget Copilot bridges the gap between raw financial data and meaningful, actionable insight. Most people have a vague sense of where their money goes — Budget Copilot makes it explicit. By securely connecting to users' bank accounts via Plaid, pulling in real transaction data, and passing it through an Anthropic Claude AI pipeline, Budget Copilot transforms a list of merchant codes into a clear, categorized picture of someone's financial life.

Users can then chat directly with an AI assistant — in plain English — to ask questions like "How much did I spend on food last month?" or "What are my biggest recurring expenses?" and get real, data-grounded answers.

---

## Real-World Impact

### The Problem

Financial illiteracy and poor spending awareness are among the most widespread causes of personal financial stress. The average American carries significant credit card debt and reports feeling anxious or confused about their finances — not because they lack intelligence, but because the tools available to them either require too much manual work (spreadsheets), charge expensive subscription fees (premium budgeting apps), or surface data without meaningful context (basic bank dashboards).

### What Budget Copilot Changes

**1. Democratizing Financial Intelligence**
Budget Copilot makes AI-assisted financial analysis accessible to anyone with a bank account. No financial advisor required. No expensive software subscription. By combining open-source tooling, free-tier API access, and a self-hostable architecture, it puts powerful analysis in the hands of everyday users.

**2. Eliminating Manual Categorization**
Manually tagging hundreds of monthly transactions is tedious and error-prone. Budget Copilot's AI categorization pipeline processes each transaction automatically, assigning categories like "Food & Drink," "Shopping," or "Transportation" with a confidence score — instantly and consistently.

**3. Making Finance Conversational**
The AI chat interface removes the cognitive friction of interpreting financial data. Instead of building mental models from tables and graphs, users can simply ask a question and receive a synthesized, intelligent answer grounded in their actual transaction history. This is transformative for users who are intimidated by traditional finance apps.

**4. Predictive Spending Awareness**
The spending prediction feature lets users see where their finances are heading, not just where they've been. Forewarning of an unusually high spending month — before the credit card bill arrives — gives users the chance to course-correct in real time.

**5. Privacy-First Design**
Budget Copilot is designed to be self-hosted. Users can run their own instance, meaning their financial data never has to pass through a third-party company's servers. This is a significant departure from most consumer fintech tools, where user data is the product.

---

## Features

- **Secure Bank Connection** via Plaid Link — supports thousands of financial institutions across the US
- **Automatic Transaction Sync** — keeps transaction history up to date
- **AI-Powered Categorization** — each transaction is categorized by Claude with a confidence score
- **Conversational AI Chat** — ask natural language questions about your finances
- **Spending Analysis** — weekly and monthly breakdowns by category
- **Predictive Analytics** — AI-generated forecasts of future spending patterns
- **Dashboard Summary** — at-a-glance view of accounts, spending, and trends
- **Mock Mode** — full AI feature testing without real bank credentials (ideal for development and demos)
- **Self-Hostable** — deploy to Cloudflare Workers or the Raindrop platform

---

## Tech Stack

### Backend

| Layer | Technology |
|---|---|
| **Runtime** | Node.js 18+ / Cloudflare Workers |
| **Language** | TypeScript (92.9% of codebase) |
| **Framework** | [Raindrop Framework](https://docs.liquidmetal.ai) by LiquidMetal AI |
| **AI** | Anthropic Claude API (`claude-sonnet`) |
| **Bank Data** | Plaid API (Link, Transactions, Accounts) |
| **Database** | SmartSQL (SQLite-compatible; Cloudflare D1 in production) |
| **Validation** | Zod |
| **MCP Support** | `@modelcontextprotocol/sdk` |
| **Package Manager** | pnpm |
| **Testing** | Vitest |
| **Linting/Formatting** | ESLint + Prettier |
| **Build** | TypeScript compiler (`tsc`) |
| **Deployment** | Raindrop CLI / Cloudflare Wrangler |

### Frontend

| Layer | Technology |
|---|---|
| **Framework** | React |
| **Language** | TypeScript |
| **Dev Server** | Vite |
| **HTTP Client** | Axios |
| **Environment** | `.env` / `VITE_` prefixed variables |

### Infrastructure

| Concern | Solution |
|---|---|
| **Edge Deployment** | Cloudflare Workers |
| **Database (prod)** | Cloudflare D1 (via SmartSQL) |
| **Queue Processing** | Raindrop queue-based message system |
| **Session Management** | Server-side session with configurable secret |
| **CORS** | Configurable frontend URL allowlist |

---

## Architecture

Budget Copilot follows a **service-oriented architecture** built on the Raindrop Framework. All services run on Cloudflare Workers and communicate via internal queues and HTTP.

```
┌─────────────────────────────────────────────────────────┐
│                     Client (React/Vite)                  │
│                    localhost:5173                         │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP (Axios)
                         ▼
┌─────────────────────────────────────────────────────────┐
│              API Gateway (Public Service)                │
│                    localhost:8787                         │
│  Routes: /api/plaid, /api/accounts, /api/transactions,  │
│          /api/chat, /api/analysis, /api/dashboard        │
└────┬──────────────┬───────────────┬──────────────────────┘
     │              │               │
     ▼              ▼               ▼
┌─────────┐  ┌──────────────┐  ┌──────────────────────┐
│  Plaid  │  │ AI Analysis  │  │  Transaction Sync    │
│ Service │  │   Service    │  │  + Processor         │
│(Private)│  │  (Private)   │  │  (Observers)         │
└────┬────┘  └──────┬───────┘  └──────────┬───────────┘
     │              │                      │
     ▼              ▼                      ▼
┌─────────┐  ┌──────────────┐       ┌─────────────┐
│  Plaid  │  │  Anthropic   │       │   SmartSQL  │
│   API   │  │  Claude API  │       │  Database   │
└─────────┘  └──────────────┘       └─────────────┘
```

### Services

**API Gateway** (Public-facing)
The primary HTTP interface. Handles request routing, authentication, CORS, and delegates to downstream services. Exposes all `/api/*` endpoints consumed by the frontend.

**Plaid Integration** (Private)
Manages the full Plaid OAuth flow — generating Link tokens, exchanging public tokens for access tokens, and fetching account/transaction data from Plaid's API.

**AI Analysis** (Private)
Receives transaction data and sends it to the Anthropic Claude API for categorization, chat responses, spending analysis, and predictive modeling.

**Transaction Sync** (Observer)
Listens for sync triggers and pulls the latest transactions from Plaid for all connected users.

**Transaction Processor** (Observer)
Enriches raw transactions with AI-generated categories and confidence scores by invoking the AI Analysis service.

---

## Project Structure

```
budget-copilot/
├── src/
│   ├── api-gateway/           # Main HTTP API service (public)
│   ├── plaid-integration/     # Plaid API communication (private)
│   ├── ai-analysis/           # Anthropic AI categorization & chat (private)
│   ├── transaction-sync/      # Transaction sync observer
│   ├── transaction-processor/ # Transaction enrichment observer
│   ├── dev-server.ts          # Local development server
│   └── sql/                   # Database utilities
├── client/                    # React frontend (Vite)
│   └── src/
│       ├── components/        # UI components (PlaidConnect, Dashboard, etc.)
│       └── config.ts          # API base URL configuration
├── scripts/
│   ├── schema.sql             # Full database schema
│   └── setup-db.js            # Database initialization script
├── .env.example               # Environment variable template
├── raindrop.manifest          # Raindrop Framework configuration
├── wrangler.toml              # Cloudflare Workers configuration
├── tsconfig.json              # TypeScript configuration
├── package.json               # Backend dependencies and scripts
└── pnpm-lock.yaml             # Lockfile
```

---

## API Reference

### Plaid Integration

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/plaid/create-link-token` | Generate a Plaid Link token to initiate bank connection |
| `POST` | `/api/plaid/exchange-token` | Exchange public token for a secure access token |

### Accounts & Transactions

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/accounts?userId={id}` | Fetch all connected bank accounts for a user |
| `GET` | `/api/transactions?userId={id}&startDate={date}&endDate={date}` | Retrieve transactions with optional date filtering |
| `POST` | `/api/transactions/sync` | Trigger a transaction sync from Plaid |

### AI Features

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/chat` | Chat with the AI financial assistant |
| `GET` | `/api/analysis/spending?userId={id}&period={monthly\|weekly}` | AI-generated spending breakdown by category |
| `GET` | `/api/analysis/predictions?userId={id}` | AI-powered future spending predictions |

### Dashboard & Utility

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dashboard?userId={id}` | Full dashboard summary (accounts, spending, trends) |
| `GET` | `/api/categories` | List all available transaction categories |

### Mock/Development

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/mock/process-transactions` | Process mock transactions through real Anthropic AI |

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- A [Plaid developer account](https://dashboard.plaid.com/signup) (free sandbox available)
- An [Anthropic API key](https://console.anthropic.com/)
- Raindrop CLI (recommended): `npm install -g @liquidmetal-ai/raindrop`

### 1. Clone the Repository

```bash
git clone https://github.com/charlesinwald/budget-copilot.git
cd budget-copilot
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Plaid — https://dashboard.plaid.com/team/keys
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_sandbox_secret
PLAID_ENVIRONMENT=sandbox

# Anthropic — https://console.anthropic.com/api-keys
ANTHROPIC_API_KEY=your_anthropic_api_key

# Session security — generate any random string
SESSION_SECRET=your_random_secret_string

# Frontend URL
FRONTEND_URL=http://localhost:5173
```

### 4. Start the Backend

**Option A — Raindrop CLI (recommended):**
```bash
raindrop build start --local
```

**Option B — npm scripts:**
```bash
npm run dev
```

The API will be available at `http://localhost:8787`.

### 5. Start the Frontend

```bash
cd client
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`.

### 6. Verify Setup

```bash
curl http://localhost:8787/api/categories
# Should return a list of transaction categories
```

---

## Development Modes

### Full Mode (Real Plaid + Real AI)

Use real bank accounts in the Plaid sandbox environment with real Anthropic AI. Requires both API keys configured in `.env`.

### Mock Mode (Mock Plaid + Real AI)

Ideal for development and demos. Generates 8 realistic test transactions (Starbucks, Amazon, Netflix, etc.) and processes them through the **real** Anthropic API — giving you full AI feature coverage without any bank credentials.

Enable mock mode in the frontend:
```env
# client/.env
VITE_PLAID_MOCK=true
```

Mock transactions processed per connection:

| Merchant | Amount |
|---|---|
| Starbucks | $5.67 |
| Amazon | $45.23 |
| Uber | $18.50 |
| Whole Foods | $87.34 |
| Netflix | $15.99 |
| Shell Gas Station | $52.00 |
| Target | $123.45 |
| Chipotle | $12.75 |

Each transaction gets AI-categorized with a confidence score and is immediately available for chat, spending analysis, and predictions.

---

## Database Schema

The SmartSQL database (SQLite-compatible) includes the following tables:

| Table | Purpose |
|---|---|
| `users` | User identity records |
| `user_sessions` | Session management |
| `plaid_items` | Connected bank account credentials |
| `transactions` | Full transaction history with AI fields (`ai_category`, `ai_confidence`) |
| `spending_patterns` | Aggregated spending data by category and period |
| `chat_history` | AI conversation history per user |

Initialize the schema locally:
```bash
npm run db:setup
```

---

## Deployment

### Raindrop Cloud (Recommended)

```bash
raindrop build deploy
```

### Cloudflare Workers

```bash
npm install -g wrangler
wrangler login
wrangler deploy
```

The `wrangler.toml` in the project root contains all the necessary Cloudflare configuration.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PLAID_CLIENT_ID` | Yes | Plaid developer client ID |
| `PLAID_SECRET` | Yes | Plaid environment secret key |
| `PLAID_ENVIRONMENT` | Yes | `sandbox`, `development`, or `production` |
| `ANTHROPIC_API_KEY` | Yes | Anthropic Claude API key |
| `SESSION_SECRET` | Yes | Random string for session signing |
| `FRONTEND_URL` | Yes | Allowed CORS origin (e.g. `http://localhost:5173`) |

---

## Scripts

```bash
# Development
npm run dev          # Build and start local dev server
npm run dev:watch    # Build with TypeScript watch mode
npm start            # Start without rebuilding

# Quality
npm run build        # Full TypeScript build
npm run lint         # ESLint (zero warnings enforced)
npm run format       # Prettier formatting

# Testing
npm test             # Run all tests (Vitest)
npm run test:watch   # Watch mode for TDD

# Database
npm run db:setup     # Initialize database schema

# Deployment
npm run raindrop:dev    # Local Raindrop dev server
npm run raindrop:deploy # Deploy to Raindrop Cloud
```

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make your changes and add tests
4. Run `npm run lint` and `npm test` to ensure everything passes
5. Submit a pull request

For questions, refer to:
- [Raindrop Framework Docs](https://docs.liquidmetal.ai)
- [Plaid API Docs](https://plaid.com/docs/)
- [Anthropic API Docs](https://docs.anthropic.com/)

---

## License

Private — Budget Copilot Application
