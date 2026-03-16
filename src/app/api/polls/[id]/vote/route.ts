import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/polls/[id]/vote - Abstimmen
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const { id: pollId } = await params;
    const body = await req.json();
    const { optionIds } = body as { optionIds: string[] };

    if (!optionIds || optionIds.length === 0) {
      return NextResponse.json(
        { error: "Mindestens eine Option auswählen" },
        { status: 400 }
      );
    }

    // Poll prüfen
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: {
        options: { select: { id: true } },
      },
    });

    if (!poll) {
      return NextResponse.json(
        { error: "Abstimmung nicht gefunden" },
        { status: 404 }
      );
    }

    if (poll.status === "CLOSED") {
      return NextResponse.json(
        { error: "Diese Abstimmung ist beendet" },
        { status: 400 }
      );
    }

    if (poll.endsAt && new Date(poll.endsAt) < new Date()) {
      return NextResponse.json(
        { error: "Diese Abstimmung ist abgelaufen" },
        { status: 400 }
      );
    }

    if (!poll.allowMultiple && optionIds.length > 1) {
      return NextResponse.json(
        { error: "Bei dieser Abstimmung ist nur eine Stimme erlaubt" },
        { status: 400 }
      );
    }

    // Prüfen ob Optionen gültig sind
    const validOptionIds = poll.options.map((o) => o.id);
    const invalidOptions = optionIds.filter(
      (id: string) => !validOptionIds.includes(id)
    );
    if (invalidOptions.length > 0) {
      return NextResponse.json(
        { error: "Ungültige Option(en)" },
        { status: 400 }
      );
    }

    // Alte Stimmen des Users entfernen
    await prisma.vote.deleteMany({
      where: {
        voterId: session.user.id,
        option: { pollId },
      },
    });

    // Neue Stimmen abgeben
    await prisma.vote.createMany({
      data: optionIds.map((optionId: string) => ({
        optionId,
        voterId: session.user.id,
      })),
    });

    return NextResponse.json({ message: "Stimme abgegeben!" });
  } catch (error) {
    console.error("Fehler beim Abstimmen:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}

// DELETE /api/polls/[id]/vote - Stimme zurückziehen
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const { id: pollId } = await params;

    await prisma.vote.deleteMany({
      where: {
        voterId: session.user.id,
        option: { pollId },
      },
    });

    return NextResponse.json({ message: "Stimme zurückgezogen" });
  } catch (error) {
    console.error("Fehler:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}