import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasCommitteeAccess } from "@/lib/permissions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/polls/[id] - Abstimmung beenden
export async function PATCH(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const { id } = await params;

    const poll = await prisma.poll.findUnique({
      where: { id },
      select: { createdById: true, status: true },
    });

    if (!poll) {
      return NextResponse.json({ error: "Abstimmung nicht gefunden" }, { status: 404 });
    }

    if (poll.status === "CLOSED") {
      return NextResponse.json({ error: "Abstimmung ist bereits beendet" }, { status: 400 });
    }

    // Berechtigung: Admin, Komitee oder Ersteller
    const isCommittee = await hasCommitteeAccess(session.user.id);
    const isCreator = poll.createdById === session.user.id;

    if (!isCommittee && !isCreator) {
      return NextResponse.json(
        { error: "Nur Admins, Komitee oder der Ersteller können Abstimmungen beenden" },
        { status: 403 }
      );
    }

    const updated = await prisma.poll.update({
      where: { id },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Fehler:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

// DELETE /api/polls/[id] - Abstimmung löschen
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const { id } = await params;

    const poll = await prisma.poll.findUnique({
      where: { id },
      select: { createdById: true, status: true },
    });

    if (!poll) {
      return NextResponse.json({ error: "Abstimmung nicht gefunden" }, { status: 404 });
    }

    // Admin/Komitee können jederzeit löschen
    const isCommittee = await hasCommitteeAccess(session.user.id);

    // Ersteller kann nur nach Beendigung löschen
    const isCreator = poll.createdById === session.user.id;

    if (isCommittee) {
      // Admin/Komitee: immer löschen
    } else if (isCreator && poll.status === "CLOSED") {
      // Ersteller: nur wenn beendet
    } else if (isCreator && poll.status === "ACTIVE") {
      return NextResponse.json(
        { error: "Du kannst eine laufende Abstimmung nur beenden, nicht löschen. Beende sie zuerst." },
        { status: 403 }
      );
    } else {
      return NextResponse.json(
        { error: "Keine Berechtigung zum Löschen" },
        { status: 403 }
      );
    }

    await prisma.poll.delete({ where: { id } });

    return NextResponse.json({ message: "Abstimmung gelöscht" });
  } catch (error) {
    console.error("Fehler:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}