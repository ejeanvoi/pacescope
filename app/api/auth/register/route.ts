import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/helpers";
import { registerSchema } from "@/lib/validators/auth";
import { rateLimit } from "@/lib/rate-limit";

const registerLimiter = rateLimit({ interval: 60_000, limit: 5 });

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { success } = registerLimiter.check(ip);
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;

    // Always hash password to prevent timing-based account enumeration
    const passwordHash = await hashPassword(password);

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      // Return same response shape to prevent account enumeration
      return NextResponse.json(
        { message: "If this email is not already registered, an account has been created." },
        { status: 201 }
      );
    }

    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
      },
    });

    return NextResponse.json(
      { message: "If this email is not already registered, an account has been created." },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
