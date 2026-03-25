"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";

// --- Types ---

interface Task {
  id: string;
  title: string;
  status: string;
  priority: number;
  dueDate: string | null;
  nextDueDate: string | null;
  type: string;
  assignments: { id: string; status: string; user: { id: string; name: string } }[];
}

interface CalendarEvent {
  id: string;
  title: string;
  startDate: string;
  location: string | null;
  type: string;
}

interface FinanceData {
  balance: number;
  totalIncome: number;
  totalExpense: number;
  goal: number;
  pendingCount: number;
  recentTransactions: { id: string; amount: number; type: string; reason: string; category: string | null; createdAt: string }[];
}

interface StoryData {
  id: string;
  text: string | null;
  mediaUrl: string | null;
  createdBy: { id: string; name: string };
  team: { id: string; name: string; color: string } | null;
  commentCount: number;
  hoursLeft: number;
  createdAt: string;
}

interface NotifData {
  id: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  pinned: boolean;
  isRead: boolean;
  createdAt: string;
}

// --- Helpers ---

function toLocalDateStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Heute";
  if (diffDays === 1) return "Morgen";
  if (diffDays < 7) return `In ${diffDays} Tagen`;
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "short" });
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "gerade eben";
  if (mins < 60) return `vor ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours}h`;
  return `vor ${Math.floor(hours / 24)}d`;
}

const WEEKDAYS_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const EVENT_DOT_COLORS: Record<string, string> = {
  EVENT: "bg-blue-500",
  EXAM: "bg-red-500",
  DEADLINE: "bg-orange-500",
  MEETING: "bg-purple-500",
};

const NOTIF_ICONS: Record<string, string> = {
  GLOBAL: "📢",
  STORY: "📸",
  CHAT: "💬",
  EVENT: "📅",
  TASK: "📋",
  POLL: "🗳️",
  TRANSACTION: "💰",
};

// --- Main Component ---

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const hasFetched = useRef(false);

  // Data
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [nextEvent, setNextEvent] = useState<CalendarEvent | null>(null);
  const [weekEvents, setWeekEvents] = useState<CalendarEvent[]>([]);
  const [finance, setFinance] = useState<FinanceData | null>(null);
  const [stories, setStories] = useState<StoryData[]>([]);
  const [notifications, setNotifications] = useState<NotifData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pinnedNotif, setPinnedNotif] = useState<NotifData | null>(null);
  const [showPinned, setShowPinned] = useState(true);
  const [selectedCalDay, setSelectedCalDay] = useState<Date | null>(null);

  // Popups
  const [showNotifPopup, setShowNotifPopup] = useState(false);
  const [showCalPopup, setShowCalPopup] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (!session || hasFetched.current) return;
    hasFetched.current = true;

    async function loadData() {
      try {
        const [tasksRes, eventsRes, financeRes, storiesRes, unreadRes, notifsRes] = await Promise.all([
          fetch("/api/tasks?myTasks=true"),
          fetch("/api/events"),
          fetch("/api/finance"),
          fetch("/api/stories"),
          fetch("/api/notifications/unread"),
          fetch("/api/notifications"),
        ]);

        if (tasksRes.ok) setMyTasks(await tasksRes.json());

        if (eventsRes.ok) {
          const allEvents: CalendarEvent[] = await eventsRes.json();
          const now = new Date();
          const upcoming = allEvents.filter((e) => new Date(e.startDate) >= now);
          if (upcoming.length > 0) setNextEvent(upcoming[0]);

          // Woche berechnen
          const startOfWeek = new Date(now);
          const day = startOfWeek.getDay();
          const diff = day === 0 ? -6 : 1 - day;
          startOfWeek.setDate(startOfWeek.getDate() + diff);
          startOfWeek.setHours(0, 0, 0, 0);
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(endOfWeek.getDate() + 7);

          setWeekEvents(
            allEvents.filter((e) => {
              const d = new Date(e.startDate);
              return d >= startOfWeek && d < endOfWeek;
            })
          );
        }

        if (financeRes.ok) setFinance(await financeRes.json());
        if (storiesRes.ok) setStories(await storiesRes.json());

        if (unreadRes.ok) {
          const data = await unreadRes.json();
          setUnreadCount(data.unreadCount);
        }

        if (notifsRes.ok) {
          const notifs: NotifData[] = await notifsRes.json();
          setNotifications(notifs.slice(0, 10));
          const pinned = notifs.find((n) => n.priority === "HIGH" && !n.isRead) ||
                         notifs.find((n) => n.pinned && !n.isRead);
          if (pinned) setPinnedNotif(pinned);
        }
      } catch (error) {
        console.error("Fehler:", error);
      }
    }

    loadData();
  }, [session]);

  async function markNotifRead(ids: string[]) {
    try {
      await fetch("/api/notifications/unread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds: ids }),
      });
      setNotifications((prev) =>
        prev.map((n) => (ids.includes(n.id) ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - ids.length));
    } catch {}
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400 text-sm">Laden...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const topTask = myTasks
    .filter((t) => t.status !== "COMPLETED" && t.status !== "VERIFIED")
    .sort((a, b) => b.priority - a.priority)[0];

  const goalPercent = finance
    ? Math.min(100, Math.round((finance.balance / Math.max(finance.goal, 1)) * 100))
    : 0;

  // Kalender-Woche berechnen
  const now = new Date();
  const startOfWeek = new Date(now);
  const dayOfWeek = startOfWeek.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  startOfWeek.setDate(startOfWeek.getDate() + diffToMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + i);
    return d;
  });

  function getEventsForDay(date: Date) {
    const dateStr = toLocalDateStr(date);
    return weekEvents.filter((e) => e.startDate.startsWith(dateStr));
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* --- Navbar --- */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-bold text-blue-700 dark:text-blue-400">AbiOrga</Link>
          <div className="flex items-center gap-1.5">
            {session?.user?.role === "ADMIN" && (
              <Link href="/dashboard/admin"
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Admin Panel">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </Link>
            )}
            {/* Kalender Popup */}
            <div className="relative">
              <button type="button" onClick={() => { setShowCalPopup(!showCalPopup); setShowNotifPopup(false); }}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </button>

              {showCalPopup && (
                <div className="absolute right-0 top-12 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-xl border dark:border-gray-700 z-50 overflow-hidden">
                  <div className="p-3 border-b dark:border-gray-700">
                    <p className="text-xs font-semibold text-gray-900 dark:text-white">Diese Woche</p>
                  </div>
                  <div className="p-2">
                    <div className="grid grid-cols-7 gap-0.5">
                      {weekDays.map((day, i) => {
                        const isToday = day.toDateString() === now.toDateString();
                        const dayEvents = getEventsForDay(day);
                        return (
                          <div key={i} className="text-center py-1.5">
                            <p className="text-[9px] text-gray-400 mb-0.5">{WEEKDAYS_SHORT[i]}</p>
                            <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedCalDay(selectedCalDay?.toDateString() === day.toDateString() ? null : day); }}
                              className={`w-8 h-8 mx-auto rounded-lg flex items-center justify-center text-xs font-medium transition-colors ${
                                isToday ? "bg-blue-600 text-white"
                                : selectedCalDay?.toDateString() === day.toDateString() ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                                : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                              }`}>
                                {day.getDate()}
                            </button>
                            <div className="flex justify-center gap-0.5 mt-0.5 h-1.5">
                              {dayEvents.slice(0, 3).map((ev) => (
                                <span key={ev.id} className={`w-1 h-1 rounded-full ${EVENT_DOT_COLORS[ev.type] || "bg-gray-400"}`}></span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Events dieser Woche */}
                    {weekEvents.length > 0 && (
                      <div className="mt-2 pt-2 border-t dark:border-gray-700 space-y-1.5 max-h-32 overflow-y-auto">
                        {weekEvents.slice(0, 4).map((ev) => (
                          <div key={ev.id} className="flex items-center gap-2 px-1">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${EVENT_DOT_COLORS[ev.type] || "bg-gray-400"}`}></span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] text-gray-900 dark:text-white truncate">{ev.title}</p>
                              <p className="text-[9px] text-gray-400">{formatDate(ev.startDate)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Ausgewählter Tag */}
                    {selectedCalDay && (
                      <div className="px-2 pb-2">
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2">
                          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                            {selectedCalDay.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "short" })}
                          </p>
                          {getEventsForDay(selectedCalDay).length === 0 ? (
                            <p className="text-[10px] text-gray-400">Keine Einträge</p>
                          ) : (
                            <div className="space-y-1">
                              {getEventsForDay(selectedCalDay).map((ev) => (
                                <div key={ev.id} className="flex items-center gap-1.5">
                                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${EVENT_DOT_COLORS[ev.type] || "bg-gray-400"}`}></span>
                                  <p className="text-[11px] text-gray-900 dark:text-white truncate">{ev.title}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-2 border-t dark:border-gray-700">
                    <Link href="/dashboard/calendar" onClick={() => setShowCalPopup(false)}
                      className="block text-center text-xs text-blue-600 dark:text-blue-400 font-medium py-1 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors">
                      Kalender öffnen
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Notification Popup */}
            <div className="relative">
              <button type="button" onClick={() => { setShowNotifPopup(!showNotifPopup); setShowCalPopup(false); setSelectedCalDay(null); }}
                className="relative p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              {showNotifPopup && (
                <div className="absolute right-0 top-12 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-xl border dark:border-gray-700 z-50 overflow-hidden">
                  <div className="p-3 border-b dark:border-gray-700 flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-900 dark:text-white">Benachrichtigungen</p>
                    {unreadCount > 0 && (
                      <button type="button" onClick={() => {
                        const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n.id);
                        if (unreadIds.length > 0) markNotifRead(unreadIds);
                      }} className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline">
                        Alle gelesen
                      </button>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.filter((n) => !n.pinned).length === 0 ? (
                      <div className="p-4 text-center">
                        <p className="text-xs text-gray-400">Keine Benachrichtigungen</p>
                      </div>
                    ) : (
                      [...notifications]
                        .filter((n) => !n.pinned)
                        .sort((a, b) => {
                          if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
                          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                        })
                        .slice(0, 8)
                        .map((notif) => (
                          <button
                            key={notif.id}
                            type="button"
                            onClick={() => { if (!notif.isRead) markNotifRead([notif.id]); }}
                            className={`w-full text-left p-3 border-b dark:border-gray-700 last:border-0 transition-colors ${
                              notif.isRead ? "opacity-60" : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              {!notif.isRead && (
                                <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                                  notif.priority === "HIGH" ? "bg-red-500" : "bg-blue-500"
                                }`}></span>
                              )}
                              {notif.isRead && <span className="w-2 h-2 mt-1.5 flex-shrink-0"></span>}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs">{NOTIF_ICONS[notif.type] || "🔔"}</span>
                                  <p className={`text-xs font-medium truncate ${notif.isRead ? "text-gray-500" : "text-gray-900 dark:text-white"}`}>
                                    {notif.title}
                                  </p>
                                  {notif.priority === "HIGH" && (
                                    <span className="text-[8px] font-bold bg-red-500 text-white px-1 py-0.5 rounded">!</span>
                                  )}
                                </div>
                                <p className="text-[10px] text-gray-400 truncate mt-0.5">{notif.message}</p>
                                <p className="text-[9px] text-gray-400 mt-0.5">{timeAgo(notif.createdAt)}</p>
                              </div>
                            </div>
                          </button>
                        ))
                    )}
                  </div>
                  <div className="p-2 border-t dark:border-gray-700">
                    <Link href="/dashboard/notifications" onClick={() => setShowNotifPopup(false)}
                      className="block text-center text-xs text-blue-600 dark:text-blue-400 font-medium py-1 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors">
                      Alle Benachrichtigungen
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Profil */}
            <Link href="/dashboard/profile" className="w-8 h-8 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full flex items-center justify-center text-sm font-bold hover:ring-2 hover:ring-blue-300 transition-all">
              {session.user.name?.charAt(0).toUpperCase() || "?"}
            </Link>

            <button onClick={() => signOut({ callbackUrl: "/login" })} className="hidden sm:block px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition font-medium ml-1">
              Abmelden
            </button>
          </div>
        </div>
      </header>

      {/* Popup Overlay */}
      {(showNotifPopup || showCalPopup) && (
        <div className="fixed inset-0 z-30" onClick={() => { setShowNotifPopup(false); setShowCalPopup(false); setSelectedCalDay(null);}}></div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-5 space-y-5">
        {/* --- Gepinnte Nachricht --- */}
        {pinnedNotif && showPinned && (
          <div className={`rounded-xl p-4 text-white shadow-lg ${
            pinnedNotif.priority === "HIGH" ? "bg-gradient-to-r from-red-500 to-red-600" : "bg-gradient-to-r from-amber-500 to-orange-500"
          }`}>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0 text-sm">
                {pinnedNotif.priority === "HIGH" ? "🚨" : "📢"}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm">{pinnedNotif.title}</h3>
                <p className="text-white/90 text-xs mt-0.5 leading-relaxed">{pinnedNotif.message}</p>
              </div>
              <button type="button" onClick={() => { setShowPinned(false); markNotifRead([pinnedNotif.id]); }}
                className="text-white/60 hover:text-white text-lg leading-none flex-shrink-0">×</button>
            </div>
          </div>
        )}

        {/* --- Finanzen (echte Daten) --- */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Abi-Kasse</h2>
            <Link href="/dashboard/finance" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Details</Link>
          </div>

          {finance ? (
            <>
              <div className="flex items-end justify-between mb-4">
                <div>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{formatCurrency(finance.balance)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Ziel: {formatCurrency(finance.goal)}</p>
                </div>
                <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 rounded-lg">{goalPercent}%</span>
              </div>
              <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${goalPercent}%`, background: "linear-gradient(90deg, #3B82F6, #8B5CF6)" }}></div>
              </div>
              {finance.recentTransactions.length > 0 && (
                <div className="flex gap-3 mt-4">
                  {finance.recentTransactions.slice(0, 2).map((tx) => (
                    <div key={tx.id} className="flex-1 bg-gray-50 dark:bg-gray-700 rounded-lg p-2.5">
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{tx.reason}</p>
                      <p className={`text-sm font-semibold mt-0.5 ${tx.type === "INCOME" ? "text-green-600" : "text-red-500"}`}>
                        {tx.type === "INCOME" ? "+" : "−"}{formatCurrency(tx.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {finance.pendingCount > 0 && (
                <Link href="/dashboard/finance" className="block mt-3 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                  {finance.pendingCount} ausstehende Genehmigung{finance.pendingCount !== 1 ? "en" : ""}
                </Link>
              )}
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-xs text-gray-400">Wird geladen...</p>
            </div>
          )}
        </div>

        {/* --- Highlights --- */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Highlights</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Aufgabe */}
            {topTask ? (
              <Link href={`/dashboard/tasks/${topTask.id}`} className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-4 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all group">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-lg flex items-center justify-center text-sm">📋</div>
                  <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">Deine Aufgabe</span>
                </div>
                <h3 className="font-semibold text-sm text-gray-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">{topTask.title}</h3>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    topTask.priority >= 4 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    : topTask.priority === 3 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                  }`}>
                    {topTask.priority >= 4 ? "Dringend" : topTask.priority === 3 ? "Mittel" : "Normal"}
                  </span>
                  {(topTask.dueDate || topTask.nextDueDate) && <span className="text-[10px] text-gray-400">{formatDate(topTask.dueDate || topTask.nextDueDate)}</span>}
                </div>
              </Link>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300 rounded-lg flex items-center justify-center text-sm">✓</div>
                  <span className="text-[11px] font-medium text-green-600 dark:text-green-400 uppercase tracking-wide">Aufgaben</span>
                </div>
                <h3 className="font-semibold text-sm text-gray-900 dark:text-white">Alles erledigt!</h3>
                <p className="text-[10px] text-gray-400 mt-1">Keine offenen Aufgaben</p>
              </div>
            )}

            {/* Nächstes Event */}
            <Link href="/dashboard/calendar" className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-4 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-md transition-all group">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 rounded-lg flex items-center justify-center text-sm">📅</div>
                <span className="text-[11px] font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wide">Nächstes Event</span>
              </div>
              {nextEvent ? (
                <>
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-white group-hover:text-purple-700 dark:group-hover:text-purple-400 transition-colors">{nextEvent.title}</h3>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] text-gray-400">{formatDate(nextEvent.startDate)}</span>
                    {nextEvent.location && <><span className="text-[10px] text-gray-300">•</span><span className="text-[10px] text-gray-400">{nextEvent.location}</span></>}
                  </div>
                </>
              ) : (
                <>
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-white">Keine Events</h3>
                  <p className="text-[10px] text-gray-400 mt-1">Erstelle Termine im Kalender</p>
                </>
              )}
            </Link>
          </div>
        </div>

        {/* --- Team Stories (echte Daten) --- */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Team Updates</h2>
            <Link href="/dashboard/stories" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Alle</Link>
          </div>
          {stories.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x">
              {stories.slice(0, 8).map((story) => (
                <Link href="/dashboard/stories" key={story.id}
                  className="flex-shrink-0 w-56 bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-4 snap-start hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: story.team?.color || "#4472C4" }}>
                      {story.team?.name.charAt(0) || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{story.team?.name || "Team"}</p>
                      <p className="text-[10px] text-gray-400">{timeAgo(story.createdAt)}</p>
                    </div>
                    <span className="text-[9px] text-gray-400">{story.hoursLeft}h</span>
                  </div>
                  {story.mediaUrl && (
                    <img src={story.mediaUrl} alt="" className="w-full h-24 object-cover rounded-lg mb-2" />
                  )}
                  {story.text && (
                    <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed line-clamp-2">{story.text}</p>
                  )}
                  {story.commentCount > 0 && (
                    <p className="text-[10px] text-gray-400 mt-1.5">{story.commentCount} Kommentar{story.commentCount !== 1 ? "e" : ""}</p>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-6 text-center">
              <p className="text-xs text-gray-400">Noch keine Stories. Tritt einem Team bei und poste die erste!</p>
            </div>
          )}
        </div>

        {/* --- Module --- */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Module</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <ModuleCard title="Aufgaben" icon="📋" href="/dashboard/tasks"
              count={myTasks.filter((t) => t.status !== "COMPLETED" && t.status !== "VERIFIED").length} countLabel="offen" />
            <ModuleCard title="Kalender" icon="📅" href="/dashboard/calendar" />
            <ModuleCard title="Abstimmung" icon="🗳️" href="/dashboard/polls" />
            <ModuleCard title="Events" icon="🎉" href="/dashboard/events" />
            <ModuleCard title="Finanzen" icon="💰" href="/dashboard/finance" />
            <ModuleCard title="Teams" icon="👥" href="/dashboard/teams" />
            <ModuleCard title="Stories" icon="📸" href="/dashboard/stories" />
          </div>
        </div>
      </main>
    </div>
  );
}

function ModuleCard({ title, icon, href, count, countLabel }: {
  title: string; icon: string; href: string; count?: number; countLabel?: string;
}) {
  return (
    <Link href={href} className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-4 text-center hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all">
      <div className="text-2xl mb-2">{icon}</div>
      <p className="text-xs font-semibold text-gray-900 dark:text-white">{title}</p>
      {count !== undefined && count > 0 && <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium mt-0.5">{count} {countLabel}</p>}
    </Link>
  );
}