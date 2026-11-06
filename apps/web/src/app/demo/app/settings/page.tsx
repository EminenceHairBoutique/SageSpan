import { RotateCcw } from "lucide-react";
import { ROLE_PERMISSIONS, can } from "@sagespan/contracts";
import { getDemoActor } from "@/auth/actor";
import { verifyAuditChain } from "@/domain/audit";
import { orgById, profileName } from "@/domain/queries";
import { getStore } from "@/domain/store";
import { CalcServiceError, fetchRuleSets } from "@/provenance/calc-client";
import { resetDemoAction, updatePolicyAction } from "@/server/actions";
import { ActionForm } from "@/ui/ActionForm";
import { ResetDemoButton } from "@/ui/console/ResetDemoButton";
import { Alert, Card, Chip, Td, Th, inputClasses } from "@/ui/primitives";

export const dynamic = "force-dynamic";

const UNAVAILABLE = ["Single sign-on (SAML/OIDC)", "Enforced MFA", "IP allow-listing", "Customer-managed retention and legal hold", "Audit log export API / SIEM streaming", "Data residency selection", "Real-document upload with malware scanning"];

export default async function SettingsPage() {
  const actor = await getDemoActor();
  const state = getStore().read();
  const org = orgById(state, actor.org_id);
  const members = state.memberships.filter((m) => m.org_id === org.id);
  const chain = verifyAuditChain(state, org.id);
  const events = state.audit_events.filter((e) => e.org_id === org.id).slice(-40).reverse();
  let rules: Awaited<ReturnType<typeof fetchRuleSets>> | null = null;
  let rulesError: string | null = null;
  try {
    rules = await fetchRuleSets(org.id);
  } catch (e) {
    rulesError = e instanceof CalcServiceError ? `${e.code}: ${e.message}` : "Unreachable";
  }
  const canPolicy = can(actor.role, "org.manage_policy");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-ink-muted">{org.name} · firm-wide authorised access (no per-seat licensing in the pricing hypothesis).</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Team and roles" subtitle="Roles are server-authoritative; the UI only reflects them.">
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[520px]">
              <thead className="border-b border-line bg-surface-muted/60">
                <tr>
                  <Th>Member</Th>
                  <Th>Role</Th>
                  <Th>Can approve</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {members.map((m) => (
                  <tr key={m.id}>
                    <Td>
                      {profileName(state, m.user_id)}
                      <div className="text-xs text-ink-faint">{state.profiles.find((p) => p.user_id === m.user_id)?.title}</div>
                    </Td>
                    <Td>
                      <Chip tone="navy">{m.role}</Chip>
                    </Td>
                    <Td>{ROLE_PERMISSIONS[m.role].includes("review.approve") && org.policies.approver_roles.includes(m.role) ? "yes" : "no"}</Td>
                    <Td>{m.status.toLowerCase()}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-ink-muted">Member invitation and role changes are not implemented in the synthetic demo.</p>
        </Card>
        <Card title="Review policy" subtitle="Changes are audited. Approval always requires rationale and a conflict attestation regardless of policy.">
          <ActionForm action={updatePolicyAction} submitLabel="Save policy" size="sm" disabled={!canPolicy} disabledReason={`Role ${actor.role} cannot manage policy.`} successMessage="Policy saved and audited.">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="separation_of_duties" defaultChecked={org.policies.separation_of_duties} /> Separation of duties: the approver may not be the person who froze the snapshot or ran the check
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="allow_nonmaterial_exceptions" defaultChecked={org.policies.allow_nonmaterial_exceptions} /> Allow COMPLIANCE to carry nonmaterial conflicts by documented exception
            </label>
            <fieldset className="text-sm">
              <legend className="font-medium">Approver roles</legend>
              {(["COMPLIANCE", "ADVISOR"] as const).map((r) => (
                <label key={r} className="mr-4 inline-flex items-center gap-2">
                  <input type="checkbox" name="approver_roles" value={r} defaultChecked={org.policies.approver_roles.includes(r)} /> {r}
                </label>
              ))}
            </fieldset>
            <p className="text-xs text-ink-muted">
              Comparison tolerance: absolute ${org.policies.tolerance.absolute}, relative {Number(org.policies.tolerance.relative) * 100}% (bounded by the published rule set; editing is not exposed in this build).
            </p>
          </ActionForm>
        </Card>
        <Card title="Rule-set versions (from the calculation service)" subtitle="Published rule sets only are used in checks; drafts are listed for transparency.">
          {rulesError ? (
            <Alert tone="conflict" title="Rule registry unavailable">
              {rulesError}. No versions are assumed.
            </Alert>
          ) : (
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full min-w-[520px]">
                <thead className="border-b border-line bg-surface-muted/60">
                  <tr>
                    <Th>Rule set</Th>
                    <Th>Version</Th>
                    <Th>Status</Th>
                    <Th>Effective</Th>
                    <Th>Checksum</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rules!.rule_sets.map((r) => (
                    <tr key={r.rule_set_id}>
                      <Td>
                        <code className="font-mono text-xs">{r.rule_set_id}</code>
                        <div className="text-xs text-ink-faint">{r.sources.map((s) => s.title).join("; ") || "firm policy parameter"}</div>
                      </Td>
                      <Td>{r.version}</Td>
                      <Td>
                        <Chip tone={r.status === "PUBLISHED" ? "teal" : "amber"}>{r.status.toLowerCase()}</Chip>
                      </Td>
                      <Td>
                        {r.effective_from} → {r.effective_to ?? "open"}
                      </Td>
                      <Td>
                        <code className="font-mono text-[11px]" title={r.checksum}>
                          {r.checksum.slice(0, 14)}…
                        </code>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-5 pt-3 text-xs text-ink-muted">
                Engine {rules!.engine_name} {rules!.engine_version}. Rule publication workflow (draft → reviewed → approved → published) and book-wide impact preview are roadmap items; see docs/ROADMAP.md.
              </p>
            </div>
          )}
        </Card>
        <Card title="Enterprise security settings" subtitle="Listed so nobody mistakes the demo for a hardened deployment.">
          <ul className="space-y-1.5 text-sm">
            {UNAVAILABLE.map((u) => (
              <li key={u} className="flex items-center justify-between gap-2">
                <span>{u}</span>
                <Chip tone="neutral">not available in this build</Chip>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Card
        title="Audit trail"
        subtitle={`Append-only, hash-chained per organisation. Chain ${chain.intact ? "intact" : "BROKEN"} across ${chain.count} events.`}
        actions={
          <ResetDemoButton action={resetDemoAction}>
            <RotateCcw size={14} aria-hidden /> Reset synthetic data
          </ResetDemoButton>
        }
      >
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="border-b border-line bg-surface-muted/60">
              <tr>
                <Th>At (UTC)</Th>
                <Th>Event</Th>
                <Th>Actor</Th>
                <Th>Summary</Th>
                <Th>Hash</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {events.map((e) => (
                <tr key={e.id}>
                  <Td className="whitespace-nowrap text-xs">{e.created_at.replace("T", " ").slice(0, 19)}</Td>
                  <Td>
                    <Chip tone={e.event_type.includes("DENIED") || e.event_type.includes("FAILED") ? "conflict" : "neutral"}>{e.event_type.toLowerCase().replace(/_/g, " ")}</Chip>
                  </Td>
                  <Td className="text-xs">
                    {profileName(state, e.actor_user_id)}
                    <div className="text-ink-faint">{e.actor_role ?? e.actor_type}</div>
                  </Td>
                  <Td className="text-xs">{e.summary}</Td>
                  <Td>
                    <code className="font-mono text-[11px]" title={e.event_hash}>
                      {e.event_hash.slice(0, 12)}…
                    </code>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
