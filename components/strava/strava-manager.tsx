"use client";

import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link2, Link2Off, RefreshCw, Loader2, CheckCircle, AlertCircle } from "lucide-react";

interface StravaManagerProps {
  isConnected: boolean;
  athleteId?: number;
  lastSyncAt?: string | null;
  initialMessage?: { type: "success" | "error"; text: string } | null;
}

export function StravaManager({
  isConnected: initialConnected,
  athleteId,
  lastSyncAt,
  initialMessage,
}: StravaManagerProps) {
  const [isConnected, setIsConnected] = useState(initialConnected);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState(initialMessage ?? null);
  const [syncResult, setSyncResult] = useState<{
    synced: number;
    skipped: number;
  } | null>(null);

  async function handleSync() {
    setSyncing(true);
    setMessage(null);
    setSyncResult(null);

    try {
      const res = await fetch("/api/strava/sync", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Sync failed" });
        return;
      }

      setSyncResult(data);
      setMessage({
        type: "success",
        text: `Sync complete! ${data.synced} new ${data.synced === 1 ? "activity" : "activities"} imported.`,
      });
    } catch {
      setMessage({ type: "error", text: "Network error during sync" });
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Are you sure you want to disconnect Strava? Your imported activities will remain.")) {
      return;
    }

    setDisconnecting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/strava/disconnect", { method: "POST" });

      if (!res.ok) {
        const data = await res.json();
        setMessage({
          type: "error",
          text: data.error || "Failed to disconnect",
        });
        return;
      }

      setIsConnected(false);
      setMessage({
        type: "success",
        text: "Strava disconnected. Your imported activities remain.",
      });
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Status Message */}
      {message && (
        <div
          className={`flex items-center gap-2 rounded-lg border p-4 text-sm ${
            message.type === "success"
              ? "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {message.text}
        </div>
      )}

      {isConnected ? (
        /* ─── Connected State ──────────────────────────────── */
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-orange-500" />
              Strava Connected
            </CardTitle>
            <CardDescription>
              Your Strava account is linked. Sync your running activities below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Athlete ID</span>
                <span className="font-mono">{athleteId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Synced</span>
                <span suppressHydrationWarning>
                  {lastSyncAt
                    ? new Date(lastSyncAt).toLocaleString()
                    : "Never"}
                </span>
              </div>
            </div>

            {syncResult && (
              <div className="rounded-md bg-muted p-3 text-sm">
                <p>
                  <strong>{syncResult.synced}</strong> imported,{" "}
                  <strong>{syncResult.skipped}</strong> skipped
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleSync} disabled={syncing}>
                {syncing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sync Now
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={handleDisconnect}
                disabled={disconnecting || syncing}
              >
                {disconnecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Disconnecting...
                  </>
                ) : (
                  <>
                    <Link2Off className="mr-2 h-4 w-4" />
                    Disconnect
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* ─── Disconnected State ───────────────────────────── */
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2Off className="h-5 w-5 text-muted-foreground" />
              Connect Strava
            </CardTitle>
            <CardDescription>
              Link your Strava account to automatically import your running
              activities, including GPS routes, heart rate, and elevation data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>Import all your runs, trail runs, and treadmill activities</li>
              <li>GPS routes displayed on interactive maps</li>
              <li>Heart rate and elevation data included</li>
              <li>Activities stay even if you disconnect later</li>
            </ul>

            <a href="/api/strava/connect" className={buttonVariants()}>
              <Link2 className="mr-2 h-4 w-4" />
              Connect with Strava
            </a>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
