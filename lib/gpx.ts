import { XMLParser } from "fast-xml-parser";
import type { TrackPoint } from "./calculations";

export interface ParsedGpxData {
  name: string | null;
  trackpoints: TrackPoint[];
}

export class GpxParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GpxParseError";
  }
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseAttributeValue: true,
  isArray: (name) => {
    // These elements can appear multiple times
    return ["trk", "trkseg", "trkpt"].includes(name);
  },
});

function extractHeartRate(extensions: unknown): number | null {
  if (!extensions || typeof extensions !== "object") return null;
  const ext = extensions as Record<string, unknown>;

  // Garmin format: gpxtpx:TrackPointExtension > gpxtpx:hr
  // Various namespace prefixes used by different devices
  const prefixes = [
    "gpxtpx:TrackPointExtension",
    "ns3:TrackPointExtension",
    "TrackPointExtension",
  ];

  for (const prefix of prefixes) {
    const tpe = ext[prefix] as Record<string, unknown> | undefined;
    if (tpe) {
      const hrKeys = [
        "gpxtpx:hr",
        "ns3:hr",
        "hr",
      ];
      for (const key of hrKeys) {
        const hr = tpe[key];
        if (typeof hr === "number" && hr > 0 && hr < 300) return hr;
      }
    }
  }

  // Direct hr in extensions (some Polar/Suunto devices)
  if (typeof ext.hr === "number" && ext.hr > 0 && ext.hr < 300) {
    return ext.hr;
  }

  return null;
}

function ensureArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

export function parseGpx(xmlContent: string): ParsedGpxData {
  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(xmlContent);
  } catch {
    throw new GpxParseError("Invalid GPX file: could not parse XML");
  }

  const gpx = parsed.gpx as Record<string, unknown> | undefined;
  if (!gpx) {
    throw new GpxParseError("Invalid GPX file: missing <gpx> root element");
  }

  const tracks = ensureArray(gpx.trk as Record<string, unknown> | Record<string, unknown>[]);
  if (tracks.length === 0) {
    throw new GpxParseError("Invalid GPX file: no tracks found");
  }

  // Extract name from first track
  const name = (tracks[0].name as string) || null;

  // Collect all trackpoints from all tracks and segments
  const trackpoints: TrackPoint[] = [];

  for (const trk of tracks) {
    const segments = ensureArray(trk.trkseg as Record<string, unknown> | Record<string, unknown>[]);

    for (const seg of segments) {
      const points = ensureArray(seg.trkpt as Record<string, unknown> | Record<string, unknown>[]);

      for (const pt of points) {
        const rawLat = pt["@_lat"];
        const rawLon = pt["@_lon"];

        // Parse lat/lon - may be number or string depending on parser config
        const lat = typeof rawLat === "number" ? rawLat : parseFloat(String(rawLat));
        const lon = typeof rawLon === "number" ? rawLon : parseFloat(String(rawLon));

        if (isNaN(lat) || isNaN(lon)) continue;
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;

        const rawEle = pt.ele;
        const elevation =
          typeof rawEle === "number"
            ? rawEle
            : typeof rawEle === "string"
              ? parseFloat(rawEle) || null
              : null;

        let timestamp: Date | null = null;
        if (pt.time) {
          const d = new Date(String(pt.time));
          if (!isNaN(d.getTime())) timestamp = d;
        }

        const heartRate = extractHeartRate(pt.extensions);

        trackpoints.push({
          latitude: lat,
          longitude: lon,
          elevation,
          timestamp,
          heartRate,
        });
      }
    }
  }

  if (trackpoints.length < 2) {
    throw new GpxParseError(
      "Invalid GPX file: need at least 2 trackpoints, found " +
        trackpoints.length
    );
  }

  return { name, trackpoints };
}
