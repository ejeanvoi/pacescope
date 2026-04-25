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

interface WeeklyDataPoint {
  weekStart: string;
  elevation: number;
}

interface ElevationChartProps {
  data: WeeklyDataPoint[];
}

export function ElevationChart({ data }: ElevationChartProps) {
  const hasElevation = data.some((d) => d.elevation > 0);

  if (data.length === 0 || !hasElevation) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Weekly Elevation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No elevation data yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((d) => ({
    week: formatWeekLabel(d.weekStart),
    elevation: Math.round(d.elevation),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Weekly Elevation</CardTitle>
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
              unit="m"
            />
            <Tooltip
              formatter={(value) => [`${value} m`, "Elevation"]}
              labelFormatter={(label) => `Week of ${label}`}
            />
            <Bar
              dataKey="elevation"
              fill="#16a34a"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function formatWeekLabel(weekStart: string): string {
  const date = new Date(weekStart + "T00:00:00");
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
