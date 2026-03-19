import { prisma } from "@/lib/prisma";

// Prüft ob ein User Admin-ähnliche Rechte hat (über Rolle ODER Komitee-Team)
export async function hasCommitteeAccess(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      teamMemberships: {
        where: {
          team: { type: "COMMITTEE" },
        },
        select: { id: true },
      },
    },
  });

  if (!user) return false;

  return (
    user.role === "ADMIN" ||
    user.role === "COMMITTEE" ||
    user.teamMemberships.length > 0
  );
}

// Prüft ob ein User Finanz-Rechte hat (über Rolle ODER Finanz-Team)
export async function hasFinanceAccess(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      teamMemberships: {
        where: {
          team: { type: { in: ["COMMITTEE", "FINANCE"] } },
        },
        select: { id: true },
      },
    },
  });

  if (!user) return false;

  return (
    user.role === "ADMIN" ||
    user.role === "COMMITTEE" ||
    user.teamMemberships.length > 0
  );
}

// Prüft ob ein User Mitglied eines bestimmten Teams ist
export async function isTeamMember(
  userId: string,
  teamId: string
): Promise<boolean> {
  const membership = await prisma.teamMember.findUnique({
    where: {
      userId_teamId: { userId, teamId },
    },
  });

  return !!membership;
}

// Prüft ob ein User Teamleiter ist
export async function isTeamLeader(
  userId: string,
  teamId: string
): Promise<boolean> {
  const membership = await prisma.teamMember.findUnique({
    where: {
      userId_teamId: { userId, teamId },
    },
    select: { isLeader: true },
  });

  return !!membership?.isLeader;
}