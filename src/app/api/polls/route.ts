import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/polls - Alle Abstimmungen
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

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
        _count: { select: { options: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Formatieren: hat der User schon abgestimmt?
    const formatted = polls.map((poll) => {
      const totalVotes = poll.options.reduce(
        (sum, opt) => sum + opt._count.votes,
        0
      );
      const hasVoted = poll.options.some((opt) => opt.votes.length > 0);

      return {
        ...poll,
        totalVotes,
        hasVoted,
        options: poll.options.map((opt) => ({
          id: opt.id,
          text: opt.text,
          voteCount: opt._count.votes,
          hasMyVote: opt.votes.length > 0,
        })),
      };
    });

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Fehler beim Laden der Abstimmungen:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
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
    const { title, description, options, allowMultiple, anonymous, endsAt } =
      body as {
        title: string;
        description?: string;
        options: string[];
        allowMultiple?: boolean;
        anonymous?: boolean;
        endsAt?: string;
      };

    if (!title || !options || options.length < 2) {
      return NextResponse.json(
        { error: "Titel und mindestens 2 Optionen sind erforderlich" },
        { status: 400 }
      );
    }

    if (options.length > 10) {
      return NextResponse.json(
        { error: "Maximal 10 Optionen erlaubt" },
        { status: 400 }
      );
    }

    const poll = await prisma.poll.create({
      data: {
        title,
        description: description || null,
        allowMultiple: allowMultiple || false,
        anonymous: anonymous || false,
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
    console.error("Fehler beim Erstellen der Abstimmung:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}