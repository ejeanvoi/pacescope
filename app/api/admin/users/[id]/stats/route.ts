import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const stats = await prisma.activity.aggregate({
    where: { userId: id },
    _sum: { distance: true, duration: true },
    _count: true,
  });

  return NextResponse.json({
    userId: id,
    totalDistance: stats._sum.distance ?? 0,
    totalDuration: stats._sum.duration ?? 0,
    activityCount: stats._count,
  });
}
