import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dashboardStatsQuerySchema } from "@/lib/validators/activity";
import type { ActivityType } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const searchParams = Object.fromEntries(request.nextUrl.searchParams);

  const parsed = dashboardStatsQuerySchema.safeParse(searchParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters" },
      { status: 400 }
    );
  }

  const { range, type } = parsed.data;

  // Compute date range
  const now = new Date();
  let fromDate: Date | null = null;
  let toDate: Date | null = null;

  if (range === "custom") {
    if (parsed.data.from) fromDate = new Date(parsed.data.from + "T00:00:00");
    if (parsed.data.to) toDate = new Date(parsed.data.to + "T23:59:59.999");
  } else {
    switch (range) {
      case "7d":
        fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        fromDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "365d":
        fromDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case "ytd":
        fromDate = new Date(now.getFullYear(), 0, 1);
        break;
    }
  }

  const dateFilter: Record<string, Date> = {};
  if (fromDate) dateFilter.gte = fromDate;
  if (toDate) dateFilter.lte = toDate;

  const where = {
    userId,
    ...(type ? { type } : {}),
    ...(Object.keys(dateFilter).length > 0 ? { startDate: dateFilter } : {}),
  };

  // Fetch aggregate stats, weekly data, and recent activities in parallel
  const [aggregateStats, activities, recentActivities] = await Promise.all([
    prisma.activity.aggregate({
      where,
      _sum: { distance: true, duration: true, elevationGain: true },
      _avg: { averagePace: true, averageHeartRate: true },
      _min: { bestPace: true },
      _count: true,
    }),
    prisma.activity.findMany({
      where,
      orderBy: { startDate: "asc" },
      select: {
        id: true,
        name: true,
        type: true,
        startDate: true,
        distance: true,
        duration: true,
        averagePace: true,
        elevationGain: true,
        averageHeartRate: true,
      },
    }),
    prisma.activity.findMany({
      where,
      orderBy: { startDate: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        type: true,
        startDate: true,
        distance: true,
        duration: true,
        averagePace: true,
      },
    }),
  ]);

  // Build weekly distance data (last 12 weeks relative to filter range)
  const weeklyData = buildWeeklyData(activities);

  // Build monthly summary
  const monthlySummary = buildMonthlySummary(activities);

  // Build pace trend (per activity, chronological)
  const paceTrend = activities
    .filter((a) => a.averagePace != null && a.averagePace > 0)
    .map((a) => ({
      date: a.startDate.toISOString(),
      pace: a.averagePace!,
      name: a.name,
      distance: a.distance,
    }));

  // Calculate running streak
  const streak = await calculateStreak(userId);

  return NextResponse.json({
    summary: {
      totalDistance: aggregateStats._sum.distance ?? 0,
      totalDuration: aggregateStats._sum.duration ?? 0,
      totalElevation: aggregateStats._sum.elevationGain ?? 0,
      totalActivities: aggregateStats._count,
      averagePace: aggregateStats._avg.averagePace ?? null,
      averageHeartRate: aggregateStats._avg.averageHeartRate ?? null,
      bestPace: aggregateStats._min.bestPace ?? null,
      streak,
    },
    weeklyData,
    monthlySummary,
    paceTrend,
    recentActivities,
  });
}

interface ActivityRow {
  startDate: Date;
  distance: number;
  duration: number;
  averagePace: number | null;
  elevationGain: number | null;
}

function buildWeeklyData(activities: ActivityRow[]) {
  const weekMap = new Map<
    string,
    { distance: number; duration: number; elevation: number; count: number; weekStart: string }
  >();

  for (const a of activities) {
    const date = new Date(a.startDate);
    // Get Monday of the week
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    const key = monday.toISOString().split("T")[0];

    const existing = weekMap.get(key) || {
      distance: 0,
      duration: 0,
      elevation: 0,
      count: 0,
      weekStart: key,
    };
    existing.distance += a.distance;
    existing.duration += a.duration;
    existing.elevation += a.elevationGain ?? 0;
    existing.count += 1;
    weekMap.set(key, existing);
  }

  return Array.from(weekMap.values()).sort((a, b) =>
    a.weekStart.localeCompare(b.weekStart)
  );
}

function buildMonthlySummary(activities: ActivityRow[]) {
  const monthMap = new Map<
    string,
    {
      month: string;
      distance: number;
      duration: number;
      count: number;
      totalPace: number;
      paceCount: number;
      elevation: number;
    }
  >();

  for (const a of activities) {
    const date = new Date(a.startDate);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    const existing = monthMap.get(key) || {
      month: key,
      distance: 0,
      duration: 0,
      count: 0,
      totalPace: 0,
      paceCount: 0,
      elevation: 0,
    };
    existing.distance += a.distance;
    existing.duration += a.duration;
    existing.count += 1;
    if (a.averagePace != null && a.averagePace > 0) {
      existing.totalPace += a.averagePace;
      existing.paceCount += 1;
    }
    existing.elevation += a.elevationGain ?? 0;
    monthMap.set(key, existing);
  }

  return Array.from(monthMap.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => ({
      month: m.month,
      distance: m.distance,
      duration: m.duration,
      count: m.count,
      averagePace: m.paceCount > 0 ? m.totalPace / m.paceCount : null,
      elevation: m.elevation,
    }));
}

async function calculateStreak(userId: string): Promise<number> {
  // Fetch activity dates for streak calculation (most recent first)
  const activityDates = await prisma.activity.findMany({
    where: { userId },
    orderBy: { startDate: "desc" },
    select: { startDate: true },
  });

  if (activityDates.length === 0) return 0;

  // Get unique days (YYYY-MM-DD)
  const uniqueDays = [
    ...new Set(
      activityDates.map((a) => a.startDate.toISOString().split("T")[0])
    ),
  ].sort((a, b) => b.localeCompare(a)); // newest first

  // Check if streak is current (today or yesterday)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const todayStr = today.toISOString().split("T")[0];
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  if (uniqueDays[0] !== todayStr && uniqueDays[0] !== yesterdayStr) {
    return 0; // Streak broken
  }

  // Count consecutive days
  let streak = 1;
  for (let i = 1; i < uniqueDays.length; i++) {
    const current = new Date(uniqueDays[i - 1]);
    const prev = new Date(uniqueDays[i]);
    const diffMs = current.getTime() - prev.getTime();
    const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));

    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}
