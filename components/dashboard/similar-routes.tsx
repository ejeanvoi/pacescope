"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { formatDistance, formatPace } from "@/lib/calculations";
import { Search, Plus, Route } from "lucide-react";

interface SimilarActivity {
  id: string;
  name: string;
  distance: number;
  duration: number;
  averagePace: number | null;
  startDate: string;
  type: string;
  similarity: number;
}

interface SimilarRoutesProps {
  sourceActivityId: string;
  onAddToCompare: (activityId: string) => void;
  selectedIds: string[];
}

export function SimilarRoutes({
  sourceActivityId,
  onAddToCompare,
  selectedIds,
}: SimilarRoutesProps) {
  const [threshold, setThreshold] = useState(80);
  const [results, setResults] = useState<SimilarActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/activities/${sourceActivityId}/similar?threshold=${threshold}`
      );
      if (res.ok) {
        const data = await res.json();
        setResults(data.similar);
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Failed to search for similar routes");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Route className="h-4 w-4" />
          Find Similar Routes
        </CardTitle>
        <CardDescription>
          Find activities with a similar GPS route to compare performances on
          the same course.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Similarity threshold: {threshold}%
          </label>
          <Slider
            value={[threshold]}
            onValueChange={([v]) => setThreshold(v)}
            min={50}
            max={100}
            step={5}
          />
          <p className="text-xs text-muted-foreground">
            Higher = stricter match. Lower = more results.
          </p>
        </div>

        <Button onClick={search} disabled={loading} size="sm">
          <Search className="mr-1 h-4 w-4" />
          {loading ? "Searching..." : "Find Similar"}
        </Button>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {searched && !error && results.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground">
            No similar routes found. Try lowering the threshold.
          </p>
        )}

        {results.length > 0 && (
          <div className="max-h-60 space-y-1 overflow-y-auto">
            {results.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{r.name}</span>
                    <span className="inline-flex shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
                      {r.similarity}%
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {formatDistance(r.distance)}
                    {r.averagePace
                      ? ` · ${formatPace(r.averagePace)} /km`
                      : ""}
                    {" · "}
                    {new Date(r.startDate).toLocaleDateString()}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-2 shrink-0"
                  disabled={
                    selectedIds.includes(r.id) || selectedIds.length >= 5
                  }
                  onClick={() => onAddToCompare(r.id)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
