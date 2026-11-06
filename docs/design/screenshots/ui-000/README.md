# UI-000 current-state screenshots (captured 2026-11-06)

Captured with Playwright (Chromium) against this worktree's `next dev` on port 3200 and the calculator on port 8010, both in demo mode, from a fresh synthetic state file (`ui-000-state.json`, git-ignored). Branch `claude/nice-kapitsa-6ae656` (= `master` @ `5299791` + `docs/ai/AI_EVALUATION_PLAN.md`).

* Widths: 1440 (fold and full page), 1280 / 768 / 320 (fold, four representative pages), 390 (fold and full page).
* Flows: the Patel household (conflict → resolve → exception → freeze → check PASS → AI draft → review → approve with exceptions → packet) and the Okafor household (UNSUPPORTED-only → approve → "Reviewed with limitations" → packet) were walked with the same steps as `apps/web/e2e/assurance-flow.spec.ts` and `pr-002-coverage.spec.ts`.
* `INDEX.tsv` maps each file to its route and a note. Numbers are capture order; gaps are files dropped from the curated set.
* To keep the repository small, desktop full-page images were scaled to 960 px wide, fold images to 1100 px, mobile full pages cropped at 6000 px, all as JPEG. Originals were 1440 px PNG/JPEG and are not committed.
* The evidence packet HTML (`181`, `182`, `184`) was rendered from the export response with `page.setContent` because the export route sends the file as a download.
* The "N" badge at the bottom-left of each image is the Next.js development overlay, not part of the product.

Synthetic demonstration data only: every person, firm and amount is fictional.
