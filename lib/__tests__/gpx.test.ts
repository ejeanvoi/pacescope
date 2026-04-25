import { describe, it, expect } from "vitest";
import { parseGpx, GpxParseError } from "../gpx";

// ─── Minimal valid GPX ──────────────────────────────────────────────

const VALID_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test">
  <trk>
    <name>Morning Run</name>
    <trkseg>
      <trkpt lat="48.8566" lon="2.3522">
        <ele>35</ele>
        <time>2024-01-01T10:00:00Z</time>
      </trkpt>
      <trkpt lat="48.8570" lon="2.3530">
        <ele>37</ele>
        <time>2024-01-01T10:01:00Z</time>
      </trkpt>
      <trkpt lat="48.8575" lon="2.3540">
        <ele>36</ele>
        <time>2024-01-01T10:02:00Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`;

// ─── GPX with heart rate (Garmin format) ────────────────────────────

const GPX_WITH_HR = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Garmin">
  <trk>
    <name>HR Run</name>
    <trkseg>
      <trkpt lat="48.8566" lon="2.3522">
        <ele>35</ele>
        <time>2024-01-01T10:00:00Z</time>
        <extensions>
          <gpxtpx:TrackPointExtension>
            <gpxtpx:hr>145</gpxtpx:hr>
          </gpxtpx:TrackPointExtension>
        </extensions>
      </trkpt>
      <trkpt lat="48.8570" lon="2.3530">
        <ele>37</ele>
        <time>2024-01-01T10:01:00Z</time>
        <extensions>
          <gpxtpx:TrackPointExtension>
            <gpxtpx:hr>152</gpxtpx:hr>
          </gpxtpx:TrackPointExtension>
        </extensions>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`;

// ─── Multi-segment GPX ──────────────────────────────────────────────

const MULTI_SEGMENT_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1">
  <trk>
    <name>Multi-seg</name>
    <trkseg>
      <trkpt lat="48.8566" lon="2.3522">
        <time>2024-01-01T10:00:00Z</time>
      </trkpt>
      <trkpt lat="48.8570" lon="2.3530">
        <time>2024-01-01T10:01:00Z</time>
      </trkpt>
    </trkseg>
    <trkseg>
      <trkpt lat="48.8580" lon="2.3540">
        <time>2024-01-01T10:05:00Z</time>
      </trkpt>
      <trkpt lat="48.8590" lon="2.3550">
        <time>2024-01-01T10:06:00Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`;

// ─── Tests ──────────────────────────────────────────────────────────

describe("parseGpx", () => {
  it("parses a valid GPX file", () => {
    const result = parseGpx(VALID_GPX);
    expect(result.name).toBe("Morning Run");
    expect(result.trackpoints).toHaveLength(3);
  });

  it("extracts coordinates correctly", () => {
    const result = parseGpx(VALID_GPX);
    const first = result.trackpoints[0];
    expect(first.latitude).toBeCloseTo(48.8566, 4);
    expect(first.longitude).toBeCloseTo(2.3522, 4);
  });

  it("extracts elevation", () => {
    const result = parseGpx(VALID_GPX);
    expect(result.trackpoints[0].elevation).toBe(35);
    expect(result.trackpoints[1].elevation).toBe(37);
  });

  it("extracts timestamps", () => {
    const result = parseGpx(VALID_GPX);
    expect(result.trackpoints[0].timestamp).toBeInstanceOf(Date);
    expect(result.trackpoints[0].timestamp!.toISOString()).toBe(
      "2024-01-01T10:00:00.000Z"
    );
  });

  it("extracts heart rate from Garmin format", () => {
    const result = parseGpx(GPX_WITH_HR);
    expect(result.trackpoints[0].heartRate).toBe(145);
    expect(result.trackpoints[1].heartRate).toBe(152);
  });

  it("handles multi-segment tracks", () => {
    const result = parseGpx(MULTI_SEGMENT_GPX);
    expect(result.trackpoints).toHaveLength(4);
  });

  it("throws GpxParseError for invalid XML", () => {
    expect(() => parseGpx("not xml at all <<<")).toThrow(GpxParseError);
  });

  it("throws GpxParseError for missing gpx root", () => {
    expect(() => parseGpx("<root><child/></root>")).toThrow(GpxParseError);
    expect(() => parseGpx("<root><child/></root>")).toThrow(
      "missing <gpx> root element"
    );
  });

  it("throws GpxParseError for no tracks", () => {
    // Empty <gpx> is treated as missing root by the parser
    expect(() => parseGpx("<gpx></gpx>")).toThrow(GpxParseError);
    // GPX with metadata but no tracks
    const gpxNoTrk = `<gpx version="1.1"><metadata><name>Test</name></metadata></gpx>`;
    expect(() => parseGpx(gpxNoTrk)).toThrow("no tracks found");
  });

  it("throws GpxParseError for fewer than 2 trackpoints", () => {
    const onePoint = `<gpx><trk><trkseg>
      <trkpt lat="48.8566" lon="2.3522"><time>2024-01-01T10:00:00Z</time></trkpt>
    </trkseg></trk></gpx>`;
    expect(() => parseGpx(onePoint)).toThrow("need at least 2 trackpoints");
  });

  it("skips points with invalid coordinates", () => {
    const badCoords = `<gpx><trk><trkseg>
      <trkpt lat="999" lon="2.35"><time>2024-01-01T10:00:00Z</time></trkpt>
      <trkpt lat="48.85" lon="2.35"><time>2024-01-01T10:01:00Z</time></trkpt>
      <trkpt lat="48.86" lon="2.36"><time>2024-01-01T10:02:00Z</time></trkpt>
    </trkseg></trk></gpx>`;
    const result = parseGpx(badCoords);
    // First point (lat=999) should be skipped
    expect(result.trackpoints).toHaveLength(2);
  });

  it("handles missing elevation gracefully", () => {
    const noElev = `<gpx><trk><trkseg>
      <trkpt lat="48.8566" lon="2.3522"><time>2024-01-01T10:00:00Z</time></trkpt>
      <trkpt lat="48.8570" lon="2.3530"><time>2024-01-01T10:01:00Z</time></trkpt>
    </trkseg></trk></gpx>`;
    const result = parseGpx(noElev);
    expect(result.trackpoints[0].elevation).toBeNull();
  });

  it("returns null name when track has no name element", () => {
    const noName = `<gpx><trk><trkseg>
      <trkpt lat="48.8566" lon="2.3522"><time>2024-01-01T10:00:00Z</time></trkpt>
      <trkpt lat="48.8570" lon="2.3530"><time>2024-01-01T10:01:00Z</time></trkpt>
    </trkseg></trk></gpx>`;
    const result = parseGpx(noName);
    expect(result.name).toBeNull();
  });
});
