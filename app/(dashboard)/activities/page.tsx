import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ActivityList } from "@/components/activities/activity-list";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

export default async function ActivitiesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const limit = 20;

  const [activities, total, locationRows] = await Promise.all([
    prisma.activity.findMany({
      where: { userId: session.user.id },
      orderBy: { startDate: "desc" },
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
    prisma.activity.count({ where: { userId: session.user.id } }),
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

  // Serialize dates for client component
  const serialized = activities.map((a) => ({
    ...a,
    startDate: a.startDate.toISOString(),
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Activities</h1>
          <p className="text-muted-foreground">
            View and manage your running activities
          </p>
        </div>
        <Link href="/activities/upload">
          <Button>
            <Upload className="h-4 w-4" />
            Upload GPX
          </Button>
        </Link>
      </div>

      <ActivityList
        initialActivities={serialized}
        initialPagination={{
          page: 1,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        }}
        initialCountries={countries}
      />
    </div>
  );
}
