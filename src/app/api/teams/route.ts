import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasCommitteeAccess } from "@/lib/permissions";

// GET /api/teams
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const teams = await prisma.team.findMany({
      include: {
        _count: { select: { members: true, followers: true } },
        members: {
          where: { userId: session.user.id },
          select: { id: true, isLeader: true },
        },
        followers: {
          where: { userId: session.user.id },
          select: { id: true },
        },
      },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });

    const formatted = teams.map((team) => ({
      id: team.id,
      name: team.name,
      description: team.description,
      color: team.color,
      icon: team.icon,
      type: team.type,
      joinMode: team.joinMode,
      createdById: team.createdById,
      memberCount: team._count.members,
      followerCount: team._count.followers,
      isMember: team.members.length > 0,
      isLeader: team.members[0]?.isLeader || false,
      isFollowing: team.followers.length > 0,
      createdAt: team.createdAt,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Fehler:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

// POST /api/teams
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, color, icon, type, joinMode } = body as {
      name: string; description?: string; color?: string; icon?: string;
      type?: string; joinMode?: string;
    };

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: "Teamname ist erforderlich" }, { status: 400 });
    }

    // Spezielle Teams: nur Admin/Komitee
    if (type === "COMMITTEE" || type === "FINANCE") {
      const canCreate = await hasCommitteeAccess(session.user.id);
      if (!canCreate) {
        return NextResponse.json({ error: "Nur Admins und Komitee können spezielle Teams erstellen" }, { status: 403 });
      }

      // Einzigartigkeits-Check: nur ein Komitee und ein Finanz-Team
      const existingSpecial = await prisma.team.findFirst({
        where: { type: type as "COMMITTEE" | "FINANCE" },
      });
      if (existingSpecial) {
        return NextResponse.json({
          error: `Es existiert bereits ein ${type === "COMMITTEE" ? "Komitee" : "Finanz"}-Team: "${existingSpecial.name}"`,
        }, { status: 400 });
      }
    }

    // Name-Check
    const existing = await prisma.team.findUnique({ where: { name: name.trim() } });
    if (existing) {
      return NextResponse.json({ error: "Ein Team mit diesem Namen existiert bereits" }, { status: 400 });
    }

    // Spezielle Teams sind immer INVITE_ONLY
    const finalJoinMode = (type === "COMMITTEE" || type === "FINANCE")
      ? "INVITE_ONLY"
      : (joinMode === "REQUEST" ? "REQUEST" : joinMode === "INVITE_ONLY" ? "INVITE_ONLY" : "OPEN");

    const team = await prisma.team.create({
      data: {
        name: name.trim(),
        description: description && description.trim().length > 0 ? description.trim() : null,
        color: color || "#4472C4",
        icon: icon && icon.trim().length > 0 ? icon.trim() : null,
        type: (type === "COMMITTEE" || type === "FINANCE") ? type : "CUSTOM",
        joinMode: finalJoinMode as "OPEN" | "REQUEST" | "INVITE_ONLY",
        createdById: session.user.id,
        members: {
          create: { userId: session.user.id, isLeader: true },
        },
      },
    });

    return NextResponse.json(team, { status: 201 });
  } catch (error) {
    console.error("Fehler:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}