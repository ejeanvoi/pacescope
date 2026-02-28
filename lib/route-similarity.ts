import { haversineDistance } from "./calculations";

// ─── Types ──────────────────────────────────────────────────────────

export interface RouteBoundingBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export interface RouteFingerprint {
  startLatitude: number;
  startLongitude: number;
  boundingBox: RouteBoundingBox;
}

export interface SamplePoint {
  latitude: number;
  longitude: number;
}

// ─── Fingerprint Computation ────────────────────────────────────────

/**
 * Compute route metadata (start point + bounding box) from GPS points.
 * Called at upload/sync time and stored on the Activity row for fast
 * pre-filtering during similarity searches.
 */
export function computeRouteFingerprint(
  points: Array<{ latitude: number; longitude: number }>
): RouteFingerprint | null {
  if (points.length === 0) return null;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;

  for (const p of points) {
    if (p.latitude < minLat) minLat = p.latitude;
    if (p.latitude > maxLat) maxLat = p.latitude;
    if (p.longitude < minLon) minLon = p.longitude;
    if (p.longitude > maxLon) maxLon = p.longitude;
  }

  return {
    startLatitude: points[0].latitude,
    startLongitude: points[0].longitude,
    boundingBox: { minLat, maxLat, minLon, maxLon },
  };
}

// ─── Route Normalization ────────────────────────────────────────────

/**
 * Resample a route to N evenly-spaced points using linear interpolation
 * on cumulativeDistance. This normalizes routes with different trackpoint
 * densities to a common representation for comparison.
 */
export function normalizeRoute(
  points: Array<{
    latitude: number;
    longitude: number;
    cumulativeDistance: number | null;
  }>,
  sampleCount: number = 50
): SamplePoint[] {
  const valid = points.filter(
    (p): p is typeof p & { cumulativeDistance: number } =>
      p.cumulativeDistance != null
  );
  if (valid.length < 2) return [];

  const totalDist = valid[valid.length - 1].cumulativeDistance;
  if (totalDist <= 0) return [];

  const samples: SamplePoint[] = [];
  let validIdx = 0;

  for (let i = 0; i < sampleCount; i++) {
    const targetDist = (i / (sampleCount - 1)) * totalDist;

    // Advance to the segment containing targetDist
    while (
      validIdx < valid.length - 2 &&
      valid[validIdx + 1].cumulativeDistance < targetDist
    ) {
      validIdx++;
    }

    const p1 = valid[validIdx];
    const p2 = valid[Math.min(validIdx + 1, valid.length - 1)];
    const segDist = p2.cumulativeDistance - p1.cumulativeDistance;
    const t =
      segDist > 0 ? (targetDist - p1.cumulativeDistance) / segDist : 0;

    samples.push({
      latitude: p1.latitude + t * (p2.latitude - p1.latitude),
      longitude: p1.longitude + t * (p2.longitude - p1.longitude),
    });
  }

  return samples;
}

// ─── Similarity Computation ─────────────────────────────────────────

/**
 * Average minimum distance from each point in `from` to its nearest
 * point in `to`. Used as one direction of the symmetric comparison.
 */
function averageMinDistance(
  from: SamplePoint[],
  to: SamplePoint[]
): number {
  let totalMin = 0;
  for (const pA of from) {
    let minDist = Infinity;
    for (const pB of to) {
      const d = haversineDistance(
        pA.latitude,
        pA.longitude,
        pB.latitude,
        pB.longitude
      );
      if (d < minDist) minDist = d;
    }
    totalMin += minDist;
  }
  return totalMin / from.length;
}

/**
 * Compute similarity between two normalized routes (0–100).
 *
 * Uses symmetric average minimum distance: for each point on route A,
 * find the closest point on route B, and vice versa. Take the worse
 * of the two averages (Hausdorff-like). Convert to a percentage using
 * a linear tolerance mapping.
 *
 * Properties:
 * - Rotation-invariant (same loop, different start → high similarity)
 * - Handles out-and-back routes
 * - Tolerates GPS noise through averaging
 */
export function computeRouteSimilarity(
  samplesA: SamplePoint[],
  samplesB: SamplePoint[],
  maxToleranceMeters: number = 200
): number {
  if (samplesA.length === 0 || samplesB.length === 0) return 0;

  const avgMinA = averageMinDistance(samplesA, samplesB);
  const avgMinB = averageMinDistance(samplesB, samplesA);
  const worstAvg = Math.max(avgMinA, avgMinB);

  const similarity = Math.max(0, 100 * (1 - worstAvg / maxToleranceMeters));
  return Math.round(similarity * 10) / 10;
}

// ─── Bounding Box Helpers ───────────────────────────────────────────

/** ~200m padding in degrees at mid-latitudes */
const BBOX_PADDING_DEG = 0.002;

export function boundingBoxesOverlap(
  a: RouteBoundingBox,
  b: RouteBoundingBox
): boolean {
  return !(
    a.maxLat + BBOX_PADDING_DEG < b.minLat ||
    b.maxLat + BBOX_PADDING_DEG < a.minLat ||
    a.maxLon + BBOX_PADDING_DEG < b.minLon ||
    b.maxLon + BBOX_PADDING_DEG < a.minLon
  );
}
