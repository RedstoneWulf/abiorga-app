"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MaintenancePage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        // Wartungspasswort korrekt → zur Login-Seite weiterleiten
        sessionStorage.setItem("maintenance-bypass", "true");
        router.push("/login");
      } else {
        setError("Falsches Passwort");
      }
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center">
        <div className="text-5xl mb-4">🔧</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Wartungsarbeiten</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          AbiOrga ist momentan wegen Wartungsarbeiten nicht erreichbar. Bitte versuche es später erneut.
        </p>

        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-6">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Zugang mit Wartungspasswort</p>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg p-2 mb-3 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Wartungspasswort..."
              className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white text-center"
            />
            <button type="submit" disabled={loading || !password}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {loading ? "Prüfe..." : "Zugang freischalten"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}