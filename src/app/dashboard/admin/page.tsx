"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface TeamMembership {
  team: { id: string; name: string; type: string };
  isLeader: boolean;
}

interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  _count: {
    createdTasks: number;
    assignments: number;
    createdEvents: number;
    createdPolls: number;
    votes: number;
    teamMemberships: number;
  };
  teamMemberships: TeamMembership[];
}

interface AppSettings {
  financeGoal: number;
  maintenanceMode: boolean;
  hasMaintenancePassword: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  COMMITTEE: "Komitee",
  TEAM_LEADER: "Teamleiter",
  MEMBER: "Mitglied",
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  COMMITTEE: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  TEAM_LEADER: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  MEMBER: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
};

export default function AdminPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [tab, setTab] = useState<"users" | "settings" | "create">("users");
  const [users, setUsers] = useState<UserData[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Password reset
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  // Role change
  const [roleUserId, setRoleUserId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState("");

  // Create user
  const [createForm, setCreateForm] = useState({
    email: "", name: "", password: "", role: "MEMBER",
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");

  // Maintenance
  const [maintenancePassword, setMaintenancePassword] = useState("");

  const userRole = session?.user?.role;

  useEffect(() => {
    if (userRole && userRole !== "ADMIN") {
      router.push("/dashboard");
    }
  }, [userRole, router]);

  const fetchData = useCallback(async () => {
    try {
      const [usersRes, settingsRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/settings"),
      ]);
      if (usersRes.ok) setUsers(await usersRes.json());
      if (settingsRes.ok) setSettings(await settingsRes.json());
    } catch (error) { console.error("Fehler:", error); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (userRole === "ADMIN") fetchData(); }, [userRole, fetchData]);

  // --- Handlers ---

  async function handleToggleMaintenance() {
    if (!settings) return;
    const newMode = !settings.maintenanceMode;

    // Wenn Wartungsmodus aktiviert wird und kein Passwort gesetzt, warnen
    if (newMode && !settings.hasMaintenancePassword && !maintenancePassword) {
      alert("Setze zuerst ein Wartungspasswort bevor du den Wartungsmodus aktivierst.");
      return;
    }

    try {
      const body: { maintenanceMode: boolean; maintenancePassword?: string } = { maintenanceMode: newMode };
      if (maintenancePassword) body.maintenancePassword = maintenancePassword;

      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setMaintenancePassword("");
      } else { const d = await res.json(); alert(d.error); }
    } catch { alert("Netzwerkfehler"); }
  }

  async function handleSaveMaintenancePassword() {
    if (!maintenancePassword || maintenancePassword.length < 4) {
      alert("Passwort muss mindestens 4 Zeichen lang sein");
      return;
    }
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maintenancePassword }),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setMaintenancePassword("");
        alert("Wartungspasswort gespeichert!");
      }
    } catch { alert("Netzwerkfehler"); }
  }

  async function handleResetPassword(userId: string) {
    if (!newPassword || newPassword.length < 6) {
      alert("Passwort muss mindestens 6 Zeichen lang sein");
      return;
    }
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      if (res.ok) {
        setResetUserId(null);
        setNewPassword("");
        alert("Passwort wurde zurückgesetzt!");
      } else { const d = await res.json(); alert(d.error); }
    } catch { alert("Netzwerkfehler"); }
  }

  async function handleChangeRole(userId: string) {
    if (!newRole) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        setRoleUserId(null);
        setNewRole("");
        fetchData();
      } else { const d = await res.json(); alert(d.error); }
    } catch { alert("Netzwerkfehler"); }
  }

  async function handleDeleteUser(userId: string, userName: string) {
    const input = prompt(`Um "${userName}" zu löschen, tippe den Namen ein:`);
    if (input !== userName) {
      if (input !== null) alert("Name stimmt nicht überein");
      return;
    }
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      if (res.ok) fetchData();
      else { const d = await res.json(); alert(d.error); }
    } catch { alert("Netzwerkfehler"); }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    setCreateSuccess("");
    setCreateLoading(true);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });

      if (res.ok) {
        setCreateSuccess(`User "${createForm.name}" erstellt! Einmal-Passwort: ${createForm.password}`);
        setCreateForm({ email: "", name: "", password: "", role: "MEMBER" });
        fetchData();
      } else { const d = await res.json(); setCreateError(d.error); }
    } catch { setCreateError("Netzwerkfehler"); }
    finally { setCreateLoading(false); }
  }

  function generatePassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let pw = "";
    for (let i = 0; i < 8; i++) pw += chars.charAt(Math.floor(Math.random() * chars.length));
    setCreateForm({ ...createForm, password: pw });
  }

  // Filter
  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (userRole !== "ADMIN") return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm">← Dashboard</Link>
          <h1 className="text-sm font-semibold text-gray-900 dark:text-white">Admin Panel</h1>
          <div className="w-16"></div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5 space-y-5">
        {/* Tabs */}
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {[
            { key: "users" as const, label: `Mitglieder (${users.length})` },
            { key: "create" as const, label: "User erstellen" },
            { key: "settings" as const, label: "Einstellungen" },
          ].map((t) => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                tab === t.key ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400"
              }`}>{t.label}</button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Laden...</div>
        ) : (
          <>
            {/* ====== TAB: MITGLIEDER ====== */}
            {tab === "users" && (
              <div className="space-y-4">
                {/* Suche */}
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="User suchen..."
                  className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />

                {/* Statistik */}
                <div className="grid grid-cols-4 gap-2">
                  {["ADMIN", "COMMITTEE", "TEAM_LEADER", "MEMBER"].map((role) => (
                    <div key={role} className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-3 text-center">
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{users.filter((u) => u.role === role).length}</p>
                      <p className="text-[10px] text-gray-400">{ROLE_LABELS[role]}</p>
                    </div>
                  ))}
                </div>

                {/* User Liste */}
                <div className="space-y-2">
                  {filteredUsers.map((user) => {
                    const isExpanded = expandedUser === user.id;
                    const isCurrentUser = user.id === session?.user?.id;

                    return (
                      <div key={user.id} className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 overflow-hidden">
                        <button type="button" onClick={() => setExpandedUser(isExpanded ? null : user.id)}
                          className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user.name}</p>
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${ROLE_COLORS[user.role]}`}>
                                {ROLE_LABELS[user.role]}
                              </span>
                              {isCurrentUser && <span className="text-[10px] text-blue-500">Du</span>}
                            </div>
                            <p className="text-xs text-gray-400 truncate">{user.email}</p>
                          </div>
                          <div className="text-xs text-gray-400 flex-shrink-0">
                            {user._count.teamMemberships} Teams
                          </div>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                            className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                          </svg>
                        </button>

                        {isExpanded && (
                          <div className="px-4 pb-4 border-t dark:border-gray-700 pt-3 space-y-3">
                            {/* Stats */}
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                              {[
                                { label: "Aufgaben", value: user._count.createdTasks },
                                { label: "Zuweisungen", value: user._count.assignments },
                                { label: "Events", value: user._count.createdEvents },
                                { label: "Abstimmungen", value: user._count.createdPolls },
                                { label: "Stimmen", value: user._count.votes },
                                { label: "Teams", value: user._count.teamMemberships },
                              ].map((stat) => (
                                <div key={stat.label} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2 text-center">
                                  <p className="text-sm font-bold text-gray-900 dark:text-white">{stat.value}</p>
                                  <p className="text-[9px] text-gray-400">{stat.label}</p>
                                </div>
                              ))}
                            </div>

                            {/* Teams */}
                            {user.teamMemberships.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Teams</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {user.teamMemberships.map((tm) => (
                                    <span key={tm.team.id}
                                      className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
                                      {tm.team.name} {tm.isLeader ? "(Leader)" : ""}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            <p className="text-[10px] text-gray-400">
                              Registriert am {new Date(user.createdAt).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })}
                            </p>

                            {/* Aktionen */}
                            {!isCurrentUser && (
                              <div className="flex flex-wrap gap-2 pt-2 border-t dark:border-gray-700">
                                {/* Rolle ändern */}
                                {roleUserId === user.id ? (
                                  <div className="flex gap-1.5 items-center">
                                    <select value={newRole} onChange={(e) => setNewRole(e.target.value)}
                                      className="border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-2 py-1 text-xs outline-none dark:text-white">
                                      <option value="">Rolle wählen...</option>
                                      {Object.entries(ROLE_LABELS).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                      ))}
                                    </select>
                                    <button type="button" onClick={() => handleChangeRole(user.id)}
                                      className="px-2 py-1 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700">Speichern</button>
                                    <button type="button" onClick={() => setRoleUserId(null)}
                                      className="text-xs text-gray-400">×</button>
                                  </div>
                                ) : (
                                  <button type="button" onClick={() => { setRoleUserId(user.id); setNewRole(user.role); }}
                                    className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-600">
                                    Rolle ändern
                                  </button>
                                )}

                                {/* Passwort zurücksetzen */}
                                {resetUserId === user.id ? (
                                  <div className="flex gap-1.5 items-center">
                                    <input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                                      placeholder="Neues Passwort..." className="border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-2 py-1 text-xs outline-none dark:text-white w-32" />
                                    <button type="button" onClick={() => handleResetPassword(user.id)}
                                      className="px-2 py-1 bg-amber-600 text-white rounded-lg text-xs hover:bg-amber-700">Setzen</button>
                                    <button type="button" onClick={() => setResetUserId(null)}
                                      className="text-xs text-gray-400">×</button>
                                  </div>
                                ) : (
                                  <button type="button" onClick={() => setResetUserId(user.id)}
                                    className="px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg text-xs font-medium hover:bg-amber-200">
                                    Passwort zurücksetzen
                                  </button>
                                )}

                                {/* Löschen */}
                                <button type="button" onClick={() => handleDeleteUser(user.id, user.name)}
                                  className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-xs font-medium hover:bg-red-200 dark:hover:bg-red-900/50">
                                  User löschen
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ====== TAB: USER ERSTELLEN ====== */}
            {tab === "create" && (
              <div className="max-w-lg mx-auto">
                <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-5">Neuen User erstellen</h2>

                  {createError && (
                    <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg p-3 mb-4 text-sm">{createError}</div>
                  )}

                  {createSuccess && (
                    <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 rounded-lg p-3 mb-4 text-sm">
                      {createSuccess}
                    </div>
                  )}

                  <form onSubmit={handleCreateUser} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">E-Mail *</label>
                      <input type="email" required value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                        placeholder="name@schule.de"
                        className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Name *</label>
                      <input type="text" required value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                        placeholder="Max Mustermann"
                        className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Einmal-Passwort *</label>
                      <div className="flex gap-2">
                        <input type="text" required value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                          placeholder="Mindestens 6 Zeichen"
                          className="flex-1 border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white font-mono" />
                        <button type="button" onClick={generatePassword}
                          className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-600">
                          Generieren
                        </button>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">Der User sollte das Passwort nach dem ersten Login ändern</p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Rolle</label>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(ROLE_LABELS).map(([key, label]) => (
                          <button key={key} type="button" onClick={() => setCreateForm({ ...createForm, role: key })}
                            className={`p-2.5 rounded-lg border-2 text-xs font-medium text-center transition-all ${
                              createForm.role === key ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                              : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400"
                            }`}>{label}</button>
                        ))}
                      </div>
                    </div>

                    <button type="submit" disabled={createLoading}
                      className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                      {createLoading ? "Wird erstellt..." : "User erstellen"}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* ====== TAB: EINSTELLUNGEN ====== */}
            {tab === "settings" && settings && (
              <div className="max-w-lg mx-auto space-y-4">
                {/* Wartungsmodus */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center text-lg">🔧</div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Wartungsmodus</h3>
                      <p className="text-[10px] text-gray-400">Login sperren für Wartungsarbeiten</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">Wartungsmodus aktiv</p>
                        <p className="text-[10px] text-gray-400">
                          {settings.maintenanceMode ? "Nur mit Wartungspasswort erreichbar" : "App ist normal erreichbar"}
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={settings.maintenanceMode}
                          onChange={handleToggleMaintenance} className="sr-only peer" />
                        <div className={`w-10 h-5 rounded-full peer transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all ${
                          settings.maintenanceMode ? "bg-red-500 after:translate-x-5" : "bg-gray-300"
                        }`}></div>
                      </label>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Wartungspasswort {settings.hasMaintenancePassword ? "(gesetzt ✓)" : "(nicht gesetzt)"}
                      </label>
                      <div className="flex gap-2">
                        <input type="text" value={maintenancePassword} onChange={(e) => setMaintenancePassword(e.target.value)}
                          placeholder="Neues Passwort setzen..."
                          className="flex-1 border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
                        <button type="button" onClick={handleSaveMaintenancePassword}
                          className="px-3 py-2 bg-orange-600 text-white rounded-lg text-xs font-medium hover:bg-orange-700">Speichern</button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Statistiken */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center text-lg">📊</div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">App-Statistiken</h3>
                      <p className="text-[10px] text-gray-400">Übersicht über die App-Nutzung</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{users.length}</p>
                      <p className="text-[10px] text-gray-400">Registrierte User</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{settings.financeGoal}€</p>
                      <p className="text-[10px] text-gray-400">Finanzziel</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}