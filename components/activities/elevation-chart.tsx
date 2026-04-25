"use client";

import { useState, useMemo } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { formatPace } from "@/lib/calculations";
import { TrendingUp, Heart, Mountain, Percent } from "lucide-react";

interface ElevationDataPoint {
  distance: number; // meters
  elevation: number | null;
  pace: number | null; // seconds per km
  heartRate: number | null; // bpm
  verticalSpeed: number | null; // m/h
  slope: number | null; // %
  timestamp: string | null; // ISO string
}

interface ElevationChartProps {
  data: ElevationDataPoint[];
  onRangeChange?: (startKm: number, endKm: number) => void;
}

export function ElevationChart({
  data,
  onRangeChange,
}: ElevationChartProps) {
  const [showPace, setShowPace] = useState(false);
  const [showHeartRate, setShowHeartRate] = useState(false);
  const [showVerticalSpeed, setShowVerticalSpeed] = useState(false);
  const [showSlope, setShowSlope] = useState(false);
  const [rangeValue, setRangeValue] = useState<[number, number]>([0, 100]);

  const hasPaceData = data.some((d) => d.pace != null && d.pace > 0);
  const hasHeartRateData = data.some((d) => d.heartRate != null);
  const hasVerticalSpeedData = data.some((d) => d.verticalSpeed != null);
  const hasSlopeData = data.some((d) => d.slope != null);

  const chartData = data
    .filter((d) => d.elevation != null)
    .map((d) => ({
      distance: Number((d.distance / 1000).toFixed(2)),
      elevation: Math.round(d.elevation!),
      pace: d.pace != null && d.pace > 0 ? Math.round(d.pace) : undefined,
      heartRate: d.heartRate != null ? d.heartRate : undefined,
      verticalSpeed:
        d.verticalSpeed != null
          ? Math.round(d.verticalSpeed * 10) / 10
          : undefined,
      slope: d.slope != null ? Math.round(d.slope * 10) / 10 : undefined,
      timestamp: d.timestamp ?? undefined,
    }));

  // Downsample if too many points (keep ~500 max for chart performance)
  const maxPoints = 500;
  const sampled =
    chartData.length > maxPoints
      ? chartData.filter(
          (_, i) =>
            i === 0 ||
            i === chartData.length - 1 ||
            i % Math.ceil(chartData.length / maxPoints) === 0
        )
      : chartData;

  if (sampled.length < 2) {
    return null;
  }

  // Calculate distance range for slider
  const totalDistance = sampled[sampled.length - 1].distance;
  const startKm = (rangeValue[0] / 100) * totalDistance;
  const endKm = (rangeValue[1] / 100) * totalDistance;

  // Filter data based on slider range
  const filteredData = sampled.filter(
    (d) => d.distance >= startKm && d.distance <= endKm
  );

  // Use filtered data for chart, but keep sampled for full data
  const chartDisplay = filteredData.length > 0 ? filteredData : sampled;

  const minElev = Math.min(...chartDisplay.map((d) => d.elevation));
  const maxElev = Math.max(...sampled.map((d) => d.elevation));
  const elevPadding = Math.max((maxElev - minElev) * 0.1, 5);

  const paceValues = chartDisplay
    .map((d) => d.pace)
    .filter((p): p is number => p != null);
  const hrValues = chartDisplay
    .map((d) => d.heartRate)
    .filter((h): h is number => h != null);

  const minPace = paceValues.length > 0 ? Math.min(...paceValues) : 0;
  const maxPace = paceValues.length > 0 ? Math.max(...paceValues) : 0;
  const pacePadding = Math.max((maxPace - minPace) * 0.1, 15);

  const minHr = hrValues.length > 0 ? Math.min(...hrValues) : 0;
  const maxHr = hrValues.length > 0 ? Math.max(...hrValues) : 0;
  const hrPadding = Math.max((maxHr - minHr) * 0.1, 5);

  const vsValues = chartDisplay
    .map((d) => d.verticalSpeed)
    .filter((v): v is number => v != null);
  const minVs = vsValues.length > 0 ? Math.min(...vsValues) : 0;
  const maxVs = vsValues.length > 0 ? Math.max(...vsValues) : 0;
  const vsPadding = Math.max((maxVs - minVs) * 0.1, 50);

  const slopeValues = chartDisplay
    .map((d) => d.slope)
    .filter((s): s is number => s != null);
  const minSlope = slopeValues.length > 0 ? Math.min(...slopeValues) : 0;
  const maxSlope = slopeValues.length > 0 ? Math.max(...slopeValues) : 0;
  const slopePadding = Math.max((maxSlope - minSlope) * 0.1, 2);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Elevation Profile</CardTitle>
          <div className="flex gap-1">
            {hasPaceData && (
              <Button
                variant={showPace ? "default" : "outline"}
                size="sm"
                onClick={() => setShowPace(!showPace)}
                className="h-7 gap-1 text-xs"
              >
                <TrendingUp className="h-3 w-3" />
                Pace
              </Button>
            )}
            {hasHeartRateData && (
              <Button
                variant={showHeartRate ? "default" : "outline"}
                size="sm"
                onClick={() => setShowHeartRate(!showHeartRate)}
                className="h-7 gap-1 text-xs"
              >
                <Heart className="h-3 w-3" />
                HR
              </Button>
            )}
            {hasVerticalSpeedData && (
              <Button
                variant={showVerticalSpeed ? "default" : "outline"}
                size="sm"
                onClick={() => setShowVerticalSpeed(!showVerticalSpeed)}
                className="h-7 gap-1 text-xs"
              >
                <Mountain className="h-3 w-3" />
                V. Speed
              </Button>
            )}
            {hasSlopeData && (
              <Button
                variant={showSlope ? "default" : "outline"}
                size="sm"
                onClick={() => setShowSlope(!showSlope)}
                className="h-7 gap-1 text-xs"
              >
                <Percent className="h-3 w-3" />
                Slope
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartDisplay} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="elevGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="distance"
              tickFormatter={(v: number) => `${v} km`}
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="elevation"
              domain={[
                Math.floor(minElev - elevPadding),
                Math.ceil(maxElev + elevPadding),
              ]}
              tickFormatter={(v: number) => `${v}m`}
              fontSize={12}
              tickLine={false}
              axisLine={false}
              width={50}
            />
            {showPace && (
              <YAxis
                yAxisId="pace"
                orientation="right"
                reversed
                domain={[
                  Math.max(0, Math.floor(minPace - pacePadding)),
                  Math.ceil(maxPace + pacePadding),
                ]}
                tickFormatter={(v: number) => formatPace(v)}
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={50}
              />
            )}
            {showHeartRate && (
              <YAxis
                yAxisId="hr"
                orientation="right"
                domain={[
                  Math.floor(minHr - hrPadding),
                  Math.ceil(maxHr + hrPadding),
                ]}
                tickFormatter={(v: number) => `${v}`}
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={40}
              />
            )}
            {showVerticalSpeed && (
              <YAxis
                yAxisId="vs"
                orientation="right"
                domain={[
                  Math.floor(minVs - vsPadding),
                  Math.ceil(maxVs + vsPadding),
                ]}
                tickFormatter={(v: number) => `${v}`}
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={50}
              />
            )}
            {showSlope && (
              <YAxis
                yAxisId="slope"
                orientation="right"
                domain={[
                  Math.floor(minSlope - slopePadding),
                  Math.ceil(maxSlope + slopePadding),
                ]}
                tickFormatter={(v: number) => `${v}%`}
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={40}
              />
            )}
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="rounded-lg border bg-background p-2 text-sm shadow-sm">
                    <p className="font-medium">{label} km</p>
                    {payload.map((entry) => {
                      if (entry.dataKey === "elevation") {
                        return (
                          <p key="elev" style={{ color: entry.color }}>
                            Elevation: {entry.value}m
                          </p>
                        );
                      }
                      if (entry.dataKey === "pace" && showPace) {
                        return (
                          <p key="pace" style={{ color: entry.color }}>
                            Pace: {formatPace(Number(entry.value))} /km
                          </p>
                        );
                      }
                      if (entry.dataKey === "heartRate" && showHeartRate) {
                        return (
                          <p key="hr" style={{ color: entry.color }}>
                            HR: {entry.value} bpm
                          </p>
                        );
                      }
                      if (entry.dataKey === "verticalSpeed" && showVerticalSpeed) {
                        return (
                          <p key="vs" style={{ color: entry.color }}>
                            Vertical: {entry.value} m/h
                          </p>
                        );
                      }
                      if (entry.dataKey === "slope" && showSlope) {
                        return (
                          <p key="slope" style={{ color: entry.color }}>
                            Slope: {entry.value}%
                          </p>
                        );
                      }
                      return null;
                    })}
                  </div>
                );
              }}
            />
            <Area
              yAxisId="elevation"
              type="monotone"
              dataKey="elevation"
              stroke="#2563eb"
              strokeWidth={2}
              fill="url(#elevGradient)"
            />
            {showPace && (
              <Line
                yAxisId="pace"
                type="monotone"
                dataKey="pace"
                stroke="#f97316"
                strokeWidth={1.5}
                dot={false}
                connectNulls
              />
            )}
            {showHeartRate && (
              <Line
                yAxisId="hr"
                type="monotone"
                dataKey="heartRate"
                stroke="#ef4444"
                strokeWidth={1.5}
                dot={false}
                connectNulls
              />
            )}
            {showVerticalSpeed && (
              <Line
                yAxisId="vs"
                type="monotone"
                dataKey="verticalSpeed"
                stroke="#8b5cf6"
                strokeWidth={1.5}
                dot={false}
                connectNulls
              />
            )}
            {showSlope && (
              <Line
                yAxisId="slope"
                type="monotone"
                dataKey="slope"
                stroke="#10b981"
                strokeWidth={1.5}
                dot={false}
                connectNulls
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>

        {onRangeChange && (
          <div className="mt-4 space-y-2">
            <Slider
              value={rangeValue}
              onValueChange={(value) => {
                const newRange = value as [number, number];
                setRangeValue(newRange);
                const start = (newRange[0] / 100) * totalDistance;
                const end = (newRange[1] / 100) * totalDistance;
                onRangeChange(start, end);
              }}
              min={0}
              max={100}
              step={0.5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{startKm.toFixed(2)} km</span>
              <span>{endKm.toFixed(2)} km</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
