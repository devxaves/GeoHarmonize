/**
 * GeoHarmonize — Middleware
 * DB-based session auth with role-based route protection
 * Roles: admin | reviewer | viewer
 */

import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "geoharmonize_session";

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  "/",
  "/landing",
  "/login",
  "/register",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
  "/api/auth/me",
  "/api/health",
  "/docs",
];

// Protected routes (admin or reviewer)
const PROTECTED_ROUTES = [
  "/dashboard",
  "/upload",
  "/conflicts",
  "/parcels",
  "/changes",
  "/archive",
  "/audit",
  "/api/dashboard",
  "/api/upload",
  "/api/documents",
  "/api/audit",
  "/api/me",
];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(route + "/"));
}

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some((route) => pathname === route || pathname.startsWith(route + "/"));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Allow static files and Next.js internals
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;

  // No session → redirect to login
  if (!token && isProtectedRoute(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Session cookie exists — route handlers validate fully (Edge runtime can't connect to PostgreSQL)
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
