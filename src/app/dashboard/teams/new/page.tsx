"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const COLORS = [
  "#4472C4", "#ED7D31", "#A5A5A5", "#FFC000",
  "#5B9BD5", "#70AD47", "#8B5CF6", "#EF4444",
  "#EC4899", "#14B8A6", "#F59E0B", "#6366F1",
];

export default function NewTeamPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [type, setType] = useState("CUSTOM");

  const userRole = session?.user?.role;
  const isAdminOrCommittee = userRole === "ADMIN" || userRole === "COMMITTEE";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description.length > 0 ? description : undefined,
          color,
          type,
        }),
      });

      if (res.ok) {
        const team = await res.json();
        router.push(`/dashboard/teams/${team.id}`);
      } else {
        const data = await res.json();
        setError(data.error);
      }
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button type="button" onClick={() => router.back()} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm">← Zurück</button>
          <h1 className="text-sm font-semibold text-gray-900 dark:text-white">Neues Team</h1>
          <div className="w-14"></div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg p-3 mb-5 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Vorschau */}
          <div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl" style={{ backgroundColor: color }}>
              {name ? name.charAt(0).toUpperCase() : "?"}
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">{name || "Teamname"}</p>
              <p className="text-xs text-gray-400">{description || "Beschreibung..."}</p>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Teamname *</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Deko-Team, Motto-Komitee..."
              className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
          </div>

          {/* Beschreibung */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Beschreibung</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Was macht das Team?" rows={2}
              className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none dark:text-white" />
          </div>

          {/* Farbe */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Teamfarbe</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`w-9 h-9 rounded-lg transition-all ${color === c ? "ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-gray-900 scale-110" : "hover:scale-105"}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          {/* Team-Typ (nur für Admin/Komitee) */}
          {isAdminOrCommittee && (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Team-Typ</label>
              <div className="space-y-2">
                <button type="button" onClick={() => setType("CUSTOM")}
                  className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                    type === "CUSTOM" ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30" : "border-gray-200 dark:border-gray-600"
                  }`}>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">Normales Team</div>
                  <div className="text-xs text-gray-400">Jeder kann beitreten, keine besonderen Rechte</div>
                </button>
                <button type="button" onClick={() => setType("COMMITTEE")}
                  className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                    type === "COMMITTEE" ? "border-amber-500 bg-amber-50 dark:bg-amber-900/30" : "border-gray-200 dark:border-gray-600"
                  }`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">Komitee</span>
                    <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 px-1.5 py-0.5 rounded font-semibold">Spezial</span>
                  </div>
                  <div className="text-xs text-gray-400">Mitglieder erhalten fast Admin-Rechte, nur per Einladung</div>
                </button>
                <button type="button" onClick={() => setType("FINANCE")}
                  className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                    type === "FINANCE" ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30" : "border-gray-200 dark:border-gray-600"
                  }`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">Finanz-Team</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 px-1.5 py-0.5 rounded font-semibold">Spezial</span>
                  </div>
                  <div className="text-xs text-gray-400">Mitglieder können Transaktionen genehmigen/ablehnen, nur per Einladung</div>
                </button>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => router.back()}
              className="flex-1 py-2.5 border dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-sm">
              Abbrechen
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-50">
              {loading ? "Wird erstellt..." : "Team erstellen"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}