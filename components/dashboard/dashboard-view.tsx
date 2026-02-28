"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatPace,
  formatDuration,
  formatDistance,
} from "@/lib/calculations";
import {
  Activity,
  Clock,
  Flame,
  MapPin,
  Mountain,
  TrendingUp,
} from "lucide-react";
import { DashboardFilters } from "./dashboard-filters";
import { DistanceChart } from "./distance-chart";
import { PaceTrendChart } from "./pace-trend-chart";
import { MonthlySummary } from "./monthly-summary";

const TYPE_LABELS: Record<string, string> = {
  RUN: "Run",
  TRAIL_RUN: "Trail Run",
  TREADMILL: "Treadmill",
};

interface DashboardData {
  summary: {
    totalDistance: number;
    totalDuration: number;
    totalElevation: number;
    totalActivities: number;
    averagePace: number | null;
    averageHeartRate: number | null;
    bestPace: number | null;
    streak: number;
  };
  weeklyData: Array<{
    weekStart: string;
    distance: number;
    duration: number;
    count: number;
  }>;
  monthlySummary: Array<{
    month: string;
    distance: number;
    duration: number;
    count: number;
    averagePace: number | null;
    elevation: number;
  }>;
  paceTrend: Array<{
    date: string;
    pace: number;
    name: string;
    distance: number;
  }>;
  recentActivities: Array<{
    id: string;
    name: string;
    type: string;
    startDate: string;
    distance: number;
    duration: number;
    averagePace: number | null;
  }>;
}

interface DashboardViewProps {
  userName: string;
}

export function DashboardView({ userName }: DashboardViewProps) {
  const [range, setRange] = useState("all");
  const [type, setType] = useState("");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ range });
      if (type) params.set("type", type);
      const res = await fetch(`/api/dashboard/stats?${params}`);
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [range, type]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const rangeLabel =
    range === "all"
      ? "All time"
      : range === "ytd"
        ? "Year to date"
        : `Last ${range}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {userName}!
        </p>
      </div>

      <DashboardFilters
        range={range}
        type={type}
        onRangeChange={setRange}
        onTypeChange={setType}
      />

      <div
        className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}
      >
        {/* Summary cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Distance
              </CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatDistance(data?.summary.totalDistance ?? 0)}
              </div>
              <CardDescription>{rangeLabel}</CardDescription>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Activities
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data?.summary.totalActivities ?? 0}
              </div>
              <CardDescription>{rangeLabel}</CardDescription>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(data?.summary.totalDuration ?? 0) > 0
                  ? formatDuration(data!.summary.totalDuration)
                  : "0m"}
              </div>
              <CardDescription>{rangeLabel}</CardDescription>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Average Pace
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data?.summary.averagePace
                  ? formatPace(data.summary.averagePace)
                  : "--:--"}
              </div>
              <CardDescription>min/km</CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Secondary stats row */}
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Elevation
              </CardTitle>
              <Mountain className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.round(data?.summary.totalElevation ?? 0)}m
              </div>
              <CardDescription>{rangeLabel}</CardDescription>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Best Pace</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data?.summary.bestPace
                  ? formatPace(data.summary.bestPace)
                  : "--:--"}
              </div>
              <CardDescription>min/km</CardDescription>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Running Streak
              </CardTitle>
              <Flame className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data?.summary.streak ?? 0} {(data?.summary.streak ?? 0) === 1 ? "day" : "days"}
              </div>
              <CardDescription>Consecutive days</CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <DistanceChart data={data?.weeklyData ?? []} />
          <PaceTrendChart data={data?.paceTrend ?? []} />
        </div>

        {/* Monthly summary */}
        <div className="mt-6">
          <MonthlySummary data={data?.monthlySummary ?? []} />
        </div>

        {/* Recent activities */}
        <div className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activities</CardTitle>
              <CardDescription>Your latest running activities</CardDescription>
            </CardHeader>
            <CardContent>
              {!data || data.recentActivities.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No activities yet. Upload a GPX file or connect Strava to get
                  started.
                </p>
              ) : (
                <div className="space-y-3">
                  {data.recentActivities.map((a) => (
                    <Link
                      key={a.id}
                      href={`/activities/${a.id}`}
                      className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{a.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                            {TYPE_LABELS[a.type] || a.type}
                          </span>
                          <span>
                            {new Date(a.startDate).toLocaleDateString(
                              undefined,
                              { month: "short", day: "numeric" }
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-4 text-sm">
                        <div className="text-right">
                          <p className="font-medium">
                            {formatDistance(a.distance)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDuration(a.duration)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-medium">
                            {a.averagePace
                              ? formatPace(a.averagePace)
                              : "--:--"}
                          </p>
                          <p className="text-xs text-muted-foreground">/km</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
