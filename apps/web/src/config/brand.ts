/**
 * Centralised brand configuration. SageSpan is a PROVISIONAL working name
 * pending trademark and domain clearance; everything brand-related reads from
 * here so a rename is a configuration change.
 */
export const brand = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME?.trim() || "SageSpan",
  tagline: process.env.NEXT_PUBLIC_BRAND_TAGLINE?.trim() || "Clear money decisions, realistic plans, independent checks",
  status: "provisional" as const,
  legalNotice: "Provisional working name pending trademark and domain clearance. Not a registered mark.",
  /** V5 (2026-11-05): one platform, two audiences. */
  productNoun: "financial clarity, retirement planning and independent plan assurance",
  personalCta: "Plan My Finances",
  firmCta: "Explore for Firms",
  /** Kept for the assurance pillar's own copy. */
  assuranceTagline: "Independent assurance for every retirement plan",
  contactNote: "Pilot interest submissions in this build are stored locally and are not transmitted to any external service.",
};

export const SYNTHETIC_BANNER = "Synthetic demonstration data. No real client, firm, custodian or planning vendor is represented. Reviewer identities are simulated.";
