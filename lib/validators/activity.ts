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
});

export const GPX_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
