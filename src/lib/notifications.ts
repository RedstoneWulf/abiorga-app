import { prisma } from "@/lib/prisma";

type NotifType =
  | "GLOBAL"
  | "STORY"
  | "CHAT"
  | "EVENT"
  | "TASK"
  | "POLL"
  | "TRANSACTION";

interface CreateNotificationInput {
  title: string;
  message: string;
  type: NotifType;
  priority?: "NORMAL" | "HIGH";
  pinned?: boolean;
  createdById: string;
  teamId?: string;
}

// Erstellt eine Benachrichtigung die bei betroffenen Usern angezeigt wird
export async function createNotification(input: CreateNotificationInput) {
  try {
    await prisma.notification.create({
      data: {
        title: input.title,
        message: input.message,
        type: input.type,
        priority: input.priority || "NORMAL",
        pinned: input.pinned || false,
        scope: input.teamId ? "TEAM" : "GLOBAL",
        teamId: input.teamId || null,
        createdById: input.createdById,
      },
    });
  } catch (error) {
    // Notification-Fehler sollen nie den Hauptvorgang blockieren
    console.error("Fehler beim Erstellen der Benachrichtigung:", error);
  }
}