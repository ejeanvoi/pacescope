import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { exchangeToken } from "@/lib/strava";
import { encrypt } from "@/lib/crypto";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", request.nextUrl.origin));
  }

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Handle user denial
  if (error) {
    return NextResponse.redirect(
      new URL("/strava?error=access_denied", request.nextUrl.origin)
    );
  }

  // Validate required params
  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/strava?error=invalid_request", request.nextUrl.origin)
    );
  }

  // Verify CSRF state
  const storedState = request.cookies.get("strava_oauth_state")?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(
      new URL("/strava?error=invalid_state", request.nextUrl.origin)
    );
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeToken(code);

    // Encrypt tokens before storage
    const encryptedAccess = encrypt(tokens.access_token);
    const encryptedRefresh = encrypt(tokens.refresh_token);

    // Create or update StravaConnection
    await prisma.stravaConnection.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        stravaAthleteId: tokens.athlete.id,
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        expiresAt: tokens.expires_at,
        scope: "read,activity:read_all",
      },
      update: {
        stravaAthleteId: tokens.athlete.id,
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        expiresAt: tokens.expires_at,
        scope: "read,activity:read_all",
      },
    });

    // Clear state cookie and redirect to Strava page
    const response = NextResponse.redirect(
      new URL("/strava?success=connected", request.nextUrl.origin)
    );
    response.cookies.delete("strava_oauth_state");

    return response;
  } catch (e) {
    console.error("Strava OAuth callback error:", e);
    return NextResponse.redirect(
      new URL("/strava?error=token_exchange_failed", request.nextUrl.origin)
    );
  }
}
