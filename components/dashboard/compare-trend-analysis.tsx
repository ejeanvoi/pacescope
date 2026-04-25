"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { formatPace } from "@/lib/calculations";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

const ROUTE_COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c",
  "#0891b2", "#be185d", "#854d0e", "#4f46e5", "#059669",
  "#e11d48", "#7c3aed", "#ca8a04", "#0d9488", "#c2410c",
  "#6366f1", "#15803d", "#b91c1c", "#7e22ce", "#0e7490",
];

interface TrendActivity {
  id: string;
  name: string;
  startDate: string;
  averagePace: number | null;
  averageHeartRate: number | null;
  points: Array<{
    heartRate: number | null;
  }>;
}

interface CompareTrendAnalysisProps {
  activities: TrendActivity[];
}

// Simple linear regression: returns { slope, intercept }
function linearRegression(
  points: Array<{ x: number; y: number }>
): { slope: number; intercept: number } | null {
  if (points.length < 2) return null;
  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function computeAvgHR(activity: TrendActivity): number | null {
  if (activity.averageHeartRate != null) return Math.round(activity.averageHeartRate);
  const hrPoints = activity.points.filter((p) => p.heartRate != null);
  if (hrPoints.length === 0) return null;
  return Math.round(
    hrPoints.reduce((s, p) => s + p.heartRate!, 0) / hrPoints.length
  );
}

export function CompareTrendAnalysis({
  activities,
}: CompareTrendAnalysisProps) {
  if (activities.length < 2) return null;

  // Sort by date
  const sorted = [...activities].sort(
    (a, b) =>
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  // ─── Pace trend data ────────────────────────────────────────
  const paceData = sorted
    .filter((a) => a.averagePace != null && a.averagePace > 0)
    .map((a, _i, arr) => {
      const date = new Date(a.startDate);
      return {
        name: a.name,
        date: date.getTime(),
        dateLabel: date.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "2-digit",
        }),
        pace: Math.round(a.averagePace!),
        color: ROUTE_COLORS[sorted.indexOf(a) % ROUTE_COLORS.length],
      };
    });

  // ─── Heart rate trend data ──────────────────────────────────
  const hrData = sorted
    .map((a) => {
      const avgHR = computeAvgHR(a);
      if (avgHR == null) return null;
      const date = new Date(a.startDate);
      return {
        name: a.name,
        date: date.getTime(),
        dateLabel: date.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "2-digit",
        }),
        hr: avgHR,
        color: ROUTE_COLORS[sorted.indexOf(a) % ROUTE_COLORS.length],
      };
    })
    .filter(Boolean) as Array<{
    name: string;
    date: number;
    dateLabel: string;
    hr: number;
    color: string;
  }>;

  // ─── Linear regressions ─────────────────────────────────────
  const paceRegression =
    paceData.length >= 2
      ? linearRegression(
          paceData.map((p) => ({ x: p.date, y: p.pace }))
        )
      : null;

  const hrRegression =
    hrData.length >= 2
      ? linearRegression(hrData.map((p) => ({ x: p.date, y: p.hr })))
      : null;

  // Compute trend line endpoints for pace
  const paceTrendLine =
    paceRegression && paceData.length >= 2
      ? [
          {
            date: paceData[0].date,
            dateLabel: paceData[0].dateLabel,
            trend:
              paceRegression.slope * paceData[0].date +
              paceRegression.intercept,
          },
          {
            date: paceData[paceData.length - 1].date,
            dateLabel: paceData[paceData.length - 1].dateLabel,
            trend:
              paceRegression.slope * paceData[paceData.length - 1].date +
              paceRegression.intercept,
          },
        ]
      : null;

  // Compute trend line endpoints for HR
  const hrTrendLine =
    hrRegression && hrData.length >= 2
      ? [
          {
            date: hrData[0].date,
            dateLabel: hrData[0].dateLabel,
            trend:
              hrRegression.slope * hrData[0].date + hrRegression.intercept,
          },
          {
            date: hrData[hrData.length - 1].date,
            dateLabel: hrData[hrData.length - 1].dateLabel,
            trend:
              hrRegression.slope * hrData[hrData.length - 1].date +
              hrRegression.intercept,
          },
        ]
      : null;

  // ─── Summaries ──────────────────────────────────────────────
  const paceChangePerActivity =
    paceRegression && paceData.length >= 2
      ? (() => {
          const firstVal =
            paceRegression.slope * paceData[0].date +
            paceRegression.intercept;
          const lastVal =
            paceRegression.slope * paceData[paceData.length - 1].date +
            paceRegression.intercept;
          return lastVal - firstVal;
        })()
      : null;

  const hrChangeTotal =
    hrRegression && hrData.length >= 2
      ? (() => {
          const firstVal =
            hrRegression.slope * hrData[0].date + hrRegression.intercept;
          const lastVal =
            hrRegression.slope * hrData[hrData.length - 1].date +
            hrRegression.intercept;
          return lastVal - firstVal;
        })()
      : null;

  // Build combined chart data (pace points + trend line) using index-based x-axis
  const paceChartData = paceData.map((p, i) => ({
    idx: i,
    dateLabel: p.dateLabel,
    pace: p.pace,
    color: p.color,
    name: p.name,
  }));

  // Interpolate trend values at each point
  if (paceRegression && paceData.length >= 2) {
    paceChartData.forEach((p, i) => {
      (p as Record<string, unknown>).trend = Math.round(
        paceRegression.slope * paceData[i].date + paceRegression.intercept
      );
    });
  }

  const hrChartData = hrData.map((p, i) => ({
    idx: i,
    dateLabel: p.dateLabel,
    hr: p.hr,
    color: p.color,
    name: p.name,
  }));

  if (hrRegression && hrData.length >= 2) {
    hrChartData.forEach((p, i) => {
      (p as Record<string, unknown>).trend = Math.round(
        hrRegression.slope * hrData[i].date + hrRegression.intercept
      );
    });
  }

  const hasPaceData = paceChartData.length >= 2;
  const hasHRData = hrChartData.length >= 2;

  if (!hasPaceData && !hasHRData) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Trend Analysis</CardTitle>
        <CardDescription>
          How your pace and heart rate evolve across the selected activities
          (sorted chronologically).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* ─── Pace trend ─── */}
        {hasPaceData && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium">Pace Trend</h3>
              {paceChangePerActivity != null && (
                <TrendBadge
                  value={paceChangePerActivity}
                  unit="sec/km"
                  inverted
                />
              )}
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={paceChartData}>
                <XAxis
                  dataKey="dateLabel"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  reversed
                  tickFormatter={(v: number) => formatPace(v)}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={55}
                />
                <Tooltip
                  labelFormatter={(_label, payload) => {
                    const p = payload?.[0]?.payload;
                    return p ? `${p.name} — ${p.dateLabel}` : String(_label);
                  }}
                  formatter={(value, name) => {
                    if (name === "trend")
                      return [`${formatPace(Number(value))} /km`, "Trend"];
                    return [`${formatPace(Number(value))} /km`, "Pace"];
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="pace"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={(props: Record<string, unknown>) => {
                    const { cx, cy, payload } = props as {
                      cx: number;
                      cy: number;
                      payload: { color: string };
                    };
                    return (
                      <circle
                        key={`pace-${cx}-${cy}`}
                        cx={cx}
                        cy={cy}
                        r={5}
                        fill={payload.color}
                        stroke="#fff"
                        strokeWidth={2}
                      />
                    );
                  }}
                />
                {paceRegression && (
                  <Line
                    type="monotone"
                    dataKey="trend"
                    stroke="#94a3b8"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                    connectNulls
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
            {paceChangePerActivity != null && (
              <p className="text-xs text-muted-foreground">
                {paceChangePerActivity < -2
                  ? `Pace improved by ~${formatPace(Math.abs(paceChangePerActivity))} /km over ${paceData.length} activities.`
                  : paceChangePerActivity > 2
                    ? `Pace slowed by ~${formatPace(Math.abs(paceChangePerActivity))} /km over ${paceData.length} activities.`
                    : `Pace is stable across ${paceData.length} activities.`}
              </p>
            )}
          </div>
        )}

        {/* ─── Heart rate trend ─── */}
        {hasHRData && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium">Heart Rate Trend</h3>
              {hrChangeTotal != null && (
                <TrendBadge value={hrChangeTotal} unit="bpm" inverted />
              )}
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={hrChartData}>
                <XAxis
                  dataKey="dateLabel"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={(v: number) => `${v}`}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={45}
                  unit=" bpm"
                />
                <Tooltip
                  labelFormatter={(_label, payload) => {
                    const p = payload?.[0]?.payload;
                    return p ? `${p.name} — ${p.dateLabel}` : String(_label);
                  }}
                  formatter={(value, name) => {
                    if (name === "trend")
                      return [`${Math.round(Number(value))} bpm`, "Trend"];
                    return [`${Math.round(Number(value))} bpm`, "Avg HR"];
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="hr"
                  stroke="#dc2626"
                  strokeWidth={2}
                  dot={(props: Record<string, unknown>) => {
                    const { cx, cy, payload } = props as {
                      cx: number;
                      cy: number;
                      payload: { color: string };
                    };
                    return (
                      <circle
                        key={`hr-${cx}-${cy}`}
                        cx={cx}
                        cy={cy}
                        r={5}
                        fill={payload.color}
                        stroke="#fff"
                        strokeWidth={2}
                      />
                    );
                  }}
                />
                {hrRegression && (
                  <Line
                    type="monotone"
                    dataKey="trend"
                    stroke="#94a3b8"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                    connectNulls
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
            {hrChangeTotal != null && (
              <p className="text-xs text-muted-foreground">
                {hrChangeTotal < -2
                  ? `Average heart rate decreased by ~${Math.round(Math.abs(hrChangeTotal))} bpm over ${hrData.length} activities — a sign of improving cardiovascular fitness.`
                  : hrChangeTotal > 2
                    ? `Average heart rate increased by ~${Math.round(Math.abs(hrChangeTotal))} bpm over ${hrData.length} activities — this may indicate increased effort or fatigue.`
                    : `Average heart rate is stable across ${hrData.length} activities.`}
              </p>
            )}
          </div>
        )}

        {/* Combined insight */}
        {hasPaceData && hasHRData && paceChangePerActivity != null && hrChangeTotal != null && (
          <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm">
            <p className="font-medium">Summary</p>
            <p className="mt-1 text-muted-foreground">
              {paceChangePerActivity < -2 && hrChangeTotal < -2
                ? "You are running faster with a lower heart rate — great progress! Your aerobic fitness is clearly improving."
                : paceChangePerActivity < -2 && hrChangeTotal > 2
                  ? "You are running faster but your heart rate is increasing. This could mean you're pushing harder — monitor your recovery."
                  : paceChangePerActivity > 2 && hrChangeTotal < -2
                    ? "Your pace has slowed while your heart rate has decreased. You may be running more conservatively or focusing on easy runs."
                    : paceChangePerActivity > 2 && hrChangeTotal > 2
                      ? "Both pace and heart rate are trending up. Consider adding more recovery runs to your training mix."
                      : paceChangePerActivity < -2
                        ? "Your pace is improving while heart rate stays stable — a positive sign of aerobic development."
                        : hrChangeTotal < -2
                          ? "Your heart rate is decreasing at a similar pace — a good indicator of cardiovascular adaptation."
                          : "Your pace and heart rate are relatively stable across these activities."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TrendBadge({
  value,
  unit,
  inverted,
}: {
  value: number;
  unit: string;
  inverted?: boolean;
}) {
  // For pace/HR, lower is better (inverted=true)
  const isPositive = inverted ? value < -2 : value > 2;
  const isNegative = inverted ? value > 2 : value < -2;
  const isNeutral = !isPositive && !isNegative;

  const absValue = Math.abs(Math.round(value));
  const label =
    unit === "sec/km"
      ? `${formatPace(absValue)} /km`
      : `${absValue} ${unit}`;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        isPositive
          ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
          : isNegative
            ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
      }`}
    >
      {isPositive ? (
        <TrendingUp className="h-3 w-3" />
      ) : isNegative ? (
        <TrendingDown className="h-3 w-3" />
      ) : (
        <Minus className="h-3 w-3" />
      )}
      {isNeutral ? "Stable" : `${value < 0 ? "-" : "+"}${label}`}
    </span>
  );
}
