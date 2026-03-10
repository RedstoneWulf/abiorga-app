import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();

    // Validierung
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, E-Mail und Passwort sind erforderlich" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Passwort muss mindestens 6 Zeichen lang sein" },
        { status: 400 }
      );
    }

    // Prüfen ob E-Mail schon existiert
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Es existiert bereits ein Account mit dieser E-Mail" },
        { status: 400 }
      );
    }

    // Passwort hashen (sicher speichern)
    const hashedPassword = await bcrypt.hash(password, 12);

    // Prüfen ob es der erste User ist -> wird automatisch Admin
    const userCount = await prisma.user.count();
    const isFirstUser = userCount === 0;

    // User erstellen
    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        role: isFirstUser ? "ADMIN" : "MEMBER",
      },
    });

    return NextResponse.json(
      {
        message: isFirstUser
          ? "Admin-Account erfolgreich erstellt!"
          : "Account erfolgreich erstellt!",
        userId: user.id,
        role: user.role,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registrierungsfehler:", error);
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten. Bitte versuche es erneut." },
      { status: 500 }
    );
  }
}