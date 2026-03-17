"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  type: "EVENT" | "EXAM" | "DEADLINE" | "MEETING";
  startDate: string;
  endDate: string | null;
  location: string | null;
  allDay: boolean;
  createdBy: { id: string; name: string };
  createdAt: string;
}

const EVENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  EVENT: { bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800" },
  EXAM: { bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-700 dark:text-red-300", border: "border-red-200 dark:border-red-800" },
  DEADLINE: { bg: "bg-orange-50 dark:bg-orange-900/20", text: "text-orange-700 dark:text-orange-300", border: "border-orange-200 dark:border-orange-800" },
  MEETING: { bg: "bg-purple-50 dark:bg-purple-900/20", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800" },
};

const EVENT_ICONS: Record<string, string> = {
  EVENT: "📅",
  EXAM: "📝",
  DEADLINE: "⏰",
  MEETING: "🤝",
};

const EVENT_LABELS: Record<string, string> = {
  EVENT: "Event",
  EXAM: "Klausur",
  DEADLINE: "Frist",
  MEETING: "Treffen",
};

export default function EventsPage() {
  const { data: session } = useSession();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [showCreate, setShowCreate] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "EVENT",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    location: "",
    allDay: false,
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  const userRole = session?.user?.role;
  const isAdminOrCommittee = userRole === "ADMIN" || userRole === "COMMITTEE";

  const fetchEvents = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter !== "ALL") params.set("type", filter);
      const res = await fetch(`/api/events?${params}`);
      if (res.ok) setEvents(await res.json());
    } catch (error) {
      console.error("Fehler:", error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    setCreateLoading(true);

    try {
      let startDate = form.startDate;
      if (form.startTime && !form.allDay) {
        startDate = `${form.startDate}T${form.startTime}`;
      }

      let endDate: string | undefined;
      if (form.endDate) {
        endDate = form.endDate;
        if (form.endTime && !form.allDay) {
          endDate = `${form.endDate}T${form.endTime}`;
        }
      }

      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description.length > 0 ? form.description : undefined,
          type: form.type,
          startDate,
          endDate,
          location: form.location.length > 0 ? form.location : undefined,
          allDay: form.allDay === true,
        }),
      });

      if (res.ok) {
        setShowCreate(false);
        setForm({ title: "", description: "", type: "EVENT", startDate: "", startTime: "", endDate: "", endTime: "", location: "", allDay: false });
        fetchEvents();
      } else {
        const data = await res.json();
        setCreateError(data.error);
      }
    } catch {
      setCreateError("Netzwerkfehler");
    } finally {
      setCreateLoading(false);
    }
  }

  function formatEventDate(ev: CalendarEvent) {
    const start = new Date(ev.startDate);
    const dateStr = start.toLocaleDateString("de-DE", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    if (ev.allDay) return dateStr + " • Ganztägig";
    const timeStr = start.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    let result = `${dateStr} • ${timeStr} Uhr`;
    if (ev.endDate) {
      const end = new Date(ev.endDate);
      const endTimeStr = end.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
      result += ` – ${endTimeStr} Uhr`;
    }
    return result;
  }

  const now = new Date();
  const upcoming = events.filter((e) => new Date(e.startDate) >= now);
  const past = events.filter((e) => new Date(e.startDate) < now);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard/calendar" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm">
            ← Kalender
          </Link>
          <h1 className="text-sm font-semibold text-gray-900 dark:text-white">Events verwalten</h1>
          <button type="button" onClick={() => setShowCreate(true)} className="text-sm text-blue-600 dark:text-blue-400 font-medium">
            + Neu
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-5 space-y-5">
        {/* Filter */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            { value: "ALL", label: "Alle" },
            { value: "EVENT", label: "📅 Events" },
            { value: "EXAM", label: "📝 Klausuren" },
            { value: "DEADLINE", label: "⏰ Fristen" },
            { value: "MEETING", label: "🤝 Treffen" },
          ].map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                filter === f.value
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-gray-800 border dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Kommende Events */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Laden...</div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  Kommende ({upcoming.length})
                </h2>
                <div className="space-y-3">
                  {upcoming.map((ev) => (
                    <div
                      key={ev.id}
                      className={`bg-white dark:bg-gray-800 rounded-xl border ${EVENT_COLORS[ev.type]?.border || "dark:border-gray-700"} p-4`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg ${EVENT_COLORS[ev.type]?.bg}`}>
                          {EVENT_ICONS[ev.type]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900 dark:text-white">{ev.title}</h3>
                            <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${EVENT_COLORS[ev.type]?.bg} ${EVENT_COLORS[ev.type]?.text}`}>
                              {EVENT_LABELS[ev.type]}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatEventDate(ev)}
                          </p>
                          {ev.location && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              📍 {ev.location}
                            </p>
                          )}
                          {ev.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">
                              {ev.description}
                            </p>
                          )}
                          <p className="text-[10px] text-gray-400 mt-2">
                            Erstellt von {ev.createdBy.name}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {past.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  Vergangene ({past.length})
                </h2>
                <div className="space-y-2">
                  {past.map((ev) => (
                    <div key={ev.id} className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-3 opacity-60">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{EVENT_ICONS[ev.type]}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{ev.title}</p>
                          <p className="text-xs text-gray-400">{formatEventDate(ev)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {upcoming.length === 0 && past.length === 0 && (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">📅</div>
                <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">Noch keine Events</p>
                <p className="text-gray-400 text-sm mt-1">Erstelle das erste Event</p>
                <button type="button" onClick={() => setShowCreate(true)}
                  className="inline-block mt-4 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">
                  Event erstellen
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Erstellen Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-xl p-6 w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Neues Event</h3>
              <button type="button" onClick={() => { setShowCreate(false); setCreateError(""); }} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            {createError && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg p-3 mb-4 text-sm">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              {/* Titel */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Titel *</label>
                <input type="text" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="z.B. Mathe Klausur, Abi-Ball Besichtigung..."
                  className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
              </div>

              {/* Beschreibung */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Beschreibung</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Weitere Details zum Event..." rows={3}
                  className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none dark:text-white" />
              </div>

              {/* Typ */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Typ</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "EVENT", label: "Event", icon: "📅", desc: "Allgemeines Event" },
                    { value: "MEETING", label: "Treffen", icon: "🤝", desc: "Team-Meeting o.ä." },
                    ...(isAdminOrCommittee ? [
                      { value: "EXAM", label: "Klausur", icon: "📝", desc: "Prüfung / Test" },
                      { value: "DEADLINE", label: "Frist", icon: "⏰", desc: "Abgabe / Deadline" },
                    ] : []),
                  ].map((opt) => (
                    <button key={opt.value} type="button" onClick={() => setForm({ ...form, type: opt.value })}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        form.type === opt.value ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30" : "border-gray-200 dark:border-gray-600 hover:border-gray-300"
                      }`}>
                      <div className="text-base mb-0.5">{opt.icon}</div>
                      <div className="text-xs font-medium text-gray-900 dark:text-white">{opt.label}</div>
                      <div className="text-[10px] text-gray-400">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Ganztägig */}
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span className="text-sm text-gray-700 dark:text-gray-300">Ganztägig</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={form.allDay} onChange={(e) => setForm({ ...form, allDay: e.target.checked })} className="sr-only peer" />
                  <div className="w-10 h-5 bg-gray-300 rounded-full peer peer-checked:bg-blue-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
                </label>
              </div>

              {/* Start-Datum/Zeit */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Start *</label>
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
                  {!form.allDay && (
                    <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                      className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
                  )}
                </div>
              </div>

              {/* End-Datum/Zeit */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Ende (optional)</label>
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
                  {!form.allDay && (
                    <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                      className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
                  )}
                </div>
              </div>

              {/* Ort */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Ort</label>
                <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="z.B. Raum 204, Aula, Stadthalle..."
                  className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowCreate(false); setCreateError(""); }}
                  className="flex-1 py-2.5 border dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-sm">
                  Abbrechen
                </button>
                <button type="submit" disabled={createLoading}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-50">
                  {createLoading ? "Wird erstellt..." : "Event erstellen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}