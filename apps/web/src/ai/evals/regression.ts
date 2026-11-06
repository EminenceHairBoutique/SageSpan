import type { AiReviewReport } from "@sagespan/contracts";

/**
 * Model/prompt change regression: compare two reports produced for the same
 * scope. Promotion of a new model or prompt version is a human decision taken on
 * this diff plus the frozen 28-case suite; nothing promotes itself (AI-E26).
 */
export interface ReportDiff {
  added: string[];
  removed: string[];
  changed: Array<{ finding_id: string; fields: string[] }>;
  identical: boolean;
}

export function diffReports(before: AiReviewReport, after: AiReviewReport): ReportDiff {
  const a = new Map(before.findings.map((f) => [f.finding_id, f]));
  const b = new Map(after.findings.map((f) => [f.finding_id, f]));
  const added = [...b.keys()].filter((k) => !a.has(k));
  const removed = [...a.keys()].filter((k) => !b.has(k));
  const changed: ReportDiff["changed"] = [];
  for (const [id, fa] of a) {
    const fb = b.get(id);
    if (!fb) continue;
    const fields = (Object.keys(fa) as Array<keyof typeof fa>).filter((k) => JSON.stringify(fa[k]) !== JSON.stringify(fb[k])).map(String);
    if (fields.length) changed.push({ finding_id: id, fields });
  }
  return { added, removed, changed, identical: added.length === 0 && removed.length === 0 && changed.length === 0 };
}
