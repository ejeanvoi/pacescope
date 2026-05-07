import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connection = await prisma.garminConnection.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!connection) {
    return NextResponse.json(
      { error: "No Garmin connection found" },
      { status: 404 }
    );
  }

  await prisma.garminConnection.delete({ where: { id: connection.id } });

  return NextResponse.json({ success: true });
}
