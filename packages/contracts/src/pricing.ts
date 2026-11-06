/**
 * PROPOSED, ILLUSTRATIVE pricing hypothesis. Not a live offer. No billing.
 *
 * standard_monthly(H) = 750 + 3.50 * max(0, H - 100)
 * Design-partner pilot: $500/month for up to 50 active monitored households,
 * a separately agreed limited arrangement (not a discount on the formula).
 *
 * "Active monitored household" = a distinct family planning unit with an
 * active assurance record in the measurement month; archived, duplicate and
 * prospect-only records are excluded. A household is never charged more than
 * once because it has several persons, accounts or reviews.
 */
export const PRICING = {
  status: "PROPOSED_ILLUSTRATIVE_NOT_OFFERED",
  currency: "USD",
  standard: { minimumMonthlyUsd: 750, includedHouseholds: 100, perAdditionalHouseholdUsd: 3.5 },
  pilot: { monthlyUsd: 500, maxHouseholds: 50 },
} as const;

/** Monthly standard subscription in whole cents (integer math; no floats in the result). */
export function standardMonthlyCents(activeHouseholds: number): number {
  if (!Number.isInteger(activeHouseholds) || activeHouseholds < 0) throw new RangeError("activeHouseholds must be a non-negative integer");
  const extra = Math.max(0, activeHouseholds - PRICING.standard.includedHouseholds);
  return PRICING.standard.minimumMonthlyUsd * 100 + extra * 350;
}

export function standardMonthlyUsd(activeHouseholds: number): number {
  return standardMonthlyCents(activeHouseholds) / 100;
}

export function pilotEligible(activeHouseholds: number): boolean {
  return Number.isInteger(activeHouseholds) && activeHouseholds >= 0 && activeHouseholds <= PRICING.pilot.maxHouseholds;
}

export function pilotMonthlyUsd(activeHouseholds: number): number | null {
  return pilotEligible(activeHouseholds) ? PRICING.pilot.monthlyUsd : null;
}

export const ILLUSTRATIVE_PRICE_TABLE = [50, 100, 250, 500, 1000].map((h) => ({
  households: h,
  monthlyUsd: standardMonthlyUsd(h),
  annualRunRateUsd: standardMonthlyUsd(h) * 12,
}));

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: amount % 1 === 0 ? 0 : 2 }).format(amount);
}


/**
 * V5 consumer pricing HYPOTHESES (blueprint §12). Unvalidated research ranges to
 * test in interviews; not announced prices, no billing. A firm-client household
 * must never be billed twice for using both portals.
 */
export const CONSUMER_PRICING_HYPOTHESIS = {
  status: "UNVALIDATED_RESEARCH_HYPOTHESIS",
  currency: "USD",
  free: { label: "Educational and manual-entry tools", monthlyUsd: 0 },
  personal: { label: "Personal", monthlyUsdLow: 8, monthlyUsdHigh: 15 },
  household: { label: "Household", monthlyUsdLow: 15, monthlyUsdHigh: 30 },
  conduct: ["No covert commissions or paid steering", "Recommendation order never favours SageSpan revenue", "Any referral relationship disclosed and legally reviewed"],
} as const;
