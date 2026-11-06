import "server-only";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { DataState } from "@sagespan/contracts";
import { env } from "@/config/env";
import { loadSeed } from "./seed";
import { seedAuditTrail } from "./audit";

/**
 * File-backed demo store. Synthetic data only.
 *
 * Every read goes through tenant-scoped query helpers (src/domain/queries.ts)
 * and every mutation re-checks the actor's organisation and role on the
 * server. The production path is Supabase/Postgres with RLS (supabase/), which
 * is written and documented but not wired to this app yet.
 */
export class FileStore {
  constructor(private readonly filePath: string) {}

  exists(): boolean {
    return existsSync(this.filePath);
  }

  read(): DataState {
    if (!this.exists()) {
      const seeded = this.seed();
      return seeded;
    }
    const raw = readFileSync(this.filePath, "utf8");
    return JSON.parse(raw) as DataState;
  }

  write(state: DataState): void {
    mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(state, null, 2), "utf8");
    renameSync(tmp, this.filePath);
  }

  /** Load, apply a mutation, persist. Returns the mutation's result. */
  mutate<T>(fn: (state: DataState) => T): T {
    const state = this.read();
    const result = fn(state);
    this.write(state);
    return result;
  }

  seed(): DataState {
    const state = loadSeed();
    state.seeded_at = new Date().toISOString();
    seedAuditTrail(state);
    this.write(state);
    return state;
  }

  reset(): DataState {
    return this.seed();
  }
}

let singleton: FileStore | null = null;

/** The demo state always lives under <app cwd>/.demo-state/<file>; only the file name is configurable. */
export function getStore(): FileStore {
  if (!singleton) {
    const fileName = path.basename(env.demoStatePath) || "state.json";
    singleton = new FileStore(path.join(process.cwd(), ".demo-state", fileName));
  }
  return singleton;
}

/** For tests: an in-memory store with the same interface. */
export class MemoryStore {
  private state: DataState;
  constructor(initial?: DataState) {
    this.state = initial ?? loadSeed();
    if (!initial) seedAuditTrail(this.state);
  }
  exists(): boolean {
    return true;
  }
  read(): DataState {
    return structuredClone(this.state);
  }
  write(state: DataState): void {
    this.state = structuredClone(state);
  }
  mutate<T>(fn: (state: DataState) => T): T {
    const s = this.read();
    const r = fn(s);
    this.write(s);
    return r;
  }
  reset(): DataState {
    this.state = loadSeed();
    seedAuditTrail(this.state);
    return this.read();
  }
}

export type Store = Pick<FileStore, "read" | "write" | "mutate" | "reset">;
