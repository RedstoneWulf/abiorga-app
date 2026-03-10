import { DefaultSession } from "next-auth";

// Erweitert die Standard-NextAuth-Typen um unsere eigenen Felder
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
  }
}