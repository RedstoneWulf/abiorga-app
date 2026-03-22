"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface PollOption {
  id: string;
  text: string;
  voteCount: number;
  hasMyVote: boolean;
}

interface Poll {
  id: string;
  title: string;
  description: string | null;
  status: "ACTIVE" | "CLOSED";
  allowMultiple: boolean;
  anonymous: boolean;
  resultVisibility: "AFTER_VOTE" | "BEFORE_VOTE" | "AFTER_CLOSE";
  endsAt: string | null;
  closedAt: string | null;
  createdBy: { id: string; name: string };
  createdById: string;
  options: PollOption[];
  totalVotes: number;
  hasVoted: boolean;
  showResults: boolean;
  createdAt: string;
}

const VISIBILITY_LABELS: Record<string, string> = {
  AFTER_VOTE: "Nach Abstimmung",
  BEFORE_VOTE: "Immer sichtbar",
  AFTER_CLOSE: "Nach Beendigung",
};

export default function PollsPage() {
  const { data: session } = useSession();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [now] = useState(() => Date.now());

  const userRole = session?.user?.role;
  const userId = session?.user?.id;
  const isAdminOrCommittee = userRole === "ADMIN" || userRole === "COMMITTEE";

  const fetchPolls = useCallback(async () => {
    try {
      const res = await fetch("/api/polls");
      if (res.ok) setPolls(await res.json());
    } catch (error) { console.error("Fehler:", error); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPolls(); }, [fetchPolls]);

  async function handleVote(pollId: string, optionId: string) {
    try {
      const res = await fetch(`/api/polls/${pollId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionIds: [optionId] }),
      });
      if (res.ok) fetchPolls();
      else { const d = await res.json(); alert(d.error); }
    } catch { alert("Netzwerkfehler"); }
  }

  async function handleRetractVote(pollId: string) {
    try {
      const res = await fetch(`/api/polls/${pollId}/vote`, { method: "DELETE" });
      if (res.ok) fetchPolls();
    } catch { alert("Netzwerkfehler"); }
  }

  async function handleClose(pollId: string) {
    if (!confirm("Abstimmung wirklich beenden? Dies kann nicht rückgängig gemacht werden.")) return;
    try {
      const res = await fetch(`/api/polls/${pollId}`, { method: "PATCH" });
      if (res.ok) fetchPolls();
      else { const d = await res.json(); alert(d.error); }
    } catch { alert("Netzwerkfehler"); }
  }

  async function handleDelete(pollId: string) {
    if (!confirm("Abstimmung wirklich löschen? Alle Stimmen gehen verloren.")) return;
    try {
      const res = await fetch(`/api/polls/${pollId}`, { method: "DELETE" });
      if (res.ok) fetchPolls();
      else { const d = await res.json(); alert(d.error); }
    } catch { alert("Netzwerkfehler"); }
  }

  function timeLeft(endsAt: string | null) {
    if (!endsAt) return null;
    const diff = new Date(endsAt).getTime() - Date.now();
    if (diff <= 0) return "Abgelaufen";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `Noch ${days} Tag${days > 1 ? "e" : ""}`;
    return `Noch ${hours}h`;
  }

  function autoDeleteIn(closedAt: string | null) {
    if (!closedAt) return null;
    const deleteAt = new Date(closedAt).getTime() + 48 * 60 * 60 * 1000;
    const diff = deleteAt - Date.now();
    if (diff <= 0) return "Wird gelöscht...";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return "< 1h bis Löschung";
    return `Wird in ${hours}h gelöscht`;
  }

  const activePolls = polls.filter((p) => p.status === "ACTIVE");
  const closedPolls = polls.filter((p) => p.status === "CLOSED");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm">← Zurück</Link>
          <h1 className="text-sm font-semibold text-gray-900 dark:text-white">Abstimmungen</h1>
          <Link href="/dashboard/polls/new" className="text-sm text-blue-600 dark:text-blue-400 font-medium">+ Neu</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Laden...</div>
        ) : polls.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🗳️</div>
            <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">Noch keine Abstimmungen</p>
            <Link href="/dashboard/polls/new" className="inline-block mt-4 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">
              Abstimmung erstellen
            </Link>
          </div>
        ) : (
          <>
            {/* Aktive */}
            {activePolls.length > 0 && (
              <div className="space-y-3">
                {activePolls.map((poll) => (
                  <PollCard key={poll.id} poll={poll} userId={userId} isAdminOrCommittee={isAdminOrCommittee}
                    onVote={handleVote} onRetract={handleRetractVote} onClose={handleClose} onDelete={handleDelete} />
                ))}
              </div>
            )}

            {/* Beendete */}
            {closedPolls.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Beendet</h2>
                <div className="space-y-3">
                  {closedPolls.map((poll) => (
                    <PollCard key={poll.id} poll={poll} userId={userId} isAdminOrCommittee={isAdminOrCommittee}
                      onVote={handleVote} onRetract={handleRetractVote} onClose={handleClose} onDelete={handleDelete} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function PollCard({ poll, userId, isAdminOrCommittee, onVote, onRetract, onClose, onDelete }: {
  poll: Poll; userId: string | undefined; isAdminOrCommittee: boolean;
  onVote: (pollId: string, optionId: string) => void;
  onRetract: (pollId: string) => void;
  onClose: (pollId: string) => void;
  onDelete: (pollId: string) => void;
}) {
  const [now] = useState(() => Date.now());
  const isClosed = poll.status === "CLOSED";
  const isCreator = poll.createdById === userId;
  const canManage = isAdminOrCommittee || isCreator;

  function autoDeleteIn(closedAt: string | null) {
    if (!closedAt) return null;
    const deleteAt = new Date(closedAt).getTime() + 48 * 60 * 60 * 1000;
    const diff = deleteAt - now;
    if (diff <= 0) return "Wird gelöscht...";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return "< 1h bis Löschung";
    return `Auto-Löschung in ${hours}h`;
  }

  function timeLeft(endsAt: string | null) {
    if (!endsAt) return null;
    const diff = new Date(endsAt).getTime() - now;
    if (diff <= 0) return "Abgelaufen";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `Noch ${days}d`;
    return `Noch ${hours}h`;
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border overflow-hidden ${
      isClosed ? "dark:border-gray-700 opacity-80" : "dark:border-gray-700"
    }`}>
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between mb-1">
          <h3 className="font-semibold text-gray-900 dark:text-white flex-1">{poll.title}</h3>
          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
            {isClosed && (
              <span className="text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 px-2 py-0.5 rounded-full">Beendet</span>
            )}
          </div>
        </div>
        {poll.description && <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{poll.description}</p>}
        <div className="flex items-center gap-3 text-[11px] text-gray-400 flex-wrap">
          <span>von {poll.createdBy.name}</span>
          <span>{poll.totalVotes} Stimme{poll.totalVotes !== 1 ? "n" : ""}</span>
          {poll.allowMultiple && <span>Mehrfachauswahl</span>}
          {poll.anonymous && <span>Anonym</span>}
          <span className="text-gray-300 dark:text-gray-600">•</span>
          <span>Ergebnisse: {VISIBILITY_LABELS[poll.resultVisibility]}</span>
          {timeLeft(poll.endsAt) && !isClosed && (
            <span className="text-orange-500 font-medium">{timeLeft(poll.endsAt)}</span>
          )}
          {isClosed && poll.closedAt && (
            <span className="text-red-400 font-medium">{autoDeleteIn(poll.closedAt)}</span>
          )}
        </div>
      </div>

      {/* Optionen */}
      <div className="px-4 pb-3 space-y-2">
        {poll.options.map((opt) => {
          const percent = poll.showResults && poll.totalVotes > 0
            ? Math.round((opt.voteCount / poll.totalVotes) * 100) : 0;
          const isWinner = poll.showResults && opt.voteCount === Math.max(...poll.options.map((o) => o.voteCount)) && opt.voteCount > 0;

          return (
            <button key={opt.id} type="button"
              onClick={() => { if (!isClosed) onVote(poll.id, opt.id); }}
              disabled={isClosed}
              className={`relative w-full text-left rounded-lg border-2 p-3 transition-all overflow-hidden ${
                opt.hasMyVote ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20"
                : isClosed ? "border-gray-200 dark:border-gray-600 cursor-default"
                : "border-gray-200 dark:border-gray-600 hover:border-blue-300"
              }`}>
              {/* Fortschrittsbalken */}
              {poll.showResults && (
                <div className={`absolute inset-y-0 left-0 transition-all duration-500 ${
                  isWinner ? "bg-blue-100/80 dark:bg-blue-900/30" : "bg-gray-100/80 dark:bg-gray-700/30"
                }`} style={{ width: `${percent}%` }}></div>
              )}
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {opt.hasMyVote && <span className="text-blue-600 text-xs">✓</span>}
                  <span className={`text-sm font-medium ${
                    opt.hasMyVote ? "text-blue-700 dark:text-blue-300" : "text-gray-700 dark:text-gray-300"
                  }`}>{opt.text}</span>
                </div>
                {poll.showResults && (
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{percent}%</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Hinweis wenn Ergebnisse nicht sichtbar */}
      {!poll.showResults && !isClosed && (
        <div className="px-4 pb-3">
          <p className="text-[10px] text-gray-400 italic">
            {poll.resultVisibility === "AFTER_VOTE" && !poll.hasVoted && "Ergebnisse werden nach deiner Abstimmung sichtbar"}
            {poll.resultVisibility === "AFTER_CLOSE" && "Ergebnisse werden erst nach Beendigung sichtbar"}
          </p>
        </div>
      )}

      {/* Aktionen */}
      <div className="px-4 pb-3 flex items-center justify-between">
        <div>
          {poll.hasVoted && !isClosed && (
            <button type="button" onClick={() => onRetract(poll.id)}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors">
              Stimme zurückziehen
            </button>
          )}
        </div>

        {/* Admin/Komitee/Ersteller Aktionen */}
        {canManage && (
          <div className="flex items-center gap-2">
            {!isClosed && (
              <button type="button" onClick={() => onClose(poll.id)}
                className="text-xs text-orange-500 hover:text-orange-600 font-medium transition-colors">
                Beenden
              </button>
            )}
            {(isAdminOrCommittee || (isCreator && isClosed)) && (
              <button type="button" onClick={() => onDelete(poll.id)}
                className="text-xs text-red-500 hover:text-red-600 font-medium transition-colors">
                Löschen
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}