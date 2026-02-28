process.loadEnvFile();

import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { computeRouteFingerprint } from "../lib/route-similarity";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Find activities without fingerprint data
  const activities = await prisma.activity.findMany({
    where: { startLatitude: null },
    select: { id: true, name: true },
  });

  console.log(`Found ${activities.length} activities to backfill`);

  let updated = 0;
  let skipped = 0;

  for (const activity of activities) {
    const points = await prisma.activityPoint.findMany({
      where: { activityId: activity.id },
      orderBy: { index: "asc" },
      select: { latitude: true, longitude: true },
    });

    const fingerprint = computeRouteFingerprint(points);

    if (!fingerprint) {
      skipped++;
      continue;
    }

    await prisma.activity.update({
      where: { id: activity.id },
      data: {
        startLatitude: fingerprint.startLatitude,
        startLongitude: fingerprint.startLongitude,
        boundingBoxMinLat: fingerprint.boundingBox.minLat,
        boundingBoxMaxLat: fingerprint.boundingBox.maxLat,
        boundingBoxMinLon: fingerprint.boundingBox.minLon,
        boundingBoxMaxLon: fingerprint.boundingBox.maxLon,
      },
    });

    updated++;
  }

  console.log(
    `Backfill complete: ${updated} updated, ${skipped} skipped (no GPS data)`
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
