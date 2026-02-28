import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function GlobalPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Global Dashboard
        </h1>
        <p className="text-muted-foreground">
          Compare your performance with other runners
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leaderboards & Comparisons</CardTitle>
          <CardDescription>
            See how you stack up against other PaceScope users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Global dashboards will be available in Phase 5.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
