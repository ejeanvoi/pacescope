"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPace } from "@/lib/calculations";

const ROUTE_COLORS = ["#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c"];

const MIN_PACE = 90; // 1:30/km — faster than world records
const MAX_PACE = 900; // 15:00/km — very slow walk

interface ComparePaceAlongTrackChartProps {
  activities: Array<{
    name: string;
    points: Array<{
      cumulativeDistance: number | null;
      timestamp: string | null;
    }>;
  }>;
}

interface PacePoint {
  distanceKm: number;
  pace: number;
}

function computeSmoothedPace(
  points: Array<{
    cumulativeDistance: number | null;
    timestamp: string | null;
  }>,
  windowSize: number = 11
): PacePoint[] {
  // Filter valid points
  const valid = points.filter(
    (p): p is typeof p & { cumulativeDistance: number; timestamp: string } =>
      p.cumulativeDistance != null && p.timestamp != null
  );

  if (valid.length < 2) return [];

  // Compute raw instantaneous pace between consecutive points
  const raw: PacePoint[] = [];
  for (let i = 1; i < valid.length; i++) {
    const distDelta =
      valid[i].cumulativeDistance - valid[i - 1].cumulativeDistance;
    const timeDelta =
      (new Date(valid[i].timestamp).getTime() -
        new Date(valid[i - 1].timestamp).getTime()) /
      1000;

    if (distDelta <= 0 || timeDelta <= 0) continue;

    const pace = (timeDelta / distDelta) * 1000; // sec/km
    if (pace < MIN_PACE || pace > MAX_PACE) continue;

    raw.push({
      distanceKm: Number((valid[i].cumulativeDistance / 1000).toFixed(2)),
      pace,
    });
  }

  if (raw.length < 2) return [];

  // Smooth with rolling average
  const halfWindow = Math.floor(windowSize / 2);
  return raw.map((p, i) => {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(raw.length - 1, i + halfWindow);
    const window = raw.slice(start, end + 1);
    const avgPace = window.reduce((s, w) => s + w.pace, 0) / window.length;
    return { distanceKm: p.distanceKm, pace: avgPace };
  });
}

export function ComparePaceAlongTrackChart({
  activities,
}: ComparePaceAlongTrackChartProps) {
  if (activities.length === 0) return null;

  // Check if any activity has timestamp + distance data
  const hasData = activities.some(
    (a) =>
      a.points.filter(
        (p) => p.cumulativeDistance != null && p.timestamp != null
      ).length >= 2
  );
  if (!hasData) return null;

  // Build unified dataset keyed by distance
  const dataMap = new Map<number, Record<string, number | null>>();

  activities.forEach((activity, idx) => {
    let pacePoints = computeSmoothedPace(activity.points);

    // Downsample to ~200 points
    const maxPts = 200;
    if (pacePoints.length > maxPts) {
      pacePoints = pacePoints.filter(
        (_, i) =>
          i === 0 ||
          i === pacePoints.length - 1 ||
          i % Math.ceil(pacePoints.length / maxPts) === 0
      );
    }

    for (const p of pacePoints) {
      const distKm = Number(p.distanceKm.toFixed(1));
      const existing = dataMap.get(distKm) || { distance: distKm };
      existing[`pace_${idx}`] = Math.round(p.pace);
      dataMap.set(distKm, existing);
    }
  });

  const chartData = Array.from(dataMap.values()).sort(
    (a, b) => (a.distance as number) - (b.distance as number)
  );

  if (chartData.length < 2) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pace Along Track</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData}>
            <XAxis
              dataKey="distance"
              tickFormatter={(v: number) => `${v} km`}
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              reversed
              tickFormatter={(v: number) => formatPace(v)}
              fontSize={12}
              tickLine={false}
              axisLine={false}
              width={55}
            />
            <Tooltip
              labelFormatter={(label) => `${label} km`}
              formatter={(value, name) => {
                const idx = parseInt(String(name).replace("pace_", ""));
                return [
                  `${formatPace(Number(value))} /km`,
                  activities[idx]?.name || String(name),
                ];
              }}
            />
            <Legend
              formatter={(value: string) => {
                const idx = parseInt(value.replace("pace_", ""));
                return activities[idx]?.name || value;
              }}
            />
            {activities.map((_, idx) => (
              <Line
                key={idx}
                type="monotone"
                dataKey={`pace_${idx}`}
                stroke={ROUTE_COLORS[idx % ROUTE_COLORS.length]}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
