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
  OPEN: "bg-gray-100 text-gray-700",
  ASSIGNED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  COMPLETED: "bg-green-100 text-green-700",
  VERIFIED: "bg-purple-100 text-purple-700",
};

const priorityLabels: Record<number, string> = {
  1: "Niedrig",
  2: "Gering",
  3: "Mittel",
  4: "Hoch",
  5: "Dringend",
};

const priorityColors: Record<number, string> = {
  1: "text-gray-400",
  2: "text-gray-500",
  3: "text-yellow-500",
  4: "text-orange-500",
  5: "text-red-500",
};

export default function TasksPage() {
  const { data: session } = useSession();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");
  const [showMyTasks, setShowMyTasks] = useState(false);

  const userRole = session?.user?.role;
  const isAdminOrCommittee =
    userRole === "ADMIN" || userRole === "COMMITTEE";

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "ALL") params.set("status", filter);
      if (showMyTasks) params.set("myTasks", "true");

      const res = await fetch(`/api/tasks?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
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
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function renderStars(rating: number | null) {
    if (rating === null) return <span className="text-gray-400 text-sm">Keine Bewertung</span>;
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5;
    return (
      <span className="text-yellow-500 text-sm">
        {"★".repeat(full)}
        {half ? "½" : ""}
        {"☆".repeat(5 - full - (half ? 1 : 0))}
        <span className="text-gray-500 ml-1">({rating.toFixed(1)})</span>
      </span>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Aufgaben</h1>
          <p className="text-gray-500 mt-1">
            {tasks.length} Aufgabe{tasks.length !== 1 ? "n" : ""}
          </p>
        </div>
        {isAdminOrCommittee && (
          <Link
            href="/dashboard/tasks/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            + Neue Aufgabe
          </Link>
        )}
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex bg-gray-100 rounded-lg p-1">
          {["ALL", "OPEN", "ASSIGNED", "IN_PROGRESS", "COMPLETED"].map(
            (s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  filter === s
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {s === "ALL" ? "Alle" : statusLabels[s]}
              </button>
            )
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showMyTasks}
            onChange={(e) => setShowMyTasks(e.target.checked)}
            className="rounded border-gray-300"
          />
          Nur meine Aufgaben
        </label>
      </div>

      {/* Task Liste */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Laden...</div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">Keine Aufgaben gefunden</p>
          {isAdminOrCommittee && (
            <Link
              href="/dashboard/tasks/new"
              className="text-blue-600 hover:underline mt-2 inline-block"
            >
              Erstelle die erste Aufgabe
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <Link
              key={task.id}
              href={`/dashboard/tasks/${task.id}`}
              className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {task.title}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        statusColors[task.status]
                      }`}
                    >
                      {statusLabels[task.status]}
                    </span>
                    {task.type === "RECURRING" && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                        Wiederkehrend
                      </span>
                    )}
                    {task.isTeamTask && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-700">
                        Team
                      </span>
                    )}
                  </div>

                  {task.description && (
                    <p className="text-gray-500 text-sm mb-3 line-clamp-2">
                      {task.description}
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-sm">
                    <span className={priorityColors[task.priority]}>
                      {"●".repeat(task.priority)}
                      {"○".repeat(5 - task.priority)}{" "}
                      {priorityLabels[task.priority]}
                    </span>

                    {task.assignments.length > 0 && (
                      <span className="text-gray-500">
                        {task.assignments
                          .map((a) => a.user.name)
                          .join(", ")}
                      </span>
                    )}

                    {(task.dueDate || task.nextDueDate) && (
                      <span className="text-gray-500">
                        {formatDate(task.dueDate || task.nextDueDate)}
                      </span>
                    )}

                    {renderStars(task.avgRating)}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Admin: Rotation Button */}
      {userRole === "ADMIN" && (
        <div className="mt-8 pt-6 border-t border-gray-200">
          <button
            onClick={async () => {
              if (
                confirm(
                  "Wiederkehrende Aufgaben jetzt rotieren? Fällige Aufgaben werden neu zugewiesen."
                )
              ) {
                const res = await fetch("/api/tasks/rotate", {
                  method: "POST",
                });
                if (res.ok) {
                  const data = await res.json();
                  alert(`${data.rotatedCount} Aufgaben rotiert!`);
                  fetchTasks();
                } else {
                  alert("Fehler bei der Rotation");
                }
              }
            }}
            className="text-sm text-gray-500 hover:text-blue-600 transition-colors"
          >
            Wiederkehrende Aufgaben manuell rotieren
          </button>
        </div>
      )}
    </div>
  );
}