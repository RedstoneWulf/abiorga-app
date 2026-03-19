import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/stories - Alle aktiven Stories (nicht abgelaufen)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get("teamId");

    const now = new Date();

    // Abgelaufene Stories im Hintergrund löschen
    await prisma.story.deleteMany({
      where: { expiresAt: { lt: now } },
    });

    const where: { expiresAt: { gt: Date }; teamId?: string } = {
      expiresAt: { gt: now },
    };

    if (teamId) {
      where.teamId = teamId;
    }

    const stories = await prisma.story.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true } },
        team: { select: { id: true, name: true, color: true } },
        reactions: {
          select: {
            id: true,
            emoji: true,
            userId: true,
            user: { select: { id: true, name: true } },
          },
        },
        _count: { select: { comments: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Reaktionen gruppieren
    const formatted = stories.map((story) => {
      const emojiGroups: Record<string, { count: number; hasMyReaction: boolean }> = {};
      for (const reaction of story.reactions) {
        if (!emojiGroups[reaction.emoji]) {
          emojiGroups[reaction.emoji] = { count: 0, hasMyReaction: false };
        }
        emojiGroups[reaction.emoji].count++;
        if (reaction.userId === session.user.id) {
          emojiGroups[reaction.emoji].hasMyReaction = true;
        }
      }

      // Verbleibende Zeit berechnen
      const expiresIn = new Date(story.expiresAt).getTime() - now.getTime();
      const hoursLeft = Math.max(0, Math.floor(expiresIn / (1000 * 60 * 60)));
      const minutesLeft = Math.max(0, Math.floor((expiresIn % (1000 * 60 * 60)) / (1000 * 60)));

      return {
        id: story.id,
        text: story.text,
        mediaUrl: story.mediaUrl,
        createdBy: story.createdBy,
        team: story.team,
        emojiGroups,
        commentCount: story._count.comments,
        hoursLeft,
        minutesLeft,
        createdAt: story.createdAt,
        expiresAt: story.expiresAt,
      };
    });

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Fehler beim Laden der Stories:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

// POST /api/stories - Neue Story erstellen
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const body = await req.json();
    const { text, mediaUrl, teamId } = body as {
      text?: string;
      mediaUrl?: string;
      teamId: string;
    };

    if (!teamId) {
      return NextResponse.json({ error: "Team ist erforderlich" }, { status: 400 });
    }

    if (!text && !mediaUrl) {
      return NextResponse.json({ error: "Text oder Bild ist erforderlich" }, { status: 400 });
    }

    // Prüfen ob User Mitglied des Teams ist
    const membership = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: session.user.id, teamId } },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Du musst Mitglied des Teams sein um eine Story zu posten" },
        { status: 403 }
      );
    }

    // Bild-Größe prüfen (Base64 max ~5MB)
    if (mediaUrl && mediaUrl.length > 7_000_000) {
      return NextResponse.json(
        { error: "Bild ist zu groß. Maximal 5MB erlaubt." },
        { status: 400 }
      );
    }

    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 Stunden

    const story = await prisma.story.create({
      data: {
        text: text && text.trim().length > 0 ? text.trim() : null,
        mediaUrl: mediaUrl || null,
        expiresAt,
        createdById: session.user.id,
        teamId,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        team: { select: { id: true, name: true, color: true } },
      },
    });

    return NextResponse.json(story, { status: 201 });
  } catch (error) {
    console.error("Fehler beim Erstellen der Story:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}