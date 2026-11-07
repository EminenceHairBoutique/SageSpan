import Link from "next/link";
import { redirect } from "next/navigation";
import { getProductionIdentity } from "@/auth/actor";
import { supabaseConfigured } from "@/config/env";
import { appStartFreshAction } from "@/server/app-personal-actions";
import { ActionForm } from "@/ui/ActionForm";
import { ProductionGate } from "@/ui/ProductionGate";
import { Card, Field, inputClasses } from "@/ui/primitives";

export const dynamic = "force-dynamic";

/** DATA-001 — production "Start fresh": creates the signed-in user's own workspace via app.create_personal_workspace. */
export default async function AppPersonalStartPage() {
  if (!supabaseConfigured()) return <ProductionGate requestedPath="/app/personal/start" />;
  const identity = await getProductionIdentity();
  if (!identity) redirect("/app/sign-in?next=%2Fapp%2Fpersonal%2Fstart");
  const owned = identity.workspaces.find((w) => w.workspace_role === "OWNER");
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal">Start fresh</p>
        <h1 className="mt-1 text-2xl font-bold">Your own picture, from your own numbers</h1>
        <p className="mt-2 text-sm text-ink-muted">
          This creates a workspace that only you can see. Nothing is connected, imported or assumed: you enter what you know, leave blank what you do not, and SageSpan shows what it can and cannot conclude.
          {owned ? (
            <>
              {" "}
              You already own <Link href="/app/personal" className="underline">{owned.label}</Link>; creating another is allowed but usually unnecessary.
            </>
          ) : null}
        </p>
      </div>
      <Card title="Who is this for?">
        <ActionForm action={appStartFreshAction} submitLabel="Create my workspace" pendingLabel="Creating…">
          <Field label="Your first name (or a nickname)" required>
            <input name="display_name" required maxLength={60} className={inputClasses} aria-label="Display name" defaultValue={identity.firm?.display_name ?? ""} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Workspace" hint="A household workspace lets you invite a partner later with limited, revocable access.">
              <select name="workspace_kind" defaultValue="PERSONAL" className={inputClasses} aria-label="Workspace kind">
                <option value="PERSONAL">Just me</option>
                <option value="HOUSEHOLD">My household</option>
              </select>
            </Field>
            <Field label="People in the household">
              <input name="household_size" type="number" min={1} max={12} defaultValue={1} className={inputClasses} aria-label="Household size" />
            </Field>
          </div>
          <Field label="Your situation, in a sentence (optional)" hint="Used for tone only, never for arithmetic.">
            <input name="situation" maxLength={240} className={inputClasses} aria-label="Situation" />
          </Field>
          <Field label="What worries you most (optional)">
            <input name="top_concern" maxLength={240} className={inputClasses} aria-label="Top concern" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Cash floor you never want to go below" required hint="A hard constraint for every recommendation. Your number.">
              <input name="cash_floor" required inputMode="decimal" className={inputClasses} aria-label="Cash floor" placeholder="1500.00" />
            </Field>
            <Field label="Buffer target in months (optional)" hint="Months of essential spending you would like in reserve.">
              <input name="buffer_target_months" inputMode="decimal" className={inputClasses} aria-label="Buffer target months" placeholder="3" />
            </Field>
          </div>
        </ActionForm>
      </Card>
    </main>
  );
}
