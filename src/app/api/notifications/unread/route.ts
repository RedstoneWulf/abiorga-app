import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/notifications/unread - Anzahl ungelesener Benachrichtigungen
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    // Alle Notification-IDs die der User gelesen hat
    const readIds = await prisma.notificationRead.findMany({
      where: { userId: session.user.id },
      select: { notificationId: true },
    });
    const readIdSet = new Set(readIds.map((r) => r.notificationId));

    // Teams des Users
    const userTeams = await prisma.teamMember.findMany({
      where: { userId: session.user.id },
      select: { teamId: true },
    });
    const teamIds = userTeams.map((t) => t.teamId);

    // Alle relevanten Notifications zählen
    const allNotifications = await prisma.notification.findMany({
      where: {
        OR: [
          { scope: "GLOBAL" },
          { scope: "TEAM", teamId: { in: teamIds } },
        ],
      },
      select: { id: true },
    });

    const unreadCount = allNotifications.filter(
      (n) => !readIdSet.has(n.id)
    ).length;

    return NextResponse.json({ unreadCount });
  } catch (error) {
    console.error("Fehler:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

// POST /api/notifications/unread - Markiere Benachrichtigungen als gelesen
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const body = await req.json();
    const { notificationIds } = body as { notificationIds: string[] };

    if (!notificationIds || notificationIds.length === 0) {
      return NextResponse.json({ error: "Keine IDs angegeben" }, { status: 400 });
    }

    // Bereits gelesene ausfiltern
    const existingReads = await prisma.notificationRead.findMany({
      where: {
        userId: session.user.id,
        notificationId: { in: notificationIds },
      },
      select: { notificationId: true },
    });

    const alreadyRead = new Set(existingReads.map((r) => r.notificationId));
    const newIds = notificationIds.filter((id) => !alreadyRead.has(id));

    if (newIds.length > 0) {
      await prisma.notificationRead.createMany({
        data: newIds.map((notificationId) => ({
          notificationId,
          userId: session.user.id,
        })),
      });
    }

    return NextResponse.json({ message: `${newIds.length} als gelesen markiert` });
  } catch (error) {
    console.error("Fehler:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}