import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/notifications/preferences - Benachrichtigungs-Einstellungen laden
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    let prefs = await prisma.notificationPreference.findUnique({
      where: { userId: session.user.id },
    });

    if (!prefs) {
      prefs = await prisma.notificationPreference.create({
        data: { userId: session.user.id },
      });
    }

    return NextResponse.json({
      stories: prefs.stories,
      chat: prefs.chat,
      events: prefs.events,
      tasks: prefs.tasks,
      polls: prefs.polls,
      transactions: prefs.transactions,
      global: prefs.global,
    });
  } catch (error) {
    console.error("Fehler:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

// PATCH /api/notifications/preferences - Einstellungen aktualisieren
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const body = await req.json();
    const { stories, chat, events, tasks, polls, transactions, global } = body as {
      stories?: boolean;
      chat?: boolean;
      events?: boolean;
      tasks?: boolean;
      polls?: boolean;
      transactions?: boolean;
      global?: boolean;
    };

    const updateData: Record<string, boolean> = {};
    if (stories !== undefined) updateData.stories = stories;
    if (chat !== undefined) updateData.chat = chat;
    if (events !== undefined) updateData.events = events;
    if (tasks !== undefined) updateData.tasks = tasks;
    if (polls !== undefined) updateData.polls = polls;
    if (transactions !== undefined) updateData.transactions = transactions;
    if (global !== undefined) updateData.global = global;

    const prefs = await prisma.notificationPreference.upsert({
      where: { userId: session.user.id },
      update: updateData,
      create: { userId: session.user.id, ...updateData },
    });

    return NextResponse.json({
      stories: prefs.stories,
      chat: prefs.chat,
      events: prefs.events,
      tasks: prefs.tasks,
      polls: prefs.polls,
      transactions: prefs.transactions,
      global: prefs.global,
    });
  } catch (error) {
    console.error("Fehler:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}