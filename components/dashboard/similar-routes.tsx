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
import { MAX_COMPARE_ACTIVITIES } from "@/lib/constants";
import { Search, Route, Check } from "lucide-react";
import { cn } from "@/lib/utils";

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
  onAddMultipleToCompare: (activityIds: string[]) => void;
  selectedIds: string[];
}

export function SimilarRoutes({
  sourceActivityId,
  onAddMultipleToCompare,
  selectedIds,
}: SimilarRoutesProps) {
  const [threshold, setThreshold] = useState(80);
  const [results, setResults] = useState<SimilarActivity[]>([]);
  const [localSelected, setLocalSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    setLoading(true);
    setError(null);
    setLocalSelected(new Set());
    try {
      const res = await fetch(
        `/api/activities/${sourceActivityId}/similar?threshold=${threshold}&limit=50`
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

  const toggleLocal = (id: string) => {
    setLocalSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // IDs checked locally that haven't been added to compare yet
  const addableSelected = [...localSelected].filter(
    (id) => !selectedIds.includes(id)
  );
  const wouldExceedMax = selectedIds.length + addableSelected.length > MAX_COMPARE_ACTIVITIES;

  const handleAddSelected = () => {
    onAddMultipleToCompare(addableSelected);
    setLocalSelected(new Set());
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
          <>
            <p className="text-xs text-muted-foreground">
              Click rows to select multiple, then add them all at once.
            </p>
            <div className="max-h-96 space-y-1 overflow-y-auto">
              {results.map((r) => {
                const alreadyAdded = selectedIds.includes(r.id);
                const isLocalSelected = localSelected.has(r.id);
                return (
                  <button
                    key={r.id}
                    disabled={alreadyAdded}
                    onClick={() => toggleLocal(r.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                      alreadyAdded
                        ? "cursor-default opacity-40"
                        : isLocalSelected
                          ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                          : "hover:bg-muted/50"
                    )}
                  >
                    {/* Checkbox indicator */}
                    <div
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                        isLocalSelected && !alreadyAdded
                          ? "border-primary bg-primary"
                          : "border-muted-foreground/40"
                      )}
                    >
                      {isLocalSelected && !alreadyAdded && (
                        <Check className="h-3 w-3 text-primary-foreground" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{r.name}</span>
                        <span className="inline-flex shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
                          {r.similarity}%
                        </span>
                        {alreadyAdded && (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            added
                          </span>
                        )}
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
                  </button>
                );
              })}
            </div>

            <Button
              size="sm"
              disabled={addableSelected.length === 0 || wouldExceedMax}
              onClick={handleAddSelected}
            >
              {wouldExceedMax
                ? "Too many selected (max 20 total)"
                : addableSelected.length === 0
                  ? "Select routes above"
                  : `Add ${addableSelected.length} selected to compare`}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
