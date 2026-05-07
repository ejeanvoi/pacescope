"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Link2,
  Link2Off,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";

interface GarminManagerProps {
  isConnected: boolean;
  garminUserId?: string;
  lastSyncAt?: string | null;
}

type UIState = "disconnected" | "mfa_pending" | "connected";

export function GarminManager({
  isConnected: initialConnected,
  garminUserId,
  lastSyncAt,
}: GarminManagerProps) {
  const [uiState, setUiState] = useState<UIState>(
    initialConnected ? "connected" : "disconnected"
  );
  const [sessionState, setSessionState] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");

  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [syncResult, setSyncResult] = useState<{
    synced: number;
    skipped: number;
    skippedNonRunning: number;
    skippedDuplicate: number;
    pages: number;
  } | null>(null);

  async function handleConnect(e: FormEvent) {
    e.preventDefault();
    setConnecting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/garmin/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Connection failed" });
        return;
      }

      if (data.requiresMfa) {
        setSessionState(data.sessionState);
        setUiState("mfa_pending");
        setPassword("");
      } else {
        setUiState("connected");
        setMessage({ type: "success", text: "Garmin account connected!" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setConnecting(false);
    }
  }

  async function handleMfa(e: FormEvent) {
    e.preventDefault();
    setConnecting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/garmin/verify-mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfaCode, sessionState }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Verification failed" });
        return;
      }

      setUiState("connected");
      setMfaCode("");
      setMessage({ type: "success", text: "Garmin account connected!" });
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setConnecting(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setMessage(null);
    setSyncResult(null);

    try {
      const res = await fetch("/api/garmin/sync", { method: "POST" });
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
    if (
      !confirm(
        "Are you sure you want to disconnect Garmin? Your imported activities will remain."
      )
    ) {
      return;
    }

    setDisconnecting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/garmin/disconnect", { method: "POST" });

      if (!res.ok) {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to disconnect" });
        return;
      }

      setUiState("disconnected");
      setMessage({
        type: "success",
        text: "Garmin disconnected. Your imported activities remain.",
      });
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="space-y-4">
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

      {uiState === "connected" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-blue-500" />
              Garmin Connected
            </CardTitle>
            <CardDescription>
              Your Garmin account is linked. Sync your running activities below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Garmin User ID</span>
                <span className="font-mono">{garminUserId}</span>
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
              <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                <p>
                  <strong>{syncResult.synced}</strong> imported,{" "}
                  <strong>{syncResult.skipped}</strong> skipped
                  {" "}({syncResult.pages} {syncResult.pages === 1 ? "page" : "pages"} fetched)
                </p>
                {syncResult.skippedNonRunning > 0 && (
                  <p className="text-muted-foreground">
                    {syncResult.skippedNonRunning} non-running activities skipped
                  </p>
                )}
                {syncResult.skippedDuplicate > 0 && (
                  <p className="text-muted-foreground">
                    {syncResult.skippedDuplicate} already imported
                  </p>
                )}
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
      )}

      {uiState === "disconnected" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2Off className="h-5 w-5 text-muted-foreground" />
              Connect Garmin
            </CardTitle>
            <CardDescription>
              Link your Garmin Connect account to import your running
              activities, including GPS routes, heart rate, and elevation data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>Import runs, trail runs, and treadmill activities</li>
              <li>GPS routes, heart rate, and elevation data included</li>
              <li>Your credentials are used only to obtain tokens — never stored</li>
              <li>Activities stay even if you disconnect later</li>
            </ul>

            <form onSubmit={handleConnect} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="garmin-email">Garmin Connect email</Label>
                <Input
                  id="garmin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="username"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="garmin-password">Password</Label>
                <Input
                  id="garmin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" disabled={connecting}>
                {connecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Link2 className="mr-2 h-4 w-4" />
                    Connect Garmin
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {uiState === "mfa_pending" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-500" />
              Two-Factor Verification
            </CardTitle>
            <CardDescription>
              Garmin sent a one-time code to your email address. Enter it below
              to complete the connection.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleMfa} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="mfa-code">One-time code</Label>
                <Input
                  id="mfa-code"
                  type="text"
                  inputMode="numeric"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  placeholder="123456"
                  required
                  autoComplete="one-time-code"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={connecting}>
                  {connecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Verify
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setUiState("disconnected");
                    setSessionState(null);
                    setMfaCode("");
                  }}
                >
                  Back
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
