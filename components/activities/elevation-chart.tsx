"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ElevationChartProps {
  data: Array<{
    distance: number; // meters
    elevation: number | null;
  }>;
}

export function ElevationChart({ data }: ElevationChartProps) {
  const chartData = data
    .filter((d) => d.elevation != null)
    .map((d) => ({
      distance: Number((d.distance / 1000).toFixed(2)),
      elevation: Math.round(d.elevation!),
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

  const minElev = Math.min(...sampled.map((d) => d.elevation));
  const maxElev = Math.max(...sampled.map((d) => d.elevation));
  const padding = Math.max((maxElev - minElev) * 0.1, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Elevation Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={sampled}>
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
              domain={[
                Math.floor(minElev - padding),
                Math.ceil(maxElev + padding),
              ]}
              tickFormatter={(v: number) => `${v}m`}
              fontSize={12}
              tickLine={false}
              axisLine={false}
              width={50}
            />
            <Tooltip
              formatter={(value) => [`${value}m`, "Elevation"]}
              labelFormatter={(label) => `${label} km`}
            />
            <Area
              type="monotone"
              dataKey="elevation"
              stroke="#2563eb"
              strokeWidth={2}
              fill="url(#elevGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
