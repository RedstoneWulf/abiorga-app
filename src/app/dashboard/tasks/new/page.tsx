"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
    maxAssignees: 1,
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
          dueDate: form.dueDate || null,
          recurrenceInterval:
            form.type === "RECURRING" ? form.recurrenceInterval : null,
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
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Neue Aufgabe erstellen
      </h1>
      <p className="text-gray-500 mb-8">
        Erstelle eine Aufgabe für die Stufe
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Titel */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Titel *
          </label>
          <input
            type="text"
            required
            value={form.title}
            onChange={(e) => updateForm("title", e.target.value)}
            placeholder="z.B. Mülldienst, Deko aufbauen..."
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        {/* Beschreibung */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Beschreibung
          </label>
          <textarea
            value={form.description}
            onChange={(e) => updateForm("description", e.target.value)}
            placeholder="Was genau ist zu tun?"
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
          />
        </div>

        {/* Typ */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Art der Aufgabe
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => updateForm("type", "ONE_TIME")}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                form.type === "ONE_TIME"
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="font-medium text-sm">Einmalig</div>
              <div className="text-xs text-gray-500">
                z.B. Deko aufbauen
              </div>
            </button>
            <button
              type="button"
              onClick={() => updateForm("type", "RECURRING")}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                form.type === "RECURRING"
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="font-medium text-sm">Wiederkehrend</div>
              <div className="text-xs text-gray-500">
                z.B. Mülldienst jede Woche
              </div>
            </button>
          </div>
        </div>

        {/* Wiederkehrend: Intervall */}
        {form.type === "RECURRING" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Wiederholungs-Intervall
            </label>
            <select
              value={form.recurrenceInterval}
              onChange={(e) =>
                updateForm("recurrenceInterval", e.target.value)
              }
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="DAILY">Täglich</option>
              <option value="WEEKLY">Wöchentlich</option>
              <option value="BIWEEKLY">Alle 2 Wochen</option>
              <option value="MONTHLY">Monatlich</option>
            </select>
          </div>
        )}

        {/* Zuweisung */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Zuweisung
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => updateForm("assignmentMode", "MANUAL")}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                form.assignmentMode === "MANUAL"
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="font-medium text-sm">Manuell</div>
              <div className="text-xs text-gray-500">
                Du wählst wer dran ist
              </div>
            </button>
            <button
              type="button"
              onClick={() => updateForm("assignmentMode", "AUTO")}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                form.assignmentMode === "AUTO"
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="font-medium text-sm">Automatisch</div>
              <div className="text-xs text-gray-500">
                System wählt fair aus
              </div>
            </button>
          </div>
        </div>

        {/* Team-Aufgabe */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
          <div>
            <div className="font-medium text-sm text-gray-900">
              Team-Aufgabe
            </div>
            <div className="text-xs text-gray-500">
              Mehrere Personen arbeiten zusammen
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={form.isTeamTask}
              onChange={(e) => updateForm("isTeamTask", e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-blue-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
          </label>
        </div>

        {/* Anzahl Personen bei Team-Aufgaben */}
        {form.isTeamTask && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Anzahl Personen
            </label>
            <input
              type="number"
              min={2}
              max={20}
              value={form.maxAssignees}
              onChange={(e) =>
                updateForm("maxAssignees", parseInt(e.target.value) || 2)
              }
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        )}

        {/* Fälligkeitsdatum */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {form.type === "RECURRING"
              ? "Erstes Fälligkeitsdatum"
              : "Fälligkeitsdatum"}
          </label>
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => updateForm("dueDate", e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        {/* Priorität */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Priorität
          </label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => updateForm("priority", p)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  form.priority === p
                    ? p <= 2
                      ? "bg-gray-200 text-gray-800"
                      : p === 3
                      ? "bg-yellow-200 text-yellow-800"
                      : p === 4
                      ? "bg-orange-200 text-orange-800"
                      : "bg-red-200 text-red-800"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {p === 1
                  ? "Niedrig"
                  : p === 2
                  ? "Gering"
                  : p === 3
                  ? "Mittel"
                  : p === 4
                  ? "Hoch"
                  : "Dringend"}
              </button>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
          >
            {loading ? "Wird erstellt..." : "Aufgabe erstellen"}
          </button>
        </div>
      </form>
    </div>
  );
}