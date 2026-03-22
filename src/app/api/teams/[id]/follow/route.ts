import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/teams/[id]/follow - Folgen/Entfolgen (toggle)
export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const { id: teamId } = await params;

    const existing = await prisma.teamFollow.findUnique({
      where: { userId_teamId: { userId: session.user.id, teamId } },
    });

    if (existing) {
      await prisma.teamFollow.delete({ where: { id: existing.id } });
      return NextResponse.json({ action: "unfollowed" });
    }

    await prisma.teamFollow.create({
      data: { userId: session.user.id, teamId },
    });

    return NextResponse.json({ action: "followed" });
  } catch (error) {
    console.error("Fehler:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}