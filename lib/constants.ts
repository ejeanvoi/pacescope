// ─── Route Colors ────────────────────────────────────────────────
// Used in compare charts, compare maps, and compare view for
// consistent color assignment to activities.

export const ROUTE_COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c",
  "#0891b2", "#be185d", "#854d0e", "#4f46e5", "#059669",
  "#e11d48", "#7c3aed", "#ca8a04", "#0d9488", "#c2410c",
  "#6366f1", "#15803d", "#b91c1c", "#7e22ce", "#0e7490",
];

// ─── Activity Types ─────────────────────────────────────────────

export const ACTIVITY_TYPE_VALUES = ["RUN", "TRAIL_RUN", "TREADMILL"] as const;

export const ACTIVITY_TYPE_OPTIONS = [
  { value: "RUN", label: "Run" },
  { value: "TRAIL_RUN", label: "Trail Run" },
  { value: "TREADMILL", label: "Treadmill" },
] as const;

export const ACTIVITY_TYPE_LABELS: Record<string, string> =
  Object.fromEntries(ACTIVITY_TYPE_OPTIONS.map(({ value, label }) => [value, label]));

// ─── Compare View ───────────────────────────────────────────────

export const MAX_COMPARE_ACTIVITIES = 20;

// ─── File Upload ────────────────────────────────────────────────

export const GPX_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
