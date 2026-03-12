"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";

interface User {
  id: string;
  name: string;
}

interface Rating {
  id: string;
  score: number;
  comment: string | null;
  rater: User;
  createdAt: string;
}

interface Assignment {
  id: string;
  user: User;
  status: string;
  assignedAt: string;
  completedAt: string | null;
  ratings: Rating[];
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  type: "ONE_TIME" | "RECURRING";
  status: string;
  assignmentMode: string;
  isTeamTask: boolean;
  maxAssignees: number;
  recurrenceInterval: string | null;
  priority: number;
  dueDate: string | null;
  nextDueDate: string | null;
  createdBy: User;
  assignments: Assignment[];
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

export default function TaskDetailPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;

  const [task, setTask] = useState<Task | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [ratingScore, setRatingScore] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingAssignmentId, setRatingAssignmentId] = useState<string | null>(
    null
  );

  const currentUserId = session?.user?.id;
  const userRole = session?.user?.role;
  const isAdminOrCommittee =
    userRole === "ADMIN" || userRole === "COMMITTEE";

  const myAssignment = task?.assignments.find(
    (a) => a.user.id === currentUserId
  );

  const fetchTask = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (res.ok) {
        setTask(await res.json());
      }
    } catch (error) {
      console.error("Fehler:", error);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        setAllUsers(await res.json());
      }
    } catch (error) {
      console.error("Fehler beim Laden der User:", error);
    }
  }, []);

  useEffect(() => {
    fetchTask();
    fetchUsers();
  }, [fetchTask, fetchUsers]);

  async function handleAssign() {
    if (selectedUsers.length === 0) return;
    try {
      const url = `/api/tasks/${taskId}/assign`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: selectedUsers }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowAssignModal(false);
        setSelectedUsers([]);
        fetchTask();
      } else {
        alert(data.error || "Fehler beim Zuweisen");
      }
    } catch {
      alert("Netzwerkfehler");
    }
  }

  async function handleStatusChange(newStatus: string) {
    try {
      const res = await fetch(`/api/tasks/${taskId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchTask();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch {
      alert("Netzwerkfehler");
    }
  }

  async function handleRate() {
    if (!ratingAssignmentId || ratingScore === 0) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: ratingAssignmentId,
          score: ratingScore,
          comment: ratingComment || null,
        }),
      });
      if (res.ok) {
        setRatingAssignmentId(null);
        setRatingScore(0);
        setRatingComment("");
        fetchTask();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch {
      alert("Netzwerkfehler");
    }
  }

  async function handleDelete() {
    if (!confirm("Aufgabe wirklich löschen? Das kann nicht rückgängig gemacht werden.")) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/dashboard/tasks");
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch {
      alert("Netzwerkfehler");
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12 text-gray-500">Laden...</div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12 text-red-500">
          Aufgabe nicht gefunden
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Zurück-Link */}
      <button
        onClick={() => router.push("/dashboard/tasks")}
        className="text-gray-500 hover:text-gray-700 text-sm mb-6 flex items-center gap-1"
      >
        ← Zurück zur Übersicht
      </button>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{task.title}</h1>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  statusColors[task.status]
                }`}
              >
                {statusLabels[task.status]}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>
                {task.type === "RECURRING"
                  ? "Wiederkehrend"
                  : "Einmalig"}
              </span>
              {task.isTeamTask && <span>Team ({task.maxAssignees} Personen)</span>}
              <span>
                Erstellt von {task.createdBy.name} am{" "}
                {formatDate(task.createdAt)}
              </span>
            </div>
          </div>

          {/* Admin-Aktionen */}
          {isAdminOrCommittee && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowAssignModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
              >
                + Zuweisen
              </button>
              {userRole === "ADMIN" && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm font-medium transition-colors"
                >
                  Löschen
                </button>
              )}
            </div>
          )}
        </div>

        {task.description && (
          <p className="text-gray-600 mt-3">{task.description}</p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100">
          <div>
            <div className="text-xs text-gray-500 mb-1">Priorität</div>
            <div className="font-medium">
              {"●".repeat(task.priority)}
              {"○".repeat(5 - task.priority)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Zuweisung</div>
            <div className="font-medium">
              {task.assignmentMode === "AUTO" ? "Automatisch" : "Manuell"}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Fällig</div>
            <div className="font-medium">
              {formatDate(task.dueDate || task.nextDueDate)}
            </div>
          </div>
          {task.recurrenceInterval && (
            <div>
              <div className="text-xs text-gray-500 mb-1">Intervall</div>
              <div className="font-medium">
                {task.recurrenceInterval === "DAILY"
                  ? "Täglich"
                  : task.recurrenceInterval === "WEEKLY"
                  ? "Wöchentlich"
                  : task.recurrenceInterval === "BIWEEKLY"
                  ? "Alle 2 Wochen"
                  : "Monatlich"}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Eigene Aktionen */}
      {myAssignment && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">
            Deine Aufgabe
          </h3>
          <p className="text-blue-700 text-sm mb-3">
            Status: {statusLabels[myAssignment.status]}
          </p>
          <div className="flex gap-2">
            {myAssignment.status === "ASSIGNED" && (
              <button
                type="button"
                onClick={() => handleStatusChange("IN_PROGRESS")}
                className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 text-sm font-medium transition-colors"
              >
                Anfangen
              </button>
            )}
            {myAssignment.status === "IN_PROGRESS" && (
              <button
                type="button"
                onClick={() => handleStatusChange("COMPLETED")}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors"
              >
                Als erledigt markieren
              </button>
            )}
          </div>
        </div>
      )}

      {/* Zuweisungen & Bewertungen */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Zuweisungen ({task.assignments.length})
        </h2>

        {task.assignments.length === 0 ? (
          <p className="text-gray-500 text-sm">
            Noch niemand zugewiesen
          </p>
        ) : (
          <div className="space-y-4">
            {task.assignments.map((assignment) => {
              const avgScore =
                assignment.ratings.length > 0
                  ? assignment.ratings.reduce((sum, r) => sum + r.score, 0) /
                    assignment.ratings.length
                  : null;

              const alreadyRated = assignment.ratings.some(
                (r) => r.rater.id === currentUserId
              );
              const canRate =
                assignment.user.id !== currentUserId &&
                !alreadyRated &&
                (assignment.status === "COMPLETED" ||
                  assignment.status === "VERIFIED");

              return (
                <div
                  key={assignment.id}
                  className="border border-gray-100 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-medium">
                        {assignment.user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {assignment.user.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          Zugewiesen am {formatDate(assignment.assignedAt)}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        statusColors[assignment.status]
                      }`}
                    >
                      {statusLabels[assignment.status]}
                    </span>
                  </div>

                  {avgScore !== null && (
                    <div className="text-sm text-yellow-600 mb-2">
                      {"★".repeat(Math.round(avgScore))}
                      {"☆".repeat(5 - Math.round(avgScore))}{" "}
                      <span className="text-gray-500">
                        ({avgScore.toFixed(1)} aus {assignment.ratings.length}{" "}
                        Bewertung{assignment.ratings.length !== 1 ? "en" : ""})
                      </span>
                    </div>
                  )}

                  {canRate && (
                    <div>
                      {ratingAssignmentId === assignment.id ? (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                          <div className="flex gap-1 mb-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => setRatingScore(star)}
                                className={`text-2xl transition-colors ${
                                  star <= ratingScore
                                    ? "text-yellow-500"
                                    : "text-gray-300"
                                }`}
                              >
                                ★
                              </button>
                            ))}
                          </div>
                          <textarea
                            value={ratingComment}
                            onChange={(e) =>
                              setRatingComment(e.target.value)
                            }
                            placeholder="Kommentar (optional)"
                            rows={2}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2 outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleRate}
                              disabled={ratingScore === 0}
                              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                              Bewerten
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRatingAssignmentId(null);
                                setRatingScore(0);
                                setRatingComment("");
                              }}
                              className="px-3 py-1.5 text-gray-500 text-sm hover:text-gray-700"
                            >
                              Abbrechen
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setRatingAssignmentId(assignment.id)
                          }
                          className="text-sm text-blue-600 hover:text-blue-700 mt-2"
                        >
                          Bewerten
                        </button>
                      )}
                    </div>
                  )}

                  {assignment.ratings.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {assignment.ratings.map((rating) => (
                        <div
                          key={rating.id}
                          className="text-xs text-gray-500 flex items-center gap-2"
                        >
                          <span className="text-yellow-500">
                            {"★".repeat(rating.score)}
                          </span>
                          <span>{rating.rater.name}</span>
                          {rating.comment && (
                            <span className="text-gray-400">
                              – {rating.comment}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Zuweisungs-Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              User zuweisen
            </h3>

            <div className="space-y-2 mb-4">
              {allUsers
                .filter(
                  (u) =>
                    !task.assignments.some((a) => a.user.id === u.id)
                )
                .map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUsers([...selectedUsers, user.id]);
                        } else {
                          setSelectedUsers(
                            selectedUsers.filter((id) => id !== user.id)
                          );
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                    <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-medium">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm">{user.name}</span>
                  </label>
                ))}
              {allUsers.filter(
                (u) => !task.assignments.some((a) => a.user.id === u.id)
              ).length === 0 && (
                <p className="text-gray-500 text-sm text-center py-4">
                  Alle User sind bereits zugewiesen
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedUsers([]);
                }}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleAssign}
                disabled={selectedUsers.length === 0}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
              >
                {selectedUsers.length} User zuweisen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}