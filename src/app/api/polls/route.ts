import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ResultVisibility } from "@prisma/client";

// GET /api/polls - Alle Abstimmungen
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    // Auto-Löschung: Beendete Polls nach 48h löschen
    const deleteThreshold = new Date(Date.now() - 48 * 60 * 60 * 1000);
    await prisma.poll.deleteMany({
      where: {
        status: "CLOSED",
        closedAt: { not: null, lt: deleteThreshold },
      },
    });

    // Auch abgelaufene Polls schließen
    await prisma.poll.updateMany({
      where: {
        status: "ACTIVE",
        endsAt: { not: null, lt: new Date() },
      },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
      },
    });

    const polls = await prisma.poll.findMany({
      include: {
        createdBy: { select: { id: true, name: true } },
        options: {
          include: {
            _count: { select: { votes: true } },
            votes: {
              where: { voterId: session.user.id },
              select: { id: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = polls.map((poll) => {
      const totalVotes = poll.options.reduce((sum, opt) => sum + opt._count.votes, 0);
      const hasVoted = poll.options.some((opt) => opt.votes.length > 0);
      const isClosed = poll.status === "CLOSED";

      // Bestimme ob Ergebnisse angezeigt werden
      let showResults = false;
      if (poll.resultVisibility === "BEFORE_VOTE") {
        showResults = true;
      } else if (poll.resultVisibility === "AFTER_VOTE") {
        showResults = hasVoted || isClosed;
      } else if (poll.resultVisibility === "AFTER_CLOSE") {
        showResults = isClosed;
      }

      return {
        id: poll.id,
        title: poll.title,
        description: poll.description,
        status: poll.status,
        allowMultiple: poll.allowMultiple,
        anonymous: poll.anonymous,
        resultVisibility: poll.resultVisibility,
        endsAt: poll.endsAt,
        closedAt: poll.closedAt,
        createdBy: poll.createdBy,
        createdById: poll.createdById,
        totalVotes,
        hasVoted,
        showResults,
        options: poll.options.map((opt) => ({
          id: opt.id,
          text: opt.text,
          voteCount: showResults ? opt._count.votes : 0,
          hasMyVote: opt.votes.length > 0,
        })),
        createdAt: poll.createdAt,
      };
    });

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Fehler:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

// POST /api/polls - Neue Abstimmung erstellen
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const body = await req.json();
    const { title, description, options, allowMultiple, anonymous, endsAt, resultVisibility } = body as {
      title: string;
      description?: string;
      options: string[];
      allowMultiple?: boolean;
      anonymous?: boolean;
      endsAt?: string;
      resultVisibility?: string;
    };

    if (!title || !options || options.length < 2) {
      return NextResponse.json({ error: "Titel und mindestens 2 Optionen sind erforderlich" }, { status: 400 });
    }

    if (options.length > 10) {
      return NextResponse.json({ error: "Maximal 10 Optionen erlaubt" }, { status: 400 });
    }

    const validVisibility: ResultVisibility =
      resultVisibility === "BEFORE_VOTE" ? "BEFORE_VOTE" :
      resultVisibility === "AFTER_CLOSE" ? "AFTER_CLOSE" : "AFTER_VOTE";

    const poll = await prisma.poll.create({
      data: {
        title,
        description: description && description.length > 0 ? description : null,
        allowMultiple: allowMultiple === true,
        anonymous: anonymous === true,
        resultVisibility: validVisibility,
        endsAt: endsAt ? new Date(endsAt) : null,
        createdById: session.user.id,
        options: {
          create: options.map((text: string) => ({ text })),
        },
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        options: true,
      },
    });

    return NextResponse.json(poll, { status: 201 });
  } catch (error) {
    console.error("Fehler:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}