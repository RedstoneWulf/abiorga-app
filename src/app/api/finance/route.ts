import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/finance - Finanz-Übersicht
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    // Alle genehmigten Transaktionen für den Kontostand
    const approvedTransactions = await prisma.transaction.findMany({
      where: { status: "APPROVED" },
      select: { amount: true, type: true },
    });

    const totalIncome = approvedTransactions
      .filter((t) => t.type === "INCOME")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpense = approvedTransactions
      .filter((t) => t.type === "EXPENSE")
      .reduce((sum, t) => sum + t.amount, 0);

    const balance = totalIncome - totalExpense;

    // Ziel laden oder erstellen
    let settings = await prisma.appSettings.findUnique({
      where: { id: "app-settings" },
    });

    if (!settings) {
      settings = await prisma.appSettings.create({
        data: { id: "app-settings", financeGoal: 5000 },
      });
    }

    // Ausstehende Transaktionen (für Badge-Count)
    const pendingCount = await prisma.transaction.count({
      where: { status: "PENDING" },
    });

    // Letzte genehmigte Transaktionen
    const recentTransactions = await prisma.transaction.findMany({
      where: { status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        amount: true,
        type: true,
        reason: true,
        category: true,
        createdAt: true,
      },
    });

    // Ausgaben nach Kategorie
    const expensesByCategory = await prisma.transaction.groupBy({
      by: ["category"],
      where: { status: "APPROVED", type: "EXPENSE" },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
    });

    return NextResponse.json({
      balance,
      totalIncome,
      totalExpense,
      goal: settings.financeGoal,
      pendingCount,
      recentTransactions,
      expensesByCategory: expensesByCategory.map((e) => ({
        category: e.category || "Sonstiges",
        amount: e._sum.amount || 0,
      })),
    });
  } catch (error) {
    console.error("Fehler bei Finanz-Übersicht:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}

// PATCH /api/finance - Ziel aktualisieren (nur Admin)
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== "ADMIN" && user?.role !== "COMMITTEE") {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const body = await req.json();
    const { financeGoal } = body as { financeGoal: number };

    if (!financeGoal || financeGoal <= 0) {
      return NextResponse.json({ error: "Ungültiges Ziel" }, { status: 400 });
    }

    const settings = await prisma.appSettings.upsert({
      where: { id: "app-settings" },
      update: { financeGoal },
      create: { id: "app-settings", financeGoal },
    });

    return NextResponse.json({ goal: settings.financeGoal });
  } catch (error) {
    console.error("Fehler beim Aktualisieren des Ziels:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}