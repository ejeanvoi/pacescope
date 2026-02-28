import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseGpx, GpxParseError } from "@/lib/gpx";
import {
  computeCumulativeDistances,
  calculateDuration,
  calculateElevation,
  calculateAveragePace,
  calculateBestPace,
  calculateHeartRateStats,
  calculateSplits,
} from "@/lib/calculations";
import {
  gpxUploadSchema,
  activityListQuerySchema,
  GPX_MAX_FILE_SIZE,
} from "@/lib/validators/activity";
import { computeRouteFingerprint } from "@/lib/route-similarity";
import { reverseGeocode } from "@/lib/geocoding";
import type { ActivityType, ActivitySource } from "@/generated/prisma/client";

// ─── POST: Upload GPX file ─────────────────────────────────────────

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid form data" },
      { status: 400 }
    );
  }

  // Extract file
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "No GPX file provided" },
      { status: 400 }
    );
  }

  // Validate file size
  if (file.size > GPX_MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 10MB." },
      { status: 400 }
    );
  }

  // Validate file extension
  if (!file.name.toLowerCase().endsWith(".gpx")) {
    return NextResponse.json(
      { error: "Invalid file type. Only .gpx files are accepted." },
      { status: 400 }
    );
  }

  // Validate form fields
  const parsed = gpxUploadSchema.safeParse({
    type: formData.get("type"),
    name: formData.get("name") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Parse GPX
  let gpxData;
  try {
    const xmlContent = await file.text();
    gpxData = parseGpx(xmlContent);
  } catch (e) {
    if (e instanceof GpxParseError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to parse GPX file" },
      { status: 400 }
    );
  }

  // Compute metrics
  const { trackpoints } = gpxData;
  const cumulativeDistances = computeCumulativeDistances(trackpoints);
  const totalDistance = cumulativeDistances[cumulativeDistances.length - 1];
  const duration = calculateDuration(trackpoints);
  const { gain: elevationGain, loss: elevationLoss } =
    calculateElevation(trackpoints);
  const averagePace =
    duration != null ? calculateAveragePace(totalDistance, duration) : null;
  const splits = calculateSplits(trackpoints, cumulativeDistances);
  const bestPace = calculateBestPace(splits);
  const { averageHeartRate, maxHeartRate } =
    calculateHeartRateStats(trackpoints);

  // Determine name
  const activityName =
    parsed.data.name ||
    gpxData.name ||
    `Activity on ${(trackpoints[0].timestamp ?? new Date()).toLocaleDateString()}`;

  // Compute route fingerprint for similarity search
  const fingerprint = computeRouteFingerprint(trackpoints);

  // Reverse-geocode start point to get location name
  const location = fingerprint
    ? await reverseGeocode(fingerprint.startLatitude, fingerprint.startLongitude)
    : null;

  // Create activity + points in a transaction
  const activity = await prisma.$transaction(async (tx) => {
    const created = await tx.activity.create({
      data: {
        userId: session.user.id,
        type: parsed.data.type as ActivityType,
        source: "GPX" as ActivitySource,
        name: activityName,
        startDate: trackpoints[0].timestamp ?? new Date(),
        duration: duration ?? 0,
        distance: totalDistance,
        elevationGain,
        elevationLoss,
        averagePace,
        bestPace,
        averageHeartRate,
        maxHeartRate,
        location,
        startLatitude: fingerprint?.startLatitude ?? null,
        startLongitude: fingerprint?.startLongitude ?? null,
        boundingBoxMinLat: fingerprint?.boundingBox.minLat ?? null,
        boundingBoxMaxLat: fingerprint?.boundingBox.maxLat ?? null,
        boundingBoxMinLon: fingerprint?.boundingBox.minLon ?? null,
        boundingBoxMaxLon: fingerprint?.boundingBox.maxLon ?? null,
      },
    });

    // Batch create trackpoints
    const pointsData = trackpoints.map((tp, index) => ({
      activityId: created.id,
      index,
      latitude: tp.latitude,
      longitude: tp.longitude,
      elevation: tp.elevation,
      timestamp: tp.timestamp ?? new Date(),
      heartRate: tp.heartRate,
      cumulativeDistance: cumulativeDistances[index],
    }));

    await tx.activityPoint.createMany({ data: pointsData });

    return created;
  });

  return NextResponse.json({ activity }, { status: 201 });
}

// ─── GET: List activities ───────────────────────────────────────────

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = activityListQuerySchema.safeParse(searchParams);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters" },
      { status: 400 }
    );
  }

  const { page, limit, sortBy, sortOrder, type, country } = parsed.data;

  const where = {
    userId: session.user.id,
    ...(type ? { type: type as ActivityType } : {}),
    ...(country ? { location: { endsWith: `, ${country}` } } : {}),
  };

  const [activities, total, locationRows] = await Promise.all([
    prisma.activity.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        type: true,
        source: true,
        name: true,
        startDate: true,
        duration: true,
        distance: true,
        elevationGain: true,
        averagePace: true,
        bestPace: true,
        averageHeartRate: true,
        location: true,
        createdAt: true,
      },
    }),
    prisma.activity.count({ where }),
    prisma.activity.findMany({
      where: { userId: session.user.id, location: { not: null } },
      select: { location: true },
      distinct: ["location"],
    }),
  ]);

  const countries = [
    ...new Set(
      locationRows
        .map((r) => {
          const parts = r.location?.split(", ");
          return parts && parts.length >= 2 ? parts[parts.length - 1] : null;
        })
        .filter((c): c is string => c != null)
    ),
  ].sort((a, b) => a.localeCompare(b));

  return NextResponse.json({
    activities,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    countries,
  });
}
