import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isTeamMember } from "@/lib/permissions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/teams/[id]/chat - Chat-Nachrichten laden
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const { id: teamId } = await params;

    // Nur Mitglieder können den Chat sehen
    const isMember = await isTeamMember(session.user.id, teamId);
    if (!isMember) {
      return NextResponse.json(
        { error: "Nur Teammitglieder können den Chat sehen" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get("cursor");
    const limit = 50;

    const messages = await prisma.chatMessage.findMany({
      where: { teamId },
      include: {
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      ...(cursor
        ? {
            skip: 1,
            cursor: { id: cursor },
          }
        : {}),
    });

    return NextResponse.json({
      messages: messages.reverse(),
      hasMore: messages.length === limit,
      nextCursor: messages.length > 0 ? messages[0].id : null,
    });
  } catch (error) {
    console.error("Fehler beim Laden des Chats:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

// POST /api/teams/[id]/chat - Nachricht senden
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const { id: teamId } = await params;

    const isMember = await isTeamMember(session.user.id, teamId);
    if (!isMember) {
      return NextResponse.json(
        { error: "Nur Teammitglieder können Nachrichten senden" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { content } = body as { content: string };

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: "Nachricht darf nicht leer sein" }, { status: 400 });
    }

    if (content.length > 2000) {
      return NextResponse.json({ error: "Maximal 2000 Zeichen" }, { status: 400 });
    }

    const message = await prisma.chatMessage.create({
      data: {
        content: content.trim(),
        teamId,
        userId: session.user.id,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error("Fehler beim Senden:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}