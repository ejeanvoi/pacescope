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
import { formatDistance, formatDuration, formatPace } from "@/lib/calculations";
import { ArrowLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CompareMapWrapper } from "./compare-map-wrapper";
import { CompareElevationChart } from "./compare-elevation-chart";
import { ComparePaceChart } from "./compare-pace-chart";

const ROUTE_COLORS = ["#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c"];

interface ActivitySummary {
  id: string;
  name: string;
  type: string;
  startDate: string;
  distance: number;
  duration: number;
  averagePace: number | null;
}

interface CompareActivity {
  id: string;
  name: string;
  distance: number;
  duration: number;
  averagePace: number | null;
  elevationGain: number | null;
  points: Array<{
    latitude: number;
    longitude: number;
    elevation: number | null;
    cumulativeDistance: number | null;
  }>;
}

export function CompareView() {
  const [allActivities, setAllActivities] = useState<ActivitySummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compareData, setCompareData] = useState<CompareActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(true);

  // Fetch all activities for selection
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/activities?limit=100&sortBy=startDate&sortOrder=desc");
        if (res.ok) {
          const data = await res.json();
          setAllActivities(data.activities);
        }
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
        : prev.length < 5
          ? [...prev, id]
          : prev
    );
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
            Select 2-5 activities to compare
          </p>
        </div>
      </div>

      {/* Activity selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select Activities</CardTitle>
          <CardDescription>
            {selectedIds.length} of 5 selected
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingList ? (
            <p className="text-sm text-muted-foreground">Loading activities...</p>
          ) : allActivities.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No activities found. Upload a GPX file or sync from Strava.
            </p>
          ) : (
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {allActivities.map((a) => {
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
                      <span className={cn("truncate", isSelected && "font-medium")}>
                        {a.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(a.startDate).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistance(a.distance)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {selectedIds.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
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

      {/* Comparison results */}
      {selectedIds.length < 2 && (
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
          {/* Comparison table */}
          <ComparePaceChart activities={compareData} />

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
        </div>
      )}
    </div>
  );
}
