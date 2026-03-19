"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type TaskType = "ONE_TIME" | "RECURRING";
type AssignmentMode = "AUTO" | "MANUAL";

interface TaskForm {
  title: string;
  description: string;
  type: TaskType;
  assignmentMode: AssignmentMode;
  isTeamTask: boolean;
  maxAssignees: number;
  recurrenceInterval: string;
  dueDate: string;
  priority: number;
}

export default function NewTaskPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState<TaskForm>({
    title: "",
    description: "",
    type: "ONE_TIME",
    assignmentMode: "MANUAL",
    isTeamTask: false,
    maxAssignees: 2,
    recurrenceInterval: "WEEKLY",
    dueDate: "",
    priority: 3,
  });

  function updateForm<K extends keyof TaskForm>(field: K, value: TaskForm[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          dueDate: form.dueDate || undefined,
          recurrenceInterval:
            form.type === "RECURRING" ? form.recurrenceInterval : undefined,
        }),
      });

      if (res.ok) {
        const task = await res.json();
        router.push(`/dashboard/tasks/${task.id}`);
      } else {
        const data = await res.json();
        setError(data.error || "Fehler beim Erstellen");
      }
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard/tasks" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm">
            ← Zurück
          </Link>
          <h1 className="text-sm font-semibold text-gray-900 dark:text-white">Neue Aufgabe</h1>
          <div className="w-14"></div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg p-3 mb-5 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Titel */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Titel *</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => updateForm("title", e.target.value)}
              placeholder="z.B. Mülldienst, Deko aufbauen..."
              className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
            />
          </div>

          {/* Beschreibung */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Beschreibung</label>
            <textarea
              value={form.description}
              onChange={(e) => updateForm("description", e.target.value)}
              placeholder="Was genau ist zu tun?"
              rows={3}
              className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none dark:text-white"
            />
          </div>

          {/* Typ */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Art der Aufgabe</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => updateForm("type", "ONE_TIME")}
                className={`p-3 rounded-xl border-2 text-left transition-all ${form.type === "ONE_TIME" ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30" : "border-gray-200 dark:border-gray-600 hover:border-gray-300"}`}>
                <div className="text-xs font-medium text-gray-900 dark:text-white">Einmalig</div>
                <div className="text-[10px] text-gray-400">z.B. Deko aufbauen</div>
              </button>
              <button type="button" onClick={() => updateForm("type", "RECURRING")}
                className={`p-3 rounded-xl border-2 text-left transition-all ${form.type === "RECURRING" ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30" : "border-gray-200 dark:border-gray-600 hover:border-gray-300"}`}>
                <div className="text-xs font-medium text-gray-900 dark:text-white">Wiederkehrend</div>
                <div className="text-[10px] text-gray-400">z.B. Mülldienst</div>
              </button>
            </div>
          </div>

          {/* Intervall */}
          {form.type === "RECURRING" && (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Wiederholungs-Intervall</label>
              <select value={form.recurrenceInterval} onChange={(e) => updateForm("recurrenceInterval", e.target.value)}
                className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white">
                <option value="DAILY">Täglich</option>
                <option value="WEEKLY">Wöchentlich</option>
                <option value="BIWEEKLY">Alle 2 Wochen</option>
                <option value="MONTHLY">Monatlich</option>
              </select>
            </div>
          )}

          {/* Zuweisung */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Zuweisung</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => updateForm("assignmentMode", "MANUAL")}
                className={`p-3 rounded-xl border-2 text-left transition-all ${form.assignmentMode === "MANUAL" ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30" : "border-gray-200 dark:border-gray-600 hover:border-gray-300"}`}>
                <div className="text-xs font-medium text-gray-900 dark:text-white">Manuell</div>
                <div className="text-[10px] text-gray-400">Du wählst wer dran ist</div>
              </button>
              <button type="button" onClick={() => updateForm("assignmentMode", "AUTO")}
                className={`p-3 rounded-xl border-2 text-left transition-all ${form.assignmentMode === "AUTO" ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30" : "border-gray-200 dark:border-gray-600 hover:border-gray-300"}`}>
                <div className="text-xs font-medium text-gray-900 dark:text-white">Automatisch</div>
                <div className="text-[10px] text-gray-400">System wählt fair</div>
              </button>
            </div>
          </div>

          {/* Team-Aufgabe */}
          <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Team-Aufgabe</p>
              <p className="text-[10px] text-gray-400">Mehrere Personen</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={form.isTeamTask}
                onChange={(e) => { updateForm("isTeamTask", e.target.checked); if (e.target.checked && form.maxAssignees < 2) updateForm("maxAssignees", 2); }}
                className="sr-only peer" />
              <div className="w-10 h-5 bg-gray-300 rounded-full peer peer-checked:bg-blue-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
            </label>
          </div>

          {/* Anzahl */}
          {form.isTeamTask && (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Anzahl Personen</label>
              <div className="flex items-center gap-4">
                <button type="button" disabled={form.maxAssignees <= 2}
                  onClick={() => updateForm("maxAssignees", form.maxAssignees - 1)}
                  className={`w-10 h-10 rounded-xl border-2 text-lg font-bold flex items-center justify-center transition-all ${form.maxAssignees <= 2 ? "border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600" : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-500"}`}>
                  −
                </button>
                <div className="text-center min-w-[50px]">
                  <div className="text-xl font-bold text-gray-900 dark:text-white">{form.maxAssignees}</div>
                  <div className="text-[10px] text-gray-400">Personen</div>
                </div>
                <button type="button" disabled={form.maxAssignees >= 20}
                  onClick={() => updateForm("maxAssignees", form.maxAssignees + 1)}
                  className={`w-10 h-10 rounded-xl border-2 text-lg font-bold flex items-center justify-center transition-all ${form.maxAssignees >= 20 ? "border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600" : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-500"}`}>
                  +
                </button>
              </div>
            </div>
          )}

          {/* Fälligkeit */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              {form.type === "RECURRING" ? "Erstes Fälligkeitsdatum" : "Fälligkeitsdatum"}
            </label>
            <input type="date" value={form.dueDate} onChange={(e) => updateForm("dueDate", e.target.value)}
              className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
          </div>

          {/* Priorität */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Priorität</label>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((p) => (
                <button key={p} type="button" onClick={() => updateForm("priority", p)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                    form.priority === p
                      ? p <= 2 ? "bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200"
                      : p === 3 ? "bg-yellow-200 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300"
                      : p === 4 ? "bg-orange-200 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300"
                      : "bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}>
                  {p <= 2 ? (p === 1 ? "Niedrig" : "Gering") : p === 3 ? "Mittel" : p === 4 ? "Hoch" : "Dringend"}
                </button>
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => router.back()}
              className="flex-1 py-2.5 border dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-sm">
              Abbrechen
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-50">
              {loading ? "Wird erstellt..." : "Aufgabe erstellen"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}