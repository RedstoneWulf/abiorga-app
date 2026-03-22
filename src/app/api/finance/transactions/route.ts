import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { TransactionStatus, TransactionType } from "@prisma/client";

// GET /api/finance/transactions
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    // Abgelaufene Belege bereinigen
    await prisma.transaction.updateMany({
      where: {
        receiptExpiresAt: { not: null, lt: new Date() },
        receiptUrl: { not: null },
      },
      data: { receiptUrl: null },
    });

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status") as TransactionStatus | null;
    const typeFilter = searchParams.get("type") as TransactionType | null;
    const myOnly = searchParams.get("my") === "true";

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    const isAdminOrCommittee = user?.role === "ADMIN" || user?.role === "COMMITTEE";

    const where: {
      status?: TransactionStatus;
      type?: TransactionType;
      createdById?: string;
      OR?: Array<{ status: TransactionStatus } | { createdById: string }>;
    } = {};

    if (statusFilter) where.status = statusFilter;
    if (typeFilter) where.type = typeFilter;

    if (!isAdminOrCommittee && !myOnly) {
      where.OR = [
        { status: "APPROVED" as TransactionStatus },
        { createdById: session.user.id },
      ];
    }

    if (myOnly) where.createdById = session.user.id;

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = transactions.map((t) => ({
      ...t,
      // Beleg-URL nur für Admin/Komitee oder Ersteller sichtbar
      receiptUrl: (isAdminOrCommittee || t.createdById === session.user.id) ? t.receiptUrl : null,
      createdBy: isAdminOrCommittee || t.createdById === session.user.id
        ? t.createdBy
        : { id: "hidden", name: "Mitglied" },
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Fehler:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

// POST /api/finance/transactions
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const body = await req.json();
    const { amount, type, reason, category, transactionDate, receiptUrl } = body as {
      amount: number;
      type: string;
      reason: string;
      category?: string;
      transactionDate?: string;
      receiptUrl?: string;
    };

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Betrag muss größer als 0 sein" }, { status: 400 });
    }

    if (!type || (type !== "INCOME" && type !== "EXPENSE")) {
      return NextResponse.json({ error: "Typ muss INCOME oder EXPENSE sein" }, { status: 400 });
    }

    if (!reason || reason.trim().length === 0) {
      return NextResponse.json({ error: "Grund ist erforderlich" }, { status: 400 });
    }

    // Beleg max ~5MB
    if (receiptUrl && receiptUrl.length > 7_000_000) {
      return NextResponse.json({ error: "Beleg-Bild ist zu groß. Maximal 5MB." }, { status: 400 });
    }

    const transaction = await prisma.transaction.create({
      data: {
        amount,
        type: type as TransactionType,
        reason: reason.trim(),
        category: category && category.trim().length > 0 ? category.trim() : null,
        status: "PENDING",
        transactionDate: transactionDate ? new Date(transactionDate) : null,
        receiptUrl: receiptUrl || null,
        createdById: session.user.id,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error("Fehler:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}