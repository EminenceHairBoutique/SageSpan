import type { Role } from "@sagespan/contracts";

/**
 * The authenticated principal for a request. org_id and role are resolved on
 * the server from the session (demo persona cookie or, in production, the
 * Supabase session and membership), never from client-supplied input.
 */
export interface Actor {
  user_id: string;
  org_id: string;
  role: Role;
  display_name: string;
  actor_type: "USER" | "SIMULATED_REVIEWER";
  mode: "DEMO" | "PRODUCTION";
}

export class UnauthenticatedError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

/** Deliberately indistinguishable from "does not exist" so other tenants' identifiers never leak. */
export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}
