import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { rolesAllowedForPath } from "@/lib/rbac";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const allowedRoles = rolesAllowedForPath(pathname);

  if (!allowedRoles) return NextResponse.next();

  const user = req.auth?.user;
  if (!user) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user.active === false || !allowedRoles.includes(user.role)) {
    return NextResponse.redirect(new URL("/unauthorized", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/portal/:path*"],
};
