import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { completeMfaLogin, GarminAuthError } from "@/lib/garmin";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { mfaCode?: string; sessionState?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { mfaCode, sessionState } = body;
  if (!mfaCode || !sessionState) {
    return NextResponse.json(
      { error: "MFA code and session state are required" },
      { status: 400 }
    );
  }

  try {
    const { tokens, oauth1, garminUserId } = await completeMfaLogin(
      sessionState,
      mfaCode
    );
    const tokenExpiry = Math.floor(Date.now() / 1000) + tokens.expires_in;

    const encryptedOauth1 = encrypt(
      JSON.stringify({
        token: oauth1.token,
        tokenSecret: oauth1.tokenSecret,
        mfaToken: oauth1.mfaToken,
      })
    );

    await prisma.garminConnection.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        garminUserId,
        accessToken: encrypt(tokens.access_token),
        refreshToken: encryptedOauth1,
        tokenExpiry,
      },
      update: {
        garminUserId,
        accessToken: encrypt(tokens.access_token),
        refreshToken: encryptedOauth1,
        tokenExpiry,
      },
    });

    return NextResponse.json({ connected: true });
  } catch (e) {
    if (e instanceof GarminAuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error("Garmin MFA error:", e);
    return NextResponse.json(
      { error: "MFA verification failed" },
      { status: 500 }
    );
  }
}
