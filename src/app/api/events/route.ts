import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { EventType } from "@prisma/client";

// GET /api/events - Events abrufen (mit optionalem Monat-Filter)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month"); // Format: "2026-03"
    const type = searchParams.get("type") as EventType | null;

    const where: {
      startDate?: { gte: Date; lt: Date };
      type?: EventType;
    } = {};

    if (month) {
      const [year, m] = month.split("-").map(Number);
      const start = new Date(year, m - 1, 1);
      const end = new Date(year, m, 1);
      where.startDate = { gte: start, lt: end };
    }

    if (type) {
      where.type = type;
    }

    const events = await prisma.event.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
      },
      orderBy: { startDate: "asc" },
    });

    return NextResponse.json(events);
  } catch (error) {
    console.error("Fehler beim Laden der Events:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}

// POST /api/events - Neues Event erstellen
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    const body = await req.json();
    const { title, description, type, startDate, endDate, location, allDay } =
      body as {
        title: string;
        description?: string;
        type: string;
        startDate: string;
        endDate?: string;
        location?: string;
        allDay?: boolean;
      };

    // Nur Admin/Committee dürfen Klausuren und Deadlines erstellen
    if (
      (type === "EXAM" || type === "DEADLINE") &&
      user?.role !== "ADMIN" &&
      user?.role !== "COMMITTEE"
    ) {
      return NextResponse.json(
        { error: "Nur Admins und Komitee können Klausuren und Fristen erstellen" },
        { status: 403 }
      );
    }

    if (!title || !type || !startDate) {
      return NextResponse.json(
        { error: "Titel, Typ und Startdatum sind erforderlich" },
        { status: 400 }
      );
    }

    const event = await prisma.event.create({
      data: {
        title,
        description: description || null,
        type: type as EventType,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        location: location || null,
        allDay: allDay === true,
        createdById: session.user.id,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error("Fehler beim Erstellen des Events:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}