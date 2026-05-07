import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GarminManager } from "@/components/garmin/garmin-manager";

export default async function GarminPage() {
  const session = await auth();

  const connection = await prisma.garminConnection.findUnique({
    where: { userId: session!.user.id },
    select: { garminUserId: true, lastSyncAt: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Garmin Connect</h1>
        <p className="text-muted-foreground">
          Connect your Garmin account to sync activities
        </p>
      </div>

      <GarminManager
        isConnected={!!connection}
        garminUserId={connection?.garminUserId}
        lastSyncAt={connection?.lastSyncAt?.toISOString() ?? null}
      />
    </div>
  );
}
