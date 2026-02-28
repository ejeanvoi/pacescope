"use client";

import dynamic from "next/dynamic";

const CompareMap = dynamic(
  () => import("@/components/dashboard/compare-map"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[400px] items-center justify-center rounded-xl bg-muted">
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    ),
  }
);

interface CompareMapWrapperProps {
  activities: Array<{
    name: string;
    points: Array<{ latitude: number; longitude: number }>;
  }>;
}

export function CompareMapWrapper({ activities }: CompareMapWrapperProps) {
  return <CompareMap activities={activities} />;
}
