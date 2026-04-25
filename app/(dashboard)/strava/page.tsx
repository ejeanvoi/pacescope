import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function StravaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Strava</h1>
        <p className="text-muted-foreground">
          Connect your Strava account to sync activities
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Strava Connection</CardTitle>
          <CardDescription>
            Link your Strava account to automatically import your runs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Strava integration will be available in Phase 3.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
