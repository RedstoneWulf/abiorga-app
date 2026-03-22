import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasCommitteeAccess } from "@/lib/permissions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/teams/[id]/requests - Anfrage genehmigen oder ablehnen
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const { id: teamId } = await params;
    const body = await req.json();
    const { requestId, action } = body as { requestId: string; action: "APPROVE" | "REJECT" };

    // Berechtigung prüfen
    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { createdById: true } });
    const isAdmin = await hasCommitteeAccess(session.user.id);
    const isCreator = team?.createdById === session.user.id;
    const membership = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: session.user.id, teamId } },
    });

    if (!isAdmin && !isCreator && !membership?.isLeader) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const request = await prisma.teamJoinRequest.findUnique({
      where: { id: requestId },
    });

    if (!request || request.teamId !== teamId) {
      return NextResponse.json({ error: "Anfrage nicht gefunden" }, { status: 404 });
    }

    if (action === "APPROVE") {
      await prisma.teamMember.create({
        data: { userId: request.userId, teamId },
      });
      await prisma.teamJoinRequest.delete({ where: { id: requestId } });
      return NextResponse.json({ message: "Anfrage genehmigt" });
    } else {
      await prisma.teamJoinRequest.update({
        where: { id: requestId },
        data: { status: "REJECTED" },
      });
      return NextResponse.json({ message: "Anfrage abgelehnt" });
    }
  } catch (error) {
    console.error("Fehler:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}