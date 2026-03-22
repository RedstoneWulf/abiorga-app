import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasCommitteeAccess } from "@/lib/permissions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/teams/[id]
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const { id } = await params;

    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, role: true } } },
          orderBy: [{ isLeader: "desc" }, { user: { name: "asc" } }],
        },
        followers: {
          where: { userId: session.user.id },
          select: { id: true },
        },
        joinRequests: {
          where: { status: "PENDING" },
          include: { user: { select: { id: true, name: true } } },
        },
        _count: { select: { members: true, chatMessages: true, followers: true } },
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Team nicht gefunden" }, { status: 404 });
    }

    const isMember = team.members.some((m) => m.userId === session.user.id);
    const isLeader = team.members.some((m) => m.userId === session.user.id && m.isLeader);
    const isCreator = team.createdById === session.user.id;
    const isAdmin = await hasCommitteeAccess(session.user.id);
    const canManage = isAdmin || isCreator;

    return NextResponse.json({
      ...team,
      isMember,
      isLeader,
      isCreator,
      isAdmin,
      canManage,
      isFollowing: team.followers.length > 0,
      followerCount: team._count.followers,
      // Nur Manager sehen Join-Requests
      joinRequests: canManage ? team.joinRequests : [],
    });
  } catch (error) {
    console.error("Fehler:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

// DELETE /api/teams/[id]
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const { id } = await params;

    const team = await prisma.team.findUnique({
      where: { id },
      select: { createdById: true },
    });

    if (!team) {
      return NextResponse.json({ error: "Team nicht gefunden" }, { status: 404 });
    }

    const isAdmin = await hasCommitteeAccess(session.user.id);
    const isCreator = team.createdById === session.user.id;

    if (!isAdmin && !isCreator) {
      return NextResponse.json({ error: "Nur Admins, Komitee oder der Ersteller können Teams löschen" }, { status: 403 });
    }

    await prisma.team.delete({ where: { id } });
    return NextResponse.json({ message: "Team gelöscht" });
  } catch (error) {
    console.error("Fehler:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}