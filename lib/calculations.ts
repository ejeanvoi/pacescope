// ─── Types ──────────────────────────────────────────────────────────

export interface TrackPoint {
  latitude: number;
  longitude: number;
  elevation: number | null;
  timestamp: Date | null;
  heartRate: number | null;
}

export interface Split {
  km: number;
  pace: number; // seconds per km
  elevationChange: number; // meters
  averageHeartRate: number | null;
}

// ─── Haversine Distance ─────────────────────────────────────────────

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

// ─── Cumulative Distances ───────────────────────────────────────────

export function computeCumulativeDistances(points: TrackPoint[]): number[] {
  const distances = [0];
  for (let i = 1; i < points.length; i++) {
    const d = haversineDistance(
      points[i - 1].latitude,
      points[i - 1].longitude,
      points[i].latitude,
      points[i].longitude
    );
    distances.push(distances[i - 1] + d);
  }
  return distances;
}

// ─── Total Distance ─────────────────────────────────────────────────

export function calculateTotalDistance(points: TrackPoint[]): number {
  if (points.length < 2) return 0;
  const cumulative = computeCumulativeDistances(points);
  return cumulative[cumulative.length - 1];
}

// ─── Elevation Gain / Loss ──────────────────────────────────────────

const ELEVATION_NOISE_THRESHOLD = 2; // meters

export function calculateElevation(points: TrackPoint[]): {
  gain: number;
  loss: number;
} {
  let gain = 0;
  let loss = 0;
  let lastElevation: number | null = null;

  for (const point of points) {
    if (point.elevation == null) continue;
    if (lastElevation != null) {
      const diff = point.elevation - lastElevation;
      if (Math.abs(diff) >= ELEVATION_NOISE_THRESHOLD) {
        if (diff > 0) gain += diff;
        else loss += Math.abs(diff);
        lastElevation = point.elevation;
      }
    } else {
      lastElevation = point.elevation;
    }
  }
  return { gain, loss };
}

// ─── Duration ───────────────────────────────────────────────────────

export function calculateDuration(points: TrackPoint[]): number | null {
  const first = points.find((p) => p.timestamp != null);
  const last = points.findLast((p) => p.timestamp != null);
  if (!first?.timestamp || !last?.timestamp) return null;
  return (last.timestamp.getTime() - first.timestamp.getTime()) / 1000;
}

// ─── Pace ───────────────────────────────────────────────────────────

export function calculateAveragePace(
  distanceMeters: number,
  durationSeconds: number
): number | null {
  if (distanceMeters <= 0 || durationSeconds <= 0) return null;
  return (durationSeconds / distanceMeters) * 1000; // sec per km
}

// ─── Heart Rate Stats ───────────────────────────────────────────────

export function calculateHeartRateStats(points: TrackPoint[]): {
  averageHeartRate: number | null;
  maxHeartRate: number | null;
} {
  const hrPoints = points.filter((p) => p.heartRate != null);
  if (hrPoints.length === 0) return { averageHeartRate: null, maxHeartRate: null };

  const sum = hrPoints.reduce((s, p) => s + p.heartRate!, 0);
  const max = hrPoints.reduce((m, p) => Math.max(m, p.heartRate!), -Infinity);
  return {
    averageHeartRate: Math.round(sum / hrPoints.length),
    maxHeartRate: max,
  };
}

// ─── Per-KM Splits ──────────────────────────────────────────────────

export function calculateSplits(
  points: TrackPoint[],
  cumulativeDistances: number[]
): Split[] {
  if (points.length < 2) return [];

  const totalDistance = cumulativeDistances[cumulativeDistances.length - 1];
  const fullKms = Math.floor(totalDistance / 1000);
  const splits: Split[] = [];

  for (let km = 0; km < fullKms; km++) {
    const startDist = km * 1000;
    const endDist = (km + 1) * 1000;

    // Find indices bracketing this km
    let startIdx = 0;
    let endIdx = 0;
    for (let i = 0; i < cumulativeDistances.length; i++) {
      if (cumulativeDistances[i] <= startDist) startIdx = i;
      if (cumulativeDistances[i] <= endDist) endIdx = i;
    }

    // Pace: time for this km
    const startTime = points[startIdx].timestamp;
    const endTime = points[endIdx].timestamp;
    let pace = 0;
    if (startTime && endTime) {
      const timeDiff = (endTime.getTime() - startTime.getTime()) / 1000;
      const distDiff = cumulativeDistances[endIdx] - cumulativeDistances[startIdx];
      pace = distDiff > 0 ? (timeDiff / distDiff) * 1000 : 0;
    }

    // Elevation change
    const startElev = points[startIdx].elevation;
    const endElev = points[endIdx].elevation;
    const elevationChange =
      startElev != null && endElev != null ? endElev - startElev : 0;

    // Avg HR for this segment
    const segmentHrPoints = points
      .slice(startIdx, endIdx + 1)
      .filter((p) => p.heartRate != null);
    const avgHr =
      segmentHrPoints.length > 0
        ? Math.round(
            segmentHrPoints.reduce((s, p) => s + p.heartRate!, 0) /
              segmentHrPoints.length
          )
        : null;

    splits.push({
      km: km + 1,
      pace,
      elevationChange,
      averageHeartRate: avgHr,
    });
  }

  // Partial last km (if remaining distance >= 100m)
  const remaining = totalDistance - fullKms * 1000;
  if (remaining >= 100) {
    const startDist = fullKms * 1000;
    let startIdx = 0;
    for (let i = 0; i < cumulativeDistances.length; i++) {
      if (cumulativeDistances[i] <= startDist) startIdx = i;
    }
    const endIdx = points.length - 1;

    const startTime = points[startIdx].timestamp;
    const endTime = points[endIdx].timestamp;
    let pace = 0;
    if (startTime && endTime) {
      const timeDiff = (endTime.getTime() - startTime.getTime()) / 1000;
      pace = remaining > 0 ? (timeDiff / remaining) * 1000 : 0;
    }

    const startElev = points[startIdx].elevation;
    const endElev = points[endIdx].elevation;
    const elevationChange =
      startElev != null && endElev != null ? endElev - startElev : 0;

    const segmentHrPoints = points
      .slice(startIdx, endIdx + 1)
      .filter((p) => p.heartRate != null);
    const avgHr =
      segmentHrPoints.length > 0
        ? Math.round(
            segmentHrPoints.reduce((s, p) => s + p.heartRate!, 0) /
              segmentHrPoints.length
          )
        : null;

    splits.push({
      km: fullKms + 1,
      pace,
      elevationChange,
      averageHeartRate: avgHr,
    });
  }

  return splits;
}

// ─── Best Pace ──────────────────────────────────────────────────────

export function calculateBestPace(splits: Split[]): number | null {
  // Only consider full km splits (exclude partial last km)
  const fullSplits = splits.filter((s) => s.pace > 0);
  if (fullSplits.length === 0) return null;
  return Math.min(...fullSplits.map((s) => s.pace));
}

// ─── Formatting ─────────────────────────────────────────────────────

export function formatPace(secPerKm: number): string {
  if (!secPerKm || secPerKm <= 0 || !isFinite(secPerKm)) return "--:--";
  const minutes = Math.floor(secPerKm / 60);
  const seconds = Math.round(secPerKm % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatDistance(meters: number): string {
  if (!meters || meters <= 0) return "0.00 km";
  return `${(meters / 1000).toFixed(2)} km`;
}

export function formatWeekLabel(weekStart: string): string {
  const date = new Date(weekStart + "T00:00:00");
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatEffortTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function extractCountries(
  locationRows: Array<{ location: string | null }>
): string[] {
  return [
    ...new Set(
      locationRows
        .map((r) => {
          const parts = r.location?.split(", ");
          return parts && parts.length >= 2 ? parts[parts.length - 1] : null;
        })
        .filter((c): c is string => c != null)
    ),
  ].sort((a, b) => a.localeCompare(b));
}
