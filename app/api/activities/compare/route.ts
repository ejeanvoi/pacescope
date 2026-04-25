import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ids = request.nextUrl.searchParams.get("ids");
  if (!ids) {
    return NextResponse.json(
      { error: "Missing ids parameter" },
      { status: 400 }
    );
  }

  const activityIds = ids.split(",").slice(0, 5); // Max 5 activities

  const activities = await prisma.activity.findMany({
    where: {
      id: { in: activityIds },
      userId: session.user.id,
    },
    include: {
      points: {
        orderBy: { index: "asc" },
        select: {
          latitude: true,
          longitude: true,
          elevation: true,
          timestamp: true,
          cumulativeDistance: true,
          heartRate: true,
        },
      },
    },
  });

  return NextResponse.json({ activities });
}
