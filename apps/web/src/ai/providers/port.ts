import type { AiModelOutput, AiProviderDescriptor, AiToolResultEnvelope } from "@sagespan/contracts";

/**
 * AI-CORE-002 / AI-CORE-005 — the PORT a live provider adapter must implement.
 *
 * This file is types only. No adapter, no network client, no credential is
 * present in this build: `resolveProvider()` maps `hosted` and `self_hosted`
 * to the deterministic mock with an explicit note (see provider.ts). The port
 * is defined now so the hosted (vendor API) and self-hosted (private
 * OpenAI-compatible server behind SageSpan's own authenticated gateway)
 * adapters are written against one shape and the runtime never changes for
 * them.
 *
 * Trust rules an implementation must honour (enforced by the runtime, tested
 * in ai-core-toolloop.test.ts against the scripted providers):
 *  - It receives the minimal authorised context the server built and no
 *    client-supplied workspace authority; it must not add, infer or forward any.
 *  - Its output is UNTRUSTED. Tool requests are authorised one by one by the
 *    runtime; results come back marked `untrusted: true`.
 *  - It must surface refusals, timeouts, malformed output and rate limits as
 *    `LiveProviderFailure` so the run records ERROR/REJECTED honestly; it must
 *    never substitute a different model or vendor with different data-handling
 *    terms than its descriptor declares.
 *  - Server-side keys only. Nothing from this port is ever bundled for the browser.
 */
export interface LiveProviderRequest {
  /** Versioned schema of the structured output the model must return (ai-review-v1), and its JSON schema for native structured output. */
  output_schema_version: string;
  output_json_schema: Record<string, unknown>;
  prompt_version: string;
  system_prompt: string;
  /** JSON-serialisable, minimal, authorised. Never raw documents beyond the resolver's snippets. */
  context_json: string;
  /** Exact allowlisted tool names and their strict argument JSON schemas. */
  tools: Array<{ name: string; args_json_schema: Record<string, unknown> }>;
  /** Turn > 1 carries the server's tool results (untrusted data) and the model's own prior output. */
  turn: number;
  prior_output: AiModelOutput | null;
  tool_results: AiToolResultEnvelope[];
  /** Server-chosen budgets; the adapter must stop at them, the runtime re-checks regardless. */
  max_output_chars: number;
  timeout_ms: number;
  /** Server-generated; the adapter must echo it on every log line and response. */
  request_id: string;
}

export interface LiveProviderResponse {
  output: AiModelOutput;
  usage: { input_tokens: number | null; output_tokens: number | null; cost_usd_estimate: string | null };
  /** The provider/model that ACTUALLY served the request (recorded on the run), not the configured one. */
  served_by: AiProviderDescriptor;
  request_id: string;
  stop_reason: "END" | "TOOL_CALLS" | "MAX_TOKENS" | "REFUSAL";
}

export type LiveProviderFailure =
  | { kind: "TIMEOUT"; request_id: string }
  | { kind: "RATE_LIMITED"; request_id: string; retry_after_ms: number | null }
  | { kind: "REFUSED"; request_id: string; reason: string }
  | { kind: "MALFORMED_OUTPUT"; request_id: string; detail: string }
  | { kind: "UNAVAILABLE"; request_id: string; detail: string };

export interface LiveProviderPort {
  describe(): AiProviderDescriptor;
  /** Resolves with a response or a typed failure; it must never throw raw vendor errors containing request bodies. */
  invoke(req: LiveProviderRequest): Promise<{ ok: true; response: LiveProviderResponse } | { ok: false; failure: LiveProviderFailure }>;
}
