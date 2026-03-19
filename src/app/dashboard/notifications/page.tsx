"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { hasCommitteeAccess } from "@/lib/permissions";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  priority: "NORMAL" | "HIGH";
  scope: string;
  pinned: boolean;
  createdBy: { id: string; name: string };
  team: { id: string; name: string; color: string } | null;
  isRead: boolean;
  createdAt: string;
}

const TYPE_ICONS: Record<string, string> = {
  GLOBAL: "📢",
  STORY: "📸",
  CHAT: "💬",
  EVENT: "📅",
  TASK: "📋",
  POLL: "🗳️",
  TRANSACTION: "💰",
};

const TYPE_LABELS: Record<string, string> = {
  GLOBAL: "Nachricht",
  STORY: "Story",
  CHAT: "Chat",
  EVENT: "Event",
  TASK: "Aufgabe",
  POLL: "Abstimmung",
  TRANSACTION: "Transaktion",
};

export default function NotificationsPage() {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);

  // Create-Form
  const [newTitle, setNewTitle] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [newPriority, setNewPriority] = useState<"NORMAL" | "HIGH">("NORMAL");
  const [newPinned, setNewPinned] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  const userRole = session?.user?.role;
  const isAdminOrCommittee = userRole === "ADMIN" || userRole === "COMMITTEE";

  const fetchNotifications = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter === "unread") params.set("unread", "true");
      const res = await fetch(`/api/notifications?${params}`);
      if (res.ok) setNotifications(await res.json());
    } catch (error) {
      console.error("Fehler:", error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  async function markAsRead(ids: string[]) {
    try {
      await fetch("/api/notifications/unread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds: ids }),
      });
      fetchNotifications();
    } catch {
      // Silent
    }
  }

  async function markAllAsRead() {
    const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n.id);
    if (unreadIds.length > 0) await markAsRead(unreadIds);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateLoading(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          message: newMessage,
          priority: newPriority,
          pinned: newPinned,
        }),
      });
      if (res.ok) {
        setShowCreate(false);
        setNewTitle("");
        setNewMessage("");
        setNewPriority("NORMAL");
        setNewPinned(false);
        fetchNotifications();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch {
      alert("Netzwerkfehler");
    } finally {
      setCreateLoading(false);
    }
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "gerade eben";
    if (mins < 60) return `vor ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `vor ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `vor ${days}d`;
    return new Date(dateStr).toLocaleDateString("de-DE", { day: "2-digit", month: "short" });
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm">← Zurück</Link>
          <h1 className="text-sm font-semibold text-gray-900 dark:text-white">Benachrichtigungen</h1>
          {isAdminOrCommittee ? (
            <button type="button" onClick={() => setShowCreate(true)} className="text-sm text-blue-600 dark:text-blue-400 font-medium">+ Neu</button>
          ) : (
            <Link href="/dashboard/profile" className="text-[10px] text-gray-400 hover:text-gray-600">Einstellungen</Link>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        {/* Filter + Alle gelesen */}
        <div className="flex items-center justify-between">
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button type="button" onClick={() => setFilter("all")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filter === "all" ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500"}`}>
              Alle
            </button>
            <button type="button" onClick={() => setFilter("unread")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filter === "unread" ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500"}`}>
              Ungelesen {unreadCount > 0 && `(${unreadCount})`}
            </button>
          </div>
          {unreadCount > 0 && (
            <button type="button" onClick={markAllAsRead}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">
              Alle gelesen
            </button>
          )}
        </div>

        {/* Benachrichtigungen */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Laden...</div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🔔</div>
            <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
              {filter === "unread" ? "Keine ungelesenen Benachrichtigungen" : "Keine Benachrichtigungen"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notif) => (
              <button
                key={notif.id}
                type="button"
                onClick={() => {
                  if (!notif.isRead) markAsRead([notif.id]);
                }}
                className={`w-full text-left rounded-xl border transition-all ${
                  notif.priority === "HIGH"
                    ? "border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-900/10"
                    : notif.isRead
                    ? "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 opacity-70"
                    : "border-blue-200 dark:border-blue-900 bg-white dark:bg-gray-800"
                } p-4`}
              >
                <div className="flex items-start gap-3">
                  {/* Ungelesen-Punkt */}
                  <div className="flex-shrink-0 mt-1">
                    {!notif.isRead ? (
                      <span className={`w-2.5 h-2.5 rounded-full block ${
                        notif.priority === "HIGH" ? "bg-red-500" : "bg-blue-500"
                      }`}></span>
                    ) : (
                      <span className="w-2.5 h-2.5 block"></span>
                    )}
                  </div>

                  {/* Icon */}
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${
                    notif.priority === "HIGH"
                      ? "bg-red-100 dark:bg-red-900/30"
                      : "bg-gray-100 dark:bg-gray-700"
                  }`}>
                    {TYPE_ICONS[notif.type] || "🔔"}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className={`text-sm font-semibold truncate ${
                        notif.isRead ? "text-gray-500 dark:text-gray-400" : "text-gray-900 dark:text-white"
                      }`}>
                        {notif.title}
                      </h3>
                      {notif.priority === "HIGH" && (
                        <span className="text-[9px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded uppercase flex-shrink-0">
                          Wichtig
                        </span>
                      )}
                      {notif.pinned && (
                        <span className="text-[9px] text-amber-600 dark:text-amber-400 flex-shrink-0">📌</span>
                      )}
                    </div>
                    <p className={`text-xs leading-relaxed ${
                      notif.isRead ? "text-gray-400" : "text-gray-600 dark:text-gray-300"
                    }`}>
                      {notif.message}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] text-gray-400">{TYPE_LABELS[notif.type]}</span>
                      {notif.team && (
                        <>
                          <span className="text-[10px] text-gray-300">•</span>
                          <span className="text-[10px] text-gray-400">{notif.team.name}</span>
                        </>
                      )}
                      <span className="text-[10px] text-gray-300">•</span>
                      <span className="text-[10px] text-gray-400">{timeAgo(notif.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Neue Benachrichtigung (Admin/Komitee) */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-xl p-6 w-full sm:max-w-md max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Neue Benachrichtigung</h3>
              <button type="button" onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Titel *</label>
                <input type="text" required value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="z.B. Abi-Beitrag Erinnerung"
                  className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Nachricht *</label>
                <textarea required value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Was soll mitgeteilt werden?" rows={3}
                  className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none dark:text-white" />
              </div>

              {/* Priorität */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Priorität</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setNewPriority("NORMAL")}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      newPriority === "NORMAL" ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30" : "border-gray-200 dark:border-gray-600"
                    }`}>
                    <div className="text-sm mb-0.5">📬</div>
                    <div className="text-xs font-medium text-gray-900 dark:text-white">Normal</div>
                    <div className="text-[10px] text-gray-400">Kann stumm geschaltet werden</div>
                  </button>
                  <button type="button" onClick={() => setNewPriority("HIGH")}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      newPriority === "HIGH" ? "border-red-500 bg-red-50 dark:bg-red-900/30" : "border-gray-200 dark:border-gray-600"
                    }`}>
                    <div className="text-sm mb-0.5">🚨</div>
                    <div className="text-xs font-medium text-gray-900 dark:text-white">Wichtig</div>
                    <div className="text-[10px] text-gray-400">Immer zugestellt</div>
                  </button>
                </div>
              </div>

              {/* Anpinnen */}
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Anpinnen</p>
                  <p className="text-[10px] text-gray-400">Bleibt ganz oben im Dashboard</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={newPinned} onChange={(e) => setNewPinned(e.target.checked)} className="sr-only peer" />
                  <div className="w-10 h-5 bg-gray-300 rounded-full peer peer-checked:bg-blue-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
                </label>
              </div>

              <button type="submit" disabled={createLoading}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {createLoading ? "Wird gesendet..." : "Benachrichtigung senden"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}