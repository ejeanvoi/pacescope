"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatWeekLabel } from "@/lib/calculations";

interface WeeklyDataPoint {
  weekStart: string;
  distance: number;
  duration: number;
  count: number;
}

interface DistanceChartProps {
  data: WeeklyDataPoint[];
}

export function DistanceChart({ data }: DistanceChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Weekly Distance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No activity data yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((d) => ({
    week: formatWeekLabel(d.weekStart),
    distance: Number((d.distance / 1000).toFixed(2)),
    count: d.count,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Weekly Distance</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData}>
            <XAxis
              dataKey="week"
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
            />
            <Tooltip
              formatter={(value) => [`${value} km`, "Distance"]}
              labelFormatter={(label) => `Week of ${label}`}
            />
            <Bar
              dataKey="distance"
              fill="#2563eb"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
