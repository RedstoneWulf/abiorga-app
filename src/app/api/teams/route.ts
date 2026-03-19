import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasCommitteeAccess } from "@/lib/permissions";

// GET /api/teams - Alle Teams abrufen
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const teams = await prisma.team.findMany({
      include: {
        _count: { select: { members: true } },
        members: {
          where: { userId: session.user.id },
          select: { id: true, isLeader: true },
        },
      },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });

    const formatted = teams.map((team) => ({
      id: team.id,
      name: team.name,
      description: team.description,
      color: team.color,
      type: team.type,
      memberCount: team._count.members,
      isMember: team.members.length > 0,
      isLeader: team.members[0]?.isLeader || false,
      createdAt: team.createdAt,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Fehler beim Laden der Teams:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

// POST /api/teams - Neues Team erstellen
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, color, type } = body as {
      name: string;
      description?: string;
      color?: string;
      type?: string;
    };

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: "Teamname ist erforderlich" }, { status: 400 });
    }

    // Spezielle Team-Typen nur von Admins/Komitee
    if (type === "COMMITTEE" || type === "FINANCE") {
      const canCreate = await hasCommitteeAccess(session.user.id);
      if (!canCreate) {
        return NextResponse.json(
          { error: "Nur Admins und Komitee können spezielle Teams erstellen" },
          { status: 403 }
        );
      }
    }

    // Prüfen ob Name schon existiert
    const existing = await prisma.team.findUnique({
      where: { name: name.trim() },
    });
    if (existing) {
      return NextResponse.json({ error: "Ein Team mit diesem Namen existiert bereits" }, { status: 400 });
    }

    const team = await prisma.team.create({
      data: {
        name: name.trim(),
        description: description && description.trim().length > 0 ? description.trim() : null,
        color: color || "#4472C4",
        type: (type === "COMMITTEE" || type === "FINANCE") ? type : "CUSTOM",
        members: {
          create: {
            userId: session.user.id,
            isLeader: true,
          },
        },
      },
    });

    return NextResponse.json(team, { status: 201 });
  } catch (error) {
    console.error("Fehler beim Erstellen des Teams:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}