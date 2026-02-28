import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { globalVisibility: true },
  });

  return NextResponse.json({
    globalVisibility: user?.globalVisibility ?? false,
  });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { globalVisibility?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.globalVisibility !== "boolean") {
    return NextResponse.json(
      { error: "globalVisibility must be a boolean" },
      { status: 400 }
    );
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { globalVisibility: body.globalVisibility },
    select: { globalVisibility: true },
  });

  return NextResponse.json({
    globalVisibility: user.globalVisibility,
  });
}
