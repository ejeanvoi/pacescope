import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function UploadPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Upload GPX</h1>
        <p className="text-muted-foreground">
          Upload a GPX file to add a new activity
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>GPX File Upload</CardTitle>
          <CardDescription>
            Drag and drop or select a .gpx file (max 10MB)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            GPX upload functionality will be available in Phase 2.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
