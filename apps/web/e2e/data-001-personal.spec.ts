import { expect, test } from "@playwright/test";

/**
 * DATA-001: the production Personal routes gate honestly without Supabase; the demo Personal
 * routes are untouched by the repository refactor (same forms, same domain functions).
 * The signed-in production path runs against the real stack in CI (supabase-repository.realstack.test.ts).
 */
test("/app/personal and /app/personal/start gate when Supabase is not configured", async ({ page }) => {
  await page.goto("/app/personal");
  await expect(page.getByText("Sign-in is not available in this build")).toBeVisible();
  await expect(page.getByText("Requested: /app/personal")).toBeVisible();
  await page.goto("/app/personal/start");
  await expect(page.getByText("Requested: /app/personal/start")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create my workspace" })).toHaveCount(0);
});

test("demo Personal record forms still add a record through the shared domain path", async ({ page }) => {
  await page.goto("/demo/personal/savings-debt");
  await expect(page.getByRole("heading", { name: "Cash, reserves and what you owe" })).toBeVisible();
  await page.getByRole("button", { name: /Add a debt/ }).first().click();
  await page.getByLabel("Debt name").fill("E2E card (synthetic)");
  await page.getByLabel("Debt balance", { exact: true }).fill("420.00");
  await page.getByLabel("Debt balance as of").fill("2026-10-31");
  await page.getByLabel("APR percent", { exact: true }).fill("19.99");
  await page.getByLabel("Minimum payment", { exact: true }).fill("25");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(/Added "E2E card \(synthetic\)" as a new revision/)).toBeVisible({ timeout: 20_000 });
});
