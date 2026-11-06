import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * Browser flow against the real Next.js app and the real Python calculation
 * service (both started by playwright.config.ts). Uses a dedicated demo state
 * file so the interactive demo is not disturbed.
 */
const STATE = path.resolve(__dirname, "../.demo-state/e2e-state.json");

async function switchPersona(page: Page, userId: string, displayName: string) {
  await page.selectOption("#persona", userId);
  await expect(page.getByText(`Acting as ${displayName}`)).toBeVisible({ timeout: 15_000 });
}

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  if (existsSync(STATE)) unlinkSync(STATE);
});

test("public site navigation and pricing calculator", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Clear money decisions, realistic plans, independent checks");
  await expect(page.getByText("$25,098.04").first()).toBeVisible();
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "For Advisors & Firms" }).click();
  await expect(page).toHaveURL(/\/firms$/);
  await expect(page.getByText("Independent plan assurance, one supported check at a time")).toBeVisible();
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Security & Trust" }).click();
  await expect(page.getByText("Design approach, not a certification")).toBeVisible();
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Pricing" }).click();
  await expect(page.getByText("Proposed, illustrative, not yet offered")).toBeVisible();
  await expect(page.getByRole("cell", { name: "$2,150", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "$3,900", exact: true })).toBeVisible();
  await page.waitForLoadState("networkidle"); // ensure the client calculator has hydrated
  await page.getByLabel("Active monitored households (number)").fill("1000");
  await expect(page.getByTestId("price-monthly")).toHaveText("$3,900");
  await page.getByLabel("Active monitored households (number)").fill("100");
  await expect(page.getByTestId("price-monthly")).toHaveText("$750");
  // the V3 Product URL still resolves (redirect to the firms page)
  await page.goto("/product");
  await expect(page).toHaveURL(/\/firms$/);
  await page.goto("/demo");
  await expect(page.getByText("Interactive synthetic tour · Firm")).toBeVisible();
  await page.getByRole("link", { name: "Start the tour" }).click();
  await expect(page).toHaveURL(/\/demo\/app\/reviews/);
});

test("unsupported import is rejected with an actionable explanation", async ({ page }) => {
  await page.goto("/demo/app/households/hh_reyes/imports");
  await switchPersona(page, "user_hp_analyst", "Priya Raman");
  await page.setInputFiles('input[name="file"]', { name: "statement.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from("binary") });
  await page.getByRole("button", { name: "Upload and validate" }).click();
  await expect(page.getByText(/files are not supported/)).toBeVisible();
});

test("Patel: conflict blocks freeze; resolve, document exception, freeze, check, review, approve, export", async ({ page }) => {
  await page.goto("/demo/app/households/hh_patel");
  await switchPersona(page, "user_hp_analyst", "Priya Raman");
  await expect(page.getByText("Synthetic demonstration data")).toBeVisible();
  const freeze = page.getByRole("button", { name: /Freeze snapshot/ });
  await expect(freeze).toBeDisabled();
  await expect(page.getByText(/custodian statement \$640,000\.00/).first()).toBeVisible();
  await expect(page.getByText(/\$612,000\.00/).first()).toBeVisible();

  // Resolve the material conflict in favour of the custodian statement.
  await page.goto("/demo/app/households/hh_patel/review");
  const balanceCard = page.locator("#conf_patel_balance");
  await balanceCard.getByRole("radio").first().check();
  await balanceCard.getByLabel(/Rationale/).first().fill("Custodian statement is primary evidence and governs the year-end balance.");
  await balanceCard.getByRole("button", { name: "Resolve with chosen source" }).click();
  await expect(balanceCard.getByText(/Resolved by Priya Raman/)).toBeVisible({ timeout: 15_000 });

  // Analyst cannot document the nonmaterial exception; the CCO can.
  const labelCard = page.locator("#conf_patel_custodian");
  await expect(labelCard.getByRole("button", { name: /Document exception/ })).toBeDisabled();
  await switchPersona(page, "user_hp_cco", "Dana Whitfield");
  await labelCard.getByLabel("Exception rationale").fill("Label difference is cosmetic; custodian identity confirmed on the profile.");
  await labelCard.getByRole("button", { name: /Document exception/ }).click();
  await expect(labelCard.getByText(/Exception documented by Dana Whitfield/)).toBeVisible({ timeout: 15_000 });

  // Freeze as analyst.
  await switchPersona(page, "user_hp_analyst", "Priya Raman");
  await page.goto("/demo/app/households/hh_patel");
  await expect(page.getByText("No blockers")).toBeVisible();
  await page.getByRole("button", { name: /Freeze snapshot/ }).click();
  await expect(page.getByText(/Snapshot snap_[a-f0-9]+ \(revision \d+\) frozen/)).toBeVisible({ timeout: 15_000 });

  // Run the independent check against the real Python service.
  await page.goto("/demo/app/households/hh_patel/checks");
  await expect(page.getByText(/Reachable · engine/)).toBeVisible();
  await page.getByRole("button", { name: /Run independent RMD check/ }).click();
  await expect(page.getByText("Arithmetic PASS").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: /\$25,098\.04/ }).first()).toBeVisible();
  await expect(page.getByText("Source conflict").first()).toBeVisible();
  await expect(page.getByText("request hash verified").first()).toBeVisible();
  await page.getByRole("button", { name: /\$25,098\.04/ }).first().click();
  await expect(page.getByRole("dialog")).toContainText("640000.00 / 25.5");
  await expect(page.getByRole("dialog")).toContainText("rmd.uniform_lifetime_table@2022.1");
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  const snapshotId = (await page.locator("code", { hasText: /^snap_/ }).first().textContent())!.trim();
  await page.getByRole("button", { name: /Send to review/ }).click();
  await expect(page.getByText("Sent to review.")).toBeVisible({ timeout: 15_000 });

  // A forged approval through the API as the restricted viewer is refused server-side.
  await switchPersona(page, "user_hp_viewer", "Sam Okoro");
  const forged = await page.request.post(`/api/snapshots/${snapshotId}/review`, { data: { decision: "APPROVED", rationale: "forged approval attempt via API", conflict_attestation: true } });
  expect(forged.status()).toBe(403);

  // Advisor dispositions and records the review.
  await switchPersona(page, "user_hp_advisor", "Marcus Lee");
  await page.goto("/demo/app/households/hh_patel/review");
  await page.getByLabel("Disposition note").fill("Plan used a superseded balance; advisor to re-run the plan with the confirmed value.");
  await page.getByRole("button", { name: "Record disposition" }).click();
  await expect(page.getByText(/Marcus Lee \(ADVISOR\) on/).first()).toBeVisible({ timeout: 15_000 });
  await page.getByLabel("Review rationale").fill("Reviewed the receipt, source facts and discrepancy classification.");
  await page.getByRole("button", { name: /Record review/ }).click();
  await expect(page.getByText("Review recorded.")).toBeVisible({ timeout: 15_000 });

  // CCO approves with attestation (separation of duties satisfied: analyst froze and ran).
  await switchPersona(page, "user_hp_cco", "Dana Whitfield");
  await page.getByLabel("Approval rationale").fill("Independent check reproduced; difference attributable to the plan's input balance.");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /Approve \(professional act\)/ }).click();
  await expect(page.getByText(/^Approved\./)).toBeVisible({ timeout: 15_000 });

  // Export the packet and verify the download carries metadata and limitations.
  await page.goto("/demo/app/households/hh_patel/evidence");
  await page.getByRole("button", { name: /Generate evidence packet/ }).click();
  await expect(page.getByText(/Packet pkt_[a-f0-9]+ ready/)).toBeVisible({ timeout: 15_000 });
  const jsonHref = await page.getByRole("link", { name: "JSON" }).first().getAttribute("href");
  // `page.request` pools keep-alive sockets. The forged-approval POST above left one idle; the Next dev
  // server closes idle sockets after its 5 s keep-alive timeout, and the UI steps in between take about
  // that long on CI, so this GET can reuse the socket at the moment the server closes it
  // (`read ECONNRESET`, CI run 42174852606). `maxRetries` re-sends only on ECONNRESET, on a fresh socket.
  const res = await page.request.get(jsonHref!, { maxRetries: 2 });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { packet_sha256: string; packet: { title: string; snapshot: { content_sha256: string }; engine: { version: string }; limitations: string[]; reviews: Array<{ decision: string }> } };
  expect(body.packet_sha256).toMatch(/^[0-9a-f]{64}$/);
  expect(body.packet.title).toBe("Review evidence packet");
  expect(body.packet.engine.version).toBe("0.1.0");
  expect(body.packet.limitations.join(" ")).toContain("not an SEC examination certification");
  expect(body.packet.reviews.map((r) => r.decision)).toContain("APPROVED");
  const html = await page.request.get(jsonHref!.replace("format=json", "format=html"));
  expect(await html.text()).toContain("Review evidence packet");
});

test("cross-tenant access: Northline personas cannot see Harbor Point households", async ({ page }) => {
  await page.goto("/demo/app/reviews");
  await switchPersona(page, "user_nl_cco", "Elena Brooks");
  await expect(page.getByRole("link", { name: "Bauer household" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Patel household" })).toHaveCount(0);
  const res = await page.request.get("/api/households/hh_patel/facts");
  expect(res.status()).toBe(404);
  await page.goto("/demo/app/households/hh_patel");
  await expect(page.getByText("Not found")).toBeVisible();
  await page.goto("/demo/app/reviews");
  await switchPersona(page, "user_hp_analyst", "Priya Raman");
  await expect(page.getByRole("link", { name: "Patel household" })).toBeVisible();
});
