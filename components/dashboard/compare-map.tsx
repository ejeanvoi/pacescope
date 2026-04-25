"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ROUTE_COLORS } from "@/lib/constants";

interface CompareMapProps {
  activities: Array<{
    name: string;
    points: Array<{ latitude: number; longitude: number }>;
  }>;
}

export default function CompareMap({ activities }: CompareMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || activities.length === 0) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
    }

    const map = L.map(mapRef.current);
    mapInstanceRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    let combinedBounds: L.LatLngBounds | null = null;

    activities.forEach((activity, index) => {
      if (activity.points.length < 2) return;
      const color = ROUTE_COLORS[index % ROUTE_COLORS.length];
      const latLngs = activity.points.map(
        (p) => [p.latitude, p.longitude] as [number, number]
      );
      const polyline = L.polyline(latLngs, {
        color,
        weight: 3,
        opacity: 0.8,
      }).addTo(map);

      polyline.bindTooltip(activity.name, { sticky: true });

      if (!combinedBounds) {
        combinedBounds = polyline.getBounds();
      } else {
        combinedBounds.extend(polyline.getBounds());
      }
    });

    if (combinedBounds) {
      map.fitBounds(combinedBounds, { padding: [20, 20] });
    }

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [activities]);

  if (activities.every((a) => a.points.length < 2)) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-xl bg-muted">
        <p className="text-muted-foreground">Not enough points to display map</p>
      </div>
    );
  }

  return <div ref={mapRef} className="h-[400px] w-full rounded-xl" />;
}
