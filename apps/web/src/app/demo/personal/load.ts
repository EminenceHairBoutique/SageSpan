import "server-only";
import { getPersonalActor, type PersonalActor } from "@/auth/personal-actor";
import { currentRun, personalBundle, personalLabels, type PersonalBundle } from "@/domain/personal/queries";
import { personalInsights, refreshPersonalBaseline, type PersonalInsights, type RefreshOutcome } from "@/domain/personal/runs";
import { getStore } from "@/domain/store";

export interface PersonalPageData {
  actor: PersonalActor;
  b: PersonalBundle;
  insights: PersonalInsights;
  labels: Record<string, string>;
  refresh: RefreshOutcome | null;
}

/**
 * Shared loader for Personal pages. With `ensureBaseline` the receipted runs for
 * the current snapshot are created when missing (a no-op when they exist). If
 * the calculation service is unreachable the page shows that; nothing is
 * computed in this tier.
 */
export async function loadPersonal(opts: { ensureBaseline?: boolean } = {}): Promise<PersonalPageData> {
  const actor = await getPersonalActor();
  const store = getStore();
  let b = personalBundle(store.read(), actor);
  let refresh: RefreshOutcome | null = null;
  if (opts.ensureBaseline && (!currentRun(b, "PERSONAL_CLARITY") || b.currentSnapshot === null)) {
    refresh = await refreshPersonalBaseline(store, actor);
    b = personalBundle(store.read(), actor);
  } else if (opts.ensureBaseline) {
    // snapshot may have drifted (records changed since the last run)
    refresh = await refreshPersonalBaseline(store, actor);
    if (refresh.snapshotCreated) b = personalBundle(store.read(), actor);
  }
  return { actor, b, insights: personalInsights(b), labels: personalLabels(b), refresh };
}
