"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

export function SettingsForm() {
  const [globalVisibility, setGlobalVisibility] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/user/settings");
        if (res.ok) {
          const data = await res.json();
          setGlobalVisibility(data.globalVisibility);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleToggle = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ globalVisibility: !globalVisibility }),
      });
      if (res.ok) {
        const data = await res.json();
        setGlobalVisibility(data.globalVisibility);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-sm text-muted-foreground">Loading settings...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Privacy
        </CardTitle>
        <CardDescription>
          Control how your data appears to other users
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="font-medium">Global Leaderboard</p>
            <p className="text-sm text-muted-foreground">
              When enabled, your name, total distance, pace, and activity count
              appear on the global leaderboard. Other users cannot see your
              individual activities.
            </p>
          </div>
          <Button
            variant={globalVisibility ? "default" : "outline"}
            onClick={handleToggle}
            disabled={saving}
          >
            {globalVisibility ? "Visible" : "Hidden"}
          </Button>
        </div>
        {saved && (
          <p className="text-sm text-green-600">Settings saved.</p>
        )}
      </CardContent>
    </Card>
  );
}
