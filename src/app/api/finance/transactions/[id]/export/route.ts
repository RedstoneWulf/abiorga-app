import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/finance/transactions/[id]/export - Als Textdokument herunterladen
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const { id } = await params;

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        createdBy: { select: { name: true } },
        reviewedBy: { select: { name: true } },
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaktion nicht gefunden" }, { status: 404 });
    }

    // Berechtigung: Admin, Komitee oder Ersteller
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    const isAdminOrCommittee = user?.role === "ADMIN" || user?.role === "COMMITTEE";
    const isCreator = transaction.createdById === session.user.id;

    if (!isAdminOrCommittee && !isCreator) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const formatDate = (d: Date | null) =>
      d ? d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

    const formatCurrency = (amount: number) =>
      new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);

    const statusLabels: Record<string, string> = {
      PENDING: "Ausstehend",
      APPROVED: "Genehmigt",
      REJECTED: "Abgelehnt",
    };

    const lines = [
      "═══════════════════════════════════════",
      "         TRANSAKTIONSBELEG",
      "            AbiOrga",
      "═══════════════════════════════════════",
      "",
      `Transaktion-ID:  ${transaction.id}`,
      `Erstellt am:     ${formatDate(transaction.createdAt)}`,
      `Erstellt von:    ${transaction.createdBy.name}`,
      "",
      "───────────────────────────────────────",
      "",
      `Typ:             ${transaction.type === "INCOME" ? "Einzahlung" : "Ausgabe"}`,
      `Betrag:          ${formatCurrency(transaction.amount)}`,
      `Grund:           ${transaction.reason}`,
      `Kategorie:       ${transaction.category || "—"}`,
      "",
      transaction.transactionDate
        ? `Transaktionsdatum: ${formatDate(transaction.transactionDate)}`
        : "",
      "",
      "───────────────────────────────────────",
      "",
      `Status:          ${statusLabels[transaction.status] || transaction.status}`,
      transaction.reviewedBy
        ? `Bearbeitet von:  ${transaction.reviewedBy.name}`
        : "",
      transaction.reviewedAt
        ? `Bearbeitet am:   ${formatDate(transaction.reviewedAt)}`
        : "",
      transaction.rejectReason
        ? `Ablehnungsgrund: ${transaction.rejectReason}`
        : "",
      "",
      "═══════════════════════════════════════",
      `Exportiert am:   ${formatDate(new Date())}`,
      "═══════════════════════════════════════",
    ].filter((line) => line !== "");

    const text = lines.join("\n");

    return new NextResponse(text, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="transaktion-${transaction.id.slice(0, 8)}.txt"`,
      },
    });
  } catch (error) {
    console.error("Fehler:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}