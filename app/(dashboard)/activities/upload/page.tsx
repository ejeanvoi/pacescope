import { UploadForm } from "@/components/activities/upload-form";

export default function UploadPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Upload GPX</h1>
        <p className="text-muted-foreground">
          Upload a GPX file to add a new activity
        </p>
      </div>
      <UploadForm />
    </div>
  );
}
