import { it, vi } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { MemoryStore } from "@/domain/store";
import { resolveProvider } from "../provider";
import { runFirmAnalyzePlan } from "../review-orchestrator";
import { HP_CCO, addPatelCheckRun } from "../evals/fixtures";

it("diag: one hosted firm run, print vendor errors", async () => {
  const out: string[] = [];
  const realFetch = globalThis.fetch;
  vi.stubGlobal("fetch", async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const res = await realFetch(url, init);
    out.push(`VENDOR HTTP ${res.status}${res.ok ? "" : ": " + (await res.clone().text()).slice(0, 2000)}`);
    return res;
  });
  const { provider, note } = resolveProvider(process.env);
  out.push(`PROVIDER ${note}`);
  const store = new MemoryStore();
  store.mutate((s) => addPatelCheckRun(s));
  const r = await runFirmAnalyzePlan(store, HP_CCO, "hh_patel", provider);
  out.push(`RUN ${r.run_status} stop=${r.runtime?.stop_reason} tokens=${r.estimated_tokens}`);
  for (const i of r.validation_issues) out.push(`ISSUE ${i.code}: ${i.detail}`);
  mkdirSync(".ai-bench", { recursive: true });
  writeFileSync(".ai-bench/diag.txt", out.join("\n"));
}, 120_000);
