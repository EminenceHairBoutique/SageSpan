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
