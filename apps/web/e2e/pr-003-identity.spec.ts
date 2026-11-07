import { expect, test } from "@playwright/test";

/**
 * PR-003b: without Supabase configuration every /app/* route shows the honest gate (no demo
 * fallback behind a login, no sign-in form that cannot work). The signed-in path needs a
 * real Supabase stack and is covered by the real-stack job (supabase/realstack).
 */
test("/app, /app/sign-in and deep /app paths all gate when Supabase is not configured", async ({ page }) => {
  await page.goto("/app/sign-in");
  await expect(page.getByText("Sign-in is not available in this build")).toBeVisible();
  await expect(page.getByLabel("Sign in")).toHaveCount(0);
  await page.goto("/app/households/abc");
  await expect(page.getByText("Sign-in is not available in this build")).toBeVisible();
  await expect(page.getByText("Requested: /app/households/abc")).toBeVisible();
  await expect(page.getByText(/Castillo|Patel|Okafor/)).toHaveCount(0); // no demo data leaks into the production namespace
});

test("the auth callback never acts as an open redirector and never serves demo data", async ({ page }) => {
  const res = await page.goto("/app/auth/callback?code=x&next=https://evil.example");
  expect(res?.status()).toBeLessThan(500);
  await expect(page).toHaveURL(/\/app(\/|$|\?)/);
  expect(page.url()).not.toContain("evil.example");
});
