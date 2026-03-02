import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  getValidAccessToken,
  fetchActivities,
  fetchActivityStreams,
  isRunningActivity,
  mapStravaActivityType,
  convertStravaToTrackPoints,
  STRAVA_PAGE_SIZE,
} from "@/lib/strava";
import {
  computeCumulativeDistances,
  calculateElevation,
  calculateAveragePace,
  calculateBestPace,
  calculateHeartRateStats,
  calculateSplits,
} from "@/lib/calculations";
import { computeRouteFingerprint } from "@/lib/route-similarity";
import { reverseGeocode } from "@/lib/geocoding";
import type { ActivitySource } from "@/generated/prisma/client";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find user's Strava connection
  const connection = await prisma.stravaConnection.findUnique({
    where: { userId: session.user.id },
  });

  if (!connection) {
    return NextResponse.json(
      { error: "Strava account not connected" },
      { status: 404 }
    );
  }

  try {
    const accessToken = await getValidAccessToken(connection);

    // Fetch activities since last sync (or all time)
    const after = connection.lastSyncAt
      ? Math.floor(connection.lastSyncAt.getTime() / 1000)
      : undefined;

    let synced = 0;
    let skipped = 0;
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const activities = await fetchActivities(accessToken, after, page);

      if (activities.length === 0) {
        hasMore = false;
        break;
      }

      for (const stravaActivity of activities) {
        // Skip non-running activities
        if (!isRunningActivity(stravaActivity)) {
          skipped++;
          continue;
        }

        // Skip if already imported (deduplication)
        const existing = await prisma.activity.findUnique({
          where: { stravaActivityId: stravaActivity.id.toString() },
          select: { id: true },
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Fetch GPS streams for this activity
        const streams = await fetchActivityStreams(
          accessToken,
          stravaActivity.id
        );

        // Convert to trackpoints
        const trackpoints = convertStravaToTrackPoints(
          streams,
          stravaActivity.start_date
        );

        // Compute metrics
        let elevationGain = stravaActivity.total_elevation_gain;
        let elevationLoss: number | null = null;
        let averagePace: number | null = null;
        let bestPace: number | null = null;
        let averageHeartRate: number | null =
          stravaActivity.average_heartrate ?? null;
        let maxHeartRate: number | null =
          stravaActivity.max_heartrate ?? null;
        const cumulativeDistances =
          trackpoints.length > 0
            ? computeCumulativeDistances(trackpoints)
            : [];

        if (trackpoints.length > 1) {
          const elevation = calculateElevation(trackpoints);
          elevationGain = elevation.gain || elevationGain;
          elevationLoss = elevation.loss || null;

          const splits = calculateSplits(trackpoints, cumulativeDistances);
          bestPace = calculateBestPace(splits);

          const hrStats = calculateHeartRateStats(trackpoints);
          if (hrStats.averageHeartRate)
            averageHeartRate = hrStats.averageHeartRate;
          if (hrStats.maxHeartRate) maxHeartRate = hrStats.maxHeartRate;
        }

        // Use Strava duration and distance for accuracy
        const duration = stravaActivity.moving_time;
        const distance = stravaActivity.distance;
        averagePace = calculateAveragePace(distance, duration);

        // Compute route fingerprint for similarity search
        const fingerprint =
          trackpoints.length > 0
            ? computeRouteFingerprint(trackpoints)
            : null;

        // Reverse-geocode start point to get location name
        const location = fingerprint
          ? await reverseGeocode(
              fingerprint.startLatitude,
              fingerprint.startLongitude
            )
          : null;

        // Create activity + points in a transaction
        await prisma.$transaction(async (tx) => {
          const created = await tx.activity.create({
            data: {
              userId: session.user.id,
              type: mapStravaActivityType(stravaActivity.sport_type),
              source: "STRAVA" as ActivitySource,
              stravaActivityId: stravaActivity.id.toString(),
              name: stravaActivity.name,
              description: stravaActivity.description || null,
              startDate: new Date(stravaActivity.start_date),
              duration,
              distance,
              elevationGain,
              elevationLoss,
              averagePace,
              bestPace,
              averageHeartRate,
              maxHeartRate,
              calories: stravaActivity.calories ?? null,
              location,
              startLatitude: fingerprint?.startLatitude ?? null,
              startLongitude: fingerprint?.startLongitude ?? null,
              boundingBoxMinLat: fingerprint?.boundingBox.minLat ?? null,
              boundingBoxMaxLat: fingerprint?.boundingBox.maxLat ?? null,
              boundingBoxMinLon: fingerprint?.boundingBox.minLon ?? null,
              boundingBoxMaxLon: fingerprint?.boundingBox.maxLon ?? null,
            },
          });

          // Create trackpoints if we have GPS data
          if (trackpoints.length > 0) {
            const pointsData = trackpoints.map((tp, index) => ({
              activityId: created.id,
              index,
              latitude: tp.latitude,
              longitude: tp.longitude,
              elevation: tp.elevation,
              timestamp: tp.timestamp ?? new Date(stravaActivity.start_date),
              heartRate: tp.heartRate,
              cumulativeDistance: cumulativeDistances[index] ?? null,
            }));

            await tx.activityPoint.createMany({ data: pointsData });
          }
        });

        synced++;
      }

      if (activities.length < STRAVA_PAGE_SIZE) {
        hasMore = false;
      } else {
        page++;
      }
    }

    // Update last sync time
    await prisma.stravaConnection.update({
      where: { id: connection.id },
      data: { lastSyncAt: new Date() },
    });

    return NextResponse.json({ synced, skipped });
  } catch (e) {
    console.error("Strava sync error:", e);
    return NextResponse.json(
      { error: "Failed to sync activities from Strava" },
      { status: 500 }
    );
  }
}
