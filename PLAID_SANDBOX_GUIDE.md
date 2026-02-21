# Plaid Sandbox Test Credentials Guide

When using Plaid in **sandbox mode**, you don't use real bank credentials. Instead, Plaid provides test credentials that simulate different scenarios.

## 🔐 Test Credentials for Sandbox

When the Plaid Link modal opens, use these test credentials:

### Default Test Institution: "First Platypus Bank"

1. **Search for**: Type "First Platypus Bank" or just "platypus"
2. **Username**: `user_good`
3. **Password**: `pass_good`
4. **MFA Code** (if prompted): `1234`

### Other Test Institutions

Plaid provides several test institutions for different scenarios:

| Institution Name | Username | Password | Description |
|-----------------|----------|----------|-------------|
| **First Platypus Bank** | `user_good` | `pass_good` | Default successful case |
| **First Gingham Credit Union** | `user_good` | `pass_good` | Another test bank |
| **Tattersall Federal Credit Union** | `user_good` | `pass_good` | Test credit union |

## 📱 Phone Number Issue

If you're seeing an "invalid phone number" error:

### The Issue
Plaid Sandbox doesn't require real phone numbers, but the Link flow might still ask for verification in certain configurations.

### Solutions

**Option 1: Skip Phone Verification (Recommended for Development)**

Update the link token creation to skip phone verification:

```typescript
// In src/plaid-integration/index.ts
async createLinkToken(userId: string): Promise<LinkTokenResponse> {
  // ... existing code ...

  const linkToken = await this.makePlaidRequest<{ link_token: string; expiration: string }>(
    '/link/token/create',
    {
      client_id: config.clientId,
      secret: config.secret,
      user: { client_user_id: userId },
      client_name: 'Budget Copilot',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
      // Add this to skip phone verification in sandbox
      webhook: 'https://example.com/webhook', // Optional
    }
  );
}
```

**Option 2: Use Plaid's Test Phone Number**

If phone verification is required, use this test phone number:
- **Phone**: `415-555-0123` (any test number works in sandbox)
- **Verification Code**: `123456` or `1234`

**Option 3: Configure Link to Skip Verification**

In your frontend Plaid Link configuration, you can add:

```javascript
// In your React component
const config = {
  token: linkToken,
  onSuccess: (public_token, metadata) => {
    // Handle success
  },
  // Add this to minimize verification steps
  env: 'sandbox',
};
```

## 🎯 Quick Test Flow

Here's the complete flow to test in sandbox:

1. **Start Backend**
   ```bash
   npm run dev
   ```

2. **Start Frontend**
   ```bash
   cd client && npm run dev
   ```

3. **Click "Connect Bank Account"**

4. **In Plaid Link Modal:**
   - Search: "First Platypus Bank"
   - Username: `user_good`
   - Password: `pass_good`
   - If MFA prompt: `1234`
   - If phone prompt: `415-555-0123`
   - If verification code: `123456`

5. **Success!** You should see test transactions appear

## 🧪 Testing Different Scenarios

Plaid provides different test credentials for various scenarios:

### Successful Authentication
- Username: `user_good`
- Password: `pass_good`
- Result: Successfully connects and returns transactions

### Invalid Credentials (to test error handling)
- Username: `user_bad`
- Password: `pass_bad`
- Result: Returns invalid credentials error

### Account Locked
- Username: `user_locked`
- Password: `pass_good`
- Result: Returns account locked error

## 🔍 Debugging Tips

### Check Your Configuration

Make sure your `.env` has:
```env
PLAID_CLIENT_ID=690f66d2f18e6a001f20e17e
PLAID_SECRET=f4ff82b0f719bf2a71c10469e5dc14
PLAID_ENVIRONMENT=sandbox
```

### Verify API Calls

Check the backend console logs:
```bash
# You should see:
[INFO] Creating link token { userId: 'test_user_123', environment: 'sandbox' }
```

### Check Browser Console

Open browser DevTools (F12) and check:
- Network tab for API calls to Plaid
- Console for any JavaScript errors
- Make sure link token is being received

### Common Errors

**"invalid_credentials"**
- You entered wrong test credentials
- Use `user_good` / `pass_good`

**"invalid_phone_number"**
- Use `415-555-0123` or any format like `(555) 123-4567`
- Or skip phone verification (see Option 1 above)

**"link_token_expired"**
- Link tokens expire after 4 hours
- Refresh the page to get a new token

**"invalid_request"**
- Check your Plaid credentials in `.env`
- Make sure `PLAID_ENVIRONMENT=sandbox`

## 📚 Additional Resources

- **Plaid Sandbox Guide**: https://plaid.com/docs/sandbox/
- **Plaid Link Customization**: https://plaid.com/docs/link/
- **Test Credentials**: https://plaid.com/docs/sandbox/test-credentials/

## 💡 Pro Tips

1. **Use Sandbox Only for Development**: Never use sandbox credentials in production
2. **Test Different Scenarios**: Try different test banks to see various account types
3. **Check Logs**: Both backend and browser console provide helpful debugging info
4. **Refresh Token**: If Link isn't working, try refreshing to get a new link token

---

**Still having issues?** Check the backend logs with `npm run dev` to see if the link token is being created successfully.
