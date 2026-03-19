import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/stories/[id]/react - Emoji-Reaktion togglen
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const { id: storyId } = await params;
    const body = await req.json();
    const { emoji } = body as { emoji: string };

    if (!emoji || emoji.length === 0) {
      return NextResponse.json({ error: "Emoji ist erforderlich" }, { status: 400 });
    }

    // Prüfen ob Story existiert
    const story = await prisma.story.findUnique({
      where: { id: storyId },
    });

    if (!story) {
      return NextResponse.json({ error: "Story nicht gefunden" }, { status: 404 });
    }

    // Prüfen ob User schon mit diesem oder anderem Emoji reagiert hat
    const existingReaction = await prisma.storyReaction.findUnique({
      where: {
        storyId_userId: { storyId, userId: session.user.id },
      },
    });

    if (existingReaction) {
      if (existingReaction.emoji === emoji) {
        // Gleiches Emoji: Reaktion entfernen
        await prisma.storyReaction.delete({
          where: { id: existingReaction.id },
        });
        return NextResponse.json({ action: "removed", emoji });
      } else {
        // Anderes Emoji: Reaktion ändern
        await prisma.storyReaction.update({
          where: { id: existingReaction.id },
          data: { emoji },
        });
        return NextResponse.json({ action: "changed", emoji });
      }
    }

    // Neue Reaktion
    await prisma.storyReaction.create({
      data: {
        storyId,
        userId: session.user.id,
        emoji,
      },
    });

    return NextResponse.json({ action: "added", emoji });
  } catch (error) {
    console.error("Fehler bei der Reaktion:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}