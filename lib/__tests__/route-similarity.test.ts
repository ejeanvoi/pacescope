import { describe, it, expect } from "vitest";
import {
  computeRouteFingerprint,
  normalizeRoute,
  computeRouteSimilarity,
  boundingBoxesOverlap,
  type SamplePoint,
} from "../route-similarity";

// ─── Helpers ────────────────────────────────────────────────────────

function makeStraightRoute(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
  numPoints: number = 20
): Array<{ latitude: number; longitude: number; cumulativeDistance: number }> {
  const points = [];
  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1);
    points.push({
      latitude: startLat + t * (endLat - startLat),
      longitude: startLon + t * (endLon - startLon),
      cumulativeDistance: t * 5000, // 5km route
    });
  }
  return points;
}

// ─── computeRouteFingerprint ────────────────────────────────────────

describe("computeRouteFingerprint", () => {
  it("returns null for empty points", () => {
    expect(computeRouteFingerprint([])).toBeNull();
  });

  it("returns correct start point and bounding box", () => {
    const points = [
      { latitude: 48.85, longitude: 2.3 },
      { latitude: 48.86, longitude: 2.35 },
      { latitude: 48.84, longitude: 2.32 },
    ];

    const fp = computeRouteFingerprint(points)!;
    expect(fp.startLatitude).toBe(48.85);
    expect(fp.startLongitude).toBe(2.3);
    expect(fp.boundingBox.minLat).toBe(48.84);
    expect(fp.boundingBox.maxLat).toBe(48.86);
    expect(fp.boundingBox.minLon).toBe(2.3);
    expect(fp.boundingBox.maxLon).toBe(2.35);
  });

  it("handles single point", () => {
    const fp = computeRouteFingerprint([
      { latitude: 10, longitude: 20 },
    ])!;
    expect(fp.startLatitude).toBe(10);
    expect(fp.boundingBox.minLat).toBe(10);
    expect(fp.boundingBox.maxLat).toBe(10);
  });
});

// ─── normalizeRoute ─────────────────────────────────────────────────

describe("normalizeRoute", () => {
  it("returns empty for fewer than 2 valid points", () => {
    expect(normalizeRoute([])).toEqual([]);
    expect(
      normalizeRoute([
        { latitude: 1, longitude: 2, cumulativeDistance: 0 },
      ])
    ).toEqual([]);
  });

  it("returns empty if all cumulativeDistance are null", () => {
    expect(
      normalizeRoute([
        { latitude: 1, longitude: 2, cumulativeDistance: null },
        { latitude: 3, longitude: 4, cumulativeDistance: null },
      ])
    ).toEqual([]);
  });

  it("returns exactly N sample points", () => {
    const route = makeStraightRoute(48.85, 2.3, 48.86, 2.35);
    const samples = normalizeRoute(route, 10);
    expect(samples).toHaveLength(10);
  });

  it("first sample matches first point", () => {
    const route = makeStraightRoute(48.85, 2.3, 48.86, 2.35);
    const samples = normalizeRoute(route, 10);
    expect(samples[0].latitude).toBeCloseTo(48.85, 4);
    expect(samples[0].longitude).toBeCloseTo(2.3, 4);
  });

  it("last sample matches last point", () => {
    const route = makeStraightRoute(48.85, 2.3, 48.86, 2.35);
    const samples = normalizeRoute(route, 10);
    expect(samples[9].latitude).toBeCloseTo(48.86, 4);
    expect(samples[9].longitude).toBeCloseTo(2.35, 4);
  });

  it("filters out points with null cumulativeDistance", () => {
    const route = [
      { latitude: 48.85, longitude: 2.3, cumulativeDistance: 0 },
      { latitude: 48.855, longitude: 2.32, cumulativeDistance: null as number | null },
      { latitude: 48.86, longitude: 2.35, cumulativeDistance: 5000 },
    ];
    const samples = normalizeRoute(route, 5);
    expect(samples).toHaveLength(5);
    expect(samples[0].latitude).toBeCloseTo(48.85, 4);
    expect(samples[4].latitude).toBeCloseTo(48.86, 4);
  });
});

// ─── computeRouteSimilarity ─────────────────────────────────────────

describe("computeRouteSimilarity", () => {
  it("returns 0 for empty samples", () => {
    expect(computeRouteSimilarity([], [])).toBe(0);
    expect(
      computeRouteSimilarity(
        [{ latitude: 0, longitude: 0 }],
        []
      )
    ).toBe(0);
  });

  it("returns 100 for identical routes", () => {
    const routeA = makeStraightRoute(48.85, 2.3, 48.86, 2.35);
    const samplesA = normalizeRoute(routeA, 50);
    const similarity = computeRouteSimilarity(samplesA, samplesA);
    expect(similarity).toBe(100);
  });

  it("returns high similarity for nearly identical routes (GPS noise)", () => {
    const routeA = makeStraightRoute(48.85, 2.3, 48.86, 2.35);
    // Add small noise (~10m)
    const routeB = routeA.map((p) => ({
      ...p,
      latitude: p.latitude + (Math.random() - 0.5) * 0.0001,
      longitude: p.longitude + (Math.random() - 0.5) * 0.0001,
    }));
    const samplesA = normalizeRoute(routeA, 50);
    const samplesB = normalizeRoute(routeB, 50);
    const similarity = computeRouteSimilarity(samplesA, samplesB);
    expect(similarity).toBeGreaterThan(90);
  });

  it("returns 0 for completely different routes (far apart)", () => {
    // Paris
    const routeA = makeStraightRoute(48.85, 2.3, 48.86, 2.35);
    // Tokyo
    const routeB = makeStraightRoute(35.68, 139.69, 35.69, 139.74);
    const samplesA = normalizeRoute(routeA, 50);
    const samplesB = normalizeRoute(routeB, 50);
    const similarity = computeRouteSimilarity(samplesA, samplesB);
    expect(similarity).toBe(0);
  });

  it("returns high similarity for same loop with different start", () => {
    // Create a square loop: A -> B -> C -> D -> A
    const loop: SamplePoint[] = [
      { latitude: 48.85, longitude: 2.30 },
      { latitude: 48.85, longitude: 2.35 },
      { latitude: 48.86, longitude: 2.35 },
      { latitude: 48.86, longitude: 2.30 },
    ];

    // Expand to 20 evenly spaced points along the loop
    const expandLoop = (points: SamplePoint[], offset: number): SamplePoint[] => {
      const expanded: SamplePoint[] = [];
      const total = points.length;
      for (let i = 0; i < 20; i++) {
        const idx = (i + offset) % total;
        const nextIdx = (i + offset + 1) % total;
        const t = (i % (20 / total)) / (20 / total);
        expanded.push({
          latitude:
            points[idx % total].latitude +
            t * (points[nextIdx].latitude - points[idx % total].latitude),
          longitude:
            points[idx % total].longitude +
            t * (points[nextIdx].longitude - points[idx % total].longitude),
        });
      }
      return expanded;
    };

    const samplesA = expandLoop(loop, 0);
    const samplesB = expandLoop(loop, 2); // Start from a different corner

    const similarity = computeRouteSimilarity(samplesA, samplesB);
    // Minimum distance pairing should still find close matches
    expect(similarity).toBeGreaterThan(50);
  });

  it("handles custom tolerance", () => {
    const routeA = makeStraightRoute(48.85, 2.3, 48.86, 2.35);
    // Shift ~100m
    const routeB = makeStraightRoute(48.851, 2.301, 48.861, 2.351);
    const samplesA = normalizeRoute(routeA, 50);
    const samplesB = normalizeRoute(routeB, 50);

    // Strict tolerance: lower similarity
    const strict = computeRouteSimilarity(samplesA, samplesB, 100);
    // Lenient tolerance: higher similarity
    const lenient = computeRouteSimilarity(samplesA, samplesB, 500);

    expect(lenient).toBeGreaterThan(strict);
  });
});

// ─── boundingBoxesOverlap ───────────────────────────────────────────

describe("boundingBoxesOverlap", () => {
  it("returns true for overlapping boxes", () => {
    const a = { minLat: 48.84, maxLat: 48.86, minLon: 2.3, maxLon: 2.35 };
    const b = { minLat: 48.85, maxLat: 48.87, minLon: 2.32, maxLon: 2.37 };
    expect(boundingBoxesOverlap(a, b)).toBe(true);
  });

  it("returns false for completely disjoint boxes", () => {
    // Paris vs Tokyo
    const a = { minLat: 48.84, maxLat: 48.86, minLon: 2.3, maxLon: 2.35 };
    const b = { minLat: 35.68, maxLat: 35.69, minLon: 139.69, maxLon: 139.74 };
    expect(boundingBoxesOverlap(a, b)).toBe(false);
  });

  it("returns true for adjacent boxes within padding", () => {
    const a = { minLat: 48.84, maxLat: 48.86, minLon: 2.3, maxLon: 2.35 };
    // Just above a, within padding
    const b = {
      minLat: 48.861,
      maxLat: 48.87,
      minLon: 2.3,
      maxLon: 2.35,
    };
    expect(boundingBoxesOverlap(a, b)).toBe(true);
  });

  it("returns false for adjacent boxes beyond padding", () => {
    const a = { minLat: 48.84, maxLat: 48.86, minLon: 2.3, maxLon: 2.35 };
    // Well above a, beyond padding
    const b = {
      minLat: 48.87,
      maxLat: 48.88,
      minLon: 2.3,
      maxLon: 2.35,
    };
    expect(boundingBoxesOverlap(a, b)).toBe(false);
  });
});
