import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { similarRoutesQuerySchema } from "@/lib/validators/activity";
import {
  normalizeRoute,
  computeRouteSimilarity,
} from "@/lib/route-similarity";

const BBOX_PADDING = 0.002; // ~200m in degrees
const MAX_CANDIDATES = 200;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = similarRoutesQuerySchema.safeParse(searchParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters" },
      { status: 400 }
    );
  }

  const { threshold, limit } = parsed.data;

  // 1. Fetch source activity with fingerprint
  const source = await prisma.activity.findUnique({
    where: { id, userId: session.user.id },
    select: {
      id: true,
      distance: true,
      startLatitude: true,
      startLongitude: true,
      boundingBoxMinLat: true,
      boundingBoxMaxLat: true,
      boundingBoxMinLon: true,
      boundingBoxMaxLon: true,
    },
  });

  if (!source) {
    return NextResponse.json(
      { error: "Activity not found" },
      { status: 404 }
    );
  }

  if (source.boundingBoxMinLat == null) {
    return NextResponse.json(
      { error: "Activity has no GPS data for route comparison" },
      { status: 400 }
    );
  }

  // 2. SQL pre-filter: distance range + bounding box overlap
  const distMin = source.distance * 0.5;
  const distMax = source.distance * 2.0;

  const candidates = await prisma.activity.findMany({
    where: {
      userId: session.user.id,
      id: { not: source.id },
      distance: { gte: distMin, lte: distMax },
      // Bounding box overlap filter (with padding)
      AND: [
        { boundingBoxMinLat: { not: null } },
        { boundingBoxMinLat: { lte: source.boundingBoxMaxLat! + BBOX_PADDING } },
        { boundingBoxMaxLat: { gte: source.boundingBoxMinLat! - BBOX_PADDING } },
        { boundingBoxMinLon: { lte: source.boundingBoxMaxLon! + BBOX_PADDING } },
        { boundingBoxMaxLon: { gte: source.boundingBoxMinLon! - BBOX_PADDING } },
      ],
    },
    select: {
      id: true,
      name: true,
      distance: true,
      duration: true,
      averagePace: true,
      startDate: true,
      type: true,
    },
    orderBy: { startDate: "desc" },
    take: MAX_CANDIDATES,
  });

  if (candidates.length === 0) {
    return NextResponse.json({ similar: [] });
  }

  // 3. Load source trackpoints and normalize
  const sourcePoints = await prisma.activityPoint.findMany({
    where: { activityId: source.id },
    orderBy: { index: "asc" },
    select: { latitude: true, longitude: true, cumulativeDistance: true },
  });
  const sourceSamples = normalizeRoute(sourcePoints, 50);

  if (sourceSamples.length === 0) {
    return NextResponse.json({ similar: [] });
  }

  // 4. Batch-load all candidate trackpoints in one query
  const candidateIds = candidates.map((c) => c.id);
  const allCandidatePoints = await prisma.activityPoint.findMany({
    where: { activityId: { in: candidateIds } },
    orderBy: { index: "asc" },
    select: {
      activityId: true,
      latitude: true,
      longitude: true,
      cumulativeDistance: true,
    },
  });

  // Group by activityId
  const pointsByActivity = new Map<
    string,
    Array<{
      latitude: number;
      longitude: number;
      cumulativeDistance: number | null;
    }>
  >();
  for (const p of allCandidatePoints) {
    let arr = pointsByActivity.get(p.activityId);
    if (!arr) {
      arr = [];
      pointsByActivity.set(p.activityId, arr);
    }
    arr.push(p);
  }

  // 5. Compute similarity for each candidate
  const results: Array<{
    id: string;
    name: string;
    distance: number;
    duration: number;
    averagePace: number | null;
    startDate: Date;
    type: string;
    similarity: number;
  }> = [];

  for (const candidate of candidates) {
    const points = pointsByActivity.get(candidate.id);
    if (!points || points.length < 2) continue;

    const candidateSamples = normalizeRoute(points, 50);
    if (candidateSamples.length === 0) continue;

    const similarity = computeRouteSimilarity(sourceSamples, candidateSamples);
    if (similarity >= threshold) {
      results.push({ ...candidate, similarity });
    }
  }

  // Sort by date (most recent first)
  results.sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );

  return NextResponse.json({
    similar: results.slice(0, limit),
  });
}
