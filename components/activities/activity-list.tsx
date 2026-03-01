"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  MapPin,
  Clock,
  TrendingUp,
  Mountain,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from "lucide-react";
import {
  formatPace,
  formatDuration,
  formatDistance,
} from "@/lib/calculations";

interface ActivitySummary {
  id: string;
  type: string;
  source: string;
  name: string;
  startDate: string;
  duration: number;
  distance: number;
  elevationGain: number | null;
  averagePace: number | null;
  bestPace: number | null;
  averageHeartRate: number | null;
  location: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ActivityListProps {
  initialActivities: ActivitySummary[];
  initialPagination: Pagination;
  initialCountries: string[];
}

const TYPE_LABELS: Record<string, string> = {
  RUN: "Run",
  TRAIL_RUN: "Trail Run",
  TREADMILL: "Treadmill",
};

const TYPE_FILTERS = [
  { value: "", label: "All" },
  { value: "RUN", label: "Run" },
  { value: "TRAIL_RUN", label: "Trail Run" },
  { value: "TREADMILL", label: "Treadmill" },
];

const SORT_OPTIONS = [
  { value: "startDate", label: "Date" },
  { value: "distance", label: "Distance" },
  { value: "averagePace", label: "Pace" },
  { value: "duration", label: "Duration" },
];

export function ActivityList({
  initialActivities,
  initialPagination,
  initialCountries,
}: ActivityListProps) {
  const router = useRouter();
  const [activities, setActivities] =
    useState<ActivitySummary[]>(initialActivities);
  const [pagination, setPagination] = useState<Pagination>(initialPagination);
  const [typeFilter, setTypeFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [countries, setCountries] = useState<string[]>(initialCountries);
  const [sortBy, setSortBy] = useState("startDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchActivities = async (
    page: number,
    type: string,
    sort: string,
    order: string,
    country: string = countryFilter,
    from: string = dateFrom,
    to: string = dateTo
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pagination.limit),
        sortBy: sort,
        sortOrder: order,
      });
      if (type) params.set("type", type);
      if (country) params.set("country", country);
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const res = await fetch(`/api/activities?${params}`);
      const data = await res.json();
      if (res.ok) {
        setActivities(data.activities);
        setPagination(data.pagination);
        if (data.countries) setCountries(data.countries);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTypeFilter = (type: string) => {
    setTypeFilter(type);
    fetchActivities(1, type, sortBy, sortOrder);
  };

  const handleCountryFilter = (country: string) => {
    setCountryFilter(country);
    fetchActivities(1, typeFilter, sortBy, sortOrder, country);
  };

  const handleDateFromChange = (from: string) => {
    setDateFrom(from);
    fetchActivities(1, typeFilter, sortBy, sortOrder, countryFilter, from, dateTo);
  };

  const handleDateToChange = (to: string) => {
    setDateTo(to);
    fetchActivities(1, typeFilter, sortBy, sortOrder, countryFilter, dateFrom, to);
  };

  const handleSort = (sort: string) => {
    const newOrder =
      sort === sortBy ? (sortOrder === "desc" ? "asc" : "desc") : "desc";
    setSortBy(sort);
    setSortOrder(newOrder);
    fetchActivities(pagination.page, typeFilter, sort, newOrder);
  };

  const handlePage = (page: number) => {
    fetchActivities(page, typeFilter, sortBy, sortOrder);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this activity?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/activities/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchActivities(pagination.page, typeFilter, sortBy, sortOrder);
      }
    } finally {
      setDeletingId(null);
    }
  };

  if (activities.length === 0 && !loading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <MapPin className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">No activities found</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            {typeFilter || countryFilter || dateFrom || dateTo
              ? "No activities match your filters."
              : "Get started by uploading a GPX file."}
          </p>
          {!typeFilter && !countryFilter && !dateFrom && !dateTo && (
            <Link href="/activities/upload">
              <Button>Upload GPX</Button>
            </Link>
          )}
          {(typeFilter || countryFilter || dateFrom || dateTo) && (
            <Button
              variant="outline"
              onClick={() => {
                setTypeFilter("");
                setCountryFilter("");
                setDateFrom("");
                setDateTo("");
                fetchActivities(1, "", sortBy, sortOrder, "", "", "");
              }}
            >
              Clear Filters
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters and sort */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {TYPE_FILTERS.map((f) => (
            <Button
              key={f.value}
              variant={typeFilter === f.value ? "default" : "outline"}
              size="sm"
              onClick={() => handleTypeFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => handleDateFromChange(e.target.value)}
            className={cn(
              "h-8 w-[130px] text-xs",
              dateFrom && "ring-1 ring-primary/30"
            )}
          />
          <span>to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => handleDateToChange(e.target.value)}
            className={cn(
              "h-8 w-[130px] text-xs",
              dateTo && "ring-1 ring-primary/30"
            )}
          />
        </div>
        {countries.length > 0 && (
          <select
            value={countryFilter}
            onChange={(e) => handleCountryFilter(e.target.value)}
            className={cn(
              "h-9 rounded-md border bg-background px-3 text-sm transition-colors",
              countryFilter
                ? "border-primary text-foreground"
                : "text-muted-foreground"
            )}
          >
            <option value="">All Countries</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
        <div className="ml-auto flex gap-1">
          {SORT_OPTIONS.map((s) => (
            <Button
              key={s.value}
              variant="ghost"
              size="sm"
              onClick={() => handleSort(s.value)}
              className={cn(
                sortBy === s.value && "bg-muted font-semibold"
              )}
            >
              {s.label}
              {sortBy === s.value && (
                <ArrowUpDown className="ml-1 h-3 w-3" />
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Activity cards */}
      <div className={cn("space-y-3", loading && "opacity-50")}>
        {activities.map((activity) => (
          <Card
            key={activity.id}
            className="cursor-pointer transition-colors hover:bg-muted/50"
            onClick={() => router.push(`/activities/${activity.id}`)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">
                    {activity.name}
                    {activity.location && (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        — {activity.location}
                      </span>
                    )}
                  </CardTitle>
                  <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {TYPE_LABELS[activity.type] || activity.type}
                    </span>
                    <span>
                      {new Date(activity.startDate).toLocaleDateString(
                        undefined,
                        {
                          weekday: "short",
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        }
                      )}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(activity.id);
                  }}
                  disabled={deletingId === activity.id}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      {formatDistance(activity.distance)}
                    </p>
                    <p className="text-xs text-muted-foreground">Distance</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      {formatDuration(activity.duration)}
                    </p>
                    <p className="text-xs text-muted-foreground">Duration</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      {activity.averagePace
                        ? `${formatPace(activity.averagePace)} /km`
                        : "--:--"}
                    </p>
                    <p className="text-xs text-muted-foreground">Avg Pace</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Mountain className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      {activity.elevationGain != null
                        ? `${Math.round(activity.elevationGain)}m`
                        : "--"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Elevation
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total}{" "}
            activities)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePage(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePage(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
