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
  endsAt: string | null;
  createdBy: { id: string; name: string };
  options: PollOption[];
  totalVotes: number;
  hasVoted: boolean;
  createdAt: string;
}

export default function PollsPage() {
  const { data: session } = useSession();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPolls = useCallback(async () => {
    try {
      const res = await fetch("/api/polls");
      if (res.ok) setPolls(await res.json());
    } catch (error) {
      console.error("Fehler:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPolls();
  }, [fetchPolls]);

  async function handleVote(pollId: string, optionId: string) {
    try {
      const res = await fetch(`/api/polls/${pollId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionIds: [optionId] }),
      });
      if (res.ok) {
        fetchPolls();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch {
      alert("Netzwerkfehler");
    }
  }

  async function handleRetractVote(pollId: string) {
    try {
      const res = await fetch(`/api/polls/${pollId}/vote`, { method: "DELETE" });
      if (res.ok) fetchPolls();
    } catch {
      alert("Netzwerkfehler");
    }
  }

  function timeLeft(endsAt: string | null) {
    if (!endsAt) return null;
    const diff = new Date(endsAt).getTime() - Date.now();
    if (diff <= 0) return "Abgelaufen";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `Noch ${days} Tag${days > 1 ? "e" : ""}`;
    return `Noch ${hours} Stunde${hours > 1 ? "n" : ""}`;
  }

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
            <p className="text-gray-400 text-sm mt-1">Erstelle die erste Abstimmung</p>
            <Link href="/dashboard/polls/new" className="inline-block mt-4 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">
              Abstimmung erstellen
            </Link>
          </div>
        ) : (
          polls.map((poll) => {
            const isExpired = poll.endsAt && new Date(poll.endsAt) < new Date();
            const isClosed = poll.status === "CLOSED" || isExpired;
            const showResults = poll.hasVoted || isClosed;

            return (
              <div key={poll.id} className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 overflow-hidden">
                <div className="p-4 pb-3">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{poll.title}</h3>
                    {isClosed && (
                      <span className="text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 px-2 py-0.5 rounded-full">Beendet</span>
                    )}
                  </div>
                  {poll.description && <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{poll.description}</p>}
                  <div className="flex items-center gap-3 text-[11px] text-gray-400">
                    <span>von {poll.createdBy.name}</span>
                    <span>{poll.totalVotes} Stimme{poll.totalVotes !== 1 ? "n" : ""}</span>
                    {poll.allowMultiple && <span>Mehrfachauswahl</span>}
                    {poll.anonymous && <span>Anonym</span>}
                    {timeLeft(poll.endsAt) && <span className="text-orange-500 font-medium">{timeLeft(poll.endsAt)}</span>}
                  </div>
                </div>

                <div className="px-4 pb-4 space-y-2">
                  {poll.options.map((opt) => {
                    const percent = poll.totalVotes > 0 ? Math.round((opt.voteCount / poll.totalVotes) * 100) : 0;
                    const isWinner = showResults && opt.voteCount === Math.max(...poll.options.map((o) => o.voteCount)) && opt.voteCount > 0;

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => { if (!isClosed) handleVote(poll.id, opt.id); }}
                        disabled={isClosed === true}
                        className={`relative w-full text-left rounded-lg border-2 p-3 transition-all overflow-hidden ${
                          opt.hasMyVote ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20" : isClosed ? "border-gray-200 dark:border-gray-600 cursor-default" : "border-gray-200 dark:border-gray-600 hover:border-blue-300"
                        }`}
                      >
                        {showResults && (
                          <div className={`absolute inset-y-0 left-0 transition-all duration-500 ${isWinner ? "bg-blue-100/80 dark:bg-blue-900/30" : "bg-gray-100/80 dark:bg-gray-700/30"}`}
                            style={{ width: `${percent}%` }}></div>
                        )}
                        <div className="relative flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {opt.hasMyVote && <span className="text-blue-600 text-xs">✓</span>}
                            <span className={`text-sm font-medium ${opt.hasMyVote ? "text-blue-700 dark:text-blue-300" : "text-gray-700 dark:text-gray-300"}`}>{opt.text}</span>
                          </div>
                          {showResults && <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{percent}%</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {poll.hasVoted && !isClosed && (
                  <div className="px-4 pb-3">
                    <button type="button" onClick={() => handleRetractVote(poll.id)} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                      Stimme zurückziehen
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}