"use client";

import dynamic from "next/dynamic";

const MapView = dynamic(
  () => import("@/components/activities/map-view"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[400px] items-center justify-center rounded-xl bg-muted">
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    ),
  }
);

interface MapWrapperProps {
  points: Array<{ latitude: number; longitude: number }>;
}

export function MapWrapper({ points }: MapWrapperProps) {
  return <MapView points={points} />;
}
