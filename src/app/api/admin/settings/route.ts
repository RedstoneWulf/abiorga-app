import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasCommitteeAccess } from "@/lib/permissions";
import bcrypt from "bcryptjs";

// GET /api/admin/settings - Einstellungen laden
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Nur Admins" }, { status: 403 });
    }

    let settings = await prisma.appSettings.findUnique({
      where: { id: "app-settings" },
    });

    if (!settings) {
      settings = await prisma.appSettings.create({
        data: { id: "app-settings" },
      });
    }

    return NextResponse.json({
      financeGoal: settings.financeGoal,
      maintenanceMode: settings.maintenanceMode,
      hasMaintenancePassword: !!settings.maintenancePassword,
    });
  } catch (error) {
    console.error("Fehler:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

// PATCH /api/admin/settings - Einstellungen ändern
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Nur Admins" }, { status: 403 });
    }

    const body = await req.json();
    const { maintenanceMode, maintenancePassword, financeGoal } = body as {
      maintenanceMode?: boolean;
      maintenancePassword?: string;
      financeGoal?: number;
    };

    const updateData: {
      maintenanceMode?: boolean;
      maintenancePassword?: string | null;
      financeGoal?: number;
    } = {};

    if (maintenanceMode !== undefined) {
      updateData.maintenanceMode = maintenanceMode;
    }

    if (maintenancePassword !== undefined) {
      if (maintenancePassword.length > 0) {
        updateData.maintenancePassword = await bcrypt.hash(maintenancePassword, 10);
      } else {
        updateData.maintenancePassword = null;
      }
    }

    if (financeGoal !== undefined && financeGoal > 0) {
      updateData.financeGoal = financeGoal;
    }

    const settings = await prisma.appSettings.upsert({
      where: { id: "app-settings" },
      update: updateData,
      create: { id: "app-settings", ...updateData },
    });

    return NextResponse.json({
      financeGoal: settings.financeGoal,
      maintenanceMode: settings.maintenanceMode,
      hasMaintenancePassword: !!settings.maintenancePassword,
    });
  } catch (error) {
    console.error("Fehler:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}