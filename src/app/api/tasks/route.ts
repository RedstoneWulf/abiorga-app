import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { TaskStatus, TaskType } from "@prisma/client";

// GET /api/tasks - Alle Aufgaben abrufen
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as TaskStatus | null;
    const type = searchParams.get("type") as TaskType | null;
    const myTasks = searchParams.get("myTasks") === "true";

    const where: {
      status?: TaskStatus;
      type?: TaskType;
      assignments?: { some: { userId: string } };
    } = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (myTasks) {
      where.assignments = {
        some: { userId: session.user.id },
      };
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        createdBy: {
          select: { id: true, name: true },
        },
        assignments: {
          include: {
            user: { select: { id: true, name: true } },
            ratings: {
              select: { score: true },
            },
          },
        },
      },
      orderBy: [
        { priority: "desc" },
        { createdAt: "desc" },
      ],
    });

    const tasksWithAvgRating = tasks.map((task) => {
      const allRatings = task.assignments.flatMap((a) =>
        a.ratings.map((r) => r.score)
      );
      const avgRating =
        allRatings.length > 0
          ? allRatings.reduce((sum, s) => sum + s, 0) / allRatings.length
          : null;

      return { ...task, avgRating };
    });

    return NextResponse.json(tasksWithAvgRating);
  } catch (error) {
    console.error("Fehler beim Laden der Aufgaben:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}

// POST /api/tasks - Neue Aufgabe erstellen
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!user || (user.role !== "ADMIN" && user.role !== "COMMITTEE")) {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      title,
      description,
      type,
      assignmentMode,
      isTeamTask,
      maxAssignees,
      recurrenceInterval,
      dueDate,
      priority,
    } = body;

    if (!title || !type) {
      return NextResponse.json(
        { error: "Titel und Typ sind erforderlich" },
        { status: 400 }
      );
    }

    const task = await prisma.task.create({
      data: {
        title,
        description: description || null,
        type,
        assignmentMode: assignmentMode || "MANUAL",
        isTeamTask: isTeamTask || false,
        maxAssignees: maxAssignees || 1,
        recurrenceInterval:
          type === "RECURRING" ? recurrenceInterval : null,
        nextDueDate:
          type === "RECURRING" && dueDate ? new Date(dueDate) : null,
        dueDate: type === "ONE_TIME" && dueDate ? new Date(dueDate) : null,
        priority: priority || 3,
        createdById: session.user.id,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    if (assignmentMode === "AUTO") {
      await autoAssignTask(task.id, isTeamTask ? maxAssignees : 1);
    }

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("Fehler beim Erstellen der Aufgabe:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}

async function autoAssignTask(taskId: string, count: number) {
  const users = await prisma.user.findMany({
    where: {
      role: { not: "ADMIN" },
    },
    select: {
      id: true,
      _count: {
        select: {
          assignments: {
            where: {
              status: { in: ["ASSIGNED", "IN_PROGRESS"] },
            },
          },
        },
      },
    },
    orderBy: {
      assignments: {
        _count: "asc",
      },
    },
    take: count,
  });

  if (users.length === 0) return;

  const assignments = users.map((u) => ({
    taskId,
    userId: u.id,
    status: "ASSIGNED" as const,
  }));

  await prisma.taskAssignment.createMany({
    data: assignments,
  });

  await prisma.task.update({
    where: { id: taskId },
    data: { status: "ASSIGNED" },
  });
}