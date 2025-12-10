# E2E Tests for UCAN Upload Wall

This directory contains end-to-end tests using Playwright to test multi-browser scenarios (Alice & Bob).

## Test Structure

Based on the [deContact](https://github.com/NiKrause/deContact) test patterns, these tests create **two parallel browser contexts** to simulate different users (Alice and Bob) interacting with the app.

### Test Workflow

1. **Alice**: Authenticates with Biometric (WebAuthn) and receives a DID
2. **Bob**: Authenticates with Biometric (WebAuthn) and receives a DID  
3. **Alice**: Adds Storacha credentials (proof & key)
4. **Alice**: Creates a delegation to Bob with upload/list capabilities
5. **Bob**: Imports the delegation from Alice
6. **Alice**: Uploads a test file to her space
7. **Bob**: Uploads another test file to the **same space** (using delegation)
8. **Alice**: Lists files and sees both files (hers + Bob's)
9. **Bob**: Lists files and sees both files (hers + his)

## Setup

### 1. Install Playwright

```bash
pnpm run playwright:install
```

This installs Playwright and the Chromium browser.

### 2. Configure Environment Variables

Copy the example env file and fill in your credentials:

```bash
cp .env.test.example .env
```

Edit `.env` and add:

```bash
# Playwright Test Configuration
PAGE_URL=http://localhost:5173

# Alice's Storacha credentials (required for delegation)
# Get these from: https://console.web3.storage/
ALICE_STORACHA_KEY=your-storacha-private-key-here
ALICE_STORACHA_PROOF=your-storacha-proof-here
ALICE_STORACHA_SPACE_DID=did:key:your-space-did-here

# Optional: Run tests in headed mode (see the browser)
HEADLESS=true
```

> **Note**: You need real Storacha credentials for Alice. Get them from [console.web3.storage](https://console.web3.storage/).

### 3. WebAuthn Virtual Authenticator

These tests use **WebAuthn biometric authentication** with a **virtual authenticator** powered by Chrome DevTools Protocol (CDP).

✅ **The tests now work in both headed AND headless mode!**

The virtual authenticator simulates a hardware security key, allowing WebAuthn to work automatically without manual interaction. This is configured in `tests/helpers/webauthn.ts`.

**How it works:**

- Uses CDP's `WebAuthn.enable` and `WebAuthn.addVirtualAuthenticator`
- Simulates a CTAP2 authenticator with user verification
- Automatically handles presence simulation
- Works in both headless and headed modes

## Running Tests

### Run all tests (headless)

```bash
pnpm run test:e2e
```

### Run tests with browser visible (headed mode)

```bash
pnpm run test:e2e:headed
```

### Run tests in UI mode (interactive)

```bash
pnpm run test:e2e:ui
```

### Debug tests with step-by-step execution

```bash
pnpm run test:e2e:debug
```

### Run a specific test file

```bash
npx playwright test alice-bob-delegation.spec.ts
```

## Key Patterns from deContact

These patterns are borrowed from the [deContact tests](https://github.com/NiKrause/deContact/tree/main/tests):

### 1. Shared Browser Instance

```typescript
const browser = await chromium.launch({
  headless: process.env.HEADLESS === 'true',
});
```

One browser is launched at the module level, then multiple contexts are created from it.

### 2. Separate Browser Contexts

```typescript
test.beforeAll(async () => {
  contextAlice = await browser.newContext();
  pageAlice = await contextAlice.newPage();
  
  contextBob = await browser.newContext();
  pageBob = await contextBob.newPage();
});
```

Each user gets their own isolated context (separate cookies, localStorage, etc.).

### 3. Helper Functions

- `initializePage()`: Sets up a fresh page with cleared storage
- `authenticateUser()`: Handles WebAuthn biometric authentication
- `uploadFile()`: Uploads a file via file input or drag-drop
- `getDelegationProof()`: Extracts delegation proof from the UI
- `countVisibleFiles()`: Counts files in the file list

### 4. User Data Structure

```typescript
const users = [
  {
    name: 'Alice',
    storachaKey: process.env.ALICE_STORACHA_KEY,
    storachaProof: process.env.ALICE_STORACHA_PROOF,
    did: '', // Filled after authentication
  },
  {
    name: 'Bob',
    did: '', // Filled after authentication
  },
];
```

## Debugging

### View test report

After tests run, open the HTML report:

```bash
npx playwright show-report
```

### Screenshots & Traces

Failed tests automatically capture:
- Screenshots (`screenshot: 'only-on-failure'`)
- Traces (`trace: 'on-first-retry'`)

View traces with:

```bash
npx playwright show-trace playwright-report/trace.zip
```

## Troubleshooting

### WebAuthn fails in headless mode

Run in headed mode instead:

```bash
pnpm run test:e2e:headed
```

Or configure a virtual authenticator (advanced).

### Can't extract DID/delegation proof

The helper functions try multiple strategies to find elements. If they fail:

1. Check the DOM structure in your app
2. Update the selectors in the helper functions
3. Add `data-testid` attributes to your components for easier testing

### Tests timeout

Increase timeouts in the test:

```typescript
test('My test', async () => {
  test.setTimeout(120000); // 2 minutes
  // ... test code
});
```

## Next Steps

- Add more test scenarios (error cases, edge cases)
- Configure virtual authenticator for headless WebAuthn
- Add visual regression testing
- Set up CI/CD integration

## References

- [Playwright Documentation](https://playwright.dev/)
- [deContact Tests](https://github.com/NiKrause/deContact/tree/main/tests)
- [WebAuthn Guide](https://webauthn.guide/)
