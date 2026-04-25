"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPace, formatDuration, formatDistance } from "@/lib/calculations";

interface MonthlySummaryRow {
  month: string;
  distance: number;
  duration: number;
  count: number;
  averagePace: number | null;
  elevation: number;
}

interface MonthlySummaryProps {
  data: MonthlySummaryRow[];
}

export function MonthlySummary({ data }: MonthlySummaryProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No activity data yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Show most recent months first
  const sorted = [...data].reverse();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Monthly Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="px-2 py-2 text-left font-medium">Month</th>
                <th className="px-2 py-2 text-right font-medium">Runs</th>
                <th className="px-2 py-2 text-right font-medium">Distance</th>
                <th className="px-2 py-2 text-right font-medium">Time</th>
                <th className="px-2 py-2 text-right font-medium">Avg Pace</th>
                <th className="px-2 py-2 text-right font-medium">Elevation</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.month} className="border-b last:border-0">
                  <td className="px-2 py-2 font-medium">
                    {formatMonthLabel(row.month)}
                  </td>
                  <td className="px-2 py-2 text-right">{row.count}</td>
                  <td className="px-2 py-2 text-right">
                    {formatDistance(row.distance)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {formatDuration(row.duration)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono">
                    {row.averagePace ? formatPace(row.averagePace) : "--:--"}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {Math.round(row.elevation)}m
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function formatMonthLabel(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1);
  return date.toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}
