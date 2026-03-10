import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { RecurrenceInterval } from "@prisma/client";

// POST /api/tasks/rotate - Wiederkehrende Aufgaben rotieren
export async function POST(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    // Nur Admins
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Nur Admins können die Rotation auslösen" },
        { status: 403 }
      );
    }

    const now = new Date();

    // Alle wiederkehrenden Aufgaben finden, die fällig sind
    const dueTasks = await prisma.task.findMany({
      where: {
        type: "RECURRING",
        assignmentMode: "AUTO",
        nextDueDate: { lte: now },
      },
      include: {
        assignments: {
          orderBy: { assignedAt: "desc" },
          take: 1,
          select: { userId: true },
        },
      },
    });

    let rotatedCount = 0;

    for (const task of dueTasks) {
      const lastAssignedUserId = task.assignments[0]?.userId;

      const nextUsers = await prisma.user.findMany({
        where: {
          role: { not: "ADMIN" },
          ...(lastAssignedUserId
            ? { id: { not: lastAssignedUserId } }
            : {}),
        },
        select: {
          id: true,
          _count: {
            select: {
              assignments: {
                where: {
                  createdAt: {
                    gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
                  },
                },
              },
            },
          },
        },
        orderBy: {
          assignments: { _count: "asc" },
        },
        take: task.isTeamTask ? task.maxAssignees : 1,
      });

      if (nextUsers.length === 0) continue;

      await prisma.taskAssignment.createMany({
        data: nextUsers.map((u) => ({
          taskId: task.id,
          userId: u.id,
          status: "ASSIGNED" as const,
        })),
      });

      const nextDue = calculateNextDueDate(
        task.nextDueDate!,
        task.recurrenceInterval!
      );

      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: "ASSIGNED",
          nextDueDate: nextDue,
        },
      });

      rotatedCount++;
    }

    return NextResponse.json({
      message: `${rotatedCount} Aufgaben rotiert`,
      rotatedCount,
    });
  } catch (error) {
    console.error("Fehler bei der Rotation:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}

function calculateNextDueDate(
  currentDue: Date,
  interval: RecurrenceInterval
): Date {
  const next = new Date(currentDue);

  switch (interval) {
    case "DAILY":
      next.setDate(next.getDate() + 1);
      break;
    case "WEEKLY":
      next.setDate(next.getDate() + 7);
      break;
    case "BIWEEKLY":
      next.setDate(next.getDate() + 14);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + 1);
      break;
  }

  return next;
}