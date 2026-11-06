/** Next.js instrumentation hook: validate the server environment once at startup (fail closed in production). */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertServerEnvironment } = await import("./config/env");
    assertServerEnvironment();
  }
}
