import type { Role } from "./enums";

/**
 * Server-authoritative permission matrix. The UI may hide or disable controls,
 * but every mutation re-checks these on the server (and, in production, RLS +
 * SECURITY DEFINER workflow functions re-check them in the database).
 */
export const PERMISSIONS = [
  "household.read",
  "import.create",
  "import.map",
  "fact.confirm",
  "conflict.resolve",
  "exception.document",
  "snapshot.freeze",
  "check.run",
  "review.comment",
  "review.disposition",
  "review.approve",
  "packet.export",
  "org.manage_members",
  "org.manage_policy",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ADMIN: ["household.read", "org.manage_members", "org.manage_policy", "review.comment", "packet.export"],
  COMPLIANCE: [
    "household.read",
    "import.create",
    "import.map",
    "fact.confirm",
    "conflict.resolve",
    "exception.document",
    "snapshot.freeze",
    "check.run",
    "review.comment",
    "review.disposition",
    "review.approve",
    "packet.export",
    "org.manage_policy",
  ],
  // ADVISOR holds the approval *capability*; whether an advisor may approve is decided by firm
  // policy (approver_roles, default COMPLIANCE only). See approvalDecision().
  ADVISOR: [
    "household.read",
    "import.create",
    "import.map",
    "fact.confirm",
    "conflict.resolve",
    "snapshot.freeze",
    "check.run",
    "review.comment",
    "review.disposition",
    "review.approve",
    "packet.export",
  ],
  // Analysts reconcile, resolve conflicts in favour of primary evidence, freeze and run checks,
  // but cannot manually confirm an unevidenced fact or record an assumption (fact.confirm).
  ANALYST: ["household.read", "import.create", "import.map", "conflict.resolve", "snapshot.freeze", "check.run", "review.comment"],
  VIEWER: ["household.read"],
};

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * Approval matrix (audit finding N-05): approval = capability × firm policy.
 *
 * - Capability: only COMPLIANCE and ADVISOR can ever hold `review.approve`.
 * - Firm policy: `policies.approver_roles` names which capable roles may approve
 *   (default COMPLIANCE only; ADVISOR is a configurable option for small firms
 *   where the lead advisor is the designated reviewer).
 *
 * Both tiers evaluate exactly this rule: TypeScript via `approvalDecision`,
 * SQL via `app.record_review` (assert_role COMPLIANCE/ADVISOR, then approver_roles).
 */
export const APPROVAL_CAPABLE_ROLES: readonly Role[] = ["COMPLIANCE", "ADVISOR"];

export type ApprovalDecision = { allowed: true } | { allowed: false; code: "PERMISSION_DENIED" | "NOT_AN_APPROVER"; message: string };

export function approvalDecision(role: Role | null | undefined, approverRoles: readonly Role[]): ApprovalDecision {
  if (!role || !APPROVAL_CAPABLE_ROLES.includes(role) || !can(role, "review.approve")) {
    return { allowed: false, code: "PERMISSION_DENIED", message: `Permission denied: role ${role ?? "none"} lacks review.approve` };
  }
  const policy = approverRoles.filter((r) => APPROVAL_CAPABLE_ROLES.includes(r));
  if (!policy.includes(role)) {
    return { allowed: false, code: "NOT_AN_APPROVER", message: `Firm policy allows approval by ${policy.length ? policy.join(", ") : "COMPLIANCE"} only.` };
  }
  return { allowed: true };
}

export function canApprove(role: Role | null | undefined, approverRoles: readonly Role[]): boolean {
  return approvalDecision(role, approverRoles).allowed;
}

export class PermissionDeniedError extends Error {
  constructor(
    public readonly role: Role | null,
    public readonly permission: Permission,
    public readonly detail?: string,
  ) {
    super(`Permission denied: role ${role ?? "none"} lacks ${permission}${detail ? ` (${detail})` : ""}`);
    this.name = "PermissionDeniedError";
  }
}

export function assertCan(role: Role | null | undefined, permission: Permission, detail?: string): void {
  if (!can(role, permission)) throw new PermissionDeniedError(role ?? null, permission, detail);
}
