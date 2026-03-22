"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewPollPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [resultVisibility, setResultVisibility] = useState<"AFTER_VOTE" | "BEFORE_VOTE" | "AFTER_CLOSE">("AFTER_VOTE");
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endsAt, setEndsAt] = useState("");

  function addOption() {
    if (options.length >= 10) return;
    setOptions([...options, ""]);
  }

  function removeOption(index: number) {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== index));
  }

  function updateOption(index: number, value: string) {
    const updated = [...options];
    updated[index] = value;
    setOptions(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const filledOptions = options.filter((o) => o.trim() !== "");
    if (filledOptions.length < 2) {
      setError("Mindestens 2 Optionen müssen ausgefüllt sein");
      return;
    }

    setLoading(true);
    try {
      const endDate = hasEndDate && endsAt.length > 0 ? new Date(endsAt).toISOString() : undefined;

      const res = await fetch("/api/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description.length > 0 ? description : undefined,
          options: filledOptions,
          allowMultiple: allowMultiple === true,
          anonymous: anonymous === true,
          resultVisibility,
          endsAt: endDate,
        }),
      });

      if (res.ok) {
        router.push("/dashboard/polls");
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
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button type="button" onClick={() => router.back()} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm">← Zurück</button>
          <h1 className="text-sm font-semibold text-gray-900 dark:text-white">Neue Abstimmung</h1>
          <div className="w-14"></div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg p-3 mb-5 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Titel */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Frage / Titel *</label>
            <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="z.B. Welches Motto wollen wir?"
              className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
          </div>

          {/* Beschreibung */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Beschreibung (optional)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Weitere Infos..." rows={2}
              className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none dark:text-white" />
          </div>

          {/* Optionen */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Antwortmöglichkeiten *</label>
            <div className="space-y-2">
              {options.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <input type="text" value={opt} onChange={(e) => updateOption(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    className="flex-1 border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
                  {options.length > 2 && (
                    <button type="button" onClick={() => removeOption(i)}
                      className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">×</button>
                  )}
                </div>
              ))}
            </div>
            {options.length < 10 && (
              <button type="button" onClick={addOption} className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium">+ Option hinzufügen</button>
            )}
          </div>

          {/* Ergebnis-Sichtbarkeit */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Wann sind Ergebnisse sichtbar?</label>
            <div className="space-y-2">
              {[
                { value: "AFTER_VOTE" as const, label: "Nach Abstimmung", desc: "User sehen Ergebnisse erst nachdem sie abgestimmt haben", icon: "🗳️" },
                { value: "BEFORE_VOTE" as const, label: "Immer sichtbar", desc: "Ergebnisse sind für alle sofort sichtbar", icon: "👁️" },
                { value: "AFTER_CLOSE" as const, label: "Nach Beendigung", desc: "Ergebnisse erst wenn die Abstimmung beendet wurde", icon: "🔒" },
              ].map((opt) => (
                <button key={opt.value} type="button" onClick={() => setResultVisibility(opt.value)}
                  className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                    resultVisibility === opt.value ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30" : "border-gray-200 dark:border-gray-600 hover:border-gray-300"
                  }`}>
                  <div className="flex items-center gap-2">
                    <span>{opt.icon}</span>
                    <div>
                      <p className="text-xs font-medium text-gray-900 dark:text-white">{opt.label}</p>
                      <p className="text-[10px] text-gray-400">{opt.desc}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Einstellungen */}
          <div className="space-y-3">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Einstellungen</label>

            <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Mehrfachauswahl</p>
                <p className="text-[10px] text-gray-400">Mehrere Optionen wählbar</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={allowMultiple} onChange={(e) => setAllowMultiple(e.target.checked)} className="sr-only peer" />
                <div className="w-10 h-5 bg-gray-300 rounded-full peer peer-checked:bg-blue-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Anonym</p>
                <p className="text-[10px] text-gray-400">Stimmen nicht zuordenbar</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="sr-only peer" />
                <div className="w-10 h-5 bg-gray-300 rounded-full peer peer-checked:bg-blue-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Enddatum</p>
                <p className="text-[10px] text-gray-400">Automatisch beenden</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={hasEndDate} onChange={(e) => setHasEndDate(e.target.checked)} className="sr-only peer" />
                <div className="w-10 h-5 bg-gray-300 rounded-full peer peer-checked:bg-blue-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
              </label>
            </div>
            {hasEndDate && (
              <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)}
                className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
            )}
          </div>

          {/* Info */}
          <div className="bg-gray-50 dark:bg-gray-700/50 border dark:border-gray-700 rounded-lg p-3">
            <p className="text-[10px] text-gray-400 leading-relaxed">
              Beendete Abstimmungen werden nach 48 Stunden automatisch gelöscht. Admins und das Komitee können Abstimmungen jederzeit beenden oder löschen. Der Ersteller kann sie nach Beendigung löschen.
            </p>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => router.back()}
              className="flex-1 py-2.5 border dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-sm">Abbrechen</button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-50">
              {loading ? "Wird erstellt..." : "Abstimmung starten"}</button>
          </div>
        </form>
      </main>
    </div>
  );
}