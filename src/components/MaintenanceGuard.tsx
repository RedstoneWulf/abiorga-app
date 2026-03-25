"use client";

import { useEffect } from "react";
import { useSession, signOut } from "next-auth/react";

export default function MaintenanceGuard() {
  const { data: session } = useSession();

  useEffect(() => {
    if (!session) return;

    const userRole = session?.user?.role;
    if (userRole === "ADMIN" || userRole === "COMMITTEE") return;

    fetch("/api/admin/maintenance")
      .then((res) => res.json())
      .then((data) => {
        if (data.maintenanceMode) {
          signOut({ callbackUrl: "/maintenance" });
        }
      })
      .catch(() => {});
  }, [session]);

  return null;
}