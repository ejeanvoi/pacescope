process.loadEnvFile();

import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { reverseGeocode } from "../lib/geocoding";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  // Find activities that have GPS coordinates but no location
  const activities = await prisma.activity.findMany({
    where: {
      location: null,
      startLatitude: { not: null },
      startLongitude: { not: null },
    },
    select: {
      id: true,
      name: true,
      startLatitude: true,
      startLongitude: true,
    },
  });

  console.log(`Found ${activities.length} activities to geocode`);

  let updated = 0;
  let failed = 0;

  for (const activity of activities) {
    // Nominatim rate limit: max 1 request per second
    const location = await reverseGeocode(
      activity.startLatitude!,
      activity.startLongitude!
    );

    if (location) {
      await prisma.activity.update({
        where: { id: activity.id },
        data: { location },
      });
      updated++;
      console.log(`  ${activity.name} → ${location}`);
    } else {
      failed++;
      console.log(`  ${activity.name} → (geocoding failed)`);
    }

    // Respect Nominatim 1 req/sec rate limit
    await sleep(1100);
  }

  console.log(
    `Backfill complete: ${updated} geocoded, ${failed} failed`
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
