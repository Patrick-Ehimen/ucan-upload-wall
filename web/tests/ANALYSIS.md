# Analysis: deContact Test Patterns

This document analyzes the Playwright test patterns from [deContact](https://github.com/NiKrause/deContact) and how they were adapted for this project.

## deContact Test Architecture

### File Structure

```
deContact/
├── playwright.config.js         # Playwright configuration
├── tests/
│   ├── BasicAddressExchange.spec.js
│   └── MyDevicesAutoSync.spec.js
└── .env                         # Environment variables (not in repo)
```

### Key Patterns

#### 1. Module-Level Browser Launch

```javascript
// From deContact/tests/BasicAddressExchange.spec.js
import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: process.env.HEADLESS === "true" ? process.env.HEADLES === "true" : true
});
```

**Why?** This creates a single browser instance shared across all tests in the file, reducing overhead.

#### 2. Multiple Browser Contexts

```javascript
test.beforeAll(async ({ browser }) => {
  test.setTimeout(10000);
  pageAlice = await initializeNewPage(browser, users[0]);
  pageBob = await initializeNewPage(browser, users[1]);
});
```

**Why?** Each context is isolated (separate cookies, storage, etc.) but shares the same browser instance.

#### 3. Helper Function: `initializeNewPage()`

```javascript
async function initializeNewPage(browser, user) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const page_url = process.env.PAGE_URL;

  await page.goto(page_url);
  await page.evaluate(() => window.localStorage.clear());
  await page.evaluate(() => window.sessionStorage.clear());
  
  // ... setup user (generate DID, fill form, etc.)
  
  return page;
}
```

**Why?** Encapsulates the setup logic for a fresh user session.

#### 4. User Data Structure

```javascript
const users = [
  {
    identity: 'Alice',
    firstname: 'Alice',
    lastname: 'Maier',
    street: 'Schulgasse 5',
    zipcode: '84444',
    did: '',  // Populated during setup
    city: 'Berlin',
    country: 'Germany'
  },
  {
    identity: 'Bob',
    firstname: 'Bob',
    lastname: 'Dylan',
    // ...
  }
];
```

**Why?** Centralizes test data and makes it easy to add more users.

#### 5. Test Lifecycle

```javascript
test.describe('Simple exchange of address between Alice and Bob', async () => {
  let pageAlice, pageBob;

  test.beforeAll(async ({ browser }) => {
    // Initialize pages
  });

  test('Alice and Bob can exchange addresses', async () => {
    // Test logic using pageAlice and pageBob
  });

  test.afterAll(async () => {
    await Promise.all([
      pageAlice.close(),
      pageBob.close()
    ]);
  });
});
```

**Why?** Setup once, run multiple tests, cleanup at the end.

## Adaptations for UCAN Upload Wall

### Changes Made

#### 1. TypeScript Instead of JavaScript

```typescript
// Our implementation
import { test, expect, Browser, Page, BrowserContext } from '@playwright/test';
```

**Why?** Better type safety and IDE support.

#### 2. WebAuthn Authentication

```typescript
async function authenticateUser(page: Page, user: typeof users[0]) {
  const authButton = page.getByRole('button', { name: /authenticate|biometric|create did/i }).first();
  await authButton.click();
  
  // Wait for WebAuthn prompt and DID creation
  await page.waitForTimeout(5000);
  
  // Extract DID from page
  const didElement = page.locator('code:has-text("did:key:")').first();
  // ...
}
```

**Difference**: deContact generates DIDs programmatically, we use WebAuthn biometric authentication.

#### 3. UCAN Delegation Flow

```typescript
test('3. Alice: Create delegation to Bob', async () => {
  // Navigate to delegations tab
  await pageAlice.getByRole('button', { name: /delegations/i }).click();
  
  // Create delegation
  await pageAlice.getByLabel(/target did/i).fill(users[1].did);
  await pageAlice.getByRole('button', { name: /create/i }).click();
  
  // Extract delegation proof
  const delegationProof = await getDelegationProof(pageAlice);
  users[0].delegationProof = delegationProof;
});

test('4. Bob: Import delegation from Alice', async () => {
  // Import the delegation
  await pageBob.getByLabel(/proof/i).fill(users[0].delegationProof);
  await pageBob.getByRole('button', { name: /import/i }).click();
});
```

**Why?** This enables Bob to upload to Alice's Storacha space.

#### 4. File Upload Helpers

```typescript
async function uploadFile(page: Page, fileName: string, content: string) {
  const buffer = Buffer.from(content, 'utf-8');
  const fileInput = page.locator('input[type="file"]');
  
  if (await fileInput.count() > 0) {
    await fileInput.setInputFiles({
      name: fileName,
      mimeType: 'text/plain',
      buffer: buffer,
    });
  } else {
    // Handle drag-drop zone
    // ...
  }
}
```

**Why?** Supports both file input and drag-drop upload methods.

#### 5. Environment Variables for Credentials

```bash
# .env
ALICE_STORACHA_KEY=...
ALICE_STORACHA_PROOF=...
ALICE_STORACHA_SPACE_DID=...
```

**Why?** Alice needs real Storacha credentials to create valid delegations.

## Comparison Table

| Feature | deContact | UCAN Upload Wall |
|---------|-----------|------------------|
| **Language** | JavaScript | TypeScript |
| **Browser Launch** | Module-level `chromium.launch()` | Same pattern |
| **Contexts** | Separate contexts per user | Same pattern |
| **Authentication** | Seed phrase | WebAuthn biometric |
| **Data Sharing** | P2P address exchange | UCAN delegation |
| **Storage** | OrbitDB | Storacha (web3.storage) |
| **Helper Functions** | Form filling, address exchange | WebAuthn, delegation, file upload |
| **Environment** | `PAGE_URL`, `SEED_TEST` | `PAGE_URL`, Alice's credentials |

## Key Learnings

### What Worked Well

1. **Shared Browser Pattern**: Significantly reduces test execution time
2. **Helper Functions**: Makes tests readable and maintainable
3. **User Data Structure**: Easy to extend with more users
4. **Module-Level Setup**: Reduces repetitive code

### Challenges

1. **WebAuthn in Headless Mode**: Requires virtual authenticator or headed mode
2. **Delegation Proof Extraction**: Had to handle multiple UI patterns
3. **Async Operations**: File uploads and listings need proper waiting

### Best Practices Applied

1. ✅ Clear test descriptions with emoji indicators (🔵 Alice, 🟢 Bob)
2. ✅ Generous timeouts for authentication and uploads
3. ✅ Multiple fallback strategies for element selection
4. ✅ Comprehensive error messages
5. ✅ Environment variable configuration
6. ✅ Test isolation through separate contexts

## Future Improvements

### Short Term

- [ ] Add `data-testid` attributes to UI components for more reliable selectors
- [ ] Configure virtual authenticator for headless WebAuthn
- [ ] Add more test scenarios (error cases, permission denied, etc.)

### Long Term

- [ ] Visual regression testing
- [ ] Performance benchmarking
- [ ] CI/CD integration
- [ ] Multi-browser testing (Firefox, Safari)
- [ ] Mobile viewport testing

## References

- [deContact Repository](https://github.com/NiKrause/deContact)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [WebAuthn Testing](https://playwright.dev/docs/chrome-extensions#headless-mode)
- [UCAN Specification](https://github.com/ucan-wg/spec)

---

**Note**: The test patterns from deContact were excellent foundation for testing distributed, multi-user applications. The key adaptation was replacing P2P communication with UCAN delegation, which required handling credentials and delegation proofs.
