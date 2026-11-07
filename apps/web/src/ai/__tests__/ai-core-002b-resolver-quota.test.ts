/**
 * AI-CORE-002b — async RLS-shaped resolver (AI-C17 … AI-C21) and per-workspace quota
 * (AI-Q01 … AI-Q06). Offline. The "repository" here is a fake that implements the Data
 * track's `PersonalRepository` seam over the MemoryStore, so what is tested is the AI
 * side of the seam: the runtime awaits the resolver, treats its NotFound as the end of
 * the run, detects snapshot drift, and never persists into a backend that would drop
 * the record. Quotas: reservation before any vendor call; fail closed on store errors.
 */
import { describe, expect, it } from "vitest";
import { AI_QUOTA_SCHEMA_VERSION, AiQuotaDecisionSchema, AiQuotaPolicySchema, DEFAULT_AI_QUOTA_POLICY, type AiQuotaPolicy, type DataState } from "@sagespan/contracts";
import type { PersonalActor } from "@/auth/personal-actor";
import { NotFoundError } from "@/auth/types";
import type { PersonalRepository } from "@/domain/personal/repository";
import { personalBundle, type PersonalBundle } from "@/domain/personal/queries";
import { MemoryStore } from "@/domain/store";
import { personalContextFromBundle, personalRepositoryResolver, resolveFirmContext, resolvePersonalContext } from "../evidence-resolver";
import { MockToolLoopProvider, ScriptedToolLoopProvider } from "../provider";
import { AnthropicMessagesPort } from "../providers/anthropic-messages";
import type { HostedConfig } from "../providers/hosted-config";
import { HostedProvider, quotaPolicyFromConfig } from "../providers/hosted-provider";
import { InMemoryAiQuotaStore, UnavailableAiQuotaStore } from "../quota/store";
import { orchestrate, runPersonalUnderstand, runPersonalUnderstandForRepository } from "../review-orchestrator";
import { ALVAREZ, HP_CCO, addCastilloRuns, addPatelCheckRun, scriptedOutput } from "../evals/fixtures";
import { diffReports } from "../evals/regression";

/** A PersonalRepository over the MemoryStore with hooks, standing in for the Supabase-backed one. */
class FakeRepository implements PersonalRepository {
  readonly supportsRuns = true;
  bundleCalls = 0;
  mutateCalls = 0;
  constructor(
    readonly mode: "DEMO" | "PRODUCTION",
    readonly actor: PersonalActor,
    readonly store: MemoryStore,
    private readonly hooks: { onBundle?: (n: number) => void } = {},
  ) {}
  async bundle(): Promise<PersonalBundle> {
    this.bundleCalls++;
    this.hooks.onBundle?.(this.bundleCalls);
    await Promise.resolve(); // genuinely async, like PostgREST
    return personalBundle(this.store.read(), this.actor); // throws NotFound when the membership is gone
  }
  async mutate<T>(fn: (view: DataState) => T): Promise<T> {
    this.mutateCalls++;
    return this.store.mutate(fn);
  }
}

function castilloStore() {
  const store = new MemoryStore();
  store.mutate((s) => {
    addCastilloRuns(s);
  });
  return store;
}

const asksFor = (tool: string) => ({ ...scriptedOutput({}), findings: [], summary: "requesting evidence", tool_calls: [{ call_id: "c1", tool, args: {} }] });

describe("AI-CORE-002b async resolver over the repository seam", () => {
  it("AI-C17 the runtime awaits an async resolver: the repository is read before every tool execution and before RECORD, and the result equals the sync path", async () => {
    const store = castilloStore();
    const repo = new FakeRepository("DEMO", ALVAREZ, store);
    const r = await runPersonalUnderstandForRepository(repo, new MockToolLoopProvider());
    expect(r.persisted).toBe(true);
    expect(r.record.run_status).toBe("DRAFT_READY");
    expect(repo.bundleCalls).toBe(3); // initial resolve + before the tool + before RECORD
    expect(r.record.runtime!.reauthorizations).toBe(2);
    const sync = await runPersonalUnderstand(store, ALVAREZ, new MockToolLoopProvider());
    expect(diffReports(sync.report!, r.record.report!).identical).toBe(true);
    expect(store.read().ai_runs.map((x) => x.id)).toContain(r.record.id);
    // the bundle-based context is the same context the sync resolver builds
    const fromBundle = personalContextFromBundle(personalBundle(store.read(), ALVAREZ));
    const direct = resolvePersonalContext(store.read(), ALVAREZ);
    expect([...fromBundle.citable_ids].sort()).toEqual([...direct.citable_ids].sort());
    expect(fromBundle.snapshot_sha256).toBe(direct.snapshot_sha256);
    expect(personalRepositoryResolver(repo).backend).toBe("DEMO_STORE");
    expect(personalRepositoryResolver(new FakeRepository("PRODUCTION", ALVAREZ, store)).backend).toBe("RLS_REPOSITORY");
  });

  it("AI-C18 access revoked between turns is seen by the ASYNC resolver: NotFound, no tool execution, no continuation, nothing persisted", async () => {
    const store = castilloStore();
    const repo = new FakeRepository("DEMO", ALVAREZ, store, {
      onBundle: (n) => {
        if (n === 2)
          store.mutate((s) => {
            s.workspace_memberships.find((m) => m.id === "wm_castillo_owner")!.status = "REVOKED";
          });
      },
    });
    const provider = new ScriptedToolLoopProvider(
      () => asksFor("read_personal_baseline"),
      () => scriptedOutput({}),
    );
    const before = store.read().ai_runs.length;
    await expect(runPersonalUnderstandForRepository(repo, provider)).rejects.toBeInstanceOf(NotFoundError);
    expect(provider.continueCalls).toBe(0);
    expect(repo.mutateCalls).toBe(0);
    expect(store.read().ai_runs).toHaveLength(before);
  });

  it("AI-C19 a new CURRENT snapshot appearing in the repository between turns is CONTEXT_CHANGED, not a draft on mixed evidence", async () => {
    const store = castilloStore();
    const repo = new FakeRepository("DEMO", ALVAREZ, store, {
      onBundle: (n) => {
        if (n === 2)
          store.mutate((s) => {
            const cur = s.personal_snapshots.find((x) => x.workspace_id === ALVAREZ.workspace_id && x.status === "CURRENT")!;
            cur.status = "SUPERSEDED";
            s.personal_snapshots.push({ ...structuredClone(cur), id: "psnap_castillo_next", status: "CURRENT", content_sha256: "b".repeat(64), created_at: "2026-11-06T22:00:00Z" });
          });
      },
    });
    const provider = new ScriptedToolLoopProvider(
      () => asksFor("read_personal_baseline"),
      () => scriptedOutput({}),
    );
    const r = await runPersonalUnderstandForRepository(repo, provider);
    expect(r.record.run_status).toBe("REJECTED");
    expect(r.record.runtime!.stop_reason).toBe("CONTEXT_CHANGED");
    expect(r.record.runtime!.tool_calls_executed).toBe(0);
    expect(provider.continueCalls).toBe(0);
    expect(r.record.report).toBeNull();
  });

  it("AI-C20 a PRODUCTION repository has no AI-run table yet: the record is returned, nothing is pushed into a view that would drop it, and the note says why", async () => {
    const store = castilloStore();
    const repo = new FakeRepository("PRODUCTION", ALVAREZ, store);
    const before = store.read().ai_runs.length;
    const r = await runPersonalUnderstandForRepository(repo, new MockToolLoopProvider());
    expect(r.record.run_status).toBe("DRAFT_READY");
    expect(r.persisted).toBe(false);
    expect(r.persistence_note).toMatch(/REGISTRY\.md/);
    expect(repo.mutateCalls).toBe(0);
    expect(store.read().ai_runs).toHaveLength(before);
  });

  it("AI-C21 a resolver that rejects for any other reason ends the run with that error (no partial record)", async () => {
    const store = castilloStore();
    const ctx = resolvePersonalContext(store.read(), ALVAREZ);
    let n = 0;
    const provider = new ScriptedToolLoopProvider(
      () => asksFor("read_personal_baseline"),
      () => scriptedOutput({}),
    );
    await expect(
      orchestrate(ctx, "PERSONAL_FINANCES_UNDERSTAND", ALVAREZ.principal_id, provider, null, {
        reauthorize: async () => {
          n++;
          throw new Error("PostgREST 503");
        },
      }),
    ).rejects.toThrow(/PostgREST 503/);
    expect(n).toBe(1);
    expect(provider.continueCalls).toBe(0);
  });
});

const KEY = "sk-test-quota-DO-NOT-LEAK";
const CONFIG: HostedConfig = { apiKey: KEY, model: "claude-test-model", baseUrl: "https://api.anthropic.com", maxTokens: 4096, timeoutMs: 1000, processTokenCeiling: 250_000, runsPerScopePerHour: 2, tokensPerScopePerHour: 1500 };
const SCOPE = { kind: "PERSONAL_WORKSPACE" as const, workspace_id: "ws_x" };

function fakeVendorDraft() {
  const fetchImpl = async () => ({ ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify({ model: "claude-test-model-2026", stop_reason: "tool_use", content: [{ type: "tool_use", id: "e", name: "emit_review", input: { status: "DRAFT_FOR_HUMAN_REVIEW", findings: [], summary: "s", limitations: ["l"] } }], usage: { input_tokens: 600, output_tokens: 150 } }) });
  return fetchImpl;
}

describe("AI-CORE-002b per-workspace quota (ai-quota-v1)", () => {
  it("AI-Q01 the policy and decision contracts are strict; the hosted config expresses a policy", () => {
    expect(AiQuotaPolicySchema.safeParse(DEFAULT_AI_QUOTA_POLICY).success).toBe(true);
    expect(AiQuotaPolicySchema.safeParse({ ...DEFAULT_AI_QUOTA_POLICY, window_ms: 1000 }).success).toBe(false);
    expect(AiQuotaPolicySchema.safeParse({ ...DEFAULT_AI_QUOTA_POLICY, extra: true }).success).toBe(false);
    const p = quotaPolicyFromConfig(CONFIG);
    expect(AiQuotaPolicySchema.safeParse(p).success).toBe(true);
    expect(p).toMatchObject({ schema_version: AI_QUOTA_SCHEMA_VERSION, max_runs_per_window: 2, max_tokens_per_window: 1500 });
    expect(AiQuotaDecisionSchema.safeParse({ allowed: false, reason: "RUNS_EXHAUSTED", retry_after_ms: 10 }).success).toBe(true);
    expect(AiQuotaDecisionSchema.safeParse({ allowed: false, reason: "BECAUSE" , retry_after_ms: null }).success).toBe(false);
  });

  it("AI-Q02 the in-memory store reserves before a run, settles tokens per reservation, denies on runs then on tokens, and recovers when the window rolls", async () => {
    const store = new InMemoryAiQuotaStore();
    const policy: AiQuotaPolicy = { ...DEFAULT_AI_QUOTA_POLICY, window_ms: 60_000, max_runs_per_window: 2, max_tokens_per_window: 1000 };
    const a = await store.reserve(SCOPE, policy, 0);
    expect(a).toMatchObject({ allowed: true, remaining_runs: 1, remaining_tokens: 1000 });
    await store.settle(SCOPE, (a as { reservation_id: string }).reservation_id, 900, 10);
    const b = await store.reserve(SCOPE, policy, 20);
    expect(b).toMatchObject({ allowed: true, remaining_runs: 0, remaining_tokens: 100 });
    expect(await store.reserve(SCOPE, policy, 30)).toMatchObject({ allowed: false, reason: "RUNS_EXHAUSTED", retry_after_ms: 59_970 });
    await store.settle(SCOPE, (b as { reservation_id: string }).reservation_id, 200, 40);
    const u = await store.usage(SCOPE, policy, 50);
    expect(u.reservations.map((r) => r.tokens)).toEqual([900, 200]);
    // a different scope is unaffected; the same scope after the window is admitted again
    expect((await store.reserve({ kind: "PERSONAL_WORKSPACE", workspace_id: "ws_other" }, policy, 50)).allowed).toBe(true);
    expect((await store.reserve(SCOPE, policy, 60_001)).allowed).toBe(true);
    // tokens exhausted with runs remaining
    const tight: AiQuotaPolicy = { ...policy, max_runs_per_window: 10, max_tokens_per_window: 100 };
    const s2 = new InMemoryAiQuotaStore();
    const r1 = await s2.reserve(SCOPE, tight, 0);
    await s2.settle(SCOPE, (r1 as { reservation_id: string }).reservation_id, 150, 1);
    expect(await s2.reserve(SCOPE, tight, 2)).toMatchObject({ allowed: false, reason: "TOKENS_EXHAUSTED" });
    await expect(s2.settle(SCOPE, "qr_unknown", 1, 3)).rejects.toThrow(/unknown reservation/);
  });

  it("AI-Q03 the hosted provider reserves before the vendor call and settles what the vendor reported, keyed by run id", async () => {
    const store = new MemoryStore();
    store.mutate((s) => {
      addPatelCheckRun(s);
    });
    const ctx = resolveFirmContext(store.read(), HP_CCO, "hh_patel");
    const quota = new InMemoryAiQuotaStore();
    let t = 0;
    const provider = new HostedProvider(new AnthropicMessagesPort(CONFIG, { fetchImpl: fakeVendorDraft() }), CONFIG, { quota, now: () => t });
    const first = await orchestrate(ctx, "RETIREMENT_PLAN_REVIEW", HP_CCO.user_id, provider);
    expect(first.record.run_status).toBe("DRAFT_READY");
    const usage = await quota.usage({ kind: "FIRM_HOUSEHOLD", org_id: "org_harborpoint", household_id: "hh_patel" }, quotaPolicyFromConfig(CONFIG), 0);
    expect(usage.reservations).toHaveLength(1);
    expect(usage.reservations[0]!.tokens).toBe(750);
    const second = await orchestrate(ctx, "RETIREMENT_PLAN_REVIEW", HP_CCO.user_id, provider);
    expect(second.record.run_status).toBe("DRAFT_READY"); // 750 < 1500 tokens, 2 runs allowed
    const third = await orchestrate(ctx, "RETIREMENT_PLAN_REVIEW", HP_CCO.user_id, provider);
    expect(third.record.run_status).toBe("ERROR");
    expect(third.record.validation_issues[0]!.detail).toMatch(/RATE_LIMIT_SCOPE.*2 hosted runs per hour.*retry after/);
    t = 3_600_001;
    const fourth = await orchestrate(ctx, "RETIREMENT_PLAN_REVIEW", HP_CCO.user_id, provider);
    expect(fourth.record.run_status).toBe("DRAFT_READY");
  });

  it("AI-Q04 tokens exhausted for the scope is a closed failure from the hosted provider, not a mock fallback", async () => {
    const store = new MemoryStore();
    store.mutate((s) => {
      addPatelCheckRun(s);
    });
    const ctx = resolveFirmContext(store.read(), HP_CCO, "hh_patel");
    const cfg = { ...CONFIG, runsPerScopePerHour: 10, tokensPerScopePerHour: 1000 };
    const provider = new HostedProvider(new AnthropicMessagesPort(cfg, { fetchImpl: fakeVendorDraft() }), cfg, { now: () => 0 });
    expect((await orchestrate(ctx, "RETIREMENT_PLAN_REVIEW", HP_CCO.user_id, provider)).record.run_status).toBe("DRAFT_READY"); // 750 settled
    expect((await orchestrate(ctx, "RETIREMENT_PLAN_REVIEW", HP_CCO.user_id, provider)).record.run_status).toBe("DRAFT_READY"); // 750 < 1000 before the call → admitted; 1500 after
    const r = await orchestrate(ctx, "RETIREMENT_PLAN_REVIEW", HP_CCO.user_id, provider);
    expect(r.record.run_status).toBe("ERROR");
    expect(r.record.provider).toBe("anthropic-messages");
    expect(r.record.validation_issues[0]!.detail).toMatch(/TOKEN_QUOTA_SCOPE/);
  });

  it("AI-Q05 a quota store that cannot answer fails the run CLOSED before any vendor call", async () => {
    const store = new MemoryStore();
    store.mutate((s) => {
      addPatelCheckRun(s);
    });
    const ctx = resolveFirmContext(store.read(), HP_CCO, "hh_patel");
    let vendorCalls = 0;
    const fetchImpl = async () => {
      vendorCalls++;
      return { ok: true, status: 200, headers: { get: () => null }, text: async () => "{}" };
    };
    const provider = new HostedProvider(new AnthropicMessagesPort(CONFIG, { fetchImpl }), CONFIG, { quota: new UnavailableAiQuotaStore() });
    const r = await orchestrate(ctx, "RETIREMENT_PLAN_REVIEW", HP_CCO.user_id, provider);
    expect(r.record.run_status).toBe("ERROR");
    expect(r.record.validation_issues[0]!.detail).toMatch(/QUOTA_UNAVAILABLE/);
    expect(vendorCalls).toBe(0);
    expect(JSON.stringify(r.record)).not.toContain(KEY);
  });

  it("AI-Q06 the per-process store says it is per-process; durability is a property of the store, not of the contract", () => {
    expect(new InMemoryAiQuotaStore().durability).toBe("PER_PROCESS");
    expect(quotaPolicyFromConfig(CONFIG).max_tokens_per_run).toBeLessThanOrEqual(CONFIG.tokensPerScopePerHour);
  });
});
