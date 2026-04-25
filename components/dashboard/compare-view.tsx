"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDistance, formatPace } from "@/lib/calculations";
import { ArrowLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CompareMapWrapper } from "./compare-map-wrapper";
import { CompareElevationChart } from "./compare-elevation-chart";
import { ComparePaceChart } from "./compare-pace-chart";
import { ComparePaceAlongTrackChart } from "./compare-pace-along-track-chart";
import { CompareHeartRateChart } from "./compare-heart-rate-chart";
import { SimilarRoutes } from "./similar-routes";
import { CompareTrendAnalysis } from "./compare-trend-analysis";

const ROUTE_COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c",
  "#0891b2", "#be185d", "#854d0e", "#4f46e5", "#059669",
  "#e11d48", "#7c3aed", "#ca8a04", "#0d9488", "#c2410c",
  "#6366f1", "#15803d", "#b91c1c", "#7e22ce", "#0e7490",
];

const ACTIVITY_TYPES = [
  { value: "ALL", label: "All" },
  { value: "RUN", label: "Run" },
  { value: "TRAIL_RUN", label: "Trail" },
  { value: "TREADMILL", label: "Treadmill" },
];

interface ActivitySummary {
  id: string;
  name: string;
  type: string;
  startDate: string;
  distance: number;
  duration: number;
  averagePace: number | null;
  elevationGain: number | null;
  location: string | null;
}

interface CompareActivity {
  id: string;
  name: string;
  startDate: string;
  distance: number;
  duration: number;
  averagePace: number | null;
  elevationGain: number | null;
  averageHeartRate: number | null;
  points: Array<{
    latitude: number;
    longitude: number;
    elevation: number | null;
    timestamp: string | null;
    cumulativeDistance: number | null;
    heartRate: number | null;
  }>;
}

export function CompareView() {
  const [allActivities, setAllActivities] = useState<ActivitySummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compareData, setCompareData] = useState<CompareActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(true);

  // Filter state
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [distMinKm, setDistMinKm] = useState("");
  const [distMaxKm, setDistMaxKm] = useState("");
  const [elevMinM, setElevMinM] = useState("");
  const [elevMaxM, setElevMaxM] = useState("");

  const hasFilters =
    typeFilter !== "ALL" ||
    distMinKm !== "" ||
    distMaxKm !== "" ||
    elevMinM !== "" ||
    elevMaxM !== "";

  const clearFilters = () => {
    setTypeFilter("ALL");
    setDistMinKm("");
    setDistMaxKm("");
    setElevMinM("");
    setElevMaxM("");
  };

  // Derived filtered list
  const filteredActivities = allActivities.filter((a) => {
    if (typeFilter !== "ALL" && a.type !== typeFilter) return false;
    const distKm = a.distance / 1000;
    if (distMinKm !== "" && distKm < parseFloat(distMinKm)) return false;
    if (distMaxKm !== "" && distKm > parseFloat(distMaxKm)) return false;
    if (elevMinM !== "" && (a.elevationGain ?? 0) < parseFloat(elevMinM))
      return false;
    if (elevMaxM !== "" && (a.elevationGain ?? 0) > parseFloat(elevMaxM))
      return false;
    return true;
  });

  // Fetch all activities for selection (paginate through all pages)
  useEffect(() => {
    async function load() {
      try {
        const all: ActivitySummary[] = [];
        let page = 1;
        let totalPages = 1;
        do {
          const res = await fetch(
            `/api/activities?limit=100&page=${page}&sortBy=startDate&sortOrder=desc`
          );
          if (!res.ok) break;
          const data = await res.json();
          all.push(...data.activities);
          totalPages = data.pagination.totalPages;
          page++;
        } while (page <= totalPages);
        setAllActivities(all);
      } finally {
        setLoadingList(false);
      }
    }
    load();
  }, []);

  const fetchComparison = useCallback(async () => {
    if (selectedIds.length < 2) {
      setCompareData([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/activities/compare?ids=${selectedIds.join(",")}`
      );
      if (res.ok) {
        const data = await res.json();
        setCompareData(data.activities);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedIds]);

  useEffect(() => {
    fetchComparison();
  }, [fetchComparison]);

  const toggleActivity = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < 20
          ? [...prev, id]
          : prev
    );
  };

  const addMultipleToCompare = (ids: string[]) => {
    setSelectedIds((prev) => {
      const toAdd = ids.filter((id) => !prev.includes(id));
      return [...prev, ...toAdd].slice(0, 20);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" /> Dashboard
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Compare Activities
          </h1>
          <p className="text-muted-foreground">
            Select 2-20 activities to compare
          </p>
        </div>
      </div>

      {/* Activity selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select Activities</CardTitle>
          <CardDescription>
            {selectedIds.length} of 20 selected
            {hasFilters &&
              ` · showing ${filteredActivities.length} of ${allActivities.length}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Filters */}
          <div className="space-y-2">
            {/* Type filter */}
            <div className="flex flex-wrap gap-1">
              {ACTIVITY_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTypeFilter(t.value)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                    typeFilter === t.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/30 hover:bg-muted/50"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Distance + elevation range */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="shrink-0">Distance (km):</span>
              <Input
                type="number"
                min={0}
                placeholder="min"
                value={distMinKm}
                onChange={(e) => setDistMinKm(e.target.value)}
                className="h-7 w-20 text-xs"
              />
              <span>–</span>
              <Input
                type="number"
                min={0}
                placeholder="max"
                value={distMaxKm}
                onChange={(e) => setDistMaxKm(e.target.value)}
                className="h-7 w-20 text-xs"
              />
              <span className="ml-2 shrink-0">Elevation (m):</span>
              <Input
                type="number"
                min={0}
                placeholder="min"
                value={elevMinM}
                onChange={(e) => setElevMinM(e.target.value)}
                className="h-7 w-20 text-xs"
              />
              <span>–</span>
              <Input
                type="number"
                min={0}
                placeholder="max"
                value={elevMaxM}
                onChange={(e) => setElevMaxM(e.target.value)}
                className="h-7 w-20 text-xs"
              />
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="ml-1 text-xs text-muted-foreground underline hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Activity list */}
          {loadingList ? (
            <p className="text-sm text-muted-foreground">
              Loading activities...
            </p>
          ) : allActivities.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No activities found. Upload a GPX file or sync from Strava.
            </p>
          ) : filteredActivities.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No activities match the current filters.
            </p>
          ) : (
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {filteredActivities.map((a) => {
                const isSelected = selectedIds.includes(a.id);
                const colorIdx = selectedIds.indexOf(a.id);
                return (
                  <button
                    key={a.id}
                    onClick={() => toggleActivity(a.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors",
                      isSelected
                        ? "bg-primary/10 ring-1 ring-primary/30"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {isSelected && (
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{
                            backgroundColor:
                              ROUTE_COLORS[colorIdx % ROUTE_COLORS.length],
                          }}
                        />
                      )}
                      <span
                        className={cn(
                          "truncate",
                          isSelected && "font-medium"
                        )}
                      >
                        {a.name}
                        {a.location && (
                          <span className="ml-1 font-normal text-muted-foreground">
                            — {a.location}
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(a.startDate).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                      {a.elevationGain != null && a.elevationGain > 0 && (
                        <span>↑{Math.round(a.elevationGain)}m</span>
                      )}
                      <span>{formatDistance(a.distance)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {selectedIds.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {selectedIds.map((id, idx) => {
                const activity = allActivities.find((a) => a.id === id);
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                    style={{
                      backgroundColor: `${ROUTE_COLORS[idx % ROUTE_COLORS.length]}20`,
                      color: ROUTE_COLORS[idx % ROUTE_COLORS.length],
                    }}
                  >
                    {activity?.name || id}
                    <button
                      onClick={() => toggleActivity(id)}
                      className="ml-0.5 hover:opacity-70"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Similar routes finder — shown when exactly 1 activity selected */}
      {selectedIds.length === 1 && (
        <SimilarRoutes
          sourceActivityId={selectedIds[0]}
          onAddMultipleToCompare={addMultipleToCompare}
          selectedIds={selectedIds}
        />
      )}

      {/* Comparison results */}
      {selectedIds.length < 2 && selectedIds.length !== 1 && (
        <p className="text-center text-sm text-muted-foreground">
          Select at least 2 activities to compare.
        </p>
      )}

      {loading && (
        <p className="text-center text-sm text-muted-foreground">
          Loading comparison...
        </p>
      )}

      {!loading && compareData.length >= 2 && (
        <div className="space-y-6">
          {/* Summary table + average pace bars */}
          <ComparePaceChart activities={compareData} />

          {/* Pace along track */}
          <ComparePaceAlongTrackChart
            activities={compareData.map((a) => ({
              name: a.name,
              points: a.points,
            }))}
          />

          {/* Map overlay */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Route Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <CompareMapWrapper
                activities={compareData.map((a) => ({
                  name: a.name,
                  points: a.points,
                }))}
              />
            </CardContent>
          </Card>

          {/* Elevation overlay */}
          <CompareElevationChart
            activities={compareData.map((a) => ({
              name: a.name,
              points: a.points,
            }))}
          />

          {/* Heart rate overlay */}
          <CompareHeartRateChart
            activities={compareData.map((a) => ({
              name: a.name,
              points: a.points,
            }))}
          />

          {/* Trend analysis */}
          <CompareTrendAnalysis activities={compareData} />
        </div>
      )}
    </div>
  );
}
