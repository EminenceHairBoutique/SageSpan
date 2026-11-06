export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export function isDomainError(e: unknown): e is DomainError {
  return e instanceof DomainError;
}

export type ActionResult<T = undefined> = { ok: true; data: T; message?: string } | { ok: false; code: string; message: string };

export function errorResult(e: unknown): { ok: false; code: string; message: string } {
  if (e instanceof DomainError) return { ok: false, code: e.code, message: e.message };
  if (e instanceof Error) {
    const code = e.name === "PermissionDeniedError" ? "PERMISSION_DENIED" : e.name === "NotFoundError" ? "NOT_FOUND" : e.name === "WorkflowTransitionError" ? "INVALID_TRANSITION" : "ERROR";
    return { ok: false, code, message: e.message };
  }
  return { ok: false, code: "ERROR", message: "Unexpected error" };
}
