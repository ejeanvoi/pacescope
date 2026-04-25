"use client";

import { cn } from "@/lib/utils";

const TIME_RANGES = [
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "90d", label: "90 Days" },
  { value: "ytd", label: "YTD" },
  { value: "365d", label: "1 Year" },
  { value: "all", label: "All Time" },
] as const;

const ACTIVITY_TYPES = [
  { value: "", label: "All Types" },
  { value: "RUN", label: "Run" },
  { value: "TRAIL_RUN", label: "Trail Run" },
  { value: "TREADMILL", label: "Treadmill" },
] as const;

interface DashboardFiltersProps {
  range: string;
  type: string;
  onRangeChange: (range: string) => void;
  onTypeChange: (type: string) => void;
}

export function DashboardFilters({
  range,
  type,
  onRangeChange,
  onTypeChange,
}: DashboardFiltersProps) {
  return (
    <div className="flex flex-wrap gap-4">
      <div className="flex flex-wrap gap-1">
        {TIME_RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => onRangeChange(r.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              range === r.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {ACTIVITY_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => onTypeChange(t.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              type === t.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
