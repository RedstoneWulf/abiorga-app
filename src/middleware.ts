import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

// Schützt alle Routen AUSSER login, register, api/auth und statische Dateien
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/tasks/:path*",
    "/finance/:path*",
    "/teams/:path*",
    "/notifications/:path*",
  ],
};