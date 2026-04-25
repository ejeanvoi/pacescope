import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { StravaManager } from "@/components/strava/strava-manager";

interface StravaPageProps {
  searchParams: Promise<{ success?: string; error?: string }>;
}

export default async function StravaPage({ searchParams }: StravaPageProps) {
  const session = await auth();
  const params = await searchParams;

  const connection = await prisma.stravaConnection.findUnique({
    where: { userId: session!.user.id },
    select: {
      stravaAthleteId: true,
      lastSyncAt: true,
    },
  });

  // Map query params to status message
  let initialMessage: { type: "success" | "error"; text: string } | null =
    null;
  if (params.success === "connected") {
    initialMessage = {
      type: "success",
      text: "Strava account connected successfully!",
    };
  } else if (params.error) {
    const errorMessages: Record<string, string> = {
      access_denied: "Strava authorization was denied.",
      invalid_request: "Invalid OAuth request. Please try again.",
      invalid_state:
        "Session expired or invalid. Please try connecting again.",
      token_exchange_failed:
        "Failed to connect with Strava. Please try again.",
    };
    initialMessage = {
      type: "error",
      text: errorMessages[params.error] || "An error occurred.",
    };
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Strava</h1>
        <p className="text-muted-foreground">
          Connect your Strava account to sync activities
        </p>
      </div>

      <StravaManager
        isConnected={!!connection}
        athleteId={connection?.stravaAthleteId}
        lastSyncAt={connection?.lastSyncAt?.toISOString() ?? null}
        initialMessage={initialMessage}
      />
    </div>
  );
}
