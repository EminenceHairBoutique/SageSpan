import "server-only";
import type { DataState } from "@sagespan/contracts";
import { getProductionPersonalActor } from "@/auth/actor";
import { getPersonalActor, type PersonalActor } from "@/auth/personal-actor";
import { createSupabaseServerClient } from "@/auth/supabase-server";
import { supabaseConfigured } from "@/config/env";
import { getStore } from "../store";
import { personalBundle, type PersonalBundle } from "./queries";
import { SupabasePersonalRepository } from "./supabase-repository";

/**
 * DATA-001 — one seam for "the signed-in person's workspace data", whatever backs it.
 *
 *  - DEMO: the file store and the persona cookie (synthetic; `/demo/personal`).
 *  - PRODUCTION: Supabase under the user's own session (`/app/personal`); reads and writes
 *    go through PostgREST with RLS from migration 0008, so what the repository returns is
 *    exactly what the database lets this person see — never more.
 *
 * This is also the boundary other server-side consumers must use. In particular the AI
 * layer (AI-CORE-001 tools such as read_facts / read_evidence) takes a PersonalBundle from
 * `bundle()` and never queries tables itself: workspace authorisation is decided once,
 * here and in the database, not re-implemented per tool.
 *
 * What is NOT behind this seam yet (DATA-002): personal snapshots, calc runs, decisions
 * and AI runs for production workspaces. Their tables do not exist, so a production
 * bundle carries them empty and the UI says so instead of computing anything.
 */
export interface PersonalRepository {
  readonly mode: "DEMO" | "PRODUCTION";
  readonly actor: PersonalActor;
  bundle(): Promise<PersonalBundle>;
  /** Run a synchronous domain mutation against the workspace view and persist what changed. */
  mutate<T>(fn: (view: DataState) => T): Promise<T>;
  /** True when snapshots / receipted runs / decisions are persisted for this backend. */
  readonly supportsRuns: boolean;
}

class DemoPersonalRepository implements PersonalRepository {
  readonly mode = "DEMO" as const;
  readonly supportsRuns = true;
  constructor(readonly actor: PersonalActor) {}
  async bundle(): Promise<PersonalBundle> {
    return personalBundle(getStore().read(), this.actor);
  }
  async mutate<T>(fn: (view: DataState) => T): Promise<T> {
    return getStore().mutate(fn);
  }
}

class ProductionPersonalRepository implements PersonalRepository {
  readonly mode = "PRODUCTION" as const;
  readonly supportsRuns = false;
  constructor(
    readonly actor: PersonalActor,
    private readonly inner: SupabasePersonalRepository,
  ) {}
  bundle(): Promise<PersonalBundle> {
    return this.inner.bundle();
  }
  mutate<T>(fn: (view: DataState) => T): Promise<T> {
    return this.inner.mutate(fn);
  }
}

export async function demoPersonalRepository(): Promise<PersonalRepository> {
  return new DemoPersonalRepository(await getPersonalActor());
}

/** Null when Supabase is not configured, nobody is signed in, or the user has no ACTIVE personal workspace. */
export async function productionPersonalRepository(): Promise<PersonalRepository | null> {
  if (!supabaseConfigured()) return null;
  const actor = await getProductionPersonalActor();
  if (!actor) return null;
  const client = await createSupabaseServerClient();
  if (!client) return null;
  return new ProductionPersonalRepository(actor, new SupabasePersonalRepository(client, actor));
}
