import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasCommitteeAccess } from "@/lib/permissions";
import type { NotificationType, NotificationPriority } from "@prisma/client";

// GET /api/notifications - Benachrichtigungen für aktuellen User
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get("unread") === "true";
    const limit = parseInt(searchParams.get("limit") || "50");

    // User-Präferenzen laden
    let prefs = await prisma.notificationPreference.findUnique({
      where: { userId: session.user.id },
    });

    if (!prefs) {
      prefs = await prisma.notificationPreference.create({
        data: { userId: session.user.id },
      });
    }

    // Erlaubte Typen basierend auf Präferenzen
    const allowedTypes: NotificationType[] = ["GLOBAL"]; // GLOBAL immer
    if (prefs.stories) allowedTypes.push("STORY");
    if (prefs.chat) allowedTypes.push("CHAT");
    if (prefs.events) allowedTypes.push("EVENT");
    if (prefs.tasks) allowedTypes.push("TASK");
    if (prefs.polls) allowedTypes.push("POLL");
    if (prefs.transactions) allowedTypes.push("TRANSACTION");

    // Teams des Users (für Team-scoped Notifications)
    const userTeams = await prisma.teamMember.findMany({
      where: { userId: session.user.id },
      select: { teamId: true },
    });
    const teamIds = userTeams.map((t) => t.teamId);

    const notifications = await prisma.notification.findMany({
      where: {
        AND: [
          {
            OR: [
              // HIGH priority: immer anzeigen
              { priority: "HIGH" },
              // Normale: nur erlaubte Typen
              { type: { in: allowedTypes }, priority: "NORMAL" },
            ],
          },
          {
            OR: [
              { scope: "GLOBAL" },
              { scope: "TEAM", teamId: { in: teamIds } },
              // Persönliche (z.B. Transaktion genehmigt)
              { createdById: session.user.id, type: "TRANSACTION" },
            ],
          },
        ],
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        team: { select: { id: true, name: true, color: true } },
        readBy: {
          where: { userId: session.user.id },
          select: { id: true },
        },
      },
      orderBy: [
        { pinned: "desc" },
        { priority: "desc" },
        { createdAt: "desc" },
      ],
      take: limit,
    });

    const formatted = notifications
      .map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        priority: n.priority,
        scope: n.scope,
        pinned: n.pinned,
        createdBy: n.createdBy,
        team: n.team,
        isRead: n.readBy.length > 0,
        createdAt: n.createdAt,
      }))
      .filter((n) => (unreadOnly ? !n.isRead : true));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Fehler beim Laden der Benachrichtigungen:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

// POST /api/notifications - Neue Benachrichtigung erstellen (Admin/Komitee)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const canCreate = await hasCommitteeAccess(session.user.id);
    if (!canCreate) {
      return NextResponse.json(
        { error: "Nur Admins und Komitee können Benachrichtigungen erstellen" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { title, message, priority, pinned, teamId } = body as {
      title: string;
      message: string;
      priority?: string;
      pinned?: boolean;
      teamId?: string;
    };

    if (!title || !message) {
      return NextResponse.json(
        { error: "Titel und Nachricht sind erforderlich" },
        { status: 400 }
      );
    }

    const notification = await prisma.notification.create({
      data: {
        title,
        message,
        type: "GLOBAL",
        priority: (priority === "HIGH" ? "HIGH" : "NORMAL") as NotificationPriority,
        pinned: pinned === true,
        scope: teamId ? "TEAM" : "GLOBAL",
        teamId: teamId || null,
        createdById: session.user.id,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(notification, { status: 201 });
  } catch (error) {
    console.error("Fehler:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}