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

/**
 * AI-CORE-002b — review aid for a live-vs-reference comparison. `diffReports`
 * keys on `finding_id`, which only works when both reports come from the same
 * deterministic provider; a live model names its findings freely ("F1"…), so
 * every finding shows as added/removed. `alignReports` instead pairs findings
 * that cite the same evidence (fact, document, check-run ids), preferring the
 * same category. It is a reading aid for the human reviewer — never a score and
 * never a promotion signal (AI-E26).
 */
export interface AlignedPair {
  reference: string;
  candidate: string;
  same_category: boolean;
  shared_refs: string[];
}
export interface ReportAlignment {
  pairs: AlignedPair[];
  /** Reference findings with no candidate citing any of their evidence: possible coverage gaps. */
  reference_only: string[];
  /** Candidate findings with no reference counterpart: new observations to read closely. */
  candidate_only: string[];
}

type AlignableFinding = AiReviewReport["findings"][number];

function refsOf(f: AlignableFinding): Set<string> {
  return new Set([...f.fact_refs, ...f.check_run_refs, ...f.document_refs.map((d) => d.id)]);
}

export function alignReports(reference: AiReviewReport, candidate: AiReviewReport): ReportAlignment {
  // score every (reference, candidate) pair that shares evidence; assign best-first globally so that a
  // finding citing overlapping evidence cannot take another finding's exact counterpart
  const scored: Array<{ r: AlignableFinding; c: AlignableFinding; shared: string[]; score: number }> = [];
  for (const r of reference.findings) {
    const rr = refsOf(r);
    for (const c of candidate.findings) {
      const cr = refsOf(c);
      const shared = [...cr].filter((x) => rr.has(x)).sort();
      if (shared.length === 0) continue;
      const jaccard = shared.length / new Set([...rr, ...cr]).size;
      scored.push({ r, c, shared, score: (c.category === r.category ? 2 : 0) + jaccard });
    }
  }
  scored.sort((x, y) => y.score - x.score || x.r.finding_id.localeCompare(y.r.finding_id) || x.c.finding_id.localeCompare(y.c.finding_id));
  const usedRef = new Set<string>();
  const usedCand = new Set<string>();
  const pairs: AlignedPair[] = [];
  for (const m of scored) {
    if (usedRef.has(m.r.finding_id) || usedCand.has(m.c.finding_id)) continue;
    usedRef.add(m.r.finding_id);
    usedCand.add(m.c.finding_id);
    pairs.push({ reference: m.r.finding_id, candidate: m.c.finding_id, same_category: m.r.category === m.c.category, shared_refs: m.shared });
  }
  const order = new Map(reference.findings.map((f, i) => [f.finding_id, i]));
  pairs.sort((x, y) => (order.get(x.reference) ?? 0) - (order.get(y.reference) ?? 0));
  return {
    pairs,
    reference_only: reference.findings.map((f) => f.finding_id).filter((id) => !usedRef.has(id)),
    candidate_only: candidate.findings.map((f) => f.finding_id).filter((id) => !usedCand.has(id)),
  };
}
