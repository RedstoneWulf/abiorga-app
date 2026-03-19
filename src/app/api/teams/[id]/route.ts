import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/teams/[id] - Team-Details mit Mitgliedern
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
          include: {
            user: { select: { id: true, name: true, role: true } },
          },
          orderBy: [{ isLeader: "desc" }, { user: { name: "asc" } }],
        },
        _count: { select: { members: true, chatMessages: true } },
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Team nicht gefunden" }, { status: 404 });
    }

    const isMember = team.members.some((m) => m.userId === session.user.id);
    const isLeader = team.members.some(
      (m) => m.userId === session.user.id && m.isLeader
    );

    return NextResponse.json({
      ...team,
      isMember,
      isLeader,
    });
  } catch (error) {
    console.error("Fehler:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

// DELETE /api/teams/[id] - Team löschen (nur Leader oder Admin)
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    const membership = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: session.user.id, teamId: id } },
    });

    if (user?.role !== "ADMIN" && !membership?.isLeader) {
      return NextResponse.json(
        { error: "Nur Teamleiter oder Admins können Teams löschen" },
        { status: 403 }
      );
    }

    await prisma.team.delete({ where: { id } });

    return NextResponse.json({ message: "Team gelöscht" });
  } catch (error) {
    console.error("Fehler:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}