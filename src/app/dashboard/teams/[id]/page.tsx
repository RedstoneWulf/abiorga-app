"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Member { id: string; isLeader: boolean; user: { id: string; name: string; role: string }; }
interface JoinRequest { id: string; user: { id: string; name: string }; createdAt: string; }
interface ChatMsg { id: string; content: string; userId: string; user: { id: string; name: string }; createdAt: string; }
interface Team {
  id: string; name: string; description: string | null; color: string; icon: string | null;
  type: "COMMITTEE" | "FINANCE" | "CUSTOM"; joinMode: string; createdById: string | null;
  members: Member[]; joinRequests: JoinRequest[]; isMember: boolean; isLeader: boolean;
  isCreator: boolean; isAdmin: boolean; canManage: boolean; isFollowing: boolean; followerCount: number;
  _count: { members: number; chatMessages: number; followers: number };
}

const TYPE_LABELS: Record<string, string> = {
  COMMITTEE: "Komitee – Fast wie Admin-Rechte",
  FINANCE: "Finanz-Team – Genehmigungsrechte",
  CUSTOM: "Normales Team",
};

const JOIN_LABELS: Record<string, string> = { OPEN: "🔓 Offen", REQUEST: "📩 Anfrage", INVITE_ONLY: "🔒 Einladung" };

export default function TeamDetailPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const teamId = params.id as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [tab, setTab] = useState<"chat" | "members" | "requests">("chat");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [allUsers, setAllUsers] = useState<{ id: string; name: string }[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentUserId = session?.user?.id;

  const fetchTeam = useCallback(async () => {
    try {
      const res = await fetch(`/api/teams/${teamId}`);
      if (res.ok) setTeam(await res.json());
      else router.push("/dashboard/teams");
    } catch { console.error("Fehler"); }
    finally { setLoading(false); }
  }, [teamId, router]);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/teams/${teamId}/chat`);
      if (res.ok) { const data = await res.json(); setMessages(data.messages); }
    } catch { console.error("Fehler"); }
  }, [teamId]);

  const fetchAllUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) setAllUsers(await res.json());
    } catch { console.error("Fehler"); }
  }, []);

  useEffect(() => { fetchTeam(); }, [fetchTeam]);

  useEffect(() => {
    if (team?.isMember || team?.isAdmin) {
      fetchMessages();
      pollIntervalRef.current = setInterval(fetchMessages, 5000);
      return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); };
    }
  }, [team?.isMember, team?.isAdmin, fetchMessages]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: newMessage.trim() }) });
      if (res.ok) { setNewMessage(""); fetchMessages(); }
    } catch { alert("Netzwerkfehler"); }
    finally { setSending(false); }
  }

  async function handleRemoveMember(userId: string) {
    if (!confirm("Mitglied wirklich entfernen?")) return;
    try {
      const res = await fetch(`/api/teams/${teamId}/members?userId=${userId}`, { method: "DELETE" });
      if (res.ok) fetchTeam();
    } catch { alert("Netzwerkfehler"); }
  }

  async function handleAddMember(userId: string) {
    try {
      const res = await fetch(`/api/teams/${teamId}/members`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
      if (res.ok) { fetchTeam(); setShowAddMember(false); }
      else { const d = await res.json(); alert(d.error); }
    } catch { alert("Netzwerkfehler"); }
  }

  async function handleJoinRequest(requestId: string, action: "APPROVE" | "REJECT") {
    try {
      const res = await fetch(`/api/teams/${teamId}/requests`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId, action }) });
      if (res.ok) fetchTeam();
      else { const d = await res.json(); alert(d.error); }
    } catch { alert("Netzwerkfehler"); }
  }

  async function handleFollow() {
    try {
      await fetch(`/api/teams/${teamId}/follow`, { method: "POST" });
      fetchTeam();
    } catch { alert("Netzwerkfehler"); }
  }

  async function handleDelete() {
    if (!confirm("Team wirklich löschen? Alle Nachrichten gehen verloren.")) return;
    try {
      const res = await fetch(`/api/teams/${teamId}`, { method: "DELETE" });
      if (res.ok) router.push("/dashboard/teams");
    } catch { alert("Netzwerkfehler"); }
  }

  function formatTime(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) return date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    return date.toLocaleDateString("de-DE", { day: "2-digit", month: "short" }) + " " + date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }

  function getTeamIcon() {
    return team?.icon || team?.name.charAt(0).toUpperCase() || "?";
  }

  if (loading) return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center"><p className="text-gray-400">Laden...</p></div>;
  if (!team) return null;

  const canViewChat = team.isMember || team.isAdmin;
  const pendingRequests = team.joinRequests?.length || 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/dashboard/teams" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm">← Teams</Link>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: team.color }}>
                {getTeamIcon()}
              </div>
              <h1 className="text-sm font-semibold text-gray-900 dark:text-white">{team.name}</h1>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleFollow}
                className={`text-sm ${team.isFollowing ? "text-pink-500" : "text-gray-400 hover:text-pink-500"}`}>
                {team.isFollowing ? "❤️" : "🤍"}
              </button>
              <span className="text-[10px] text-gray-400">{team._count.members}</span>
            </div>
          </div>

          {team.type !== "CUSTOM" && (
            <p className="text-[10px] text-center text-amber-600 dark:text-amber-400 mt-1">{TYPE_LABELS[team.type]}</p>
          )}

          <p className="text-[10px] text-center text-gray-400 mt-0.5">{JOIN_LABELS[team.joinMode]} • {team.followerCount} Follower</p>

          {/* Tabs */}
          {canViewChat && (
            <div className="flex mt-2 border-t dark:border-gray-700 pt-2 gap-1">
              <button type="button" onClick={() => setTab("chat")}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === "chat" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" : "text-gray-500"}`}>Chat</button>
              <button type="button" onClick={() => { setTab("members"); fetchAllUsers(); }}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === "members" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" : "text-gray-500"}`}>
                Mitglieder ({team._count.members})
              </button>
              {team.canManage && pendingRequests > 0 && (
                <button type="button" onClick={() => setTab("requests")}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === "requests" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" : "text-gray-500"}`}>
                  Anfragen ({pendingRequests})
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Nicht-Mitglied Ansicht */}
      {!canViewChat ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4" style={{ backgroundColor: team.color }}>
              {getTeamIcon()}
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{team.name}</h2>
            {team.description && <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{team.description}</p>}
            <p className="text-xs text-gray-400 mb-4">{team._count.members} Mitglieder</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Tritt dem Team bei um den Chat zu sehen</p>
          </div>
        </div>
      ) : tab === "chat" ? (
        /* Chat */
        <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 ? (
              <div className="text-center py-12"><p className="text-gray-400 text-sm">Noch keine Nachrichten</p></div>
            ) : messages.map((msg) => {
              const isMe = msg.userId === currentUserId;
              return (
                <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%]`}>
                    {!isMe && <p className="text-[10px] text-gray-400 mb-0.5 ml-1">{msg.user.name}</p>}
                    <div className={`px-3 py-2 rounded-2xl ${isMe ? "bg-blue-600 text-white rounded-br-md" : "bg-white dark:bg-gray-800 border dark:border-gray-700 text-gray-900 dark:text-white rounded-bl-md"}`}>
                      <p className="text-sm leading-relaxed break-words">{msg.content}</p>
                    </div>
                    <p className={`text-[9px] text-gray-400 mt-0.5 ${isMe ? "text-right mr-1" : "ml-1"}`}>{formatTime(msg.createdAt)}</p>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef}></div>
          </div>
          {team.isMember && (
            <div className="border-t dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
              <form onSubmit={handleSend} className="flex gap-2">
                <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Nachricht schreiben..." maxLength={2000}
                  className="flex-1 border dark:border-gray-600 bg-gray-50 dark:bg-gray-700 rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
                <button type="submit" disabled={sending || !newMessage.trim()}
                  className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 transition-colors flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
                  </svg>
                </button>
              </form>
            </div>
          )}
        </div>
      ) : tab === "requests" ? (
        /* Anfragen */
        <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-5 space-y-3">
          {team.joinRequests.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Keine offenen Anfragen</p>
          ) : team.joinRequests.map((req) => (
            <div key={req.id} className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full flex items-center justify-center text-sm font-bold">
                  {req.user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{req.user.name}</p>
                  <p className="text-[10px] text-gray-400">{formatTime(req.createdAt)}</p>
                </div>
              </div>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => handleJoinRequest(req.id, "APPROVE")}
                  className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">Annehmen</button>
                <button type="button" onClick={() => handleJoinRequest(req.id, "REJECT")}
                  className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-xs font-medium">Ablehnen</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Mitglieder */
        <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-5 space-y-4">
          {team.canManage && (
            <button type="button" onClick={() => { setShowAddMember(true); fetchAllUsers(); }}
              className="w-full py-2 border-2 border-dashed dark:border-gray-600 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 transition-colors">
              + Mitglied einladen
            </button>
          )}
          <div className="space-y-2">
            {team.members.map((member) => (
              <div key={member.id} className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: team.color }}>
                    {member.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{member.user.name}</p>
                      {member.isLeader && <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">Leader</span>}
                    </div>
                    <p className="text-[10px] text-gray-400">{member.user.role}</p>
                  </div>
                </div>
                {team.canManage && member.user.id !== currentUserId && (
                  <button type="button" onClick={() => handleRemoveMember(member.user.id)}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors">Entfernen</button>
                )}
              </div>
            ))}
          </div>
          {team.canManage && (
            <button type="button" onClick={handleDelete}
              className="w-full py-2 text-xs text-red-500 hover:text-red-600 transition-colors mt-4">Team löschen</button>
          )}
        </div>
      )}

      {/* Mitglied hinzufügen */}
      {showAddMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Mitglied einladen</h3>
              <button type="button" onClick={() => setShowAddMember(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="space-y-2">
              {allUsers.filter((u) => !team.members.some((m) => m.user.id === u.id)).map((user) => (
                <button key={user.id} type="button" onClick={() => handleAddMember(user.id)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full flex items-center justify-center text-sm font-medium">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-gray-900 dark:text-white">{user.name}</span>
                </button>
              ))}
              {allUsers.filter((u) => !team.members.some((m) => m.user.id === u.id)).length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Alle User sind bereits Mitglied</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}