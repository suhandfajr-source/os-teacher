import { test, expect } from '@playwright/test';

test('App shell renders without errors', async ({ page }) => {
  await page.goto('/');

  // Should redirect to login
  await expect(page).toHaveURL(/.*\/login/);

  // Check if Login card is visible
  await expect(page.getByText('Masuk', { exact: true }).first()).toBeVisible();
  
  // Check if register link is present
  await expect(page.getByRole('link', { name: 'Daftar sekarang' })).toBeVisible();
});
