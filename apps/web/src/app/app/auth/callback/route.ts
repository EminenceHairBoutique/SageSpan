import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/auth/supabase-server";

export const dynamic = "force-dynamic";

/**
 * PR-003b — completes a magic-link / OAuth / PKCE sign-in by exchanging the one-time
 * code for a session cookie. The redirect target is restricted to /app/* so this
 * route can never be used as an open redirector.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/app";
  const target = /^\/app(\/[A-Za-z0-9_\-./]*)?$/.test(next) ? next : "/app";
  const client = await createSupabaseServerClient();
  if (!client) return NextResponse.redirect(new URL("/app", url.origin));
  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL("/app/sign-in?error=callback", url.origin));
  }
  return NextResponse.redirect(new URL(target, url.origin));
}
