import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/auth";
import { getAuthorizationUrl } from "@/lib/strava";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check that Strava env vars are configured
  if (!process.env.STRAVA_CLIENT_ID || !process.env.STRAVA_CLIENT_SECRET) {
    return NextResponse.json(
      { error: "Strava integration is not configured" },
      { status: 503 }
    );
  }

  // Generate CSRF state parameter
  const state = randomBytes(16).toString("hex");

  // Build authorization URL
  const authUrl = getAuthorizationUrl(state);

  // Set state in cookie and redirect to Strava
  const response = NextResponse.redirect(authUrl);
  response.cookies.set("strava_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  return response;
}
