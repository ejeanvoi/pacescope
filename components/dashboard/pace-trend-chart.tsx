"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPace } from "@/lib/calculations";

interface PaceTrendPoint {
  date: string;
  pace: number;
  name: string;
  distance: number;
}

interface PaceTrendChartProps {
  data: PaceTrendPoint[];
}

export function PaceTrendChart({ data }: PaceTrendChartProps) {
  if (data.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pace Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Need at least 2 activities to show pace trend.
          </p>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((d) => ({
    date: new Date(d.date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    pace: Math.round(d.pace),
    name: d.name,
    distance: Number((d.distance / 1000).toFixed(2)),
  }));

  const avgPace =
    chartData.reduce((sum, d) => sum + d.pace, 0) / chartData.length;
  const minPace = Math.min(...chartData.map((d) => d.pace));
  const maxPace = Math.max(...chartData.map((d) => d.pace));
  const padding = Math.max((maxPace - minPace) * 0.15, 15);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pace Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData}>
            <XAxis
              dataKey="date"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              reversed
              domain={[
                Math.max(0, Math.floor(minPace - padding)),
                Math.ceil(maxPace + padding),
              ]}
              tickFormatter={(v: number) => formatPace(v)}
              fontSize={12}
              tickLine={false}
              axisLine={false}
              width={55}
            />
            <Tooltip
              formatter={(value) => [
                `${formatPace(Number(value))} /km`,
                "Pace",
              ]}
              labelFormatter={(label) => `${label}`}
            />
            <ReferenceLine
              y={avgPace}
              stroke="#888"
              strokeDasharray="4 4"
              label={{
                value: `Avg ${formatPace(avgPace)}`,
                position: "right",
                fontSize: 11,
              }}
            />
            <Line
              type="monotone"
              dataKey="pace"
              stroke="#2563eb"
              strokeWidth={2}
              dot={{ fill: "#2563eb", r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
