"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MapViewProps {
  points: Array<{ latitude: number; longitude: number }>;
}

export default function MapView({ points }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || points.length < 2) return;

    // Prevent double initialization
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
    }

    const map = L.map(mapRef.current);
    mapInstanceRef.current = map;

    // OpenStreetMap tiles
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Draw route polyline
    const latLngs = points.map(
      (p) => [p.latitude, p.longitude] as [number, number]
    );
    const polyline = L.polyline(latLngs, {
      color: "#2563eb",
      weight: 3,
      opacity: 0.8,
    }).addTo(map);

    // Start marker (green)
    L.circleMarker([points[0].latitude, points[0].longitude], {
      radius: 8,
      fillColor: "#22c55e",
      color: "#fff",
      weight: 2,
      fillOpacity: 1,
    }).addTo(map);

    // End marker (red)
    const last = points[points.length - 1];
    L.circleMarker([last.latitude, last.longitude], {
      radius: 8,
      fillColor: "#ef4444",
      color: "#fff",
      weight: 2,
      fillOpacity: 1,
    }).addTo(map);

    // Fit bounds
    map.fitBounds(polyline.getBounds(), { padding: [20, 20] });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [points]);

  if (points.length < 2) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-xl bg-muted">
        <p className="text-muted-foreground">Not enough points to display map</p>
      </div>
    );
  }

  return <div ref={mapRef} className="h-[400px] w-full rounded-xl" />;
}
