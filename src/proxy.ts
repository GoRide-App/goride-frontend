import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side route guard — runs on every matching request before the page
 * component renders. This eliminates the flash-of-protected-content that the
 * client-side RoleGuard alone can't prevent.
 *
 * Auth model:
 *  - The `goride_role` cookie is written by session.ts whenever a session is
 *    established or cleared. We read it here as a lightweight signal.
 *  - We intentionally do NOT treat the cookie as a trusted auth token — it is
 *    only used for routing decisions. The real session check happens inside
 *    each page via getMe() / the OIDC cookie the backend sets.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

/** Redirect to the identity provider login, preserving the intended destination. */
function toLogin(destination: string): NextResponse {
  const returnUrl = `${APP_URL}${destination}`;
  const loginUrl = `${API_URL}/login?returnUrl=${encodeURIComponent(returnUrl)}`;
  return NextResponse.redirect(loginUrl);
}

/**
 * Routes that require a signed-in session of any role.
 * Add new protected path prefixes here as the app grows.
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/rider",
  "/driver",
  "/admin",
  "/onboarding",
];

/**
 * Role-restricted path prefixes.
 * A signed-in user whose role isn't in the allowed list is bounced to /dashboard.
 */
const ROLE_RESTRICTED: { prefix: string; roles: string[] }[] = [
  { prefix: "/rider", roles: ["Rider"] },
  { prefix: "/driver", roles: ["Driver"] },
  { prefix: "/admin", roles: ["Admin"] },
];

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const role = request.cookies.get("goride_role")?.value ?? null;

  // No role cookie → no session → bounce to identity login
  if (!role) {
    // If API_URL is not configured we can't redirect properly; let the
    // client-side guard handle it rather than sending to a dead URL.
    if (!API_URL || !APP_URL) return NextResponse.next();
    return toLogin(pathname);
  }

  // Role cookie present — check route-level role restrictions
  const restriction = ROLE_RESTRICTED.find((r) =>
    pathname.startsWith(r.prefix),
  );
  if (restriction && !restriction.roles.includes(role)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  /*
   * Match all paths that need a session check.
   * Exclude Next.js internals and static files so they are never blocked.
   */
  matcher: [
    "/dashboard/:path*",
    "/rider/:path*",
    "/driver/:path*",
    "/admin/:path*",
    "/onboarding/:path*",
  ],
};
