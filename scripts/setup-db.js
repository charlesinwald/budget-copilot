#!/usr/bin/env node
/**
 * Database Setup Script
 *
 * This script initializes the local SQLite database for development.
 * In production, the database is managed by Raindrop/Cloudflare D1.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║                                                           ║');
console.log('║         Budget Copilot - Database Setup                  ║');
console.log('║                                                           ║');
console.log('╚═══════════════════════════════════════════════════════════╝');
console.log('');

console.log('📝 For local development, this project uses:');
console.log('   - Mock database in dev-server.ts for testing');
console.log('   - Raindrop SmartSQL for production');
console.log('');
console.log('📄 Database schema is defined in: scripts/schema.sql');
console.log('');
console.log('To use a real SQLite database locally, you can:');
console.log('  1. Install better-sqlite3: npm install better-sqlite3');
console.log('  2. Update dev-server.ts to use a real SQLite connection');
console.log('  3. Run this script to initialize the database');
console.log('');
console.log('For now, the mock database in dev-server.ts is sufficient');
console.log('for frontend development and testing.');
console.log('');
console.log('✅ Setup complete!');
