"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface EventData {
  id: string;
  title: string;
  description: string | null;
  type: string;
  category: string | null;
  startDate: string;
  endDate: string | null;
  location: string | null;
  allDay: boolean;
  isFree: boolean;
  price: number | null;
  registrationRequired: boolean;
  maxAttendees: number | null;
  visibility: string;
  contactName: string | null;
  contactInfo: string | null;
  createdBy: { id: string; name: string };
  team: { id: string; name: string; color: string } | null;
  attendeeCount: number;
  isRegistered: boolean;
  createdAt: string;
}

interface TeamOption {
  id: string;
  name: string;
  isMember: boolean;
}

const PREDEFINED_CATEGORIES = ["Treffen", "Fest", "Aufführung", "Party", "Ausflug", "Workshop", "Spendenaktion"];
const CATEGORY_ICONS: Record<string, string> = {
  Treffen: "🤝", Fest: "🎉", Aufführung: "🎭", Party: "🥳",
  Ausflug: "🚌", Workshop: "🛠️", Spendenaktion: "💝",
};

function formatEventDate(startDate: string, endDate: string | null, allDay: boolean) {
  const start = new Date(startDate);
  const dateStr = start.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" });
  if (allDay) return `${dateStr} • Ganztägig`;
  const timeStr = start.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  let result = `${dateStr} • ${timeStr} Uhr`;
  if (endDate) {
    const end = new Date(endDate);
    result += ` – ${end.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr`;
  }
  return result;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);
}

export default function EventsPage() {
  const { data: session } = useSession();
  const [events, setEvents] = useState<EventData[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [showCreate, setShowCreate] = useState(false);

  const [form, setForm] = useState({
    title: "", description: "", category: "Treffen", customCategory: "",
    startDate: "", startTime: "", endDate: "", endTime: "", location: "",
    allDay: false, isFree: true, price: "", registrationRequired: false,
    maxAttendees: "", visibility: "ALL", teamId: "",
    contactName: "", contactInfo: "",
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  const userRole = session?.user?.role;
  const isAdminOrCommittee = userRole === "ADMIN" || userRole === "COMMITTEE";

  const fetchEvents = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter !== "ALL" && filter !== "CUSTOM") params.set("category", filter);
      if (filter === "CUSTOM") params.set("category", "CUSTOM");
      // Only show EVENT type on this page
      params.set("type", "EVENT");
      const res = await fetch(`/api/events?${params}`);
      if (res.ok) setEvents(await res.json());
    } catch (error) { console.error("Fehler:", error); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  useEffect(() => {
    fetch("/api/teams").then((r) => r.ok ? r.json() : []).then(setTeams).catch(() => {});
  }, []);

  async function handleRegister(eventId: string, isRegistered: boolean) {
    try {
      const res = await fetch(`/api/events/${eventId}/register`, {
        method: isRegistered ? "DELETE" : "POST",
      });
      if (res.ok) fetchEvents();
      else { const d = await res.json(); alert(d.error); }
    } catch { alert("Netzwerkfehler"); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    setCreateLoading(true);

    try {
      let startDate = form.startDate;
      if (form.startTime && !form.allDay) startDate = `${form.startDate}T${form.startTime}`;
      let endDate: string | undefined;
      if (form.endDate) {
        endDate = form.endDate;
        if (form.endTime && !form.allDay) endDate = `${form.endDate}T${form.endTime}`;
      }

      const category = form.category === "CUSTOM" ? form.customCategory : form.category;

      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description.length > 0 ? form.description : undefined,
          type: "EVENT",
          category: category || undefined,
          startDate, endDate,
          location: form.location.length > 0 ? form.location : undefined,
          allDay: form.allDay === true,
          isFree: form.isFree,
          price: !form.isFree && form.price ? parseFloat(form.price) : undefined,
          registrationRequired: form.registrationRequired === true,
          maxAttendees: form.maxAttendees ? parseInt(form.maxAttendees) : undefined,
          visibility: form.visibility,
          teamId: form.visibility === "TEAM_ONLY" && form.teamId ? form.teamId : undefined,
          contactName: form.contactName.length > 0 ? form.contactName : undefined,
          contactInfo: form.contactInfo.length > 0 ? form.contactInfo : undefined,
        }),
      });

      if (res.ok) {
        setShowCreate(false);
        setForm({ title: "", description: "", category: "Treffen", customCategory: "", startDate: "", startTime: "", endDate: "", endTime: "", location: "", allDay: false, isFree: true, price: "", registrationRequired: false, maxAttendees: "", visibility: "ALL", teamId: "", contactName: "", contactInfo: "" });
        fetchEvents();
      } else { const d = await res.json(); setCreateError(d.error); }
    } catch { setCreateError("Netzwerkfehler"); }
    finally { setCreateLoading(false); }
  }

  const now = new Date();
  const upcoming = events.filter((e) => new Date(e.startDate) >= now);
  const past = events.filter((e) => new Date(e.startDate) < now);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm">← Dashboard</Link>
          <h1 className="text-sm font-semibold text-gray-900 dark:text-white">Events</h1>
          <button type="button" onClick={() => setShowCreate(true)} className="text-sm text-blue-600 dark:text-blue-400 font-medium">+ Neu</button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-5 space-y-4">
        {/* Filter */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            { value: "ALL", label: "Alle" },
            ...PREDEFINED_CATEGORIES.map((c) => ({ value: c, label: `${CATEGORY_ICONS[c] || ""} ${c}` })),
            { value: "CUSTOM", label: "Sonstiges" },
          ].map((f) => (
            <button key={f.value} type="button" onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                filter === f.value ? "bg-blue-600 text-white" : "bg-white dark:bg-gray-800 border dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}>{f.label}</button>
          ))}
        </div>

        {/* Events */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Laden...</div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Kommende ({upcoming.length})</h2>
                <div className="space-y-3">
                  {upcoming.map((ev) => (
                    <EventCard key={ev.id} event={ev} onRegister={handleRegister} />
                  ))}
                </div>
              </div>
            )}
            {past.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Vergangene ({past.length})</h2>
                <div className="space-y-2">
                  {past.map((ev) => (
                    <div key={ev.id} className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-3 opacity-60">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{CATEGORY_ICONS[ev.category || ""] || "📅"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{ev.title}</p>
                          <p className="text-[10px] text-gray-400">{formatEventDate(ev.startDate, ev.endDate, ev.allDay)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {upcoming.length === 0 && past.length === 0 && (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">🎉</div>
                <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">Noch keine Events</p>
                <button type="button" onClick={() => setShowCreate(true)}
                  className="inline-block mt-4 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">Event erstellen</button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-xl p-6 w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Neues Event</h3>
              <button type="button" onClick={() => { setShowCreate(false); setCreateError(""); }} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            {createError && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg p-3 mb-4 text-sm">{createError}</div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              {/* Titel */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Titel *</label>
                <input type="text" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="z.B. Abi-Ball, Filmabend..." className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
              </div>

              {/* Beschreibung */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Beschreibung</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Details zum Event..." rows={2} className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none dark:text-white" />
              </div>

              {/* Kategorie */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Kategorie</label>
                <div className="flex flex-wrap gap-1.5">
                  {PREDEFINED_CATEGORIES.map((cat) => (
                    <button key={cat} type="button" onClick={() => setForm({ ...form, category: cat })}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        form.category === cat ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                      }`}>{CATEGORY_ICONS[cat]} {cat}</button>
                  ))}
                  <button type="button" onClick={() => setForm({ ...form, category: "CUSTOM" })}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      form.category === "CUSTOM" ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                    }`}>✏️ Eigene</button>
                </div>
                {form.category === "CUSTOM" && (
                  <input type="text" value={form.customCategory} onChange={(e) => setForm({ ...form, customCategory: e.target.value })}
                    placeholder="Eigene Kategorie..." className="w-full mt-2 border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
                )}
              </div>

              {/* Datum/Zeit */}
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span className="text-sm text-gray-700 dark:text-gray-300">Ganztägig</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={form.allDay} onChange={(e) => setForm({ ...form, allDay: e.target.checked })} className="sr-only peer" />
                  <div className="w-10 h-5 bg-gray-300 rounded-full peer peer-checked:bg-blue-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Start *</label>
                  <input type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
                </div>
                {!form.allDay && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Uhrzeit</label>
                    <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                      className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Ende</label>
                  <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
                </div>
                {!form.allDay && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Bis</label>
                    <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                      className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
                  </div>
                )}
              </div>

              {/* Ort */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Ort</label>
                <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="z.B. Aula, Stadthalle..." className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
              </div>

              {/* Preis */}
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Kostenlos</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={form.isFree} onChange={(e) => setForm({ ...form, isFree: e.target.checked })} className="sr-only peer" />
                    <div className="w-10 h-5 bg-gray-300 rounded-full peer peer-checked:bg-green-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
                  </label>
                </div>
                {!form.isFree && (
                  <input type="number" min="0" step="0.50" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="Preis in €" className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
                )}
              </div>

              {/* Anmeldung */}
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">Anmeldung erforderlich</p>
                    <p className="text-[10px] text-gray-400">User müssen sich aktiv anmelden</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={form.registrationRequired} onChange={(e) => setForm({ ...form, registrationRequired: e.target.checked })} className="sr-only peer" />
                    <div className="w-10 h-5 bg-gray-300 rounded-full peer peer-checked:bg-blue-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
                  </label>
                </div>
                {form.registrationRequired && (
                  <input type="number" min="1" value={form.maxAttendees} onChange={(e) => setForm({ ...form, maxAttendees: e.target.value })}
                    placeholder="Max. Teilnehmer (leer = unbegrenzt)" className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
                )}
              </div>

              {/* Sichtbarkeit */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Sichtbarkeit</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setForm({ ...form, visibility: "ALL" })}
                    className={`p-2.5 rounded-lg border-2 text-center transition-all text-xs ${
                      form.visibility === "ALL" ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400"
                    }`}>🌍 Alle</button>
                  <button type="button" onClick={() => setForm({ ...form, visibility: "TEAM_ONLY" })}
                    className={`p-2.5 rounded-lg border-2 text-center transition-all text-xs ${
                      form.visibility === "TEAM_ONLY" ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400"
                    }`}>👥 Nur Team</button>
                </div>
                {form.visibility === "TEAM_ONLY" && (
                  <select value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value })}
                    className="w-full mt-2 border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white">
                    <option value="">Team auswählen...</option>
                    {teams.filter((t) => t.isMember).map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Kontakt */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Kontakt (bei Fragen)</label>
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                    placeholder="Name" className="border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
                  <input type="text" value={form.contactInfo} onChange={(e) => setForm({ ...form, contactInfo: e.target.value })}
                    placeholder="E-Mail / Telefon" className="border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowCreate(false); setCreateError(""); }}
                  className="flex-1 py-2.5 border dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-sm">Abbrechen</button>
                <button type="submit" disabled={createLoading}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-50">
                  {createLoading ? "Wird erstellt..." : "Event erstellen"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Event Card Component
function EventCard({ event, onRegister }: { event: EventData; onRegister: (id: string, isReg: boolean) => void }) {
  const icon = CATEGORY_ICONS[event.category || ""] || "📅";
  const spotsLeft = event.maxAttendees ? event.maxAttendees - event.attendeeCount : null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-lg flex-shrink-0">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-semibold text-sm text-gray-900 dark:text-white">{event.title}</h3>
              {event.category && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  {event.category}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{formatEventDate(event.startDate, event.endDate, event.allDay)}</p>

            {event.description && (
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">{event.description}</p>
            )}

            {/* Info Chips */}
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {event.location && (
                <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">📍 {event.location}</span>
              )}
              {event.isFree ? (
                <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">Kostenlos</span>
              ) : (
                <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">{formatCurrency(event.price || 0)}</span>
              )}
              {event.registrationRequired && (
                <span className="text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded-full">
                  Anmeldung • {event.attendeeCount}{event.maxAttendees ? `/${event.maxAttendees}` : ""}
                </span>
              )}
              {event.visibility === "TEAM_ONLY" && event.team && (
                <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
                  Nur {event.team.name}
                </span>
              )}
            </div>

            {/* Kontakt */}
            {(event.contactName || event.contactInfo) && (
              <p className="text-[10px] text-gray-400 mt-2">
                Kontakt: {event.contactName}{event.contactInfo ? ` – ${event.contactInfo}` : ""}
              </p>
            )}

            <p className="text-[10px] text-gray-400 mt-1.5">von {event.createdBy.name}</p>
          </div>
        </div>
      </div>

      {/* Anmeldung */}
      {event.registrationRequired && (
        <div className="px-4 pb-4">
          {event.isRegistered ? (
            <button type="button" onClick={() => onRegister(event.id, true)}
              className="w-full py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg text-xs font-medium hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors">
              ✓ Angemeldet – Abmelden?
            </button>
          ) : spotsLeft !== null && spotsLeft <= 0 ? (
            <div className="w-full py-2 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded-lg text-xs font-medium text-center">
              Ausgebucht
            </div>
          ) : (
            <button type="button" onClick={() => onRegister(event.id, false)}
              className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors">
              Anmelden {spotsLeft !== null ? `(${spotsLeft} Plätze frei)` : ""}
            </button>
          )}
        </div>
      )}
    </div>
  );
}