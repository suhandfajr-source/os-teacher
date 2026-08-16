import { test, expect } from '@playwright/test';

test('App shell renders without errors', async ({ page }) => {
  await page.goto('/');

  // Check if Topbar/Sidebar title is visible
  await expect(page.getByText('AI Teacher', { exact: true }).first()).toBeVisible();

  // Check if Sidebar or BottomNav items are present
  await expect(page.getByRole('link', { name: 'Beranda' }).first()).toBeVisible();
  
  // Check if main content placeholder exists
  await expect(page.getByRole('heading', { name: 'Beranda' })).toBeVisible();
});
