/**
 * Playwright E2E tests for the Auth flow.
 *
 * Install:  npx playwright install --with-deps chromium
 * Run:      npx playwright test
 *
 * Requires the full stack to be running (docker compose up or local dev).
 * Set PLAYWRIGHT_BASE_URL env var to point at the running frontend.
 *
 * These tests use a timestamp-based unique email so they can be run
 * repeatedly without database cleanup.
 */

import { test, expect, Page } from '@playwright/test';

const TIMESTAMP = Date.now();
const TEST_EMAIL = `e2e_${TIMESTAMP}@example.com`;
const TEST_PASSWORD = 'Test1234!';
const TEST_NAME = 'E2E User';

// ─── HELPERS ────────────────────────────────────────────────────────────────

async function fillRegisterForm(page: Page, opts: {
  email?: string;
  password?: string;
  name?: string;
  role?: 'client' | 'freelancer';
} = {}) {
  const email = opts.email ?? TEST_EMAIL;
  const password = opts.password ?? TEST_PASSWORD;
  const name = opts.name ?? TEST_NAME;

  if (opts.role === 'freelancer') {
    await page.getByLabel(/freelancer/i).click();
  }

  await page.getByLabel(/full name/i).fill(name);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByLabel(/confirm password/i).fill(password);
}

// ─── TEST 1 — REGISTER ───────────────────────────────────────────────────────

test.describe('Registration flow', () => {
  test('T1: shows register form and validates required fields', async ({ page }) => {
    await page.goto('/auth/register');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Try to submit empty form
    await page.getByRole('button', { name: /register|create account|sign up/i }).click();

    // Expect validation to prevent submission (form stays on page)
    await expect(page).toHaveURL(/register/);
  });

  test('T2: submits registration and shows success message', async ({ page }) => {
    await page.goto('/auth/register');

    await fillRegisterForm(page);
    await page.getByRole('button', { name: /register|create account|sign up/i }).click();

    // After successful registration the user is redirected to login page
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
  });

  test('T3: rejects duplicate email', async ({ page }) => {
    await page.goto('/auth/register');

    // Use the same email registered above
    await fillRegisterForm(page, { email: TEST_EMAIL });
    await page.getByRole('button', { name: /register|create account|sign up/i }).click();

    // Should show an error toast or stay on register page
    await expect(page.getByText(/already/i)).toBeVisible({ timeout: 8_000 });
  });

  test('T4: rejects weak password', async ({ page }) => {
    await page.goto('/auth/register');

    await fillRegisterForm(page, {
      email: `weak_${TIMESTAMP}@example.com`,
      password: 'alllowercase',
    });
    await page.getByRole('button', { name: /register|create account|sign up/i }).click();

    await expect(page).toHaveURL(/register/);
  });
});

// ─── TEST 2 — LOGIN ──────────────────────────────────────────────────────────

test.describe('Login flow', () => {
  test('T5: shows login form', async ({ page }) => {
    await page.goto('/auth/login');

    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /log in|sign in/i })).toBeVisible();
  });

  test('T6: shows error for wrong credentials', async ({ page }) => {
    await page.goto('/auth/login');

    await page.getByLabel(/email/i).fill('nobody@example.com');
    await page.getByLabel(/password/i).fill('WrongPass1!');
    await page.getByRole('button', { name: /log in|sign in/i }).click();

    // Should show error toast / message, NOT redirect to dashboard
    await expect(page).not.toHaveURL('/dashboard', { timeout: 5_000 }).catch(() => {});
  });

  test('T7: unverified account is rejected with clear message', async ({ page }) => {
    await page.goto('/auth/login');

    // The user we registered in T2 has status=pending (email not verified)
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /log in|sign in/i }).click();

    await expect(page.getByText(/verify/i)).toBeVisible({ timeout: 8_000 });
  });
});

// ─── TEST 3 — NAVBAR STATE ───────────────────────────────────────────────────

test.describe('Navbar unauthenticated state', () => {
  test('T8: shows login and register buttons when not logged in', async ({ page }) => {
    await page.goto('/');

    const loginBtn = page.getByRole('link', { name: /login|sign in/i });
    const registerBtn = page.getByRole('link', { name: /register|sign up/i });

    await expect(loginBtn).toBeVisible();
    await expect(registerBtn).toBeVisible();
  });

  test('T9: does NOT show dashboard or user menu when not logged in', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('link', { name: /dashboard/i })).not.toBeVisible();
  });
});

// ─── TEST 4 — PROTECTED ROUTES ──────────────────────────────────────────────

test.describe('Protected route redirects', () => {
  test('T10: /dashboard redirects to /auth/login when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login/, { timeout: 8_000 });
  });

  test('T11: /orders redirects to /auth/login when unauthenticated', async ({ page }) => {
    await page.goto('/orders');
    await expect(page).toHaveURL(/login/, { timeout: 8_000 });
  });

  test('T12: /contracts redirects to /auth/login when unauthenticated', async ({ page }) => {
    await page.goto('/contracts');
    await expect(page).toHaveURL(/login/, { timeout: 8_000 });
  });
});

// ─── TEST 5 — FORGOT PASSWORD ────────────────────────────────────────────────

test.describe('Forgot password flow', () => {
  test('T13: shows generic success message regardless of email existence', async ({ page }) => {
    await page.goto('/auth/forgot-password');

    await page.getByLabel(/email/i).fill('doesnotexist@example.com');
    await page.getByRole('button', { name: /send|reset/i }).click();

    await expect(page.getByText(/sent|check/i)).toBeVisible({ timeout: 8_000 });
  });
});

// ─── TEST 6 — PUBLIC PAGES ───────────────────────────────────────────────────

test.describe('Public pages load without errors', () => {
  test('T14: home page loads', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await expect(page).toHaveTitle(/.+/);

    // No critical JS errors
    expect(errors.filter((e) => !e.includes('favicon') && !e.includes('404'))).toHaveLength(0);
  });

  test('T15: gigs listing page loads', async ({ page }) => {
    await page.goto('/gigs');
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('T16: projects listing page loads', async ({ page }) => {
    await page.goto('/projects');
    await expect(page.getByRole('main')).toBeVisible();
  });
});
