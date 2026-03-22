import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasCommitteeAccess } from "@/lib/permissions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/teams/[id]/members - Beitreten oder hinzufügen
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const { id: teamId } = await params;
    const body = await req.json();
    const { userId } = body as { userId?: string };

    const targetUserId = userId || session.user.id;
    const isSelfJoin = !userId || userId === session.user.id;
    const isAdmin = await hasCommitteeAccess(session.user.id);

    // Jemand anderen hinzufügen: nur Leader/Admin/Creator
    if (!isSelfJoin) {
      const team = await prisma.team.findUnique({ where: { id: teamId }, select: { createdById: true } });
      const membership = await prisma.teamMember.findUnique({
        where: { userId_teamId: { userId: session.user.id, teamId } },
      });

      if (!membership?.isLeader && !isAdmin && team?.createdById !== session.user.id) {
        return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
      }
    }

    // Bereits Mitglied?
    const existing = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: targetUserId, teamId } },
    });
    if (existing) {
      return NextResponse.json({ error: "Bereits Mitglied" }, { status: 400 });
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { type: true, joinMode: true },
    });

    if (!team) {
      return NextResponse.json({ error: "Team nicht gefunden" }, { status: 404 });
    }

    // Admin/Komitee kann IMMER beitreten
    if (isSelfJoin && !isAdmin) {
      if (team.joinMode === "INVITE_ONLY") {
        return NextResponse.json({ error: "Dieses Team ist nur per Einladung erreichbar" }, { status: 403 });
      }

      if (team.joinMode === "REQUEST") {
        // Prüfen ob bereits Anfrage existiert
        const existingRequest = await prisma.teamJoinRequest.findUnique({
          where: { userId_teamId: { userId: session.user.id, teamId } },
        });
        if (existingRequest) {
          return NextResponse.json({ error: "Deine Anfrage wurde bereits gesendet" }, { status: 400 });
        }

        await prisma.teamJoinRequest.create({
          data: { userId: session.user.id, teamId },
        });

        return NextResponse.json({ message: "Beitrittsanfrage gesendet!", isRequest: true });
      }
    }

    // OPEN oder Admin → direkt beitreten
    await prisma.teamMember.create({ data: { userId: targetUserId, teamId } });

    // Falls eine Anfrage existierte, löschen
    await prisma.teamJoinRequest.deleteMany({
      where: { userId: targetUserId, teamId },
    }).catch(() => {});

    return NextResponse.json({ message: "Beigetreten!" });
  } catch (error) {
    console.error("Fehler:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

// DELETE /api/teams/[id]/members - Verlassen oder entfernen
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const { id: teamId } = await params;
    const { searchParams } = new URL(req.url);
    const removeUserId = searchParams.get("userId") || session.user.id;

    if (removeUserId !== session.user.id) {
      const isAdmin = await hasCommitteeAccess(session.user.id);
      const team = await prisma.team.findUnique({ where: { id: teamId }, select: { createdById: true } });
      const membership = await prisma.teamMember.findUnique({
        where: { userId_teamId: { userId: session.user.id, teamId } },
      });

      if (!membership?.isLeader && !isAdmin && team?.createdById !== session.user.id) {
        return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
      }
    }

    await prisma.teamMember.delete({
      where: { userId_teamId: { userId: removeUserId, teamId } },
    });

    return NextResponse.json({ message: "Mitglied entfernt" });
  } catch (error) {
    console.error("Fehler:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}