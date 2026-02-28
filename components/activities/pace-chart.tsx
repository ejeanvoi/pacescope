"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPace } from "@/lib/calculations";

interface Split {
  km: number;
  pace: number;
  elevationChange: number;
  averageHeartRate: number | null;
}

interface PaceChartProps {
  splits: Split[];
  averagePace: number | null;
}

export function PaceChart({ splits, averagePace }: PaceChartProps) {
  if (splits.length === 0) return null;

  const validSplits = splits.filter((s) => s.pace > 0);
  if (validSplits.length === 0) return null;

  const avgPace =
    averagePace || validSplits.reduce((s, sp) => s + sp.pace, 0) / validSplits.length;

  const chartData = validSplits.map((s) => ({
    km: `${s.km}`,
    pace: Math.round(s.pace),
    elevationChange: Math.round(s.elevationChange),
    averageHeartRate: s.averageHeartRate,
    label: formatPace(s.pace),
  }));

  const minPace = Math.min(...chartData.map((d) => d.pace));
  const maxPace = Math.max(...chartData.map((d) => d.pace));
  const padding = Math.max((maxPace - minPace) * 0.15, 15);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pace Splits</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData}>
            <XAxis
              dataKey="km"
              tickFormatter={(v: string) => `${v} km`}
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
              labelFormatter={(label) => `Km ${label}`}
            />
            {avgPace > 0 && (
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
            )}
            <Bar dataKey="pace" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={entry.pace <= avgPace ? "#22c55e" : "#f97316"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Splits table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="px-2 py-1 text-left font-medium">Km</th>
                <th className="px-2 py-1 text-right font-medium">Pace</th>
                <th className="px-2 py-1 text-right font-medium">Elev</th>
                {validSplits.some((s) => s.averageHeartRate) && (
                  <th className="px-2 py-1 text-right font-medium">HR</th>
                )}
              </tr>
            </thead>
            <tbody>
              {validSplits.map((split) => (
                <tr key={split.km} className="border-b last:border-0">
                  <td className="px-2 py-1">{split.km}</td>
                  <td className="px-2 py-1 text-right font-mono">
                    {formatPace(split.pace)}
                  </td>
                  <td className="px-2 py-1 text-right">
                    {split.elevationChange > 0 ? "+" : ""}
                    {Math.round(split.elevationChange)}m
                  </td>
                  {validSplits.some((s) => s.averageHeartRate) && (
                    <td className="px-2 py-1 text-right">
                      {split.averageHeartRate ?? "--"}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
