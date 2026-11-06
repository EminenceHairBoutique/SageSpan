import type { DataState } from "@sagespan/contracts";
import seedJson from "../../../../fixtures/synthetic/seed.json";

/** Returns a deep copy of the synthetic seed state (fixtures/synthetic/seed.json). */
export function loadSeed(): DataState {
  return structuredClone(seedJson as unknown as DataState);
}
