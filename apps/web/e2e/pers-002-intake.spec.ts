import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

/**
 * PERS-002 acceptance:
 *  - what-if scenarios run on the cash-flow baseline with receipts and the
 *    policy picks them up;
 *  - records can be added, edited and retired (owner only) and the baseline
 *    recomputes from a new snapshot;
 *  - "Start fresh" creates a separate workspace, blanks stay MISSING, the first
 *    baseline is honest (INSUFFICIENT_DATA until the basics exist), and the
 *    Castillo demo is untouched.
 * Runs after dual-market.spec.ts against the same dedicated state file.
 */
const STATE = path.resolve(__dirname, "../.demo-state/e2e-state.json");

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  if (existsSync(STATE)) unlinkSync(STATE);
});

test("what-if: a one-month income interruption is computed with a receipt and surfaces as a resilience step", async ({ page }) => {
  await page.goto("/demo/personal/scenarios");
  await expect(page.getByRole("heading", { name: "What if…" })).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Scenario kind").selectOption("INCOME_INTERRUPTION");
  await page.getByLabel("Income stream").selectOption({ label: "Design contract work" });
  await page.getByLabel("Interruption months").fill("1");
  await page.getByRole("button", { name: "Run what-if" }).click();
  await expect(page.getByText(/What-if computed with a receipt/)).toBeVisible({ timeout: 30_000 });
  const result = page.locator("#what-if-result");
  await expect(result.getByRole("row", { name: /Margin, typical month/ })).toContainText("-$2,266.50");
  await expect(result.getByRole("row", { name: /Margin, typical month/ })).toContainText("-$3,770.00");
  await expect(result.getByText("0.95 months")).toBeVisible();
  await expect(result.getByText("personal.cashflow_scenario@2026.1")).toBeVisible();
  await expect(result.getByText("re-derived and matched")).toBeVisible();
  await page.goto("/demo/personal/next-steps");
  await expect(page.getByText(/If Design contract work stopped, cash above your floor would last about 0\.95/)).toBeVisible({ timeout: 30_000 });
});

test("what-if: an impossible spending cut is INFEASIBLE, not capped", async ({ page }) => {
  await page.goto("/demo/personal/scenarios");
  await page.getByLabel("Scenario kind").selectOption("SPENDING_CHANGE");
  await page.getByLabel("Monthly spending change").fill("900");
  await page.getByRole("button", { name: "Run what-if" }).click();
  await expect(page.getByText("This change cannot be applied to your inputs", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/larger than typical monthly discretionary spending \(\$442\.00\)/)).toBeVisible();
});

test("records: add a commitment, then retire it; the baseline recomputes from a new snapshot each time", async ({ page }) => {
  await page.goto("/demo/personal/cash-flow");
  await page.getByRole("button", { name: "Add a recurring commitment" }).click();
  await page.getByLabel("Commitment name").fill("Internet");
  await page.getByLabel("Category").selectOption("UTILITIES");
  await page.getByLabel("Amount", { exact: true }).fill("70");
  await page.getByLabel("Next due date").fill("2026-11-25");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(/Added "Internet" as a new revision/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("cell", { name: /^Internet/ })).toBeVisible();
  // essential commitments rose by exactly 70.00 (engine figure): 3,024.50 -> 3,094.50
  await expect(page.getByRole("button", { name: "$3,094.50" }).first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole("row", { name: /^Internet/ }).getByRole("button", { name: "Retire" }).click();
  // the row (and its inline form) leave the page once the record is retired; the history keeps it
  await expect(page.getByRole("cell", { name: /^Internet/ })).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByRole("cell", { name: /-\$70\.00 Internet/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "$3,024.50" }).first()).toBeVisible({ timeout: 30_000 });
});

test("start fresh: a new workspace, blanks stay missing, honest first baseline, Castillo untouched", async ({ page }) => {
  await page.goto("/demo/personal/intake/welcome");
  await page.getByLabel("Display name").fill("Jordan");
  await page.getByLabel("Workspace kind").selectOption("HOUSEHOLD");
  await page.getByLabel("Household size").fill("2");
  await page.getByLabel("Cash floor").fill("800");
  await page.getByRole("button", { name: "Create my workspace" }).click();
  await expect(page).toHaveURL(/\/demo\/personal\/intake\/income/, { timeout: 30_000 });
  await expect(page.getByText("Start fresh · Jordan's household")).toBeVisible();
  await expect(page.getByText("Signed in as Jordan").first()).toBeVisible();

  // Income with three observed months
  await page.getByRole("button", { name: "Add an income stream" }).click();
  await page.getByLabel("Income name").fill("Salary");
  await page.getByLabel("Income kind").selectOption("SALARY");
  await page.getByLabel("Income cadence").selectOption("MONTHLY");
  await page.getByLabel("Income reliability").selectOption("REGULAR");
  await page.getByLabel("Observed monthly amounts").fill("4200\n4200\n4250");
  await page.getByLabel("Next expected date").fill("2026-11-28");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(/Added "Salary"/)).toBeVisible({ timeout: 30_000 });
  await page.getByRole("link", { name: "Continue" }).click();

  // Bills: one essential
  await expect(page.getByRole("heading", { name: "Recurring bills and commitments" })).toBeVisible();
  await page.getByRole("button", { name: "Add a commitment" }).click();
  await page.getByLabel("Commitment name").fill("Rent");
  await page.getByLabel("Category").selectOption("HOUSING");
  await page.getByLabel("Amount", { exact: true }).fill("1600");
  await page.getByLabel("Next due date").fill("2026-12-01");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(/Added "Rent"/)).toBeVisible({ timeout: 30_000 });
  await page.getByRole("link", { name: "Continue" }).click();

  // Spending: a category with NO months stays MISSING
  await expect(page.getByRole("heading", { name: "Variable spending" })).toBeVisible();
  await page.getByRole("button", { name: "Add a category" }).click();
  await page.getByLabel("Spending category").fill("Groceries");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(/Added "Groceries"/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Missing", { exact: true }).first()).toBeVisible();
  await page.getByRole("link", { name: "Continue" }).click();

  // Cash & debts: skip cash on purpose → verify warns → baseline is INSUFFICIENT_DATA
  await expect(page.getByRole("heading", { name: "Cash and debts" })).toBeVisible();
  await page.getByRole("link", { name: "Skip for now" }).click();
  await expect(page.getByRole("heading", { name: "Goals", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Skip for now" }).click();
  await expect(page.getByRole("heading", { name: "Verify the key inputs" })).toBeVisible();
  await expect(page.getByText("The baseline will say INSUFFICIENT_DATA")).toBeVisible();
  await expect(page.getByText("$800.00")).toBeVisible();
  await page.getByRole("link", { name: "Compute my baseline" }).click();
  await expect(page.getByRole("heading", { name: "Insufficient data" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/No cash balances were supplied/)).toBeVisible();

  // Add the missing balance and recompute → COMPUTED with the engine's figures
  await page.goto("/demo/personal/intake/cash-debts");
  await page.getByRole("button", { name: "Add a cash account" }).click();
  await page.getByLabel("Account name").fill("Joint checking");
  await page.getByLabel("Balance", { exact: true }).fill("3000");
  await page.getByLabel("Balance as of").fill("2026-11-06");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(/Added "Joint checking"/)).toBeVisible({ timeout: 30_000 });
  await page.goto("/demo/personal/intake/baseline");
  await expect(page.getByRole("heading", { name: "Computed" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("$4,200.00")).toBeVisible(); // median of 4200, 4200, 4250
  await expect(page.getByText("$2,600.00")).toBeVisible(); // 4200 - 1600 margin
  await page.getByRole("link", { name: /Open my Overview/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Jordan");
  await expect(page.getByRole("main").getByText(/Maya|Castillo|Design contract/)).toHaveCount(0); // only the switcher may name her

  // Castillo is untouched and still reachable via the switcher
  await page.getByLabel("Switch person").selectOption({ label: "Maya Castillo" });
  await page.getByRole("button", { name: "Switch" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Maya", { timeout: 30_000 });
  await expect(page.getByText("$1,503.50").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("main").getByText(/Jordan|Joint checking/)).toHaveCount(0);
});
