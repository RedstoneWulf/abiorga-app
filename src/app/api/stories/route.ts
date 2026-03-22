import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/stories
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get("teamId");
    const now = new Date();

    // Abgelaufene löschen
    await prisma.story.deleteMany({ where: { expiresAt: { lt: now } } });

    const where: { expiresAt: { gt: Date }; teamId?: string } = {
      expiresAt: { gt: now },
    };
    if (teamId) where.teamId = teamId;

    // Gefolgte Teams laden
    const followedTeams = await prisma.teamFollow.findMany({
      where: { userId: session.user.id },
      select: { teamId: true },
    });
    const followedTeamIds = new Set(followedTeams.map((f) => f.teamId));

    const stories = await prisma.story.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true } },
        team: { select: { id: true, name: true, color: true, icon: true } },
        reactions: {
          select: { id: true, emoji: true, userId: true },
        },
        views: {
          where: { userId: session.user.id },
          select: { id: true },
        },
        _count: { select: { comments: true, views: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = stories.map((story) => {
      // Reaktionen gruppieren
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

      const expiresIn = new Date(story.expiresAt).getTime() - now.getTime();
      const hoursLeft = Math.max(0, Math.floor(expiresIn / (1000 * 60 * 60)));
      const minutesLeft = Math.max(0, Math.floor((expiresIn % (1000 * 60 * 60)) / (1000 * 60)));

      const isSeen = story.views.length > 0;
      const isFollowedTeam = story.teamId ? followedTeamIds.has(story.teamId) : false;

      return {
        id: story.id,
        text: story.text,
        mediaUrl: story.mediaUrl,
        createdBy: story.createdBy,
        team: story.team,
        emojiGroups,
        commentCount: story._count.comments,
        viewCount: story._count.views,
        hoursLeft,
        minutesLeft,
        isSeen,
        isFollowedTeam,
        createdAt: story.createdAt,
        expiresAt: story.expiresAt,
      };
    });

    // Sortierung: Ungesehene gefolgte Teams → Ungesehene andere → Gesehene
    formatted.sort((a, b) => {
      const scoreA = (!a.isSeen ? 2 : 0) + (a.isFollowedTeam ? 1 : 0);
      const scoreB = (!b.isSeen ? 2 : 0) + (b.isFollowedTeam ? 1 : 0);
      if (scoreA !== scoreB) return scoreB - scoreA;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Fehler:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

// POST /api/stories
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const body = await req.json();
    const { text, mediaUrl, teamId } = body as {
      text?: string; mediaUrl?: string; teamId: string;
    };

    if (!teamId) {
      return NextResponse.json({ error: "Team ist erforderlich" }, { status: 400 });
    }

    if (!text && !mediaUrl) {
      return NextResponse.json({ error: "Text oder Bild ist erforderlich" }, { status: 400 });
    }

    const membership = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: session.user.id, teamId } },
    });

    if (!membership) {
      return NextResponse.json({ error: "Du musst Mitglied des Teams sein" }, { status: 403 });
    }

    if (mediaUrl && mediaUrl.length > 7_000_000) {
      return NextResponse.json({ error: "Bild zu groß. Max 5MB." }, { status: 400 });
    }

    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

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
        team: { select: { id: true, name: true, color: true, icon: true } },
      },
    });

    return NextResponse.json(story, { status: 201 });
  } catch (error) {
    console.error("Fehler:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}