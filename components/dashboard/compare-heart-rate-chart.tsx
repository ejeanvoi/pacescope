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

const ROUTE_COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c",
  "#0891b2", "#be185d", "#854d0e", "#4f46e5", "#059669",
  "#e11d48", "#7c3aed", "#ca8a04", "#0d9488", "#c2410c",
  "#6366f1", "#15803d", "#b91c1c", "#7e22ce", "#0e7490",
];

interface CompareHeartRateChartProps {
  activities: Array<{
    name: string;
    points: Array<{
      cumulativeDistance: number | null;
      heartRate: number | null;
    }>;
  }>;
}

export function CompareHeartRateChart({
  activities,
}: CompareHeartRateChartProps) {
  if (activities.length === 0) return null;

  // Check if any activity has heart rate data
  const hasAnyHR = activities.some((a) =>
    a.points.some((p) => p.heartRate != null)
  );
  if (!hasAnyHR) return null;

  // Build a unified dataset keyed by distance (km, rounded to 0.1)
  const dataMap = new Map<number, Record<string, number | null>>();

  activities.forEach((activity, idx) => {
    const validPoints = activity.points.filter(
      (p) => p.cumulativeDistance != null && p.heartRate != null
    );
    // Downsample to ~200 points
    const maxPts = 200;
    const sampled =
      validPoints.length > maxPts
        ? validPoints.filter(
            (_, i) =>
              i === 0 ||
              i === validPoints.length - 1 ||
              i % Math.ceil(validPoints.length / maxPts) === 0
          )
        : validPoints;

    for (const p of sampled) {
      const distKm = Number((p.cumulativeDistance! / 1000).toFixed(1));
      const existing = dataMap.get(distKm) || { distance: distKm };
      existing[`hr_${idx}`] = p.heartRate!;
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
        <CardTitle className="text-base">Heart Rate Comparison</CardTitle>
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
              tickFormatter={(v: number) => `${v}`}
              fontSize={12}
              tickLine={false}
              axisLine={false}
              width={45}
              unit=" bpm"
            />
            <Tooltip
              labelFormatter={(label) => `${label} km`}
              formatter={(value, name) => {
                const idx = parseInt(String(name).replace("hr_", ""));
                return [`${value} bpm`, activities[idx]?.name || String(name)];
              }}
            />
            <Legend
              formatter={(value: string) => {
                const idx = parseInt(value.replace("hr_", ""));
                return activities[idx]?.name || value;
              }}
            />
            {activities.map((_, idx) => (
              <Line
                key={idx}
                type="monotone"
                dataKey={`hr_${idx}`}
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
