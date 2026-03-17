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
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: number;
  dueDate: string | null;
  nextDueDate: string | null;
}

const EVENT_COLORS: Record<string, { bg: string; text: string; dot: string; bar: string }> = {
  EVENT: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", dot: "bg-blue-500", bar: "bg-blue-500" },
  EXAM: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300", dot: "bg-red-500", bar: "bg-red-500" },
  DEADLINE: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300", dot: "bg-orange-500", bar: "bg-orange-500" },
  MEETING: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300", dot: "bg-purple-500", bar: "bg-purple-500" },
  TASK: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-300", dot: "bg-green-500", bar: "bg-green-500" },
};

const EVENT_LABELS: Record<string, string> = {
  EVENT: "Event",
  EXAM: "Klausur",
  DEADLINE: "Frist",
  MEETING: "Treffen",
  TASK: "Aufgabe",
};

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

export default function CalendarPage() {
  const { data: session } = useSession();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [newEvent, setNewEvent] = useState({
    title: "",
    type: "EVENT" as string,
    startDate: "",
    startTime: "",
    location: "",
    description: "",
    allDay: false,
  });
  const [createLoading, setCreateLoading] = useState(false);

  const userRole = session?.user?.role;
  const isAdminOrCommittee = userRole === "ADMIN" || userRole === "COMMITTEE";

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;

  const fetchData = useCallback(async () => {
    try {
      const [eventsRes, tasksRes] = await Promise.all([
        fetch(`/api/events?month=${monthStr}`),
        fetch("/api/tasks?myTasks=true"),
      ]);
      if (eventsRes.ok) setEvents(await eventsRes.json());
      if (tasksRes.ok) setTasks(await tasksRes.json());
    } catch (error) {
      console.error("Fehler:", error);
    }
  }, [monthStr]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const totalDays = lastDay.getDate();

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) calendarDays.push(null);
  for (let i = 1; i <= totalDays; i++) calendarDays.push(i);
  while (calendarDays.length % 7 !== 0) calendarDays.push(null);

  function getItemsForDay(day: number) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayEvents = events.filter((e) => e.startDate.startsWith(dateStr));
    const dayTasks = tasks.filter((t) => {
      const due = t.dueDate || t.nextDueDate;
      return due && due.startsWith(dateStr) && t.status !== "COMPLETED" && t.status !== "VERIFIED";
    });
    return { events: dayEvents, tasks: dayTasks };
  }

  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const selectedItems = selectedDate
    ? (() => {
        const day = parseInt(selectedDate.split("-")[2]);
        return getItemsForDay(day);
      })()
    : null;

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    setCreateLoading(true);
    try {
      let startDate = newEvent.startDate;
      if (newEvent.startTime && !newEvent.allDay) {
        startDate = `${newEvent.startDate}T${newEvent.startTime}`;
      }
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newEvent.title,
          type: newEvent.type,
          startDate,
          location: newEvent.location.length > 0 ? newEvent.location : undefined,
          description: newEvent.description.length > 0 ? newEvent.description : undefined,
          allDay: newEvent.allDay === true,
        }),
      });
      if (res.ok) {
        setShowCreateForm(false);
        setNewEvent({ title: "", type: "EVENT", startDate: "", startTime: "", location: "", description: "", allDay: false });
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch {
      alert("Netzwerkfehler");
    } finally {
      setCreateLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm">
            ← Zurück
          </Link>
          <h1 className="text-sm font-semibold text-gray-900 dark:text-white">Kalender</h1>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/events" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-medium">
              Events
            </Link>
            <button
              type="button"
              onClick={() => {
                setShowCreateForm(true);
                setNewEvent((prev) => ({
                  ...prev,
                  startDate: selectedDate || new Date().toISOString().split("T")[0],
                }));
              }}
              className="text-sm text-blue-600 dark:text-blue-400 font-medium"
            >
              + Neu
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5 space-y-4">
        {/* Monats-Navigation */}
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => { setCurrentDate(new Date(year, month - 1, 1)); setSelectedDate(null); }}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            ←
          </button>
          <div className="text-center">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{MONTH_NAMES[month]} {year}</h2>
            <button type="button" onClick={() => { setCurrentDate(new Date()); setSelectedDate(null); }}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
              Heute
            </button>
          </div>
          <button type="button" onClick={() => { setCurrentDate(new Date(year, month + 1, 1)); setSelectedDate(null); }}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            →
          </button>
        </div>

        {/* Kalender-Grid */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 overflow-hidden">
          <div className="grid grid-cols-7 border-b dark:border-gray-700">
            {WEEKDAYS.map((day) => (
              <div key={day} className="py-2 text-center text-xs font-semibold text-gray-500 dark:text-gray-400">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {calendarDays.map((day, i) => {
              if (day === null) {
                return <div key={`empty-${i}`} className="min-h-[80px] border-b border-r dark:border-gray-700 last:border-r-0 bg-gray-50/50 dark:bg-gray-800/50"></div>;
              }

              const { events: dayEvents, tasks: dayTasks } = getItemsForDay(day);
              const allItems = [
                ...dayEvents.map((e) => ({ type: e.type, title: e.title })),
                ...dayTasks.map((t) => ({ type: "TASK" as const, title: t.title })),
              ];
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isSelected = selectedDate === dateStr;

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className={`min-h-[80px] border-b border-r dark:border-gray-700 p-1 text-left transition-colors flex flex-col ${
                    isSelected
                      ? "bg-blue-50 dark:bg-blue-900/20"
                      : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  }`}
                >
                  <span
                    className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-medium mb-0.5 ${
                      isToday(day)
                        ? "bg-blue-600 text-white"
                        : "text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {day}
                  </span>
                  {/* Farbige Mini-Balken statt Punkte */}
                  <div className="flex flex-col gap-[2px] flex-1 w-full overflow-hidden">
                    {allItems.slice(0, 3).map((item, idx) => (
                      <div
                        key={idx}
                        className={`h-[5px] w-full rounded-sm ${EVENT_COLORS[item.type]?.bar || "bg-gray-400"}`}
                        title={item.title}
                      ></div>
                    ))}
                    {allItems.length > 3 && (
                      <span className="text-[8px] text-gray-400 leading-none">
                        +{allItems.length - 3}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Legende */}
        <div className="flex flex-wrap gap-4 text-xs">
          {Object.entries(EVENT_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              <span className={`w-5 h-[5px] rounded-sm ${EVENT_COLORS[key]?.bar || "bg-gray-400"}`}></span>
              <span className="text-gray-500 dark:text-gray-400">{label}</span>
            </div>
          ))}
        </div>

        {/* Ausgewählter Tag */}
        {selectedDate && selectedItems && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
              {new Date(selectedDate + "T12:00:00").toLocaleDateString("de-DE", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </h3>

            {selectedItems.events.length === 0 && selectedItems.tasks.length === 0 ? (
              <p className="text-sm text-gray-400">Keine Termine an diesem Tag</p>
            ) : (
              <div className="space-y-2">
                {selectedItems.events.map((ev) => (
                  <div key={ev.id} className={`p-3 rounded-lg border-l-4 ${EVENT_COLORS[ev.type]?.bg}`} style={{ borderLeftColor: `var(--tw-${EVENT_COLORS[ev.type]?.bar?.replace("bg-", "")})` }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2 h-2 rounded-full ${EVENT_COLORS[ev.type]?.dot}`}></span>
                      <span className={`text-[10px] font-semibold uppercase ${EVENT_COLORS[ev.type]?.text}`}>
                        {EVENT_LABELS[ev.type]}
                      </span>
                      {ev.location && <span className="text-[10px] text-gray-400">• {ev.location}</span>}
                    </div>
                    <p className={`text-sm font-medium ${EVENT_COLORS[ev.type]?.text}`}>{ev.title}</p>
                    {!ev.allDay && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(ev.startDate).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr
                      </p>
                    )}
                  </div>
                ))}
                {selectedItems.tasks.map((t) => (
                  <Link key={t.id} href={`/dashboard/tasks/${t.id}`}
                    className={`block p-3 rounded-lg border-l-4 border-green-500 ${EVENT_COLORS.TASK.bg} hover:opacity-80 transition`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      <span className={`text-[10px] font-semibold uppercase ${EVENT_COLORS.TASK.text}`}>Aufgabe</span>
                    </div>
                    <p className={`text-sm font-medium ${EVENT_COLORS.TASK.text}`}>{t.title}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Kommende Termine */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Kommende Termine
          </h2>
          <div className="space-y-2">
            {events
              .filter((e) => new Date(e.startDate) >= new Date())
              .slice(0, 5)
              .map((ev) => (
                <div key={ev.id} className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-3 flex items-center gap-3">
                  <div className={`w-1 h-10 rounded-full ${EVENT_COLORS[ev.type]?.bar}`}></div>
                  <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center ${EVENT_COLORS[ev.type]?.bg}`}>
                    <span className={`text-xs font-bold ${EVENT_COLORS[ev.type]?.text}`}>{new Date(ev.startDate).getDate()}</span>
                    <span className={`text-[9px] ${EVENT_COLORS[ev.type]?.text}`}>{new Date(ev.startDate).toLocaleDateString("de-DE", { month: "short" })}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{ev.title}</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-medium ${EVENT_COLORS[ev.type]?.text}`}>{EVENT_LABELS[ev.type]}</span>
                      {ev.location && <span className="text-[10px] text-gray-400">• {ev.location}</span>}
                    </div>
                  </div>
                </div>
              ))}
            {events.filter((e) => new Date(e.startDate) >= new Date()).length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">Keine kommenden Termine</p>
            )}
          </div>
        </div>
      </main>

      {/* Schnell-Erstellen Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-xl p-6 w-full sm:max-w-md max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Schnell hinzufügen</h3>
              <button type="button" onClick={() => setShowCreateForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <p className="text-xs text-gray-400 mb-4">Für mehr Optionen nutze die <Link href="/dashboard/events" className="text-blue-600 dark:text-blue-400 underline" onClick={() => setShowCreateForm(false)}>Events-Seite</Link></p>

            <form onSubmit={handleCreateEvent} className="space-y-4">
              <input type="text" required value={newEvent.title} onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                placeholder="Titel..." className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />

              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: "EVENT", label: "Event", icon: "📅" },
                  { value: "MEETING", label: "Treffen", icon: "🤝" },
                  ...(isAdminOrCommittee ? [
                    { value: "EXAM", label: "Klausur", icon: "📝" },
                    { value: "DEADLINE", label: "Frist", icon: "⏰" },
                  ] : []),
                ].map((opt) => (
                  <button key={opt.value} type="button" onClick={() => setNewEvent({ ...newEvent, type: opt.value })}
                    className={`p-2 rounded-lg border-2 text-xs font-medium text-center transition-all ${
                      newEvent.type === opt.value ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400"
                    }`}>
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input type="date" required value={newEvent.startDate} onChange={(e) => setNewEvent({ ...newEvent, startDate: e.target.value })}
                  className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
                {!newEvent.allDay && (
                  <input type="time" value={newEvent.startTime} onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })}
                    className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
                )}
              </div>

              <input type="text" value={newEvent.location} onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                placeholder="Ort (optional)" className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />

              <button type="submit" disabled={createLoading}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {createLoading ? "Wird erstellt..." : "Erstellen"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}