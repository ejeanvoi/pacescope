import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { DeleteActivityButton } from "@/components/activities/delete-button";
import { ActivityChartSection } from "@/components/activities/activity-chart-section";
import {
  calculateSplits,
  computeCumulativeDistances,
  type TrackPoint,
} from "@/lib/calculations";
import { ACTIVITY_TYPE_LABELS } from "@/lib/constants";
import { ArrowLeft } from "lucide-react";

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

  // Compute per-point vertical speed (m/h)
  const pointVerticalSpeeds: (number | null)[] = activity.points.map((p, i) => {
    if (
      i === 0 ||
      p.elevation == null ||
      activity.points[i - 1].elevation == null
    )
      return null;
    const prev = activity.points[i - 1];
    if (!p.timestamp || !prev.timestamp) return null;
    const timeDiff =
      (new Date(p.timestamp).getTime() - new Date(prev.timestamp).getTime()) /
      1000;
    if (timeDiff <= 0) return null;
    return ((p.elevation - prev.elevation!) / timeDiff) * 3600;
  });

  // Smooth vertical speed with rolling average (window of ~10 points)
  const smoothedVerticalSpeeds: (number | null)[] = pointVerticalSpeeds.map(
    (_, i) => {
      const start = Math.max(0, i - Math.floor(smoothWindow / 2));
      const end = Math.min(
        pointVerticalSpeeds.length,
        i + Math.ceil(smoothWindow / 2)
      );
      const values = pointVerticalSpeeds
        .slice(start, end)
        .filter((v): v is number => v != null);
      if (values.length === 0) return null;
      return values.reduce((s, v) => s + v, 0) / values.length;
    }
  );

  // Compute per-point slope (%)
  const pointSlopes: (number | null)[] = activity.points.map((p, i) => {
    if (
      i === 0 ||
      p.elevation == null ||
      activity.points[i - 1].elevation == null
    )
      return null;
    const distDiff = cumulativeDistances[i] - cumulativeDistances[i - 1];
    if (distDiff <= 0) return null;
    return ((p.elevation - activity.points[i - 1].elevation!) / distDiff) * 100;
  });

  // Smooth slope with rolling average (window of ~10 points)
  const smoothedSlopes: (number | null)[] = pointSlopes.map((_, i) => {
    const start = Math.max(0, i - Math.floor(smoothWindow / 2));
    const end = Math.min(pointSlopes.length, i + Math.ceil(smoothWindow / 2));
    const values = pointSlopes
      .slice(start, end)
      .filter((v): v is number => v != null);
    if (values.length === 0) return null;
    return values.reduce((s, v) => s + v, 0) / values.length;
  });

  // Prepare elevation data with pace, heart rate, vertical speed, and slope
  const elevationData = activity.points.map((p, i) => ({
    distance: cumulativeDistances[i],
    elevation: p.elevation,
    pace: smoothedPaces[i],
    heartRate: p.heartRate,
    verticalSpeed: smoothedVerticalSpeeds[i],
    slope: smoothedSlopes[i],
    timestamp: p.timestamp?.toISOString() ?? null,
  }));

  const defaultStats = {
    distance: activity.distance,
    duration: activity.duration,
    averagePace: activity.averagePace,
    bestPace: activity.bestPace,
    elevationGain: activity.elevationGain,
    elevationLoss: activity.elevationLoss,
    averageHeartRate: activity.averageHeartRate,
    maxHeartRate: activity.maxHeartRate,
  };

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

      <ActivityChartSection
        elevationData={elevationData}
        defaultStats={defaultStats}
        mapPoints={mapPoints}
        splits={splits}
        hasHeartRate={activity.averageHeartRate != null}
      />
    </div>
  );
}
