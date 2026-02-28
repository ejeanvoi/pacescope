import { z } from "zod";

export const gpxUploadSchema = z.object({
  type: z.enum(["RUN", "TRAIL_RUN", "TREADMILL"]),
  name: z.string().max(200).optional(),
});

export const activityListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z
    .enum(["startDate", "distance", "duration", "averagePace"])
    .default("startDate"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  type: z.enum(["RUN", "TRAIL_RUN", "TREADMILL"]).optional(),
  country: z.string().max(100).optional(),
});

export const dashboardStatsQuerySchema = z.object({
  range: z.enum(["7d", "30d", "90d", "365d", "ytd", "all", "custom"]).default("all"),
  type: z.enum(["RUN", "TRAIL_RUN", "TREADMILL"]).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  country: z.string().max(100).optional(),
});

export const globalDashboardQuerySchema = z.object({
  period: z.enum(["weekly", "monthly", "all"]).default("all"),
  type: z.enum(["RUN", "TRAIL_RUN", "TREADMILL"]).optional(),
});

export const similarRoutesQuerySchema = z.object({
  threshold: z.coerce.number().min(0).max(100).default(80),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const GPX_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
