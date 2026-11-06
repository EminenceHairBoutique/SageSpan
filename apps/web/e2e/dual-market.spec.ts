import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * V5 dual-market browser flow (DUAL-001 / PERS-001 / AI-001 acceptance):
 *  - both audience paths are discoverable from the public site;
 *  - the Personal workspace shows a receipted baseline and at most three ranked
 *    actions, records a user decision as an event, recomputes after a balance
 *    change, compares debt paths and drafts a grounded AI explanation;
 *  - the firm console keeps its own navigation and gains the AI review tab;
 *  - the two workspaces never leak into each other;
 *  - the mobile layout renders the personal navigation and banner.
 * Runs against the real Next.js dev server and the real calculation service
 * (playwright.config.ts). Uses the same dedicated demo state file as the
 * assurance flow so the interactive demo is not disturbed.
 */
const STATE = path.resolve(__dirname, "../.demo-state/e2e-state.json");

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  if (existsSync(STATE)) unlinkSync(STATE);
});

async function switchPersona(page: Page, userId: string, displayName: string) {
  await page.selectOption("#persona", userId);
  await expect(page.getByText(`Acting as ${displayName}`)).toBeVisible({ timeout: 15_000 });
}

test("both audience paths are discoverable from the home page", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary" });
  for (const label of ["Personal", "Retirement Planning", "For Advisors & Firms", "How It Works", "Security & Trust", "Pricing"]) {
    await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("link", { name: "Sign In" }).first()).toBeVisible();
  await page.getByRole("link", { name: /Plan My Finances/ }).first().click();
  await expect(page).toHaveURL(/\/demo\/personal$/);
  await expect(page.getByText(/Synthetic demonstration\. Every person here is fictional/)).toBeVisible();
  await page.goto("/");
  await page.getByRole("link", { name: "Explore for Firms" }).first().click();
  await expect(page).toHaveURL(/\/firms$/);
  await page.getByRole("link", { name: "Open the firm console (synthetic)" }).click();
  await expect(page).toHaveURL(/\/demo\/app\/reviews/);
  await expect(page.getByRole("heading", { level: 1, name: "Review queue" })).toBeVisible();
  // Sign In is honest about production
  await page.goto("/app");
  await expect(page.getByText("Sign-in is not available in this build")).toBeVisible();
});

test("Personal: receipted baseline, three ranked steps, a decision event and 'Ask why'", async ({ page }) => {
  await page.goto("/demo/personal");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Where you stand, Maya");
  await expect(page.getByText("$1,503.50").first()).toBeVisible({ timeout: 30_000 }); // typical margin from the engine
  await expect(page.getByText("$3,650.00").first()).toBeVisible(); // liquid cash
  await expect(page.getByText("re-derived and matched")).toBeVisible();
  const cards = page.locator("article[aria-label]");
  await expect(cards).toHaveCount(3);
  await expect(page.getByText("Do this now").first()).toBeVisible();
  await expect(page.getByText("Consider next").first()).toBeVisible();
  await expect(page.getByText("Revisit later").first()).toBeVisible();
  const first = cards.first();
  await expect(first).toContainText("Build toward your 2-month essential buffer");
  await expect(first).toContainText("$2,399.00");
  await first.getByRole("button", { name: "Ask why" }).click();
  await expect(first.getByText(/Ranked 1 of \d+/)).toBeVisible();
  await expect(first.getByText(/decision-policy\.v1/).first()).toBeVisible();
  // a receipt is one click away from a number
  await page.getByRole("button", { name: "$3,650.00" }).first().click();
  await expect(page.getByRole("dialog")).toContainText("personal.cashflow_baseline@2026.1");
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  // record a decision: an event, not a mutation
  await first.getByRole("button", { name: "Snooze" }).click();
  await expect(first.getByText(/You: snooze/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("$1,503.50").first()).toBeVisible(); // numbers unchanged
});

test("Personal: scenarios compare debt paths with receipts; the assistant drafts a grounded explanation", async ({ page }) => {
  await page.goto("/demo/personal/scenarios");
  await expect(page.getByRole("cell", { name: "Highest rate first" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("cell", { name: "Minimums only" })).toBeVisible();
  await expect(page.getByRole("button", { name: "$3,026.04" }).first()).toBeVisible();
  await expect(page.getByText("Required minimum payments are always paid in full").first()).toBeVisible();
  await page.goto("/demo/personal/assistant");
  await page.getByRole("button", { name: /Understand my finances/ }).click();
  await expect(page.getByText(/Draft ready/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("AI draft — not advice")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Where you stand this month" })).toBeVisible();
  await expect(page.getByText("Amounts from a receipted calculation").first()).toBeVisible();
  await expect(page.getByText(/not financial, tax, investment or legal advice/)).toBeVisible();
  await page.getByRole("button", { name: "Accept" }).first().click();
  await expect(page.getByText(/accept · v1/).first()).toBeVisible({ timeout: 15_000 });
});

test("Personal: updating a balance creates a revision and recomputes; the floor flag appears", async ({ page }) => {
  await page.goto("/demo/personal/savings-debt");
  const savings = page.locator("div.rounded-lg", { hasText: "Savings" }).filter({ has: page.getByText("Update balance") }).first();
  await savings.getByText("Update balance").click();
  await savings.getByLabel("New balance for Savings").fill("400");
  await savings.getByLabel("As-of date for Savings").fill("2026-11-05");
  await savings.getByRole("button", { name: "Save new revision" }).click();
  await expect(page.getByText("savings · as of 2026-11-05 · revision 2")).toBeVisible({ timeout: 30_000 });
  await page.goto("/demo/personal");
  await expect(page.getByText("$2,550.00").first()).toBeVisible({ timeout: 30_000 }); // 2150 + 400, from the engine
  await expect(page.getByText(/below your 2-month essential buffer target|Rebuild at least one month/).first()).toBeVisible();
});

test("firm console keeps its own navigation and gains an AI draft that cites evidence", async ({ page }) => {
  await page.goto("/demo/app/reviews");
  await switchPersona(page, "user_hp_cco", "Dana Whitfield");
  const nav = page.getByRole("navigation", { name: "Console" });
  for (const label of ["Review queue", "Clients", "Imports & evidence", "Checks", "Planning studio", "AI plan review", "Reviews & approvals", "Firm settings"]) {
    await expect(nav.getByRole("link", { name: label })).toBeVisible();
  }
  await expect(page.getByText("Synthetic demonstration data")).toBeVisible();
  await expect(page.getByText("Maya Castillo")).toHaveCount(0);
  await page.goto("/demo/app/households/hh_patel/ai-review");
  await page.getByRole("button", { name: /Analyze plan/ }).click();
  await expect(page.getByText(/Draft ready: \d+ grounded finding/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("AI draft — not a review, approval or verification")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Two sources disagree on account.year_end_balance" })).toBeVisible();
  await expect(page.getByText("Unverified draft").first()).toBeVisible();
  await expect(page.getByText(/Sources: .*patel_ira_statement_2025-12-31\.txt/)).toBeVisible();
  // the firm page never shows personal records
  await expect(page.getByText(/cash_castillo|Rewards credit card/)).toHaveCount(0);
  await page.getByRole("button", { name: "Request evidence" }).first().click();
  await page.getByPlaceholder("What evidence is needed and from whom").fill("Custodian statement as of 2025-12-31 from the client.");
  await page.getByRole("button", { name: "Record request" }).click();
  await expect(page.getByText(/request evidence · v1/).first()).toBeVisible({ timeout: 15_000 });
  await page.goto("/demo/app/ai-review");
  await expect(page.getByText("draft for human review").first()).toBeVisible();
});

test("the personal workspace shows no firm data and the planning studio is honest", async ({ page }) => {
  await page.goto("/demo/personal/privacy");
  await expect(page.getByText("You have not shared anything.")).toBeVisible();
  await expect(page.getByText(/Patel|Harbor Point/)).toHaveCount(0);
  await page.goto("/demo/app/planning-studio");
  await expect(page.getByText("Proposed · not implemented")).toBeVisible();
  // no fake planning controls: the only interactive elements are navigation links, the persona <select> and Next's dev overlay
  await expect(page.locator("main").getByRole("button")).toHaveCount(0);
  await expect(page.locator("main").getByRole("textbox")).toHaveCount(0);
});

test("mobile: personal overview renders banner, navigation and content at 390px", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("/demo/personal");
  await expect(page.getByText(/Synthetic demonstration\. Every person here is fictional/)).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Personal workspace" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("My next three steps")).toBeVisible({ timeout: 30_000 });
  await context.close();
});
