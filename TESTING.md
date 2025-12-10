# Testing Guide

This project uses Jest for unit/integration testing and Playwright for end-to-end testing.

## Unit & Integration Tests (Jest + React Testing Library)

### Running Tests

```bash
# Run tests in watch mode (development)
npm test

# Run tests once (CI)
npm run test:ci

# Run tests with coverage report
npm run test:coverage
```

### Writing Tests

Tests should be placed in `__tests__` directories next to the code they test:

```
src/
  components/
    ui/
      button.tsx
      __tests__/
        button.test.tsx
  lib/
    utils.ts
    __tests__/
      utils.test.ts
```

### Example Unit Test

```typescript
import { render, screen } from '@testing-library/react'
import { Button } from '../button'

describe('Button', () => {
  it('should render button with text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument()
  })
})
```

### Mocks

Firebase, Next.js router, and other external dependencies are automatically mocked in `jest.setup.ts`.

## End-to-End Tests (Playwright)

### Running E2E Tests

```bash
# Run E2E tests
npm run test:e2e

# Run E2E tests in UI mode (interactive)
npm run test:e2e:ui
```

### Writing E2E Tests

E2E tests should be placed in the `e2e/` directory:

```
e2e/
  auth.spec.ts
  inventory.spec.ts
  orders.spec.ts
```

### Example E2E Test

```typescript
import { test, expect } from '@playwright/test'

test('should login successfully', async ({ page }) => {
  await page.goto('/login')

  await page.fill('input[name="email"]', 'test@example.com')
  await page.fill('input[name="password"]', 'password123')
  await page.click('button[type="submit"]')

  await expect(page).toHaveURL('/dashboard')
})
```

## Best Practices

1. **Test user behavior, not implementation details**
   - Use `getByRole`, `getByLabelText` instead of `getByTestId`
   - Test what users see and do

2. **Keep tests simple and focused**
   - One assertion per test (when possible)
   - Clear test names that describe the expected behavior

3. **Use beforeEach for common setup**
   ```typescript
   beforeEach(() => {
     // Setup code that runs before each test
   })
   ```

4. **Mock external dependencies**
   - API calls should be mocked
   - Database interactions should be mocked
   - Use `jest.mock()` for modules

5. **Aim for high coverage on critical paths**
   - Authentication flows
   - Payment processing
   - Data validation
   - Business logic in services

## CI/CD Integration

Tests run automatically in CI using:
- `npm run test:ci` for unit tests
- `npm run test:e2e` for E2E tests

## Troubleshooting

### Firebase errors in tests
Firebase is mocked in `jest.setup.ts`. If you see Firebase errors, ensure the mock covers the APIs you're using.

### Next.js router errors
The Next.js router is mocked in `jest.setup.ts`. Update the mock if you need additional router functionality.

### Playwright browser not found
Run `npx playwright install` to install browser binaries.
