import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import authConfig from "@/auth.config";

const { auth } = NextAuth(authConfig);

const publicRoutes = ["/login", "/register"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Allow public routes
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    // Redirect authenticated users away from auth pages
    if (session) {
      return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
    }
    return NextResponse.next();
  }

  // Allow API auth routes (handled by NextAuth)
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // All other routes require authentication
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }

  // Admin routes require admin role
  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/admin")
  ) {
    if (session.user?.role !== "ADMIN") {
      return NextResponse.redirect(
        new URL("/dashboard", req.nextUrl.origin)
      );
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
