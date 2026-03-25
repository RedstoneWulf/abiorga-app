import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// GET /api/admin/maintenance - Prüfe ob Wartungsmodus aktiv
export async function GET(_req: NextRequest) {
  try {
    const settings = await prisma.appSettings.findUnique({
      where: { id: "app-settings" },
      select: { maintenanceMode: true },
    });

    return NextResponse.json({
      maintenanceMode: settings?.maintenanceMode || false,
    });
  } catch {
    return NextResponse.json({ maintenanceMode: false });
  }
}

// POST /api/admin/maintenance - Wartungs-Passwort prüfen
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password } = body as { password: string };

    if (!password) {
      return NextResponse.json({ error: "Passwort erforderlich" }, { status: 400 });
    }

    const settings = await prisma.appSettings.findUnique({
      where: { id: "app-settings" },
      select: { maintenancePassword: true },
    });

    if (!settings?.maintenancePassword) {
      return NextResponse.json({ error: "Kein Wartungspasswort gesetzt" }, { status: 400 });
    }

    const valid = await bcrypt.compare(password, settings.maintenancePassword);

    if (!valid) {
      return NextResponse.json({ error: "Falsches Passwort" }, { status: 401 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Fehler:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}