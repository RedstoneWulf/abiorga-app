import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/admin/users/[id] - User bearbeiten (Rolle, Passwort-Reset)
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (currentUser?.role !== "ADMIN") {
      return NextResponse.json({ error: "Nur Admins" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { role, newPassword } = body as {
      role?: string;
      newPassword?: string;
    };

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User nicht gefunden" }, { status: 404 });
    }

    // Kann sich nicht selbst degradieren
    if (targetUser.id === session.user.id && role && role !== "ADMIN") {
      return NextResponse.json(
        { error: "Du kannst deine eigene Admin-Rolle nicht entfernen" },
        { status: 400 }
      );
    }

    const updateData: { role?: "ADMIN" | "COMMITTEE" | "TEAM_LEADER" | "MEMBER"; password?: string } = {};

    if (role) {
      const validRoles = ["ADMIN", "COMMITTEE", "TEAM_LEADER", "MEMBER"];
      if (validRoles.includes(role)) {
        updateData.role = role as "ADMIN" | "COMMITTEE" | "TEAM_LEADER" | "MEMBER";
      }
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        return NextResponse.json(
          { error: "Passwort muss mindestens 6 Zeichen lang sein" },
          { status: 400 }
        );
      }
      const bcrypt = await import("bcryptjs");
      updateData.password = await bcrypt.hash(newPassword, 10);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, email: true, name: true, role: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Fehler:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

// DELETE /api/admin/users/[id] - User löschen
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (currentUser?.role !== "ADMIN") {
      return NextResponse.json({ error: "Nur Admins" }, { status: 403 });
    }

    const { id } = await params;

    if (id === session.user.id) {
      return NextResponse.json(
        { error: "Du kannst dich nicht selbst löschen" },
        { status: 400 }
      );
    }

    // Alle verbundenen Daten werden durch Prisma-Kaskade gelöscht
    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ message: "User gelöscht" });
  } catch (error) {
    console.error("Fehler:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}