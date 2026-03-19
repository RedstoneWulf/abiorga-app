import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/finance/transactions/[id]/review - Genehmigen oder Ablehnen
export async function POST(req: NextRequest, { params }: RouteParams) {
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
      return NextResponse.json(
        { error: "Nur Admins und Komitee können Transaktionen genehmigen" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const { action, rejectReason } = body as {
      action: "APPROVE" | "REJECT";
      rejectReason?: string;
    };

    if (action !== "APPROVE" && action !== "REJECT") {
      return NextResponse.json(
        { error: "Aktion muss APPROVE oder REJECT sein" },
        { status: 400 }
      );
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaktion nicht gefunden" },
        { status: 404 }
      );
    }

    if (transaction.status !== "PENDING") {
      return NextResponse.json(
        { error: "Transaktion wurde bereits bearbeitet" },
        { status: 400 }
      );
    }

    if (action === "REJECT" && (!rejectReason || rejectReason.trim().length === 0)) {
      return NextResponse.json(
        { error: "Bei Ablehnung muss ein Grund angegeben werden" },
        { status: 400 }
      );
    }

    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        status: action === "APPROVE" ? "APPROVED" : "REJECTED",
        rejectReason: action === "REJECT" ? rejectReason?.trim() : null,
        reviewedById: session.user.id,
        reviewedAt: new Date(),
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Fehler bei der Genehmigung:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}