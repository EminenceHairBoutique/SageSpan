import { expect, test, type Page } from "@playwright/test";

/**
 * PR-002 browser acceptance (S-06): a household whose only account is outside the
 * supported RMD scope can be approved by a professional, but the UI, the approvals
 * list and the exported packet all label it "reviewed with limitations" and never
 * "verified". Runs after assurance-flow.spec.ts against the same dedicated state
 * file. Okafor's IRA names a spouse as sole primary beneficiary for the entire
 * year, which puts it on the Joint Life table — outside the published Uniform
 * Lifetime rule set — so the engine returns UNSUPPORTED with a verified receipt.
 * N-02 retry semantics are covered by the TS and SQL suites (they need a failing
 * calculator mid-flow, which the browser cannot stage deterministically).
 */
async function switchPersona(page: Page, userId: string, displayName: string) {
  await page.selectOption("#persona", userId);
  await expect(page.getByText(`Acting as ${displayName}`)).toBeVisible({ timeout: 15_000 });
}

test("Okafor: unsupported-only coverage is approvable but labelled 'reviewed with limitations' everywhere", async ({ page }) => {
  await page.goto("/demo/app/households/hh_okafor/review");
  await switchPersona(page, "user_hp_advisor", "Marcus Lee");
  const dob = page.locator("#conf_okafor_dob");
  await dob.getByRole("radio").first().check();
  await dob.getByLabel(/Rationale/).first().fill("Custodian profile is the primary identity record for the date of birth.");
  await dob.getByRole("button", { name: "Resolve with chosen source" }).click();
  await expect(dob.getByText(/Resolved by Marcus Lee/)).toBeVisible({ timeout: 15_000 });

  await switchPersona(page, "user_hp_analyst", "Priya Raman");
  await page.goto("/demo/app/households/hh_okafor");
  await expect(page.getByText("No blockers")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /Freeze snapshot/ }).click();
  await expect(page.getByText(/Snapshot snap_[a-f0-9]+ \(revision \d+\) frozen/)).toBeVisible({ timeout: 15_000 });
  await page.goto("/demo/app/households/hh_okafor/checks");
  await page.getByRole("button", { name: /Run independent RMD check/ }).click();
  await expect(page.getByTestId("coverage-panel")).toBeVisible({ timeout: 30_000 });
  const panel = page.getByTestId("coverage-panel");
  await expect(panel.getByText(/Outside supported scope|Verified \(not required\)/)).toBeVisible();
  const unsupported = (await panel.getByText("Outside supported scope").count()) > 0;
  await page.getByRole("button", { name: /Send to review/ }).click();
  await expect(page.getByText("Sent to review.")).toBeVisible({ timeout: 15_000 });

  await switchPersona(page, "user_hp_advisor", "Marcus Lee");
  await page.goto("/demo/app/households/hh_okafor/review");
  for (const note of await page.getByLabel("Disposition note").all()) {
    await note.fill("Reviewed; classification acknowledged by the advisor.");
    await page.getByRole("button", { name: "Record disposition" }).first().click();
    await expect(page.getByText(/Marcus Lee \(ADVISOR\) on/).first()).toBeVisible({ timeout: 15_000 });
  }
  await page.getByLabel("Review rationale").fill("Reviewed; the account is outside the supported RMD check scope.");
  await page.getByRole("button", { name: /Record review/ }).click();
  await expect(page.getByText("Review recorded.")).toBeVisible({ timeout: 15_000 });

  await switchPersona(page, "user_hp_cco", "Dana Whitfield");
  const expected = unsupported ? "Reviewed with limitations" : "Supported check verified";
  await expect(page.getByText(new RegExp(`If approved now: ${expected}`))).toBeVisible();
  await page.getByLabel("Approval rationale").fill("Professional approval recorded with the coverage limitation disclosed.");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /Approve \(professional act\)/ }).click();
  await expect(page.getByText(/^Approved\./)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(`Approved: ${expected}`)).toBeVisible({ timeout: 15_000 });

  // Approvals list carries the typed outcome
  await page.goto("/demo/app/approvals");
  await expect(page.getByRole("row", { name: /Okafor/ }).getByText(expected)).toBeVisible({ timeout: 15_000 });

  // Packet title and coverage block derive from actual coverage
  await page.goto("/demo/app/households/hh_okafor/evidence");
  await page.getByRole("button", { name: /Generate evidence packet/ }).click();
  await expect(page.getByText(/Packet pkt_[a-f0-9]+ ready/)).toBeVisible({ timeout: 15_000 });
  const jsonHref = await page.getByRole("link", { name: "JSON" }).first().getAttribute("href");
  const res = await page.request.get(jsonHref!, { maxRetries: 2 });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { packet: { packet_version: string; title: string; coverage: { outcome: string; summary: { accounts_in_scope: number; verified: number; unsupported: number } }; scope: { accounts: Array<{ coverage: string }> } } };
  expect(body.packet.packet_version).toBe("sagespan.evidence-packet.v2");
  if (unsupported) {
    expect(body.packet.coverage.outcome).toBe("REVIEWED_WITH_LIMITATIONS");
    expect(body.packet.title).toContain("reviewed with limitations");
    expect(body.packet.title).toContain("no supported checks");
    expect(body.packet.coverage.summary.verified).toBe(0);
    expect(JSON.stringify(body.packet.title)).not.toMatch(/supported check verified/i);
  } else {
    expect(body.packet.coverage.outcome).toBe("SUPPORTED_CHECK_VERIFIED");
  }
  const html = await page.request.get(jsonHref!.replace("format=json", "format=html"), { maxRetries: 2 });
  expect(await html.text()).toContain("Coverage outcome");
});
