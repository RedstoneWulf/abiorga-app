import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/feedback - Bug-Meldung oder Verbesserungsvorschlag
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const body = await req.json();
    const { type, title, description } = body as {
      type: "BUG" | "FEATURE" | "OTHER";
      title: string;
      description: string;
    };

    if (!type || !title || !description) {
      return NextResponse.json(
        { error: "Typ, Titel und Beschreibung sind erforderlich" },
        { status: 400 }
      );
    }

    // Feedback als Notification für Admins speichern
    await prisma.notification.create({
      data: {
        title: `[${type === "BUG" ? "Bug" : type === "FEATURE" ? "Vorschlag" : "Feedback"}] ${title}`,
        message: `Von ${session.user.name}: ${description}`,
        scope: "GLOBAL",
        pinned: type === "BUG",
        createdById: session.user.id,
      },
    });

    return NextResponse.json(
      { message: "Feedback erfolgreich gesendet. Danke!" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Fehler beim Feedback senden:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}