import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { TaskStatus } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/tasks/[id]/assign - User(s) zuweisen
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const { id: taskId } = await params;

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (
      !currentUser ||
      (currentUser.role !== "ADMIN" && currentUser.role !== "COMMITTEE")
    ) {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { userIds } = body as { userIds: string[] };

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: "Mindestens ein User muss ausgewählt werden" },
        { status: 400 }
      );
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignments: { select: { userId: true } },
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: "Aufgabe nicht gefunden" },
        { status: 404 }
      );
    }

    const existingUserIds = task.assignments.map((a) => a.userId);
    const newUserIds = userIds.filter(
      (uid: string) => !existingUserIds.includes(uid)
    );

    if (newUserIds.length === 0) {
      return NextResponse.json(
        { error: "Alle User sind bereits zugewiesen" },
        { status: 400 }
      );
    }

    await prisma.taskAssignment.createMany({
      data: newUserIds.map((userId: string) => ({
        taskId,
        userId,
        status: "ASSIGNED" as const,
      })),
    });

    if (task.status === "OPEN") {
      await prisma.task.update({
        where: { id: taskId },
        data: { status: "ASSIGNED" },
      });
    }

    return NextResponse.json({ message: `${newUserIds.length} User zugewiesen` });
  } catch (error) {
    console.error("Fehler bei der Zuweisung:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}

// PATCH /api/tasks/[id]/assign - Status ändern
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const { id: taskId } = await params;
    const body = await req.json();
    const { status } = body as { status: TaskStatus };

    const assignment = await prisma.taskAssignment.findFirst({
      where: {
        taskId,
        userId: session.user.id,
      },
      orderBy: { assignedAt: "desc" },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: "Du bist dieser Aufgabe nicht zugewiesen" },
        { status: 403 }
      );
    }

    const validTransitions: Record<string, TaskStatus[]> = {
      ASSIGNED: ["IN_PROGRESS"],
      IN_PROGRESS: ["COMPLETED"],
    };

    const allowed = validTransitions[assignment.status];
    if (!allowed || !allowed.includes(status)) {
      return NextResponse.json(
        {
          error: `Ungültiger Status-Wechsel: ${assignment.status} → ${status}`,
        },
        { status: 400 }
      );
    }

    const updateData: { status: TaskStatus; completedAt?: Date } = { status };
    if (status === "COMPLETED") {
      updateData.completedAt = new Date();
    }

    await prisma.taskAssignment.update({
      where: { id: assignment.id },
      data: updateData,
    });

    if (status === "COMPLETED") {
      const allAssignments = await prisma.taskAssignment.findMany({
        where: { taskId },
      });
      const allCompleted = allAssignments.every(
        (a) => a.status === "COMPLETED" || a.status === "VERIFIED"
      );
      if (allCompleted) {
        await prisma.task.update({
          where: { id: taskId },
          data: { status: "COMPLETED" },
        });
      }
    }

    return NextResponse.json({ message: "Status aktualisiert" });
  } catch (error) {
    console.error("Fehler beim Status-Update:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}