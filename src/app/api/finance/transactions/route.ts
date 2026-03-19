import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { TransactionStatus, TransactionType } from "@prisma/client";

// GET /api/finance/transactions - Transaktionen abrufen
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status") as TransactionStatus | null;
    const typeFilter = searchParams.get("type") as TransactionType | null;
    const myOnly = searchParams.get("my") === "true";

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    const isAdminOrCommittee =
      user?.role === "ADMIN" || user?.role === "COMMITTEE";

    const where: {
      status?: TransactionStatus;
      type?: TransactionType;
      createdById?: string;
      OR?: Array<{ status: TransactionStatus } | { createdById: string }>;
    } = {};

    if (statusFilter) {
      where.status = statusFilter;
    }

    if (typeFilter) {
      where.type = typeFilter;
    }

    // Normaler User: nur eigene + genehmigte Transaktionen sehen
    if (!isAdminOrCommittee && !myOnly) {
      where.OR = [
        { status: "APPROVED" as TransactionStatus },
        { createdById: session.user.id },
      ];
    }

    if (myOnly) {
      where.createdById = session.user.id;
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Für normale User: Ersteller-Name bei fremden Transaktionen ausblenden
    const formatted = transactions.map((t) => ({
      ...t,
      createdBy: isAdminOrCommittee || t.createdById === session.user.id
        ? t.createdBy
        : { id: "hidden", name: "Mitglied" },
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Fehler beim Laden der Transaktionen:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}

// POST /api/finance/transactions - Neue Transaktion erstellen
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const body = await req.json();
    const { amount, type, reason, category } = body as {
      amount: number;
      type: string;
      reason: string;
      category?: string;
    };

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Betrag muss größer als 0 sein" },
        { status: 400 }
      );
    }

    if (!type || (type !== "INCOME" && type !== "EXPENSE")) {
      return NextResponse.json(
        { error: "Typ muss INCOME oder EXPENSE sein" },
        { status: 400 }
      );
    }

    if (!reason || reason.trim().length === 0) {
      return NextResponse.json(
        { error: "Grund ist erforderlich" },
        { status: 400 }
      );
    }

    const transaction = await prisma.transaction.create({
      data: {
        amount,
        type: type as TransactionType,
        reason: reason.trim(),
        category: category && category.trim().length > 0 ? category.trim() : null,
        status: "PENDING",
        createdById: session.user.id,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error("Fehler beim Erstellen der Transaktion:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}