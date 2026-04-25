import { NextRequest, NextResponse } from "next/server";
import { handlers } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";

const loginLimiter = rateLimit({ interval: 60_000, limit: 10 });

export const { GET } = handlers;

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { success } = loginLimiter.check(ip);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }
  return handlers.POST(request);
}
