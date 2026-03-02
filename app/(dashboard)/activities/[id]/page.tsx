import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DeleteActivityButton } from "@/components/activities/delete-button";
import { MapWrapper } from "@/components/activities/map-wrapper";
import { ElevationChart } from "@/components/activities/elevation-chart";
import { PaceChart } from "@/components/activities/pace-chart";
import {
  formatPace,
  formatDuration,
  formatDistance,
  calculateSplits,
  computeCumulativeDistances,
  type TrackPoint,
} from "@/lib/calculations";
import { ACTIVITY_TYPE_LABELS } from "@/lib/constants";
import {
  ArrowLeft,
  MapPin,
  Clock,
  TrendingUp,
  Mountain,
  Heart,
} from "lucide-react";

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const activity = await prisma.activity.findUnique({
    where: { id, userId: session.user.id },
    include: {
      points: {
        orderBy: { index: "asc" },
      },
    },
  });

  if (!activity) notFound();

  // Compute splits from points
  const trackpoints: TrackPoint[] = activity.points.map((p) => ({
    latitude: p.latitude,
    longitude: p.longitude,
    elevation: p.elevation,
    timestamp: p.timestamp,
    heartRate: p.heartRate,
  }));

  const cumulativeDistances = computeCumulativeDistances(trackpoints);
  const splits = calculateSplits(trackpoints, cumulativeDistances);

  // Prepare map data
  const mapPoints = activity.points.map((p) => ({
    latitude: p.latitude,
    longitude: p.longitude,
  }));

  // Compute per-point instantaneous pace (smoothed over a rolling window)
  const pointPaces: (number | null)[] = activity.points.map((p, i) => {
    if (i === 0) return null;
    const prev = activity.points[i - 1];
    if (!p.timestamp || !prev.timestamp) return null;
    const timeDiff =
      (new Date(p.timestamp).getTime() - new Date(prev.timestamp).getTime()) /
      1000;
    const distDiff = cumulativeDistances[i] - cumulativeDistances[i - 1];
    if (distDiff <= 0 || timeDiff <= 0) return null;
    return (timeDiff / distDiff) * 1000; // sec per km
  });

  // Smooth pace with a rolling average (window of ~10 points) to reduce noise
  const smoothWindow = 10;
  const smoothedPaces: (number | null)[] = pointPaces.map((_, i) => {
    const start = Math.max(0, i - Math.floor(smoothWindow / 2));
    const end = Math.min(pointPaces.length, i + Math.ceil(smoothWindow / 2));
    const values = pointPaces
      .slice(start, end)
      .filter((v): v is number => v != null && v > 60 && v < 1200);
    if (values.length === 0) return null;
    return values.reduce((s, v) => s + v, 0) / values.length;
  });

  // Prepare elevation data with pace and heart rate
  const elevationData = activity.points.map((p, i) => ({
    distance: cumulativeDistances[i],
    elevation: p.elevation,
    pace: smoothedPaces[i],
    heartRate: p.heartRate,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/activities"
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Activities
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">
            {activity.name}
            {activity.location && (
              <span className="ml-2 text-lg font-normal text-muted-foreground">
                — {activity.location}
              </span>
            )}
          </h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {ACTIVITY_TYPE_LABELS[activity.type] || activity.type}
            </span>
            <span>
              {activity.startDate.toLocaleDateString(undefined, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
            <span>
              {activity.startDate.toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>
        <DeleteActivityButton activityId={activity.id} />
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Distance</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDistance(activity.distance)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDuration(activity.duration)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Pace</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activity.averagePace
                ? `${formatPace(activity.averagePace)} /km`
                : "--:--"}
            </div>
            {activity.bestPace && (
              <p className="text-xs text-muted-foreground">
                Best: {formatPace(activity.bestPace)} /km
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Elevation</CardTitle>
            <Mountain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activity.elevationGain != null
                ? `+${Math.round(activity.elevationGain)}m`
                : "--"}
            </div>
            {activity.elevationLoss != null && (
              <p className="text-xs text-muted-foreground">
                -{Math.round(activity.elevationLoss)}m loss
              </p>
            )}
          </CardContent>
        </Card>

        {activity.averageHeartRate != null && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg HR</CardTitle>
              <Heart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.round(activity.averageHeartRate)} bpm
              </div>
              {activity.maxHeartRate != null && (
                <p className="text-xs text-muted-foreground">
                  Max: {activity.maxHeartRate} bpm
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Route Map */}
      {mapPoints.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Route Map</CardTitle>
          </CardHeader>
          <CardContent>
            <MapWrapper points={mapPoints} />
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ElevationChart data={elevationData} />
        <PaceChart splits={splits} averagePace={activity.averagePace} />
      </div>
    </div>
  );
}
