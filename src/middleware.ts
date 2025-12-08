import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminRoute = pathname.startsWith("/dashboard") || 
      pathname.startsWith("/analytics") ||
      pathname.startsWith("/users") ||
      pathname.startsWith("/organizations") ||
      pathname.startsWith("/subscription-plans") ||
      pathname.startsWith("/support-tickets") ||
      pathname.startsWith("/community-admin") ||
      pathname.startsWith("/map-gallery-admin");

  if (isAdminRoute) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/analytics/:path*",
    "/users/:path*",
    "/organizations/:path*",
    "/subscription-plans/:path*",
    "/support-tickets/:path*",
    "/community-admin/:path*",
    "/map-gallery-admin/:path*",
  ],
};
