# <TRACK> session handoff — <PACKAGE ID> (<YYYY-MM-DD>)

> Save as `docs/engineering/V5_SESSION_<n>_<PACKAGE>_REPORT.md` and upload to the Project. The repository is the source of truth; this report is dated evidence of what this session did and saw.

## 1. Baseline I started from
- `master` @ `<SHA>` (CI run <id>: <conclusion>); open PRs: <…>; founder tree: <clean/dirty, untouched>
- Branch: `<name>` → PR #<n> (head `<SHA>`, base `master`)

## 2. What changed (file inventory)
| Path | Change | Why |
|---|---|---|
| `<path>` | added / modified / removed | <one line> |

## 3. Behaviour delivered vs. deferred
- **Delivered:** <bullets, in product terms>
- **Deferred / non-goals kept:** <bullets>
- **Status vocabulary:** <PROPOSED | IMPLEMENTED_SYNTHETIC | CI_TESTED | REAL_STACK_VERIFIED | …> for each capability touched

## 4. Evidence (only commands actually run)
| Suite | Command | Result |
|---|---|---|
| typecheck / lint | `npm run typecheck`, `npm run lint` | <clean / errors> |
| contracts Vitest | `npm run test --workspace packages/contracts` | <n passed> |
| web Vitest | `npm run test --workspace apps/web` (calculator up) | <n passed / n skipped (which)> |
| pytest | `uv run python -m pytest -q` | <n passed> |
| SQL shim | `python supabase/tests/run_sql_tests.py` | <n/n files> or NOT RUN (<why>) |
| build | `npm run build --workspace apps/web` | <clean> |
| Playwright | `npx playwright test` | <n passed> |
| CI | <Actions run URL(s)> | calculator / web / database / e2e / realstack: <…> |

Real-stack evidence is the CI `realstack` job on a disposable local Supabase only. No deployed project, live model, real data or professional sign-off is claimed unless stated with evidence.

## 5. Security / financial / regulatory implications
<Which S-/N- invariants touched and how they are still enforced; any new grant; any new amount shown and the engine/receipt behind it; REG-001 / FIN-VERIFY-001 unchanged>

## 6. Traceability and decisions
- `docs/requirements/SAGESPAN_V5_TRACEABILITY.md` §<letter> added
- `docs/DECISIONS.md` rows added: <…>
- `FEATURE_STATUS_MATRIX.md` rows moved: <…> (coordinator finalises)

## 7. Cross-track requests (files I needed but do not own)
| File | Owner track | What I need |
|---|---|---|

## 8. Next smallest PR for this track
<ID, scope, acceptance, dependency, migration number needed?>

## 9. For the coordinator
<merge prerequisites, expected conflicts, docs to update on merge>
