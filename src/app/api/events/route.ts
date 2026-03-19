import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { EventType, EventVisibility } from "@prisma/client";

// GET /api/events - Events abrufen
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month");
    const type = searchParams.get("type") as EventType | null;
    const category = searchParams.get("category");

    const where: {
      startDate?: { gte: Date; lt: Date };
      type?: EventType;
      category?: string | { not: null };
    } = {};

    if (month) {
      const [year, m] = month.split("-").map(Number);
      where.startDate = { gte: new Date(year, m - 1, 1), lt: new Date(year, m, 1) };
    }

    if (type) where.type = type;

    if (category === "CUSTOM") {
      // Alle mit eigener Kategorie (nicht die vorgefertigten)
      where.category = { not: null };
    } else if (category) {
      where.category = category;
    }

    const events = await prisma.event.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true } },
        team: { select: { id: true, name: true, color: true } },
        _count: { select: { attendees: true } },
        attendees: {
          where: { userId: session.user.id },
          select: { id: true },
        },
      },
      orderBy: { startDate: "asc" },
    });

    const formatted = events.map((ev) => ({
      ...ev,
      attendeeCount: ev._count.attendees,
      isRegistered: ev.attendees.length > 0,
      attendees: undefined,
      _count: undefined,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Fehler:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
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
    const {
      title, description, type, category, startDate, endDate, location,
      allDay, isFree, price, registrationRequired, maxAttendees,
      visibility, contactName, contactInfo, teamId,
    } = body as {
      title: string; description?: string; type: string; category?: string;
      startDate: string; endDate?: string; location?: string; allDay?: boolean;
      isFree?: boolean; price?: number; registrationRequired?: boolean;
      maxAttendees?: number; visibility?: string; contactName?: string;
      contactInfo?: string; teamId?: string;
    };

    // Klausuren/Deadlines nur für Admin/Komitee
    if (
      (type === "EXAM" || type === "DEADLINE") &&
      user?.role !== "ADMIN" && user?.role !== "COMMITTEE"
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
        category: category || null,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        location: location || null,
        allDay: allDay === true,
        isFree: isFree !== false,
        price: isFree === false && price ? price : null,
        registrationRequired: registrationRequired === true,
        maxAttendees: maxAttendees || null,
        visibility: (visibility === "TEAM_ONLY" ? "TEAM_ONLY" : "ALL") as EventVisibility,
        contactName: contactName || null,
        contactInfo: contactInfo || null,
        createdById: session.user.id,
        teamId: teamId || null,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error("Fehler:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}