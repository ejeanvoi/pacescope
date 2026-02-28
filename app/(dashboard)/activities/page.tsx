import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Upload } from "lucide-react";

export default function ActivitiesPage() {
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

      <Card>
        <CardHeader>
          <CardTitle>Your Activities</CardTitle>
          <CardDescription>
            Upload a GPX file or sync from Strava to see your activities here
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No activities found. Get started by uploading a GPX file.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
