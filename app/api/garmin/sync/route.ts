import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  getValidAccessToken,
  fetchActivities,
  downloadActivityGpx,
  isRunningActivity,
  mapGarminActivityType,
  GARMIN_SYNC_LIMIT,
} from "@/lib/garmin";
import { parseGpx, GpxParseError } from "@/lib/gpx";
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

  const connection = await prisma.garminConnection.findUnique({
    where: { userId: session.user.id },
  });

  if (!connection) {
    return NextResponse.json(
      { error: "Garmin account not connected" },
      { status: 404 }
    );
  }

  try {
    const accessToken = await getValidAccessToken(connection);

    let synced = 0;
    let skipped = 0;
    let skippedNonRunning = 0;
    let skippedDuplicate = 0;
    let start = 0;
    let pages = 0;
    const seenIds = new Set<string>();

    while (true) {
      const activities = await fetchActivities(
        accessToken,
        start,
        GARMIN_SYNC_LIMIT
      );

      pages++;
      console.log(`[Garmin sync] Page ${pages}: fetched ${activities.length} activities (start=${start})`);

      if (activities.length === 0) break;

      for (const garminActivity of activities) {
        const garminId = garminActivity.activityId.toString();

        // Guard against API wrapping around and returning the same IDs again
        if (seenIds.has(garminId)) {
          console.log(`[Garmin sync] API returned duplicate ID ${garminId}, stopping pagination`);
          start = -1; // signal to break outer loop
          break;
        }
        seenIds.add(garminId);

        if (!isRunningActivity(garminActivity)) {
          console.log(`[Garmin sync] Skipped non-running: ${garminId} type=${garminActivity.activityType.typeKey}`);
          skippedNonRunning++;
          skipped++;
          continue;
        }

        // Already imported — skip but keep paginating (earlier sync may have been partial)
        const existing = await prisma.activity.findUnique({
          where: { garminActivityId: garminId },
          select: { id: true },
        });
        if (existing) {
          skippedDuplicate++;
          skipped++;
          continue;
        }

        // Download and parse GPX for GPS trackpoints
        let trackpoints: ReturnType<typeof parseGpx>["trackpoints"] = [];
        try {
          const gpxText = await downloadActivityGpx(
            accessToken,
            garminActivity.activityId
          );
          const parsed = parseGpx(gpxText);
          trackpoints = parsed.trackpoints;
        } catch (e) {
          if (!(e instanceof GpxParseError)) {
            console.warn(
              `Garmin GPX download failed for activity ${garminActivity.activityId}:`,
              e
            );
          }
          // Continue without trackpoints — store summary data only
        }

        // Compute metrics from trackpoints when available
        const cumulativeDistances =
          trackpoints.length > 1
            ? computeCumulativeDistances(trackpoints)
            : [];

        let elevationGain = garminActivity.elevationGain ?? null;
        let elevationLoss = garminActivity.elevationLoss ?? null;
        let bestPace: number | null = null;
        let averageHeartRate: number | null = garminActivity.averageHR ?? null;
        let maxHeartRate: number | null = garminActivity.maxHR ?? null;

        if (trackpoints.length > 1) {
          const elevation = calculateElevation(trackpoints);
          elevationGain = elevation.gain || elevationGain;
          elevationLoss = elevation.loss || elevationLoss;

          const splits = calculateSplits(trackpoints, cumulativeDistances);
          bestPace = calculateBestPace(splits);

          const hrStats = calculateHeartRateStats(trackpoints);
          if (hrStats.averageHeartRate) averageHeartRate = hrStats.averageHeartRate;
          if (hrStats.maxHeartRate) maxHeartRate = hrStats.maxHeartRate;
        }

        const distance = garminActivity.distance;
        const duration =
          garminActivity.movingDuration || garminActivity.duration;
        const averagePace = calculateAveragePace(distance, duration);

        const fingerprint =
          trackpoints.length > 0
            ? computeRouteFingerprint(trackpoints)
            : null;

        const location = fingerprint
          ? await reverseGeocode(
              fingerprint.startLatitude,
              fingerprint.startLongitude
            )
          : null;

        const startDate = new Date(
          garminActivity.startTimeGMT.replace(" ", "T") + "Z"
        );

        await prisma.$transaction(async (tx) => {
          const created = await tx.activity.create({
            data: {
              userId: session.user.id,
              type: mapGarminActivityType(garminActivity.activityType.typeKey),
              source: "GARMIN" as ActivitySource,
              garminActivityId: garminActivity.activityId.toString(),
              name: garminActivity.activityName || "Garmin Activity",
              startDate,
              duration,
              distance,
              elevationGain,
              elevationLoss,
              averagePace,
              bestPace,
              averageHeartRate,
              maxHeartRate,
              calories: garminActivity.calories ?? null,
              location,
              startLatitude: fingerprint?.startLatitude ?? null,
              startLongitude: fingerprint?.startLongitude ?? null,
              boundingBoxMinLat: fingerprint?.boundingBox.minLat ?? null,
              boundingBoxMaxLat: fingerprint?.boundingBox.maxLat ?? null,
              boundingBoxMinLon: fingerprint?.boundingBox.minLon ?? null,
              boundingBoxMaxLon: fingerprint?.boundingBox.maxLon ?? null,
            },
          });

          if (trackpoints.length > 0) {
            await tx.activityPoint.createMany({
              data: trackpoints.map((tp, index) => ({
                activityId: created.id,
                index,
                latitude: tp.latitude,
                longitude: tp.longitude,
                elevation: tp.elevation,
                timestamp: tp.timestamp ?? startDate,
                heartRate: tp.heartRate,
                cumulativeDistance: cumulativeDistances[index] ?? null,
              })),
            });
          }
        });

        synced++;
      }

      if (start === -1) break;
      start += GARMIN_SYNC_LIMIT;

    }

    console.log(`[Garmin sync] Done: pages=${pages} synced=${synced} skippedNonRunning=${skippedNonRunning} skippedDuplicate=${skippedDuplicate}`);

    await prisma.garminConnection.update({
      where: { id: connection.id },
      data: { lastSyncAt: new Date() },
    });

    return NextResponse.json({ synced, skipped, skippedNonRunning, skippedDuplicate, pages });
  } catch (e) {
    console.error("Garmin sync error:", e);
    return NextResponse.json(
      { error: "Failed to sync activities from Garmin" },
      { status: 500 }
    );
  }
}
