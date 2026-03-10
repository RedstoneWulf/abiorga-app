import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/tasks/[id]/rate - Bewertung abgeben
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const { id: taskId } = await params;
    const body = await req.json();
    const { assignmentId, score, comment } = body;

    // Validierung
    if (!assignmentId || !score || score < 1 || score > 5) {
      return NextResponse.json(
        { error: "Bewertung muss zwischen 1 und 5 sein" },
        { status: 400 }
      );
    }

    // Prüfen ob die Zuweisung existiert und zur Aufgabe gehört
    const assignment = await prisma.taskAssignment.findFirst({
      where: {
        id: assignmentId,
        taskId,
        status: { in: ["COMPLETED", "VERIFIED"] },
      },
    });

    if (!assignment) {
      return NextResponse.json(
        {
          error:
            "Zuweisung nicht gefunden oder Aufgabe noch nicht abgeschlossen",
        },
        { status: 404 }
      );
    }

    // Sich selbst bewerten ist nicht erlaubt
    if (assignment.userId === session.user.id) {
      return NextResponse.json(
        { error: "Du kannst dich nicht selbst bewerten" },
        { status: 400 }
      );
    }

    // Prüfen ob bereits bewertet
    const existingRating = await prisma.taskRating.findUnique({
      where: {
        assignmentId_raterId: {
          assignmentId,
          raterId: session.user.id,
        },
      },
    });

    if (existingRating) {
      return NextResponse.json(
        { error: "Du hast diese Aufgabe bereits bewertet" },
        { status: 400 }
      );
    }

    // Bewertung erstellen
    const rating = await prisma.taskRating.create({
      data: {
        assignmentId,
        raterId: session.user.id,
        score,
        comment: comment || null,
      },
      include: {
        rater: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(rating, { status: 201 });
  } catch (error) {
    console.error("Fehler bei der Bewertung:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}

// GET /api/tasks/[id]/rate - Bewertungen für eine Aufgabe abrufen
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const { id: taskId } = await params;

    const assignments = await prisma.taskAssignment.findMany({
      where: { taskId },
      include: {
        user: { select: { id: true, name: true } },
        ratings: {
          include: {
            rater: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Pro Zuweisung den Durchschnitt berechnen
    const results = assignments.map((assignment) => {
      const scores = assignment.ratings.map((r) => r.score);
      const avgScore =
        scores.length > 0
          ? scores.reduce((sum, s) => sum + s, 0) / scores.length
          : null;

      return {
        assignmentId: assignment.id,
        user: assignment.user,
        status: assignment.status,
        avgScore,
        ratingCount: scores.length,
        ratings: assignment.ratings,
      };
    });

    return NextResponse.json(results);
  } catch (error) {
    console.error("Fehler beim Laden der Bewertungen:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}