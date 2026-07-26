import type { Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * Route groups and the roles permitted to access them. Used by middleware
 * for page-level gating. API routes should additionally call
 * `requireRole()` for defense-in-depth server-side checks.
 */
export const ROUTE_ROLE_MAP: { prefix: string; roles: Role[] }[] = [
  { prefix: "/dashboard/admin", roles: ["ADMIN"] },
  { prefix: "/dashboard/shop-manager", roles: ["ADMIN", "SHOP_MANAGER"] },
  { prefix: "/dashboard/parts-manager", roles: ["ADMIN", "PARTS_MANAGER"] },
  { prefix: "/dashboard/technician", roles: ["ADMIN", "SHOP_MANAGER", "TECHNICIAN"] },
  { prefix: "/dashboard/front-desk", roles: ["ADMIN", "SHOP_MANAGER", "FRONT_DESK"] },
  { prefix: "/portal", roles: ["CUSTOMER"] },
];

export function rolesAllowedForPath(pathname: string): Role[] | null {
  const match = ROUTE_ROLE_MAP.find((r) => pathname.startsWith(r.prefix));
  return match ? match.roles : null;
}

/**
 * Server-side guard for API route handlers. Returns the authenticated
 * session if the caller's role is permitted, otherwise returns a
 * NextResponse describing the failure (401/403) to be returned directly.
 */
export async function requireRole(...allowed: Role[]) {
  const session = await auth();
  if (!session?.user) {
    return { session: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (session.user.active === false) {
    return { session: null, error: NextResponse.json({ error: "Account is deactivated" }, { status: 403 }) };
  }
  if (allowed.length > 0 && !allowed.includes(session.user.role)) {
    return { session: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, error: null };
}
