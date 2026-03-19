"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface Task {
  id: string;
  title: string;
  description: string | null;
  type: "ONE_TIME" | "RECURRING";
  status: string;
  assignmentMode: string;
  isTeamTask: boolean;
  priority: number;
  dueDate: string | null;
  nextDueDate: string | null;
  createdBy: { id: string; name: string };
  assignments: {
    id: string;
    user: { id: string; name: string };
    status: string;
    ratings: { score: number }[];
  }[];
  avgRating: number | null;
  createdAt: string;
}

const statusLabels: Record<string, string> = {
  OPEN: "Offen",
  ASSIGNED: "Zugewiesen",
  IN_PROGRESS: "In Bearbeitung",
  COMPLETED: "Erledigt",
  VERIFIED: "Bestätigt",
};

const statusColors: Record<string, string> = {
  OPEN: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  ASSIGNED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  COMPLETED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  VERIFIED: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
};

const priorityLabels: Record<number, string> = {
  1: "Niedrig",
  2: "Gering",
  3: "Mittel",
  4: "Hoch",
  5: "Dringend",
};

const priorityColors: Record<number, string> = {
  1: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
  2: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
  3: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  4: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  5: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default function TasksPage() {
  const { data: session } = useSession();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");
  const [showMyTasks, setShowMyTasks] = useState(false);

  const userRole = session?.user?.role;
  const isAdminOrCommittee = userRole === "ADMIN" || userRole === "COMMITTEE";

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "ALL") params.set("status", filter);
      if (showMyTasks) params.set("myTasks", "true");

      const res = await fetch(`/api/tasks?${params}`);
      if (res.ok) setTasks(await res.json());
    } catch (error) {
      console.error("Fehler:", error);
    } finally {
      setLoading(false);
    }
  }, [filter, showMyTasks]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "short",
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm">
            ← Zurück
          </Link>
          <h1 className="text-sm font-semibold text-gray-900 dark:text-white">Aufgaben</h1>
          {isAdminOrCommittee ? (
            <Link href="/dashboard/tasks/new" className="text-sm text-blue-600 dark:text-blue-400 font-medium">
              + Neu
            </Link>
          ) : (
            <div className="w-10"></div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-5 space-y-4">
        {/* Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 overflow-x-auto">
            {["ALL", "OPEN", "ASSIGNED", "IN_PROGRESS", "COMPLETED"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  filter === s
                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
                }`}
              >
                {s === "ALL" ? "Alle" : statusLabels[s]}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showMyTasks}
              onChange={(e) => setShowMyTasks(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            Nur meine
          </label>
        </div>

        {/* Zähler */}
        <p className="text-xs text-gray-400">
          {tasks.length} Aufgabe{tasks.length !== 1 ? "n" : ""}
          {showMyTasks ? " (deine)" : ""}
        </p>

        {/* Task Liste */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Laden...</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">Keine Aufgaben gefunden</p>
            {isAdminOrCommittee && (
              <Link href="/dashboard/tasks/new" className="inline-block mt-4 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">
                Erste Aufgabe erstellen
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <Link
                key={task.id}
                href={`/dashboard/tasks/${task.id}`}
                className="block bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl p-4 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Titel + Badges */}
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                        {task.title}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[task.status]}`}>
                        {statusLabels[task.status]}
                      </span>
                      {task.type === "RECURRING" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                          Wiederkehrend
                        </span>
                      )}
                      {task.isTeamTask && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">
                          Team
                        </span>
                      )}
                    </div>

                    {task.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mb-2">
                        {task.description}
                      </p>
                    )}

                    {/* Meta */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${priorityColors[task.priority]}`}>
                        {priorityLabels[task.priority]}
                      </span>

                      {task.assignments.length > 0 && (
                        <span className="text-[10px] text-gray-400">
                          {task.assignments.map((a) => a.user.name).join(", ")}
                        </span>
                      )}

                      {(task.dueDate || task.nextDueDate) && (
                        <span className="text-[10px] text-gray-400">
                          {formatDate(task.dueDate || task.nextDueDate)}
                        </span>
                      )}

                      {task.avgRating !== null && (
                        <span className="text-[10px] text-yellow-500">
                          {"★".repeat(Math.round(task.avgRating))} {task.avgRating.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Chevron */}
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0 mt-1">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Admin: Rotation */}
        {userRole === "ADMIN" && (
          <div className="pt-4 border-t dark:border-gray-700">
            <button
              type="button"
              onClick={async () => {
                if (confirm("Wiederkehrende Aufgaben jetzt rotieren?")) {
                  const res = await fetch("/api/tasks/rotate", { method: "POST" });
                  if (res.ok) {
                    const data = await res.json();
                    alert(`${data.rotatedCount} Aufgaben rotiert!`);
                    fetchTasks();
                  } else {
                    alert("Fehler bei der Rotation");
                  }
                }
              }}
              className="text-xs text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              Wiederkehrende Aufgaben manuell rotieren
            </button>
          </div>
        )}
      </main>
    </div>
  );
}