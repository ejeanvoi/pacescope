import { z } from "zod";
import { ACTIVITY_TYPE_VALUES } from "@/lib/constants";

const activityTypeEnum = z.enum(ACTIVITY_TYPE_VALUES);

export const gpxUploadSchema = z.object({
  type: activityTypeEnum,
  name: z.string().max(200).optional(),
});

export const activityListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z
    .enum(["startDate", "distance", "duration", "averagePace"])
    .default("startDate"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  type: activityTypeEnum.optional(),
  country: z.string().max(100).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const dashboardStatsQuerySchema = z.object({
  range: z.enum(["7d", "30d", "90d", "365d", "ytd", "all", "custom"]).default("all"),
  type: activityTypeEnum.optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  country: z.string().max(100).optional(),
});

export const globalDashboardQuerySchema = z.object({
  period: z.enum(["weekly", "monthly", "all"]).default("all"),
  type: activityTypeEnum.optional(),
});

export const similarRoutesQuerySchema = z.object({
  threshold: z.coerce.number().min(0).max(100).default(80),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
