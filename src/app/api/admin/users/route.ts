import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/users - Alle User mit Details
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (currentUser?.role !== "ADMIN") {
      return NextResponse.json({ error: "Nur Admins" }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            createdTasks: true,
            assignments: true,
            createdEvents: true,
            createdPolls: true,
            votes: true,
            teamMemberships: true,
          },
        },
        teamMemberships: {
          select: {
            team: { select: { id: true, name: true, type: true } },
            isLeader: true,
          },
        },
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("Fehler:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

// POST /api/admin/users - Neuen User erstellen
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (currentUser?.role !== "ADMIN") {
      return NextResponse.json({ error: "Nur Admins" }, { status: 403 });
    }

    const body = await req.json();
    const { email, name, password, role } = body as {
      email: string;
      name: string;
      password: string;
      role?: string;
    };

    if (!email || !name || !password) {
      return NextResponse.json(
        { error: "E-Mail, Name und Passwort sind erforderlich" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Passwort muss mindestens 6 Zeichen lang sein" },
        { status: 400 }
      );
    }

    // Prüfen ob E-Mail bereits existiert
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Ein User mit dieser E-Mail existiert bereits" },
        { status: 400 }
      );
    }

    const bcrypt = await import("bcryptjs");
    const hashedPassword = await bcrypt.hash(password, 10);

    const validRoles = ["ADMIN", "COMMITTEE", "TEAM_LEADER", "MEMBER"];
    const userRole = role && validRoles.includes(role) ? role : "MEMBER";

    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role: userRole as "ADMIN" | "COMMITTEE" | "TEAM_LEADER" | "MEMBER",
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error("Fehler:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}