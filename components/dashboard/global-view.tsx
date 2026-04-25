"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  formatPace,
  formatDuration,
  formatDistance,
} from "@/lib/calculations";
import {
  Globe,
  MapPin,
  Clock,
  TrendingUp,
  Mountain,
  Users,
  Trophy,
  Medal,
  Award,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LeaderboardDistanceChart } from "./leaderboard-chart";

const PERIODS = [
  { value: "weekly", label: "This Week" },
  { value: "monthly", label: "This Month" },
  { value: "all", label: "All Time" },
] as const;

const ACTIVITY_TYPES = [
  { value: "", label: "All Types" },
  { value: "RUN", label: "Run" },
  { value: "TRAIL_RUN", label: "Trail Run" },
  { value: "TREADMILL", label: "Treadmill" },
] as const;

interface LeaderboardEntry {
  userId: string;
  name: string;
  activityCount: number;
  totalDistance: number;
  totalDuration: number;
  totalElevation: number;
  averagePace: number | null;
  bestPace: number | null;
  isCurrentUser: boolean;
}

interface GlobalData {
  leaderboard: LeaderboardEntry[];
  aggregate: {
    totalDistance: number;
    totalDuration: number;
    totalElevation: number;
    totalActivities: number;
    averagePace: number | null;
    participantCount: number;
  };
  currentUserOptedIn: boolean;
  period: string;
}

export function GlobalView() {
  const [period, setPeriod] = useState("all");
  const [type, setType] = useState("");
  const [data, setData] = useState<GlobalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ period });
      if (type) params.set("type", type);
      const res = await fetch(`/api/dashboard/global?${params}`);
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [period, type]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleVisibility = async () => {
    if (!data) return;
    setToggling(true);
    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          globalVisibility: !data.currentUserOptedIn,
        }),
      });
      if (res.ok) {
        fetchData();
      }
    } finally {
      setToggling(false);
    }
  };

  const periodLabel =
    period === "weekly"
      ? "This week"
      : period === "monthly"
        ? "This month"
        : "All time";

  const RANK_ICONS = [Trophy, Medal, Award];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Global Dashboard
          </h1>
          <p className="text-muted-foreground">
            Compare your performance with other runners
          </p>
        </div>
        <Button
          variant={data?.currentUserOptedIn ? "outline" : "default"}
          onClick={toggleVisibility}
          disabled={toggling}
        >
          <Globe className="mr-2 h-4 w-4" />
          {data?.currentUserOptedIn
            ? "Leave Leaderboard"
            : "Join Leaderboard"}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex flex-wrap gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                period === p.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {ACTIVITY_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                type === t.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className={
          loading ? "opacity-60 transition-opacity" : "transition-opacity"
        }
      >
        {/* Opt-in notice */}
        {!data?.currentUserOptedIn && (
          <Card className="mb-6 border-dashed">
            <CardContent className="flex items-center gap-4 py-4">
              <Globe className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-medium">You are not on the leaderboard</p>
                <p className="text-sm text-muted-foreground">
                  Click &ldquo;Join Leaderboard&rdquo; above to share your stats
                  with other runners. You can leave at any time.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Aggregate stats */}
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
                {formatDistance(data?.aggregate.totalDistance ?? 0)}
              </div>
              <CardDescription>
                {periodLabel} &middot; all participants
              </CardDescription>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Activities
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data?.aggregate.totalActivities ?? 0}
              </div>
              <CardDescription>{periodLabel}</CardDescription>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(data?.aggregate.totalDuration ?? 0) > 0
                  ? formatDuration(data!.aggregate.totalDuration)
                  : "0m"}
              </div>
              <CardDescription>{periodLabel}</CardDescription>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Participants
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data?.aggregate.participantCount ?? 0}
              </div>
              <CardDescription>Runners on leaderboard</CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Leaderboard */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Leaderboard</CardTitle>
              <CardDescription>
                Ranked by total distance ({periodLabel.toLowerCase()})
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!data || data.leaderboard.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No participants yet. Be the first to join!
                </p>
              ) : (
                <div className="space-y-2">
                  {data.leaderboard.map((entry, index) => {
                    const RankIcon = RANK_ICONS[index] || null;
                    return (
                      <div
                        key={entry.userId}
                        className={cn(
                          "flex items-center justify-between rounded-lg border p-3",
                          entry.isCurrentUser && "bg-primary/5 ring-1 ring-primary/20"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-bold">
                            {RankIcon ? (
                              <RankIcon
                                className={cn(
                                  "h-4 w-4",
                                  index === 0 && "text-yellow-500",
                                  index === 1 && "text-gray-400",
                                  index === 2 && "text-amber-600"
                                )}
                              />
                            ) : (
                              index + 1
                            )}
                          </div>
                          <div>
                            <p className={cn("font-medium", entry.isCurrentUser && "text-primary")}>
                              {entry.name}
                              {entry.isCurrentUser && (
                                <span className="ml-1.5 text-xs text-muted-foreground">
                                  (you)
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {entry.activityCount}{" "}
                              {entry.activityCount === 1 ? "run" : "runs"}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-4 text-sm">
                          <div className="text-right">
                            <p className="font-medium">
                              {formatDistance(entry.totalDistance)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDuration(entry.totalDuration)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono font-medium">
                              {entry.averagePace
                                ? formatPace(entry.averagePace)
                                : "--:--"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              avg /km
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Distance comparison chart */}
          <LeaderboardDistanceChart
            leaderboard={data?.leaderboard ?? []}
            period={periodLabel}
          />
        </div>
      </div>
    </div>
  );
}
