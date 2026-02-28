"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPace, formatDistance, formatDuration } from "@/lib/calculations";

const ROUTE_COLORS = ["#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c"];

interface ComparePaceChartProps {
  activities: Array<{
    name: string;
    distance: number;
    duration: number;
    averagePace: number | null;
    elevationGain: number | null;
  }>;
}

export function ComparePaceChart({ activities }: ComparePaceChartProps) {
  if (activities.length === 0) return null;

  const chartData = [
    {
      metric: "Pace",
      ...Object.fromEntries(
        activities.map((a, i) => [`a_${i}`, a.averagePace ?? 0])
      ),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Activity Comparison</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Activity</th>
                <th className="px-3 py-2 text-right font-medium">Distance</th>
                <th className="px-3 py-2 text-right font-medium">Duration</th>
                <th className="px-3 py-2 text-right font-medium">Avg Pace</th>
                <th className="px-3 py-2 text-right font-medium">Elevation</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((a, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{
                          backgroundColor:
                            ROUTE_COLORS[i % ROUTE_COLORS.length],
                        }}
                      />
                      <span className="truncate font-medium">{a.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatDistance(a.distance)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatDuration(a.duration)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {a.averagePace ? formatPace(a.averagePace) : "--:--"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {a.elevationGain != null
                      ? `${Math.round(a.elevationGain)}m`
                      : "--"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bar chart comparing paces */}
        {activities.some((a) => a.averagePace && a.averagePace > 0) && (
          <div className="mt-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <XAxis dataKey="metric" hide />
                <YAxis
                  reversed
                  tickFormatter={(v: number) => formatPace(v)}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  width={55}
                />
                <Tooltip
                  formatter={(value, name) => {
                    const idx = parseInt(String(name).replace("a_", ""));
                    return [
                      `${formatPace(Number(value))} /km`,
                      activities[idx]?.name || String(name),
                    ];
                  }}
                />
                <Legend
                  formatter={(value: string) => {
                    const idx = parseInt(value.replace("a_", ""));
                    return activities[idx]?.name || value;
                  }}
                />
                {activities.map((_, i) => (
                  <Bar
                    key={i}
                    dataKey={`a_${i}`}
                    fill={ROUTE_COLORS[i % ROUTE_COLORS.length]}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
