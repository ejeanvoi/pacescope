"use client";

import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ElevationChart } from "./elevation-chart";
import { PaceChart } from "./pace-chart";
import { MapWrapper } from "./map-wrapper";
import {
  formatPace,
  formatDuration,
  formatDistance,
  type TrackPoint,
} from "@/lib/calculations";
import {
  MapPin,
  Clock,
  TrendingUp,
  Mountain,
  Heart,
  RotateCcw,
} from "lucide-react";

interface ElevationDataPoint {
  distance: number;
  elevation: number | null;
  pace: number | null;
  heartRate: number | null;
  verticalSpeed: number | null;
  slope: number | null;
  timestamp: string | null;
}

interface DefaultStats {
  distance: number;
  duration: number;
  averagePace: number | null;
  bestPace: number | null;
  elevationGain: number | null;
  elevationLoss: number | null;
  averageHeartRate: number | null;
  maxHeartRate: number | null;
}

interface ActivityChartSectionProps {
  elevationData: ElevationDataPoint[];
  defaultStats: DefaultStats;
  mapPoints: Array<{ latitude: number; longitude: number }>;
  splits: Array<{
    km: number;
    pace: number;
    elevationChange: number;
    averageHeartRate: number | null;
  }>;
  hasHeartRate: boolean;
}

interface SegmentStats {
  distance: number;
  duration: number;
  averagePace: number | null;
  elevationGain: number;
  elevationLoss: number;
  averageHeartRate: number | null;
}

export function ActivityChartSection({
  elevationData,
  defaultStats,
  mapPoints,
  splits,
  hasHeartRate,
}: ActivityChartSectionProps) {
  const [rangeKm, setRangeKm] = useState<[number, number]>([0, 0]);

  const totalKm = useMemo(() => {
    return elevationData.length > 0
      ? elevationData[elevationData.length - 1].distance / 1000
      : 0;
  }, [elevationData]);

  // Initialize rangeKm on first render
  useState(() => {
    setRangeKm([0, totalKm]);
  });

  const isFullRange =
    rangeKm[0] <= 0.001 && rangeKm[1] >= totalKm - 0.001;

  const segmentData = useMemo(() => {
    if (isFullRange) return elevationData;
    return elevationData.filter(
      (p) =>
        p.distance / 1000 >= rangeKm[0] && p.distance / 1000 <= rangeKm[1]
    );
  }, [elevationData, rangeKm, isFullRange]);

  const computedStats = useMemo((): SegmentStats => {
    if (segmentData.length === 0) {
      return {
        distance: 0,
        duration: 0,
        averagePace: null,
        elevationGain: 0,
        elevationLoss: 0,
        averageHeartRate: null,
      };
    }

    const firstPoint = segmentData[0];
    const lastPoint = segmentData[segmentData.length - 1];

    // Distance
    const distance = lastPoint.distance - firstPoint.distance;

    // Duration
    let duration = 0;
    if (firstPoint.timestamp && lastPoint.timestamp) {
      duration =
        (new Date(lastPoint.timestamp).getTime() -
          new Date(firstPoint.timestamp).getTime()) /
        1000;
    }

    // Average pace
    const averagePace =
      distance > 0 && duration > 0
        ? (duration / distance) * 1000
        : null;

    // Elevation gain/loss
    let elevationGain = 0;
    let elevationLoss = 0;
    let lastElevation: number | null = null;
    const ELEVATION_NOISE_THRESHOLD = 2;

    for (const point of segmentData) {
      if (point.elevation == null) continue;
      if (lastElevation != null) {
        const diff = point.elevation - lastElevation;
        if (Math.abs(diff) >= ELEVATION_NOISE_THRESHOLD) {
          if (diff > 0) elevationGain += diff;
          else elevationLoss += Math.abs(diff);
          lastElevation = point.elevation;
        }
      } else {
        lastElevation = point.elevation;
      }
    }

    // Average heart rate
    const hrPoints = segmentData.filter((p) => p.heartRate != null);
    const averageHeartRate =
      hrPoints.length > 0
        ? Math.round(
            hrPoints.reduce((s, p) => s + p.heartRate!, 0) / hrPoints.length
          )
        : null;

    return {
      distance,
      duration,
      averagePace,
      elevationGain,
      elevationLoss,
      averageHeartRate,
    };
  }, [segmentData]);

  const displayStats = isFullRange ? defaultStats : computedStats;

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div />
          {!isFullRange && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRangeKm([0, totalKm])}
              className="gap-1 text-xs"
            >
              <RotateCcw className="h-3 w-3" />
              Full Activity
            </Button>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Distance</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatDistance(displayStats.distance)}
              </div>
              {!isFullRange && (
                <p className="text-xs text-muted-foreground">
                  {rangeKm[0].toFixed(2)} – {rangeKm[1].toFixed(2)} km
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Duration</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatDuration(displayStats.duration)}
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
                {displayStats.averagePace
                  ? `${formatPace(displayStats.averagePace)} /km`
                  : "--:--"}
              </div>
              {!isFullRange && displayStats.distance > 0 && (
                <p className="text-xs text-muted-foreground">
                  {(displayStats.distance / 1000).toFixed(2)} km
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
                {computedStats.elevationGain > 0
                  ? `+${Math.round(computedStats.elevationGain)}m`
                  : "--"}
              </div>
              {computedStats.elevationLoss > 0 && (
                <p className="text-xs text-muted-foreground">
                  -{Math.round(computedStats.elevationLoss)}m loss
                </p>
              )}
            </CardContent>
          </Card>

          {hasHeartRate && displayStats.averageHeartRate != null && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg HR</CardTitle>
                <Heart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round(displayStats.averageHeartRate)} bpm
                </div>
              </CardContent>
            </Card>
          )}
        </div>
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
        <ElevationChart
          data={elevationData}
          onRangeChange={(startKm, endKm) => {
            setRangeKm([startKm, endKm]);
          }}
        />
        <PaceChart splits={splits} averagePace={defaultStats.averagePace} />
      </div>
    </div>
  );
}
