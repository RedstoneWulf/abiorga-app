import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/events/[id]/register - Anmelden
export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const { id: eventId } = await params;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { _count: { select: { attendees: true } } },
    });

    if (!event) {
      return NextResponse.json({ error: "Event nicht gefunden" }, { status: 404 });
    }

    if (!event.registrationRequired) {
      return NextResponse.json({ error: "Keine Anmeldung erforderlich" }, { status: 400 });
    }

    if (event.maxAttendees && event._count.attendees >= event.maxAttendees) {
      return NextResponse.json({ error: "Event ist voll" }, { status: 400 });
    }

    // Prüfen ob bereits angemeldet
    const existing = await prisma.eventAttendee.findUnique({
      where: { eventId_userId: { eventId, userId: session.user.id } },
    });

    if (existing) {
      return NextResponse.json({ error: "Bereits angemeldet" }, { status: 400 });
    }

    await prisma.eventAttendee.create({
      data: { eventId, userId: session.user.id },
    });

    return NextResponse.json({ message: "Angemeldet!" });
  } catch (error) {
    console.error("Fehler:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

// DELETE /api/events/[id]/register - Abmelden
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const { id: eventId } = await params;

    await prisma.eventAttendee.delete({
      where: { eventId_userId: { eventId, userId: session.user.id } },
    });

    return NextResponse.json({ message: "Abgemeldet" });
  } catch (error) {
    console.error("Fehler:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}