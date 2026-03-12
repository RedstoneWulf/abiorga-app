"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

// --- Typen ---

interface TaskAssignment {
  id: string;
  status: string;
  user: { id: string; name: string };
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  dueDate: string | null;
  nextDueDate: string | null;
  type: string;
  assignments: TaskAssignment[];
}

interface Notification {
  id: string;
  title: string;
  message: string;
  scope: string;
  pinned: boolean;
  createdAt: string;
}

// --- Platzhalter-Daten (werden später durch echte APIs ersetzt) ---

const MOCK_FINANCE = {
  balance: 1247.5,
  goal: 5000,
  recentTransactions: [
    { label: "Kuchenverkauf", amount: 186.0, type: "INCOME" },
    { label: "Deko-Material", amount: -43.2, type: "EXPENSE" },
  ],
};

const MOCK_EVENTS = [
  {
    id: "1",
    title: "Motto-Woche Planung",
    date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    location: "Raum 204",
  },
  {
    id: "2",
    title: "Abi-Ball Besichtigung",
    date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    location: "Stadthalle",
  },
];

const MOCK_STORIES = [
  {
    id: "1",
    team: "Deko-Team",
    color: "#8B5CF6",
    text: "Erste Deko-Entwürfe sind fertig! 🎨",
    timeAgo: "vor 2h",
  },
  {
    id: "2",
    team: "Finanz-Team",
    color: "#10B981",
    text: "Kuchenverkauf war ein voller Erfolg! 🍰",
    timeAgo: "vor 5h",
  },
  {
    id: "3",
    team: "Motto-Team",
    color: "#F59E0B",
    text: "Abstimmung für das Motto läuft!",
    timeAgo: "vor 1d",
  },
];

// --- Hilfsfunktionen ---

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.ceil(
    (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "Heute";
  if (diffDays === 1) return "Morgen";
  if (diffDays < 7) return `In ${diffDays} Tagen`;

  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
  });
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

// --- Hauptkomponente ---

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(true);

  const userId = session?.user?.id;
  const userRole = session?.user?.role;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const fetchMyTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks?myTasks=true");
      if (res.ok) {
        const data = await res.json();
        setMyTasks(data);
      }
    } catch (error) {
      console.error("Fehler beim Laden der Aufgaben:", error);
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  useEffect(() => {
    if (session) {
      fetchMyTasks();
    }
  }, [session, fetchMyTasks]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400 text-sm">Laden...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  // Wichtigste Aufgabe: höchste Priorität, nicht erledigt
  const topTask = myTasks
    .filter((t) => t.status !== "COMPLETED" && t.status !== "VERIFIED")
    .sort((a, b) => b.priority - a.priority)[0];

  // Nächstes Event
  const nextEvent = MOCK_EVENTS[0];

  // Finanzen
  const finance = MOCK_FINANCE;
  const goalPercent = Math.min(
    100,
    Math.round((finance.balance / finance.goal) * 100)
  );

  // Ungelesene Benachrichtigungen (Platzhalter)
  const unreadCount = 3;

  // Gepinnte / wichtige Benachrichtigungen
  const pinnedNotification = {
    id: "pinned-1",
    title: "Abi-Beitrag fällig",
    message:
      "Bitte überweist bis Freitag 50€ auf das Abi-Konto. Infos im Finanz-Bereich.",
    pinned: true,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* --- Navbar --- */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-bold text-blue-700">
            AbiOrga
          </Link>
          <div className="flex items-center gap-3">
            {/* Benachrichtigungs-Glocke */}
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5"
              >
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* User Info */}
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-gray-900">
                {session.user.name}
              </p>
              <p className="text-[11px] text-gray-400">{session.user.role}</p>
            </div>

            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition font-medium"
            >
              Abmelden
            </button>
          </div>
        </div>

        {/* Benachrichtigungs-Dropdown */}
        {showNotifications && (
          <div className="absolute right-4 top-14 w-80 bg-white rounded-xl shadow-xl border z-50">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-900 text-sm">
                Benachrichtigungen
              </h3>
            </div>
            <div className="max-h-64 overflow-y-auto">
              <div className="p-3 border-b hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full mt-1.5 flex-shrink-0"></span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Abi-Beitrag fällig
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      50€ bis Freitag überweisen
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      vor 2 Stunden
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-3 border-b hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Neue Aufgabe zugewiesen
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Mülldienst diese Woche
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      vor 5 Stunden
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-gray-300 rounded-full mt-1.5 flex-shrink-0"></span>
                  <div>
                    <p className="text-sm text-gray-700">
                      Deko-Team hat eine Story gepostet
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">gestern</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-3 border-t">
              <button className="text-xs text-blue-600 hover:text-blue-700 font-medium w-full text-center">
                Alle Benachrichtigungen ansehen
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Klick-Overlay zum Schließen */}
      {showNotifications && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setShowNotifications(false)}
        ></div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-5 space-y-5">
        {/* --- Wichtige Benachrichtigung (Pinned) --- */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-4 h-4"
              >
                <path
                  fillRule="evenodd"
                  d="M5.25 9a6.75 6.75 0 0113.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 01-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 11-7.48 0 24.585 24.585 0 01-4.831-1.244.75.75 0 01-.298-1.205A8.217 8.217 0 005.25 9.75V9zm4.502 8.9a2.25 2.25 0 104.496 0 25.057 25.057 0 01-4.496 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm">{pinnedNotification.title}</h3>
              <p className="text-white/90 text-xs mt-0.5 leading-relaxed">
                {pinnedNotification.message}
              </p>
            </div>
            <button className="text-white/60 hover:text-white text-lg leading-none flex-shrink-0">
              ×
            </button>
          </div>
        </div>

        {/* --- Finanzen Quickview --- */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                Abi-Kasse
              </h2>
              <span className="text-xs text-gray-400">Bald verfügbar</span>
            </div>

            <div className="flex items-end justify-between mb-4">
              <div>
                <p className="text-3xl font-bold text-gray-900">
                  {formatCurrency(finance.balance)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Ziel: {formatCurrency(finance.goal)}
                </p>
              </div>
              <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
                {goalPercent}%
              </span>
            </div>

            {/* Fortschrittsbalken */}
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: `${goalPercent}%`,
                  background: `linear-gradient(90deg, #3B82F6, #8B5CF6)`,
                }}
              ></div>
            </div>

            {/* Letzte Transaktionen */}
            <div className="flex gap-3 mt-4">
              {finance.recentTransactions.map((tx, i) => (
                <div
                  key={i}
                  className="flex-1 bg-gray-50 rounded-lg p-2.5"
                >
                  <p className="text-[11px] text-gray-500 truncate">
                    {tx.label}
                  </p>
                  <p
                    className={`text-sm font-semibold mt-0.5 ${
                      tx.type === "INCOME" ? "text-green-600" : "text-red-500"
                    }`}
                  >
                    {tx.type === "INCOME" ? "+" : ""}
                    {formatCurrency(tx.amount)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* --- Highlights --- */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Highlights
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Wichtigste Aufgabe */}
            {topTask ? (
              <Link
                href={`/dashboard/tasks/${topTask.id}`}
                className="bg-white rounded-xl border p-4 hover:border-blue-300 hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-sm">
                    📋
                  </div>
                  <span className="text-[11px] font-medium text-blue-600 uppercase tracking-wide">
                    Deine Aufgabe
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                  {topTask.title}
                </h3>
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      topTask.priority >= 4
                        ? "bg-red-100 text-red-700"
                        : topTask.priority === 3
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {topTask.priority >= 4
                      ? "Dringend"
                      : topTask.priority === 3
                      ? "Mittel"
                      : "Normal"}
                  </span>
                  {(topTask.dueDate || topTask.nextDueDate) && (
                    <span className="text-xs text-gray-400">
                      {formatDate(topTask.dueDate || topTask.nextDueDate)}
                    </span>
                  )}
                </div>
              </Link>
            ) : (
              <div className="bg-white rounded-xl border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-green-100 text-green-600 rounded-lg flex items-center justify-center text-sm">
                    ✓
                  </div>
                  <span className="text-[11px] font-medium text-green-600 uppercase tracking-wide">
                    Aufgaben
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900">
                  Alles erledigt!
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Du hast keine offenen Aufgaben
                </p>
              </div>
            )}

            {/* Nächstes Event */}
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center text-sm">
                  📅
                </div>
                <span className="text-[11px] font-medium text-purple-600 uppercase tracking-wide">
                  Nächstes Event
                </span>
              </div>
              <h3 className="font-semibold text-gray-900">
                {nextEvent.title}
              </h3>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-gray-400">
                  {formatDate(nextEvent.date)}
                </span>
                <span className="text-xs text-gray-300">•</span>
                <span className="text-xs text-gray-400">
                  {nextEvent.location}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* --- Team Stories --- */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Team Updates
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x">
            {MOCK_STORIES.map((story) => (
              <div
                key={story.id}
                className="flex-shrink-0 w-56 bg-white rounded-xl border p-4 snap-start hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: story.color }}
                  >
                    {story.team.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-900">
                      {story.team}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {story.timeAgo}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {story.text}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* --- Alle Module --- */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Module
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <ModuleCard
              title="Aufgaben"
              icon="📋"
              href="/dashboard/tasks"
              count={
                myTasks.filter(
                  (t) =>
                    t.status !== "COMPLETED" && t.status !== "VERIFIED"
                ).length
              }
              countLabel="offen"
            />
            <ModuleCard title="Finanzen" icon="💰" comingSoon />
            <ModuleCard title="Events" icon="📅" comingSoon />
            <ModuleCard title="Teams" icon="👥" comingSoon />
            <ModuleCard title="Stories" icon="📸" comingSoon />
          </div>
        </div>
      </main>
    </div>
  );
}

// --- Modul-Karte ---

function ModuleCard({
  title,
  icon,
  href,
  comingSoon,
  count,
  countLabel,
}: {
  title: string;
  icon: string;
  href?: string;
  comingSoon?: boolean;
  count?: number;
  countLabel?: string;
}) {
  const content = (
    <>
      <div className="text-2xl mb-2">{icon}</div>
      <p className="text-xs font-semibold text-gray-900">{title}</p>
      {count !== undefined && count > 0 && (
        <p className="text-[10px] text-blue-600 font-medium mt-0.5">
          {count} {countLabel}
        </p>
      )}
      {comingSoon && (
        <p className="text-[10px] text-gray-400 mt-0.5">Bald</p>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="bg-white rounded-xl border p-4 text-center hover:border-blue-300 hover:shadow-md transition-all"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="bg-white rounded-xl border p-4 text-center opacity-60">
      {content}
    </div>
  );
}