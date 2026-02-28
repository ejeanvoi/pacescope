import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import authConfig from "@/auth.config";

const { auth } = NextAuth(authConfig);

const publicRoutes = ["/login", "/register"];

const securityHeaders = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-DNS-Prefetch-Control": "off",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
} as const;

function withSecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }
  return response;
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Allow public routes
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    // Redirect authenticated users away from auth pages
    if (session) {
      return withSecurityHeaders(
        NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin))
      );
    }
    return withSecurityHeaders(NextResponse.next());
  }

  // Allow API auth routes (handled by NextAuth)
  if (pathname.startsWith("/api/auth")) {
    return withSecurityHeaders(NextResponse.next());
  }

  // All other routes require authentication
  if (!session) {
    return withSecurityHeaders(
      NextResponse.redirect(new URL("/login", req.nextUrl.origin))
    );
  }

  // Admin routes require admin role
  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/admin")
  ) {
    if (session.user?.role !== "ADMIN") {
      return withSecurityHeaders(
        NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin))
      );
    }
  }

  return withSecurityHeaders(NextResponse.next());
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
