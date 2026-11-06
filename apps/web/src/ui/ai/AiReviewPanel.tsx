"use client";

import { useState } from "react";
import { Bot, ChevronDown, ChevronUp } from "lucide-react";
import { AI_FINDING_CATEGORY_LABELS, formatMoney, type AiFeedback, type AiFinding, type AiRunRecord } from "@sagespan/contracts";
import type { ActionResult } from "@/domain/errors";
import { ActionForm } from "@/ui/ActionForm";
import { Alert, Chip, cx, Field, inputClasses, Mono } from "@/ui/primitives";

type FeedbackAction = (prev: ActionResult<{ message: string }> | null, formData: FormData) => Promise<ActionResult<{ message: string }>>;

/**
 * Renders one immutable AI run: draft findings with resolved citations, the
 * validator's record of what it rejected, questions, a draft memo (firm) and
 * Accept / Edit / Dismiss / Request evidence controls that write separate
 * feedback events. The "DRAFT" marking is deliberate and permanent: nothing on
 * this panel is an approval, a verified fact or a professional opinion.
 */
export function AiReviewPanel({ run, feedback, labels, feedbackAction, audience, canGiveFeedback }: { run: AiRunRecord; feedback: Record<string, AiFeedback>; labels: Record<string, string>; feedbackAction: FeedbackAction; audience: "personal" | "firm"; canGiveFeedback: boolean }) {
  const [showIssues, setShowIssues] = useState(false);
  const report = run.report;
  const rejected = run.validation_issues.filter((i) => i.disposition !== "NOTE");
  const notes = run.validation_issues.filter((i) => i.disposition === "NOTE");
  return (
    <section className="space-y-4" aria-label="AI draft review">
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
        <Chip tone="amber" icon={<Bot size={13} aria-hidden />}>
          AI draft — {audience === "firm" ? "not a review, approval or verification" : "not advice"}
        </Chip>
        <span>
          {run.provider} · {run.model} · prompt {run.prompt_version} · {run.mode.toLowerCase().replace(/_/g, " ")}
        </span>
        <span>· {run.created_at.replace("T", " ").slice(0, 19)} UTC</span>
        {run.snapshot_id && (
          <span>
            · snapshot <Mono>{run.snapshot_id}</Mono>
          </span>
        )}
        <span>
          · {run.accepted_finding_count} accepted, {run.rejected_finding_count} rejected by the validator
        </span>
      </div>

      {run.run_status !== "DRAFT_READY" && (
        <Alert tone="conflict" title={run.run_status === "REJECTED" ? "The validator rejected this output; nothing is shown as a finding." : "The provider failed; nothing was produced."}>
          {rejected.map((i) => i.detail).join(" ")}
        </Alert>
      )}

      {report && (
        <>
          <p className="text-sm text-ink">{report.summary}</p>
          <div className="space-y-3">
            {report.findings.map((f) => (
              <FindingCard key={f.finding_id} f={f} runId={run.id} labels={labels} fb={feedback[f.finding_id]} feedbackAction={feedbackAction} canGiveFeedback={canGiveFeedback} audience={audience} />
            ))}
            {report.findings.length === 0 && <p className="text-sm text-ink-muted">No grounded findings survived validation.</p>}
          </div>
          {report.questions.length > 0 && (
            <div className="rounded-lg border border-line bg-canvas p-3 text-sm">
              <p className="font-semibold">{audience === "firm" ? "Suggested questions for the file" : "Questions that would sharpen this"}</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink-muted">
                {report.questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
          {report.draft_memo && audience === "firm" && (
            <details className="rounded-lg border border-line bg-canvas p-3 text-sm">
              <summary className="cursor-pointer font-semibold">Draft reviewer memo (not approved, not published)</summary>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-xs text-ink-muted">{report.draft_memo}</pre>
            </details>
          )}
          <div className="rounded-lg border border-amber/30 bg-amber-100/40 p-3 text-xs text-amber-700">
            <p className="font-semibold">Limitations</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {report.limitations.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </div>
        </>
      )}

      {(rejected.length > 0 || notes.length > 0) && (
        <div>
          <button type="button" onClick={() => setShowIssues((v) => !v)} className="inline-flex items-center gap-1 text-xs font-semibold text-navy" aria-expanded={showIssues}>
            {showIssues ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />} Validator log ({rejected.length} rejected, {notes.length} notes)
          </button>
          {showIssues && (
            <ul className="mt-2 space-y-1 text-xs">
              {run.validation_issues.map((i, idx) => (
                <li key={idx} className={cx("rounded border px-2 py-1", i.disposition === "NOTE" ? "border-line text-ink-muted" : "border-conflict/30 bg-conflict-100/40 text-conflict-700")}>
                  <Mono>{i.code}</Mono> {i.finding_id ? <Mono>{i.finding_id}</Mono> : null} {i.detail}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function FindingCard({ f, runId, labels, fb, feedbackAction, canGiveFeedback, audience }: { f: AiFinding; runId: string; labels: Record<string, string>; fb: AiFeedback | undefined; feedbackAction: FeedbackAction; canGiveFeedback: boolean; audience: "personal" | "firm" }) {
  const [open, setOpen] = useState<"EDIT" | "REQUEST_EVIDENCE" | null>(null);
  const tone = f.severity === "HIGH" ? "conflict" : f.severity === "MEDIUM" ? "amber" : f.severity === "LOW" ? "slate" : "neutral";
  const name = (id: string) => labels[id] ?? id;
  return (
    <article className={cx("rounded-card border bg-surface p-4 shadow-card", fb?.action === "DISMISS" ? "opacity-60" : "", f.severity === "HIGH" ? "border-conflict/30" : "border-line")}>
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={tone}>{AI_FINDING_CATEGORY_LABELS[f.category]}</Chip>
        <Chip tone={f.evidence_status === "TOOL_BACKED" ? "teal" : f.evidence_status === "HYPOTHESIS" ? "slate" : "neutral"}>{f.evidence_status === "TOOL_BACKED" ? "Amounts from a receipted calculation" : f.evidence_status === "HYPOTHESIS" ? "Hypothesis" : "Unverified draft"}</Chip>
        {fb && (
          <Chip tone={fb.action === "ACCEPT" ? "teal" : fb.action === "DISMISS" ? "slate" : "amber"} className="ml-auto">
            {fb.action.toLowerCase().replace(/_/g, " ")} · v{fb.version}
          </Chip>
        )}
      </div>
      <h3 className="mt-2 font-semibold text-ink">{f.title}</h3>
      <p className="mt-1 text-sm text-ink">{f.explanation}</p>
      {fb?.action === "EDIT" && fb.edited_text && (
        <p className="mt-2 rounded bg-surface-muted px-3 py-2 text-sm">
          <span className="font-semibold text-ink-muted">Reviewer edit (v{fb.version}): </span>
          {fb.edited_text}
        </p>
      )}
      {f.suggested_next_action && (
        <p className="mt-2 text-sm text-ink-muted">
          <span className="font-semibold">Suggested: </span>
          {f.suggested_next_action}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-faint">
        {f.fact_refs.length > 0 && <span>Facts: {f.fact_refs.map(name).join(", ")}</span>}
        {f.document_refs.length > 0 && <span>Sources: {f.document_refs.map((d) => `${name(d.id)} (${d.locator})`).join(", ")}</span>}
        {f.check_run_refs.length > 0 && <span>Calculations: {f.check_run_refs.join(", ")}</span>}
        {f.cited_amounts.length > 0 && <span>Amounts: {f.cited_amounts.map((a) => `${formatMoney(a.amount)} ← ${a.field}`).join("; ")}</span>}
      </div>
      {canGiveFeedback && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
          <ActionForm action={feedbackAction} hidden={{ ai_run_id: runId, finding_id: f.finding_id, action: "ACCEPT", rationale: audience === "firm" ? "Accepted as a draft finding for the file." : "Accepted." }} submitLabel="Accept" size="sm" inline />
          <button type="button" className="rounded-lg border border-line-strong px-3 py-1.5 text-sm font-semibold" onClick={() => setOpen(open === "EDIT" ? null : "EDIT")}>
            Edit
          </button>
          <ActionForm action={feedbackAction} hidden={{ ai_run_id: runId, finding_id: f.finding_id, action: "DISMISS", rationale: "Dismissed by the reviewer." }} submitLabel="Dismiss" variant="secondary" size="sm" inline />
          <button type="button" className="rounded-lg border border-line-strong px-3 py-1.5 text-sm font-semibold" onClick={() => setOpen(open === "REQUEST_EVIDENCE" ? null : "REQUEST_EVIDENCE")}>
            Request evidence
          </button>
        </div>
      )}
      {open && (
        <ActionForm action={feedbackAction} hidden={{ ai_run_id: runId, finding_id: f.finding_id, action: open }} submitLabel={open === "EDIT" ? "Save edit" : "Record request"} size="sm" className="mt-3">
          {open === "EDIT" && (
            <Field label="Your wording" required>
              <textarea name="edited_text" rows={3} defaultValue={f.explanation} className={inputClasses} />
            </Field>
          )}
          <Field label="Rationale" required>
            <input name="rationale" className={inputClasses} placeholder={open === "EDIT" ? "Why the wording changes" : "What evidence is needed and from whom"} />
          </Field>
        </ActionForm>
      )}
    </article>
  );
}
