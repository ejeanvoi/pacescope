import { describe, it, expect } from "vitest";
import {
  haversineDistance,
  computeCumulativeDistances,
  calculateTotalDistance,
  calculateElevation,
  calculateDuration,
  calculateAveragePace,
  calculateHeartRateStats,
  calculateSplits,
  calculateBestPace,
  formatPace,
  formatDuration,
  formatDistance,
  type TrackPoint,
} from "../calculations";

// ─── Helper ─────────────────────────────────────────────────────────

function makePoint(overrides: Partial<TrackPoint> = {}): TrackPoint {
  return {
    latitude: 48.8566,
    longitude: 2.3522,
    elevation: null,
    timestamp: null,
    heartRate: null,
    ...overrides,
  };
}

// ─── haversineDistance ───────────────────────────────────────────────

describe("haversineDistance", () => {
  it("returns 0 for identical points", () => {
    expect(haversineDistance(48.8566, 2.3522, 48.8566, 2.3522)).toBe(0);
  });

  it("calculates Paris to London (~343 km)", () => {
    const d = haversineDistance(48.8566, 2.3522, 51.5074, -0.1278);
    expect(d).toBeGreaterThan(340_000);
    expect(d).toBeLessThan(345_000);
  });

  it("calculates short distance (~111 m for ~0.001 degrees lat)", () => {
    const d = haversineDistance(0, 0, 0.001, 0);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(120);
  });
});

// ─── computeCumulativeDistances ─────────────────────────────────────

describe("computeCumulativeDistances", () => {
  it("returns [0] for a single point", () => {
    const result = computeCumulativeDistances([makePoint()]);
    expect(result).toEqual([0]);
  });

  it("accumulates distances correctly", () => {
    const points = [
      makePoint({ latitude: 0, longitude: 0 }),
      makePoint({ latitude: 0.001, longitude: 0 }),
      makePoint({ latitude: 0.002, longitude: 0 }),
    ];
    const result = computeCumulativeDistances(points);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe(0);
    expect(result[1]).toBeGreaterThan(0);
    expect(result[2]).toBeGreaterThan(result[1]);
    // Should be roughly double
    expect(result[2]).toBeCloseTo(result[1] * 2, 0);
  });
});

// ─── calculateTotalDistance ─────────────────────────────────────────

describe("calculateTotalDistance", () => {
  it("returns 0 for fewer than 2 points", () => {
    expect(calculateTotalDistance([])).toBe(0);
    expect(calculateTotalDistance([makePoint()])).toBe(0);
  });

  it("returns positive distance for valid track", () => {
    const points = [
      makePoint({ latitude: 0, longitude: 0 }),
      makePoint({ latitude: 0.01, longitude: 0 }),
    ];
    const d = calculateTotalDistance(points);
    expect(d).toBeGreaterThan(1000); // ~1.1 km
  });
});

// ─── calculateElevation ─────────────────────────────────────────────

describe("calculateElevation", () => {
  it("returns zero for no elevation data", () => {
    const result = calculateElevation([
      makePoint(),
      makePoint(),
    ]);
    expect(result).toEqual({ gain: 0, loss: 0 });
  });

  it("calculates gain and loss correctly", () => {
    const points = [
      makePoint({ elevation: 100 }),
      makePoint({ elevation: 110 }), // +10
      makePoint({ elevation: 120 }), // +10
      makePoint({ elevation: 115 }), // -5 (below threshold, ignored)
      makePoint({ elevation: 105 }), // -15 from 120
      makePoint({ elevation: 130 }), // +25
    ];
    const result = calculateElevation(points);
    expect(result.gain).toBeGreaterThan(0);
    expect(result.loss).toBeGreaterThan(0);
  });

  it("ignores small elevation changes below noise threshold", () => {
    const points = [
      makePoint({ elevation: 100 }),
      makePoint({ elevation: 101 }), // +1, below 2m threshold
      makePoint({ elevation: 100 }), // -1, below threshold
    ];
    const result = calculateElevation(points);
    expect(result.gain).toBe(0);
    expect(result.loss).toBe(0);
  });
});

// ─── calculateDuration ──────────────────────────────────────────────

describe("calculateDuration", () => {
  it("returns null when no timestamps", () => {
    expect(calculateDuration([makePoint(), makePoint()])).toBeNull();
  });

  it("calculates duration in seconds", () => {
    const start = new Date("2024-01-01T10:00:00Z");
    const end = new Date("2024-01-01T10:30:00Z");
    const points = [
      makePoint({ timestamp: start }),
      makePoint({ timestamp: new Date("2024-01-01T10:15:00Z") }),
      makePoint({ timestamp: end }),
    ];
    expect(calculateDuration(points)).toBe(1800); // 30 minutes
  });
});

// ─── calculateAveragePace ───────────────────────────────────────────

describe("calculateAveragePace", () => {
  it("returns null for zero distance", () => {
    expect(calculateAveragePace(0, 300)).toBeNull();
  });

  it("returns null for zero duration", () => {
    expect(calculateAveragePace(5000, 0)).toBeNull();
  });

  it("calculates pace as sec/km", () => {
    // 5km in 25 minutes = 300 sec/km
    expect(calculateAveragePace(5000, 1500)).toBe(300);
  });

  it("calculates 10km in 50 minutes = 300 sec/km", () => {
    expect(calculateAveragePace(10000, 3000)).toBe(300);
  });
});

// ─── calculateHeartRateStats ────────────────────────────────────────

describe("calculateHeartRateStats", () => {
  it("returns nulls when no HR data", () => {
    const result = calculateHeartRateStats([makePoint(), makePoint()]);
    expect(result.averageHeartRate).toBeNull();
    expect(result.maxHeartRate).toBeNull();
  });

  it("computes average and max correctly", () => {
    const points = [
      makePoint({ heartRate: 140 }),
      makePoint({ heartRate: 160 }),
      makePoint({ heartRate: 150 }),
      makePoint({ heartRate: null }), // ignored
    ];
    const result = calculateHeartRateStats(points);
    expect(result.averageHeartRate).toBe(150);
    expect(result.maxHeartRate).toBe(160);
  });
});

// ─── calculateSplits ────────────────────────────────────────────────

describe("calculateSplits", () => {
  it("returns empty for fewer than 2 points", () => {
    expect(calculateSplits([], [])).toEqual([]);
    expect(calculateSplits([makePoint()], [0])).toEqual([]);
  });

  it("creates splits for a multi-km track", () => {
    // Simulate a 3.5km track
    const numPoints = 100;
    const totalDist = 3500;
    const startTime = new Date("2024-01-01T10:00:00Z").getTime();
    const totalTime = 1200000; // 20 minutes in ms

    const points: TrackPoint[] = [];
    const distances: number[] = [];

    for (let i = 0; i < numPoints; i++) {
      const fraction = i / (numPoints - 1);
      points.push(
        makePoint({
          latitude: fraction * 0.03,
          longitude: 0,
          elevation: 100 + fraction * 50,
          timestamp: new Date(startTime + fraction * totalTime),
        })
      );
      distances.push(fraction * totalDist);
    }

    const splits = calculateSplits(points, distances);
    // Should have 3 full km splits + partial (500m >= 100m)
    expect(splits.length).toBeGreaterThanOrEqual(3);
    expect(splits[0].km).toBe(1);
    expect(splits[0].pace).toBeGreaterThan(0);
  });
});

// ─── calculateBestPace ──────────────────────────────────────────────

describe("calculateBestPace", () => {
  it("returns null for empty splits", () => {
    expect(calculateBestPace([])).toBeNull();
  });

  it("returns the fastest pace", () => {
    const splits = [
      { km: 1, pace: 300, elevationChange: 0, averageHeartRate: null },
      { km: 2, pace: 280, elevationChange: 0, averageHeartRate: null },
      { km: 3, pace: 310, elevationChange: 0, averageHeartRate: null },
    ];
    expect(calculateBestPace(splits)).toBe(280);
  });
});

// ─── formatPace ─────────────────────────────────────────────────────

describe("formatPace", () => {
  it("formats 300 sec/km as 5:00", () => {
    expect(formatPace(300)).toBe("5:00");
  });

  it("formats 265 sec/km as 4:25", () => {
    expect(formatPace(265)).toBe("4:25");
  });

  it("returns --:-- for zero or negative", () => {
    expect(formatPace(0)).toBe("--:--");
    expect(formatPace(-1)).toBe("--:--");
  });

  it("returns --:-- for NaN/Infinity", () => {
    expect(formatPace(NaN)).toBe("--:--");
    expect(formatPace(Infinity)).toBe("--:--");
  });
});

// ─── formatDuration ─────────────────────────────────────────────────

describe("formatDuration", () => {
  it("formats seconds only", () => {
    expect(formatDuration(45)).toBe("45s");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(125)).toBe("2m 5s");
  });

  it("formats hours and minutes", () => {
    expect(formatDuration(3720)).toBe("1h 2m");
  });

  it("returns 0m for zero", () => {
    expect(formatDuration(0)).toBe("0m");
  });
});

// ─── formatDistance ─────────────────────────────────────────────────

describe("formatDistance", () => {
  it("formats meters to km", () => {
    expect(formatDistance(5000)).toBe("5.00 km");
  });

  it("formats with decimal precision", () => {
    expect(formatDistance(10567)).toBe("10.57 km");
  });

  it("returns 0.00 km for zero", () => {
    expect(formatDistance(0)).toBe("0.00 km");
  });
});
