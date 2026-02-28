"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface LeaderboardEntry {
  userId: string;
  name: string;
  totalDistance: number;
  isCurrentUser: boolean;
}

interface LeaderboardDistanceChartProps {
  leaderboard: LeaderboardEntry[];
  period: string;
}

export function LeaderboardDistanceChart({
  leaderboard,
  period,
}: LeaderboardDistanceChartProps) {
  if (leaderboard.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Distance by Runner</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No leaderboard data yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  const chartData = leaderboard
    .slice(0, 10) // Top 10
    .map((entry) => ({
      name: entry.name,
      distance: Number((entry.totalDistance / 1000).toFixed(2)),
      isCurrentUser: entry.isCurrentUser,
    }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Distance by Runner</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(250, chartData.length * 40)}>
          <BarChart data={chartData} layout="vertical">
            <XAxis
              type="number"
              tickFormatter={(v: number) => `${v} km`}
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={100}
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              formatter={(value) => [`${value} km`, "Distance"]}
            />
            <Bar dataKey="distance" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={entry.isCurrentUser ? "#2563eb" : "#94a3b8"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
