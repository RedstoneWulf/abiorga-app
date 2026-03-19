"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface User { id: string; name: string; }
interface Rating { id: string; score: number; comment: string | null; rater: User; createdAt: string; }
interface Assignment { id: string; user: User; status: string; assignedAt: string; completedAt: string | null; ratings: Rating[]; }
interface Task {
  id: string; title: string; description: string | null; type: "ONE_TIME" | "RECURRING"; status: string;
  assignmentMode: string; isTeamTask: boolean; maxAssignees: number; recurrenceInterval: string | null;
  priority: number; dueDate: string | null; nextDueDate: string | null; createdBy: User;
  assignments: Assignment[]; createdAt: string;
}

const statusLabels: Record<string, string> = { OPEN: "Offen", ASSIGNED: "Zugewiesen", IN_PROGRESS: "In Bearbeitung", COMPLETED: "Erledigt", VERIFIED: "Bestätigt" };
const statusColors: Record<string, string> = {
  OPEN: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  ASSIGNED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  COMPLETED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  VERIFIED: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
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
  const [ratingAssignmentId, setRatingAssignmentId] = useState<string | null>(null);

  const currentUserId = session?.user?.id;
  const userRole = session?.user?.role;
  const isAdminOrCommittee = userRole === "ADMIN" || userRole === "COMMITTEE";
  const myAssignment = task?.assignments.find((a) => a.user.id === currentUserId);

  const fetchTask = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (res.ok) setTask(await res.json());
    } catch (error) { console.error("Fehler:", error); }
    finally { setLoading(false); }
  }, [taskId]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) setAllUsers(await res.json());
    } catch (error) { console.error("Fehler:", error); }
  }, []);

  useEffect(() => { fetchTask(); fetchUsers(); }, [fetchTask, fetchUsers]);

  async function handleAssign() {
    if (selectedUsers.length === 0) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}/assign`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userIds: selectedUsers }) });
      const data = await res.json();
      if (res.ok) { setShowAssignModal(false); setSelectedUsers([]); fetchTask(); } else { alert(data.error || "Fehler"); }
    } catch { alert("Netzwerkfehler"); }
  }

  async function handleStatusChange(newStatus: string) {
    try {
      const res = await fetch(`/api/tasks/${taskId}/assign`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) });
      if (res.ok) fetchTask(); else { const d = await res.json(); alert(d.error); }
    } catch { alert("Netzwerkfehler"); }
  }

  async function handleRate() {
    if (!ratingAssignmentId || ratingScore === 0) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}/rate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assignmentId: ratingAssignmentId, score: ratingScore, comment: ratingComment || undefined }) });
      if (res.ok) { setRatingAssignmentId(null); setRatingScore(0); setRatingComment(""); fetchTask(); } else { const d = await res.json(); alert(d.error); }
    } catch { alert("Netzwerkfehler"); }
  }

  async function handleDelete() {
    if (!confirm("Aufgabe wirklich löschen?")) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (res.ok) router.push("/dashboard/tasks"); else { const d = await res.json(); alert(d.error); }
    } catch { alert("Netzwerkfehler"); }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  if (loading) return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center"><p className="text-gray-400">Laden...</p></div>;
  if (!task) return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center"><p className="text-red-500">Aufgabe nicht gefunden</p></div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard/tasks" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm">← Aufgaben</Link>
          <h1 className="text-sm font-semibold text-gray-900 dark:text-white truncate max-w-[200px]">{task.title}</h1>
          {isAdminOrCommittee ? (
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowAssignModal(true)} className="text-xs text-blue-600 dark:text-blue-400 font-medium">+ Zuweisen</button>
              {userRole === "ADMIN" && (
                <button type="button" onClick={handleDelete} className="text-xs text-red-500 font-medium">Löschen</button>
              )}
            </div>
          ) : <div className="w-16"></div>}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-5 space-y-4">
        {/* Task Info */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-5">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[task.status]}`}>{statusLabels[task.status]}</span>
            {task.type === "RECURRING" && <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">Wiederkehrend</span>}
            {task.isTeamTask && <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">Team ({task.maxAssignees})</span>}
          </div>

          {task.description && <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-4">{task.description}</p>}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2.5">
              <p className="text-[10px] text-gray-400 mb-0.5">Priorität</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{"●".repeat(task.priority)}{"○".repeat(5 - task.priority)}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2.5">
              <p className="text-[10px] text-gray-400 mb-0.5">Zuweisung</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{task.assignmentMode === "AUTO" ? "Automatisch" : "Manuell"}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2.5">
              <p className="text-[10px] text-gray-400 mb-0.5">Fällig</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(task.dueDate || task.nextDueDate)}</p>
            </div>
            {task.recurrenceInterval && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2.5">
                <p className="text-[10px] text-gray-400 mb-0.5">Intervall</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {task.recurrenceInterval === "DAILY" ? "Täglich" : task.recurrenceInterval === "WEEKLY" ? "Wöchentlich" : task.recurrenceInterval === "BIWEEKLY" ? "Alle 2 Wochen" : "Monatlich"}
                </p>
              </div>
            )}
          </div>

          <p className="text-[10px] text-gray-400 mt-3">Erstellt von {task.createdBy.name} am {formatDate(task.createdAt)}</p>
        </div>

        {/* Eigene Aktionen */}
        {myAssignment && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">Deine Aufgabe</p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">Status: {statusLabels[myAssignment.status]}</p>
              </div>
              <div className="flex gap-2">
                {myAssignment.status === "ASSIGNED" && (
                  <button type="button" onClick={() => handleStatusChange("IN_PROGRESS")}
                    className="px-3 py-1.5 bg-yellow-500 text-white rounded-lg text-xs font-medium hover:bg-yellow-600 transition-colors">
                    Anfangen
                  </button>
                )}
                {myAssignment.status === "IN_PROGRESS" && (
                  <button type="button" onClick={() => handleStatusChange("COMPLETED")}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors">
                    Erledigt
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Zuweisungen */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Zuweisungen ({task.assignments.length})
          </h2>

          {task.assignments.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">Noch niemand zugewiesen</p>
          ) : (
            <div className="space-y-3">
              {task.assignments.map((assignment) => {
                const avgScore = assignment.ratings.length > 0
                  ? assignment.ratings.reduce((sum, r) => sum + r.score, 0) / assignment.ratings.length : null;
                const alreadyRated = assignment.ratings.some((r) => r.rater.id === currentUserId);
                const canRate = assignment.user.id !== currentUserId && !alreadyRated && (assignment.status === "COMPLETED" || assignment.status === "VERIFIED");

                return (
                  <div key={assignment.id} className="border dark:border-gray-700 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full flex items-center justify-center text-[10px] font-bold">
                          {assignment.user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{assignment.user.name}</p>
                          <p className="text-[10px] text-gray-400">{formatDate(assignment.assignedAt)}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[assignment.status]}`}>
                        {statusLabels[assignment.status]}
                      </span>
                    </div>

                    {avgScore !== null && (
                      <div className="text-xs text-yellow-500 mt-1">
                        {"★".repeat(Math.round(avgScore))}{"☆".repeat(5 - Math.round(avgScore))}
                        <span className="text-gray-400 ml-1">({avgScore.toFixed(1)})</span>
                      </div>
                    )}

                    {canRate && (
                      <div className="mt-2">
                        {ratingAssignmentId === assignment.id ? (
                          <div className="p-2.5 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-2">
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button key={star} type="button" onClick={() => setRatingScore(star)}
                                  className={`text-xl transition-colors ${star <= ratingScore ? "text-yellow-500" : "text-gray-300 dark:text-gray-600"}`}>★</button>
                              ))}
                            </div>
                            <input type="text" value={ratingComment} onChange={(e) => setRatingComment(e.target.value)}
                              placeholder="Kommentar (optional)" maxLength={200}
                              className="w-full border dark:border-gray-600 bg-white dark:bg-gray-800 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
                            <div className="flex gap-2">
                              <button type="button" onClick={handleRate} disabled={ratingScore === 0}
                                className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 disabled:opacity-50">Bewerten</button>
                              <button type="button" onClick={() => { setRatingAssignmentId(null); setRatingScore(0); setRatingComment(""); }}
                                className="px-3 py-1 text-xs text-gray-500">Abbrechen</button>
                            </div>
                          </div>
                        ) : (
                          <button type="button" onClick={() => setRatingAssignmentId(assignment.id)}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Bewerten</button>
                        )}
                      </div>
                    )}

                    {assignment.ratings.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {assignment.ratings.map((r) => (
                          <div key={r.id} className="text-[10px] text-gray-400 flex items-center gap-1.5">
                            <span className="text-yellow-500">{"★".repeat(r.score)}</span>
                            <span>{r.rater.name}</span>
                            {r.comment && <span className="text-gray-300 dark:text-gray-600">– {r.comment}</span>}
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
      </main>

      {/* Zuweisungs-Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">User zuweisen</h3>
              <button type="button" onClick={() => { setShowAssignModal(false); setSelectedUsers([]); }} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
            </div>
            <div className="space-y-1.5 mb-4">
              {allUsers.filter((u) => !task.assignments.some((a) => a.user.id === u.id)).map((user) => (
                <label key={user.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                  <input type="checkbox" checked={selectedUsers.includes(user.id)}
                    onChange={(e) => { if (e.target.checked) setSelectedUsers([...selectedUsers, user.id]); else setSelectedUsers(selectedUsers.filter((id) => id !== user.id)); }}
                    className="rounded border-gray-300 dark:border-gray-600" />
                  <div className="w-7 h-7 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full flex items-center justify-center text-[10px] font-bold">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-gray-900 dark:text-white">{user.name}</span>
                </label>
              ))}
              {allUsers.filter((u) => !task.assignments.some((a) => a.user.id === u.id)).length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">Alle User sind bereits zugewiesen</p>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setShowAssignModal(false); setSelectedUsers([]); }}
                className="flex-1 py-2 border dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-xs font-medium">Abbrechen</button>
              <button type="button" onClick={handleAssign} disabled={selectedUsers.length === 0}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
                {selectedUsers.length} zuweisen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}