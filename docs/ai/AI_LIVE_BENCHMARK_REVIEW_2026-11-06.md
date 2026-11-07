# Live benchmark review #1: `claude-sonnet-5-5` vs the deterministic mock (2026-11-06)

**Scope.** This is the first hosted run, done on the founder's machine with **synthetic fixtures only**:
- Firm: Patel review by HP_CCO.
- Personal: Alvarez "understand my finances".

Provider: Anthropic Messages API. The model was pinned as `claude-sonnet-5-5`, and the run recorded the same id as served. Adapter: `master` after #22 (`tool_choice` auto, hosted wall clock).

**Source.** `apps/web/.ai-bench/2026-11-07T02-14-25-631Z-hosted.json` on the founder's machine. The file is git-ignored and was read through the desktop bridge. It contains no key: the test asserts this, and a grep for `sk-ant` found nothing.

**Reviewer.** Integration coordinator (Claude Code session), for the founder. This is not an independent validation, so the status vocabulary does not change.

## What the report shows

| | Firm: live | Firm: mock | Personal: live | Personal: mock |
|---|---|---|---|---|
| Run status | `DRAFT_READY` | `DRAFT_READY` | `DRAFT_READY` | `DRAFT_READY` |
| Turns / stop | 2 / `FINAL_DRAFT` | 2 / `FINAL_DRAFT` | 2 / `FINAL_DRAFT` | 2 / `FINAL_DRAFT` |
| Tools requested | `read_facts`, `get_check_runs`, `read_evidence` | `get_check_runs` | `read_facts`, `get_check_runs`, `read_personal_baseline` | `read_personal_baseline` |
| Tool calls denied | 0 | 0 | 0 | 0 |
| Findings accepted / rejected | 8 / 0 | 4 / 0 | 8 / 0 | 6 / 0 |
| Validation issues | none | none | none | none |
| Tokens (vendor-reported for live) | 15,898 | n/a (mock estimate) | 14,335 | n/a |
| Finding categories | CHECK_DISCREPANCY, CONFLICTING_FACTS ×2, HYPOTHESIS, ASSUMPTION_RISK, STALE_EVIDENCE, PATTERN_OBSERVATION, FOLLOWUP_QUESTION | CONFLICTING_FACTS ×2, CHECK_DISCREPANCY, ASSUMPTION_RISK | MISSING_EVIDENCE, UNSUPPORTED_CHECK, ASSUMPTION_RISK ×2, CHECK_DISCREPANCY, PATTERN_OBSERVATION, FOLLOWUP_QUESTION, HYPOTHESIS | PATTERN_OBSERVATION ×5, EDUCATION |

## Assessment

1. **Runtime invariants: held.** On every live run:
   - The run ended in a valid state.
   - No tool call was denied or out of scope.
   - The validator rejected nothing: no ungrounded amount, no unknown id, no forbidden status, and no narrative redaction.
   - The served model matched the pinned id.

   The live test asserts the same rules on every finding: never `VERIFIED`, and every cited amount backed by a cited run.

2. **Firm (Patel): category coverage is plausible, content not reviewed.** Every category the mock raised appears in the live draft: one CHECK_DISCREPANCY, two CONFLICTING_FACTS and one ASSUMPTION_RISK. The live model also read the facts and evidence, not only the check runs, and added four findings: a hypothesis, a stale-evidence item, a pattern and a follow-up question. Whether its two conflicts are the mock's balance and custodian conflicts **cannot be determined from this file**.

3. **Personal (Alvarez): material divergence, needs a content read before any wider use.**
   - The mock's six findings are consumer-register pattern and education items, all derived from the receipted baseline.
   - The live draft has **no EDUCATION item** and a single pattern observation. It leans toward audit-style categories: MISSING_EVIDENCE, UNSUPPORTED_CHECK, CHECK_DISCREPANCY and HYPOTHESIS.
   - It also requested `get_check_runs` and `read_facts` in a personal scope. Both were authorised and returned only scope data (0 denials), but the result should be checked against the personal-register guidance in `docs/ai/AI_EVALUATION_PLAN.md`.
   - Specific question for the next read: **what does the live personal CHECK_DISCREPANCY refer to?** The personal workspace has receipted baseline runs, not plan-vs-engine checks.

4. **The comparison tool did not work for this case.** `diffReports` keys on `finding_id`. The live model names its findings `F1`…`F8`, so every finding showed as added or removed. The report also stored only categories, not finding text. A human comparison was therefore not possible.

## Verdict

- **Invariants: PASS.**
- **Content quality: NOT REVIEWED.** The finding content was not captured.
- **Not accepted for promotion** (`docs/ai/AI_EVAL_MATRIX.md` promotion rule).
- Hosted stays disabled by default, and its use stays synthetic-only.

## Changes made for the next run (`feat/ai-core-002b-bench-review`)

- `alignReports(reference, candidate)` in `apps/web/src/ai/evals/regression.ts` pairs findings by the evidence they cite (fact, document and check-run ids). It assigns pairs best-first, preferring the same category and higher overlap. It lists `reference_only` findings (possible coverage gaps) and `candidate_only` findings (new observations to read). It is a reading aid, not a score. Tested by AI-H14.
- `ai-hosted.live.test.ts` now writes each run's validated content (summary, memo, questions, limitations, and each finding's title, explanation, refs, cited amounts and next action) plus the alignment. The data is synthetic only and the file stays git-ignored.

## Next

1. The founder reruns the live benchmark on this branch, or on `master` after merge. That takes about 1–3 minutes and costs a few cents.
2. Review #2 then reads the content. Check items:
   - Firm: are the mock's balance and custodian conflicts present?
   - Firm: is the discrepancy described with the engine's figures only?
   - Personal: is the register and tone right? What does the "discrepancy" refer to? Is education missing?
   - All drafts: do they make any implied promise, advice or approval language?
3. A scored live run of the AI-E and AI-N cases per `docs/ai/AI_EVALUATION_PLAN.md`, before any decision beyond synthetic development.
