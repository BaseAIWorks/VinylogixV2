import { test, expect } from '@playwright/test'

test.describe('Homepage', () => {
  test('should load homepage successfully', async ({ page }) => {
    await page.goto('/')

    // Check that the page loads and contains expected content
    await expect(page).toHaveTitle(/Vinylogix/i)
  })

  test('should navigate to login page', async ({ page }) => {
    await page.goto('/')

    // Look for login link/button
    const loginButton = page.getByRole('link', { name: /login/i })
    await loginButton.click()

    // Verify we're on the login page
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('Authentication', () => {
  test('should show login form', async ({ page }) => {
    await page.goto('/login')

    // Check for email and password inputs
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })
})
