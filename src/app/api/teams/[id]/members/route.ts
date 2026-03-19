import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/teams/[id]/members - Team beitreten oder Mitglied hinzufügen
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const { id: teamId } = await params;
    const body = await req.json();
    const { userId } = body as { userId?: string };

    // Wenn userId angegeben: jemand anderen hinzufügen (nur Leader/Admin)
    const targetUserId = userId || session.user.id;

    if (userId && userId !== session.user.id) {
      const membership = await prisma.teamMember.findUnique({
        where: { userId_teamId: { userId: session.user.id, teamId } },
      });
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      });

      if (!membership?.isLeader && user?.role !== "ADMIN") {
        return NextResponse.json(
          { error: "Nur Teamleiter können Mitglieder hinzufügen" },
          { status: 403 }
        );
      }
    }

    // Prüfen ob bereits Mitglied
    const existing = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: targetUserId, teamId } },
    });

    if (existing) {
      return NextResponse.json({ error: "Bereits Mitglied" }, { status: 400 });
    }

    // Spezielle Teams: nur mit Einladung (Leader/Admin)
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { type: true },
    });

    if (
      (team?.type === "COMMITTEE" || team?.type === "FINANCE") &&
      !userId // Selbst beitreten
    ) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      });
      if (user?.role !== "ADMIN") {
        return NextResponse.json(
          { error: "Spezielle Teams erfordern eine Einladung vom Teamleiter" },
          { status: 403 }
        );
      }
    }

    await prisma.teamMember.create({
      data: { userId: targetUserId, teamId },
    });

    return NextResponse.json({ message: "Beigetreten!" });
  } catch (error) {
    console.error("Fehler:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

// DELETE /api/teams/[id]/members - Team verlassen oder Mitglied entfernen
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const { id: teamId } = await params;
    const { searchParams } = new URL(req.url);
    const removeUserId = searchParams.get("userId") || session.user.id;

    // Jemand anderen entfernen: nur Leader/Admin
    if (removeUserId !== session.user.id) {
      const membership = await prisma.teamMember.findUnique({
        where: { userId_teamId: { userId: session.user.id, teamId } },
      });
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      });

      if (!membership?.isLeader && user?.role !== "ADMIN") {
        return NextResponse.json(
          { error: "Nur Teamleiter können Mitglieder entfernen" },
          { status: 403 }
        );
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