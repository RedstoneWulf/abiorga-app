import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/stories/[id]/comments - Kommentare laden
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const { id: storyId } = await params;

    const comments = await prisma.storyComment.findMany({
      where: { storyId },
      include: {
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error("Fehler beim Laden der Kommentare:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

// POST /api/stories/[id]/comments - Kommentar schreiben
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const { id: storyId } = await params;
    const body = await req.json();
    const { content } = body as { content: string };

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: "Kommentar darf nicht leer sein" }, { status: 400 });
    }

    if (content.length > 500) {
      return NextResponse.json({ error: "Maximal 500 Zeichen" }, { status: 400 });
    }

    // Prüfen ob Story existiert und nicht abgelaufen
    const story = await prisma.story.findUnique({
      where: { id: storyId },
    });

    if (!story) {
      return NextResponse.json({ error: "Story nicht gefunden" }, { status: 404 });
    }

    if (new Date(story.expiresAt) < new Date()) {
      return NextResponse.json({ error: "Diese Story ist abgelaufen" }, { status: 400 });
    }

    const comment = await prisma.storyComment.create({
      data: {
        content: content.trim(),
        storyId,
        userId: session.user.id,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error("Fehler beim Kommentieren:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}