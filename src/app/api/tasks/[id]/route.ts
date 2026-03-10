import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { TaskStatus, AssignmentMode } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/tasks/[id]
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const { id } = await params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
        assignments: {
          include: {
            user: { select: { id: true, name: true } },
            ratings: {
              include: {
                rater: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { assignedAt: "desc" },
        },
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: "Aufgabe nicht gefunden" },
        { status: 404 }
      );
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error("Fehler beim Laden der Aufgabe:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}

// PATCH /api/tasks/[id]
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const { id } = await params;

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
      status,
      priority,
      dueDate,
      nextDueDate,
      assignmentMode,
    } = body;

    const updateData: {
      title?: string;
      description?: string | null;
      status?: TaskStatus;
      priority?: number;
      dueDate?: Date | null;
      nextDueDate?: Date | null;
      assignmentMode?: AssignmentMode;
    } = {};

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (dueDate !== undefined)
      updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (nextDueDate !== undefined)
      updateData.nextDueDate = nextDueDate ? new Date(nextDueDate) : null;
    if (assignmentMode !== undefined)
      updateData.assignmentMode = assignmentMode;

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        createdBy: { select: { id: true, name: true } },
        assignments: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
    });

    return NextResponse.json(task);
  } catch (error) {
    console.error("Fehler beim Aktualisieren der Aufgabe:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/[id]
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Nur Admins können Aufgaben löschen" },
        { status: 403 }
      );
    }

    await prisma.task.delete({ where: { id } });

    return NextResponse.json({ message: "Aufgabe gelöscht" });
  } catch (error) {
    console.error("Fehler beim Löschen der Aufgabe:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}