import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/stories/[id]/view - Story als gesehen markieren
export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const { id: storyId } = await params;

    // Upsert: erstelle View nur wenn nicht schon vorhanden
    await prisma.storyView.upsert({
      where: {
        storyId_userId: { storyId, userId: session.user.id },
      },
      update: {},
      create: {
        storyId,
        userId: session.user.id,
      },
    });

    return NextResponse.json({ message: "Gesehen" });
  } catch (error) {
    console.error("Fehler:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}