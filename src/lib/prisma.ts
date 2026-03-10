import { PrismaClient } from "@prisma/client";

// Verhindert dass in der Entwicklung bei jedem Hot-Reload
// eine neue Datenbankverbindung erstellt wird
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}