import { describe, expect, it } from "vitest";
import { fieldLabel, parseFieldErrors } from "@/ui/fieldErrors";
import { formatWhen, humanize, shortHash } from "@/ui/format";

describe("humanize", () => {
  it("lowercases and replaces underscores", () => {
    expect(humanize("SOURCE_CONFLICT")).toBe("source conflict");
    expect(humanize("REVIEWED_WITH_LIMITATIONS", { capitalize: true })).toBe("Reviewed with limitations");
  });
  it("is safe on empty input", () => {
    expect(humanize(null)).toBe("");
    expect(humanize(undefined)).toBe("");
    expect(humanize("  ")).toBe("");
  });
});

describe("formatWhen", () => {
  it("renders ISO timestamps as recorded, without time-zone conversion", () => {
    expect(formatWhen("2026-11-06T09:12:34.000Z")).toBe("2026-11-06 09:12:34");
    expect(formatWhen("2026-11-06T09:12:34Z", { precision: "minute" })).toBe("2026-11-06 09:12");
    expect(formatWhen("2026-11-06T09:12:34Z", { precision: "date" })).toBe("2026-11-06");
    expect(formatWhen("2026-11-06T09:12:34Z", { utcSuffix: true })).toBe("2026-11-06 09:12:34 UTC");
  });
  it("keeps plain dates and unknown strings, and shows a dash for nothing", () => {
    expect(formatWhen("2026-11-06")).toBe("2026-11-06");
    expect(formatWhen("yesterday")).toBe("yesterday");
    expect(formatWhen(null)).toBe("—");
    expect(formatWhen("")).toBe("—");
  });
  it("accepts Date objects", () => {
    expect(formatWhen(new Date("2026-01-02T03:04:05Z"), { precision: "minute" })).toBe("2026-01-02 03:04");
  });
});

describe("shortHash", () => {
  const sha = "859c42fc45f63719fa083ece7009852c15b4dbda332414d1f91489d532b14124";
  it("truncates with an ellipsis and keeps the full value", () => {
    expect(shortHash(sha)).toEqual({ short: "859c42fc45f6…", full: sha });
    expect(shortHash(sha, 8).short).toBe("859c42fc…");
  });
  it("leaves short values alone and dashes empties", () => {
    expect(shortHash("snap_1")).toEqual({ short: "snap_1", full: "snap_1" });
    expect(shortHash(null)).toEqual({ short: "—", full: "" });
  });
});

describe("parseFieldErrors", () => {
  it("maps VALIDATION messages built from Zod issues to field paths", () => {
    const parsed = parseFieldErrors({ ok: false, code: "VALIDATION", message: "label: Required; balance: Invalid decimal; observed_monthly_amounts.2: Expected number" });
    expect(parsed.fields).toEqual([
      { path: "label", message: "Required" },
      { path: "balance", message: "Invalid decimal" },
      { path: "observed_monthly_amounts.2", message: "Expected number" },
    ]);
    expect(parsed.general).toEqual([]);
  });
  it("keeps segments without a path at form level and ignores non-validation results", () => {
    expect(parseFieldErrors({ ok: false, code: "VALIDATION", message: "At least one observed month is needed" })).toEqual({ fields: [], general: ["At least one observed month is needed"] });
    expect(parseFieldErrors({ ok: false, code: "PERMISSION_DENIED", message: "label: nope" })).toEqual({ fields: [], general: [] });
    expect(parseFieldErrors({ ok: true })).toEqual({ fields: [], general: [] });
    expect(parseFieldErrors(null)).toEqual({ fields: [], general: [] });
  });
  it("labels paths in plain words", () => {
    expect(fieldLabel("balance_as_of")).toBe("Balance as of");
    expect(fieldLabel("observed_monthly_amounts.2")).toBe("Observed monthly amounts (item 3)");
  });
});
