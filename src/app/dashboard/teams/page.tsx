"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface Team {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  type: "COMMITTEE" | "FINANCE" | "CUSTOM";
  joinMode: "OPEN" | "REQUEST" | "INVITE_ONLY";
  memberCount: number;
  followerCount: number;
  isMember: boolean;
  isLeader: boolean;
  isFollowing: boolean;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = { COMMITTEE: "Komitee", FINANCE: "Finanz-Team" };
const TYPE_BADGES: Record<string, string> = {
  COMMITTEE: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  FINANCE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};
const JOIN_LABELS: Record<string, string> = { OPEN: "Offen", REQUEST: "Anfrage", INVITE_ONLY: "Einladung" };
const JOIN_ICONS: Record<string, string> = { OPEN: "🔓", REQUEST: "📩", INVITE_ONLY: "🔒" };

export default function TeamsPage() {
  const { data: session } = useSession();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "mine">("all");

  const userRole = session?.user?.role;
  const isAdminOrCommittee = userRole === "ADMIN" || userRole === "COMMITTEE";

  const fetchTeams = useCallback(async () => {
    try {
      const res = await fetch("/api/teams");
      if (res.ok) setTeams(await res.json());
    } catch (error) { console.error("Fehler:", error); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTeams(); }, [fetchTeams]);

  async function handleJoin(teamId: string) {
    try {
      const res = await fetch(`/api/teams/${teamId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.isRequest) alert("Beitrittsanfrage gesendet!");
        fetchTeams();
      } else { alert(data.error); }
    } catch { alert("Netzwerkfehler"); }
  }

  async function handleLeave(teamId: string) {
    if (!confirm("Team wirklich verlassen?")) return;
    try {
      const res = await fetch(`/api/teams/${teamId}/members`, { method: "DELETE" });
      if (res.ok) fetchTeams();
    } catch { alert("Netzwerkfehler"); }
  }

  async function handleFollow(teamId: string) {
    try {
      await fetch(`/api/teams/${teamId}/follow`, { method: "POST" });
      fetchTeams();
    } catch { alert("Netzwerkfehler"); }
  }

  function getTeamIcon(team: Team) {
    return team.icon || team.name.charAt(0).toUpperCase();
  }

  const filtered = filter === "mine" ? teams.filter((t) => t.isMember) : teams;
  const myTeams = teams.filter((t) => t.isMember);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm">← Zurück</Link>
          <h1 className="text-sm font-semibold text-gray-900 dark:text-white">Teams</h1>
          <Link href="/dashboard/teams/new" className="text-sm text-blue-600 dark:text-blue-400 font-medium">+ Neu</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-5 space-y-5">
        {/* Filter */}
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button type="button" onClick={() => setFilter("all")}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filter === "all" ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500"}`}>
            Alle ({teams.length})
          </button>
          <button type="button" onClick={() => setFilter("mine")}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filter === "mine" ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500"}`}>
            Meine ({myTeams.length})
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Laden...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">👥</div>
            <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
              {filter === "mine" ? "Du bist in keinem Team" : "Noch keine Teams"}
            </p>
            <Link href="/dashboard/teams/new" className="inline-block mt-4 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">
              Team erstellen
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((team) => (
              <div key={team.id} className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 overflow-hidden">
                <div className="flex items-center gap-4 p-4">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                    style={{ backgroundColor: team.color }}>
                    {getTeamIcon(team)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate">{team.name}</h3>
                      {team.type !== "CUSTOM" && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${TYPE_BADGES[team.type]}`}>{TYPE_LABELS[team.type]}</span>
                      )}
                      {team.isLeader && <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">Leader</span>}
                    </div>
                    {team.description && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{team.description}</p>}
                    <div className="flex items-center gap-3 mt-0.5">
                      <p className="text-[10px] text-gray-400">{team.memberCount} Mitglieder</p>
                      <p className="text-[10px] text-gray-400">{team.followerCount} Follower</p>
                      <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                        {JOIN_ICONS[team.joinMode]} {JOIN_LABELS[team.joinMode]}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Follow */}
                    <button type="button" onClick={() => handleFollow(team.id)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        team.isFollowing
                          ? "bg-pink-100 dark:bg-pink-900/30 text-pink-600"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-400 hover:text-pink-500"
                      }`} title={team.isFollowing ? "Entfolgen" : "Folgen"}>
                      {team.isFollowing ? "❤️" : "🤍"}
                    </button>

                    {team.isMember ? (
                      <>
                        <Link href={`/dashboard/teams/${team.id}`}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors">
                          Öffnen
                        </Link>
                        {!team.isLeader && (
                          <button type="button" onClick={() => handleLeave(team.id)}
                            className="px-2 py-1.5 text-gray-400 hover:text-red-500 text-xs transition-colors">×</button>
                        )}
                      </>
                    ) : isAdminOrCommittee ? (
                      <div className="flex gap-1.5">
                        <Link href={`/dashboard/teams/${team.id}`}
                          className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                          Einsehen
                        </Link>
                        <button type="button" onClick={() => handleJoin(team.id)}
                          className="px-3 py-1.5 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                          Beitreten
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => handleJoin(team.id)}
                        className="px-3 py-1.5 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        {team.joinMode === "REQUEST" ? "Anfragen" : "Beitreten"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}