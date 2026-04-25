"use client";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

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
  customFrom: string;
  customTo: string;
  onRangeChange: (range: string) => void;
  onTypeChange: (type: string) => void;
  onCustomFromChange: (from: string) => void;
  onCustomToChange: (to: string) => void;
}

export function DashboardFilters({
  range,
  type,
  customFrom,
  customTo,
  onRangeChange,
  onTypeChange,
  onCustomFromChange,
  onCustomToChange,
}: DashboardFiltersProps) {
  const isCustom = range === "custom";

  const handlePresetClick = (value: string) => {
    onRangeChange(value);
    if (value !== "custom") {
      onCustomFromChange("");
      onCustomToChange("");
    }
  };

  const handleFromChange = (value: string) => {
    onCustomFromChange(value);
    if (value || customTo) {
      onRangeChange("custom");
    }
  };

  const handleToChange = (value: string) => {
    onCustomToChange(value);
    if (customFrom || value) {
      onRangeChange("custom");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex flex-wrap gap-1">
        {TIME_RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => handlePresetClick(r.value)}
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
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Input
          type="date"
          value={customFrom}
          onChange={(e) => handleFromChange(e.target.value)}
          className={cn(
            "h-8 w-[130px] text-xs",
            isCustom && "ring-1 ring-primary/30"
          )}
        />
        <span>to</span>
        <Input
          type="date"
          value={customTo}
          onChange={(e) => handleToChange(e.target.value)}
          className={cn(
            "h-8 w-[130px] text-xs",
            isCustom && "ring-1 ring-primary/30"
          )}
        />
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
