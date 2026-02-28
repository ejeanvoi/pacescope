import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
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
import { Activity, Clock, MapPin, TrendingUp } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  RUN: "Run",
  TRAIL_RUN: "Trail Run",
  TREADMILL: "Treadmill",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = session.user.id;

  // Fetch aggregate stats and recent activities in parallel
  const [stats, recentActivities] = await Promise.all([
    prisma.activity.aggregate({
      where: { userId },
      _sum: { distance: true, duration: true },
      _avg: { averagePace: true },
      _count: true,
    }),
    prisma.activity.findMany({
      where: { userId },
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

  const totalDistance = stats._sum.distance ?? 0;
  const totalDuration = stats._sum.duration ?? 0;
  const totalActivities = stats._count;
  const avgPace = stats._avg.averagePace;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {session?.user?.name || "Runner"}!
        </p>
      </div>

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
              {formatDistance(totalDistance)}
            </div>
            <CardDescription>All time</CardDescription>
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
            <div className="text-2xl font-bold">{totalActivities}</div>
            <CardDescription>All time</CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalDuration > 0 ? formatDuration(totalDuration) : "0m"}
            </div>
            <CardDescription>All time</CardDescription>
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
              {avgPace ? `${formatPace(avgPace)}` : "--:--"}
            </div>
            <CardDescription>min/km</CardDescription>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activities</CardTitle>
          <CardDescription>
            Your latest running activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentActivities.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No activities yet. Upload a GPX file or connect Strava to get
              started.
            </p>
          ) : (
            <div className="space-y-3">
              {recentActivities.map((a) => (
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
                        {a.startDate.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
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
                          ? `${formatPace(a.averagePace)}`
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
  );
}
