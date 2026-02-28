import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";
import type { TrackPoint } from "@/lib/calculations";

// ─── Types ──────────────────────────────────────────────────────────

export interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix timestamp
  athlete: {
    id: number;
    firstname: string;
    lastname: string;
  };
}

export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  start_date: string;
  elapsed_time: number; // seconds
  moving_time: number; // seconds
  distance: number; // meters
  total_elevation_gain: number; // meters
  average_heartrate?: number;
  max_heartrate?: number;
  calories?: number;
  description?: string;
}

interface StravaStream {
  type: string;
  data: number[] | [number, number][];
  series_type: string;
  original_size: number;
  resolution: string;
}

export interface StravaStreams {
  latlng?: { data: [number, number][] };
  altitude?: { data: number[] };
  heartrate?: { data: number[] };
  time?: { data: number[] };
  distance?: { data: number[] };
}

// ─── Constants ──────────────────────────────────────────────────────

const STRAVA_BASE_URL = "https://www.strava.com";
const STRAVA_API_URL = "https://www.strava.com/api/v3";

// ─── OAuth URL ──────────────────────────────────────────────────────

export function getAuthorizationUrl(state: string): string {
  const clientId = process.env.STRAVA_CLIENT_ID;
  if (!clientId) {
    throw new Error("STRAVA_CLIENT_ID is not set");
  }

  const redirectUri = `${process.env.AUTH_URL}/api/strava/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    approval_prompt: "auto",
    scope: "read,activity:read_all",
    state,
  });

  return `${STRAVA_BASE_URL}/oauth/authorize?${params.toString()}`;
}

// ─── Token Exchange ─────────────────────────────────────────────────

export async function exchangeToken(
  code: string
): Promise<StravaTokenResponse> {
  const res = await fetch(`${STRAVA_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Strava token exchange failed: ${res.status} ${body}`);
  }

  return res.json();
}

// ─── Token Refresh ──────────────────────────────────────────────────

export async function refreshAccessToken(
  refreshToken: string
): Promise<StravaTokenResponse> {
  const res = await fetch(`${STRAVA_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Strava token refresh failed: ${res.status} ${body}`);
  }

  return res.json();
}

// ─── Get Valid Access Token ─────────────────────────────────────────

export async function getValidAccessToken(connection: {
  id: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  // Token still valid (with 60s buffer)
  if (connection.expiresAt > now + 60) {
    return decrypt(connection.accessToken);
  }

  // Refresh the token
  const decryptedRefresh = decrypt(connection.refreshToken);
  const tokens = await refreshAccessToken(decryptedRefresh);

  // Update stored tokens
  await prisma.stravaConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: encrypt(tokens.access_token),
      refreshToken: encrypt(tokens.refresh_token),
      expiresAt: tokens.expires_at,
    },
  });

  return tokens.access_token;
}

// ─── Fetch Activities ───────────────────────────────────────────────

export async function fetchActivities(
  accessToken: string,
  after?: number,
  page: number = 1,
  perPage: number = 50
): Promise<StravaActivity[]> {
  const params = new URLSearchParams({
    page: page.toString(),
    per_page: perPage.toString(),
  });
  if (after) {
    params.set("after", after.toString());
  }

  const res = await fetch(
    `${STRAVA_API_URL}/athlete/activities?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Strava fetch activities failed: ${res.status} ${body}`);
  }

  return res.json();
}

// ─── Fetch Activity Streams ─────────────────────────────────────────

export async function fetchActivityStreams(
  accessToken: string,
  activityId: number
): Promise<StravaStreams> {
  const keys = "latlng,altitude,heartrate,time,distance";
  const res = await fetch(
    `${STRAVA_API_URL}/activities/${activityId}/streams?keys=${keys}&key_type=stream`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    // 404 means no streams (e.g. treadmill with no GPS)
    if (res.status === 404) {
      return {};
    }
    const body = await res.text();
    throw new Error(`Strava fetch streams failed: ${res.status} ${body}`);
  }

  const streams: StravaStream[] = await res.json();

  // Convert array of streams to keyed object
  const result: StravaStreams = {};
  for (const stream of streams) {
    if (stream.type === "latlng") {
      result.latlng = { data: stream.data as [number, number][] };
    } else if (stream.type === "altitude") {
      result.altitude = { data: stream.data as number[] };
    } else if (stream.type === "heartrate") {
      result.heartrate = { data: stream.data as number[] };
    } else if (stream.type === "time") {
      result.time = { data: stream.data as number[] };
    } else if (stream.type === "distance") {
      result.distance = { data: stream.data as number[] };
    }
  }

  return result;
}

// ─── Activity Type Mapping ──────────────────────────────────────────

const RUNNING_TYPES = new Set([
  "Run",
  "TrailRun",
  "VirtualRun",
  "Treadmill",
]);

export function isRunningActivity(stravaActivity: StravaActivity): boolean {
  return (
    RUNNING_TYPES.has(stravaActivity.sport_type) ||
    RUNNING_TYPES.has(stravaActivity.type)
  );
}

export function mapStravaActivityType(
  sportType: string
): "RUN" | "TRAIL_RUN" | "TREADMILL" {
  switch (sportType) {
    case "TrailRun":
      return "TRAIL_RUN";
    case "Treadmill":
    case "VirtualRun":
      return "TREADMILL";
    default:
      return "RUN";
  }
}

// ─── Stream to TrackPoint Conversion ────────────────────────────────

export function convertStravaToTrackPoints(
  streams: StravaStreams,
  startDate: string
): TrackPoint[] {
  const latlng = streams.latlng?.data;
  if (!latlng || latlng.length === 0) {
    return [];
  }

  const altitude = streams.altitude?.data;
  const heartrate = streams.heartrate?.data;
  const time = streams.time?.data;
  const startTime = new Date(startDate).getTime();

  return latlng.map((coords, i) => ({
    latitude: coords[0],
    longitude: coords[1],
    elevation: altitude?.[i] ?? null,
    timestamp: time ? new Date(startTime + time[i] * 1000) : null,
    heartRate: heartrate?.[i] ?? null,
  }));
}
