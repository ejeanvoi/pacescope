import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { globalDashboardQuerySchema } from "@/lib/validators/activity";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = globalDashboardQuerySchema.safeParse(searchParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters" },
      { status: 400 }
    );
  }

  const { period, type } = parsed.data;

  // Compute date filter
  const now = new Date();
  let fromDate: Date | null = null;
  switch (period) {
    case "weekly": {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      fromDate = new Date(now);
      fromDate.setDate(diff);
      fromDate.setHours(0, 0, 0, 0);
      break;
    }
    case "monthly":
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
  }

  const activityWhere = {
    user: { globalVisibility: true, isActive: true },
    ...(type ? { type } : {}),
    ...(fromDate ? { startDate: { gte: fromDate } } : {}),
  };

  // Fetch leaderboard data: per-user aggregations for opted-in users
  const usersWithStats = await prisma.user.findMany({
    where: { globalVisibility: true, isActive: true },
    select: {
      id: true,
      name: true,
      activities: {
        where: {
          ...(type ? { type } : {}),
          ...(fromDate ? { startDate: { gte: fromDate } } : {}),
        },
        select: {
          distance: true,
          duration: true,
          averagePace: true,
          bestPace: true,
          elevationGain: true,
        },
      },
    },
  });

  // Build leaderboard entries
  const leaderboard = usersWithStats
    .map((user) => {
      const activities = user.activities;
      const totalDistance = activities.reduce((s, a) => s + a.distance, 0);
      const totalDuration = activities.reduce((s, a) => s + a.duration, 0);
      const totalElevation = activities.reduce(
        (s, a) => s + (a.elevationGain ?? 0),
        0
      );
      const paces = activities
        .map((a) => a.averagePace)
        .filter((p): p is number => p != null && p > 0);
      const avgPace =
        paces.length > 0 ? paces.reduce((s, p) => s + p, 0) / paces.length : null;
      const bestPaces = activities
        .map((a) => a.bestPace)
        .filter((p): p is number => p != null && p > 0);
      const bestPace = bestPaces.length > 0 ? Math.min(...bestPaces) : null;

      return {
        userId: user.id,
        name: user.name || "Anonymous",
        activityCount: activities.length,
        totalDistance,
        totalDuration,
        totalElevation,
        averagePace: avgPace,
        bestPace,
        isCurrentUser: user.id === session.user.id,
      };
    })
    .filter((entry) => entry.activityCount > 0);

  // Sort by total distance (default leaderboard ranking)
  leaderboard.sort((a, b) => b.totalDistance - a.totalDistance);

  // Aggregate stats across all opted-in users
  const aggregateStats = await prisma.activity.aggregate({
    where: activityWhere,
    _sum: { distance: true, duration: true, elevationGain: true },
    _avg: { averagePace: true },
    _count: true,
  });

  // Current user's opt-in status
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { globalVisibility: true },
  });

  return NextResponse.json({
    leaderboard,
    aggregate: {
      totalDistance: aggregateStats._sum.distance ?? 0,
      totalDuration: aggregateStats._sum.duration ?? 0,
      totalElevation: aggregateStats._sum.elevationGain ?? 0,
      totalActivities: aggregateStats._count,
      averagePace: aggregateStats._avg.averagePace ?? null,
      participantCount: leaderboard.length,
    },
    currentUserOptedIn: currentUser?.globalVisibility ?? false,
    period,
  });
}
