import { getStore } from "@/domain/store";
import { updatePolicyAction } from "@/server/personal-actions";
import { ActionForm } from "@/ui/ActionForm";
import { Alert, Card, Chip, EmptyState, KeyValue, Mono, Td, Th } from "@/ui/primitives";
import { loadPersonal } from "../load";

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const { actor, b } = await loadPersonal();
  const principals = new Map(getStore().read().principals.map((p) => [p.id, p.display_name]));
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal">Privacy &amp; sharing</p>
        <h1 className="mt-1 text-2xl font-bold">Who can see what</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">Your workspace is yours. A firm you work with never sees it because you are their client; a household member never sees it because they live with you. Access exists only through explicit, purpose-limited, revocable grants, and every read is checked against them on the server.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="This workspace" subtitle="Identity in this build is simulated; production identity arrives with PR-003 (Supabase Auth).">
          <KeyValue
            rows={[
              { k: "Workspace", v: <><Mono>{b.workspace.id}</Mono> · {b.workspace.kind.toLowerCase()}</> },
              { k: "Owner", v: principals.get(b.workspace.owner_principal_id ?? "") ?? "—" },
              { k: "You", v: `${actor.display_name} (${actor.workspace_role.toLowerCase()})` },
              { k: "Data connections", v: "None. Manual entry only; no bank, card or brokerage is linked." },
              { k: "AI provider", v: "Deterministic offline mock; no data leaves this server." },
            ]}
          />
        </Card>
        <Card title="Members" subtitle="Participants see only the domains you grant.">
          <table className="w-full">
            <thead className="border-b border-line">
              <tr>
                <Th>Person</Th>
                <Th>Role</Th>
                <Th>Domains</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {b.memberships.map((m) => (
                <tr key={m.id}>
                  <Td>{principals.get(m.principal_id) ?? m.principal_id}</Td>
                  <Td>{m.role.toLowerCase()}</Td>
                  <Td>{m.role === "OWNER" ? "all" : m.domains.map((d) => d.toLowerCase().replace(/_/g, " ")).join(", ") || "none"}</Td>
                  <Td>
                    <Chip tone={m.status === "ACTIVE" ? "teal" : m.status === "INVITED" ? "amber" : "slate"}>{m.status.toLowerCase()}</Chip>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Grants to advisors or firms" subtitle="Purpose-limited and revocable; none exist.">
          {b.grants.length === 0 ? <EmptyState title="You have not shared anything.">When sharing ships, a grant names the recipient, the domains (e.g. retirement only), the purpose, an expiry and the recipient&apos;s legal retention obligations. You can revoke it at any time.</EmptyState> : null}
        </Card>
        <Card title="Notifications" subtitle="Quiet mode keeps the Overview and Next steps but suppresses nudges.">
          {b.membership.role === "OWNER" ? (
            <ActionForm action={updatePolicyAction} hidden={{ notification_mode: b.profile.notification_mode === "QUIET" ? "NORMAL" : "QUIET" }} submitLabel={b.profile.notification_mode === "QUIET" ? "Turn quiet mode off" : "Turn quiet mode on"} variant="secondary" size="sm" inline />
          ) : (
            <p className="text-sm text-ink-muted">Only the owner can change notification settings.</p>
          )}
          <p className="mt-3 text-xs text-ink-faint">No notifications are sent in this build; the preference is recorded so the model is honest about cadence from day one.</p>
        </Card>
      </div>
      <Alert tone="slate" title="Export, correction and deletion">
        You will be able to export everything, correct any value (as a new revision; history is kept), and delete the workspace, with any legal retention exceptions stated plainly. These controls, consent records and real authentication are part of PR-003 / DATA-001 and are not live in this synthetic build.
      </Alert>
    </div>
  );
}
