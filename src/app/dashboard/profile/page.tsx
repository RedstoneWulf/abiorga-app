"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTheme } from "@/components/ThemeProvider";

export default function ProfilePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  // Passwort ändern
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Account löschen
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteText, setDeleteText] = useState("");

  // Feedback
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackType, setFeedbackType] = useState<"BUG" | "FEATURE" | "OTHER">(
    "BUG"
  );
  const [feedbackTitle, setFeedbackTitle] = useState("");
  const [feedbackDesc, setFeedbackDesc] = useState("");
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  if (!session) return null;

  const userName = session.user.name || "User";
  const userEmail = session.user.email || "";
  const userRole = session.user.role;

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMessage(null);

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "Passwörter stimmen nicht überein" });
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();

      if (res.ok) {
        setPasswordMessage({ type: "success", text: "Passwort erfolgreich geändert!" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => setShowPasswordForm(false), 2000);
      } else {
        setPasswordMessage({ type: "error", text: data.error });
      }
    } catch {
      setPasswordMessage({ type: "error", text: "Netzwerkfehler" });
    } finally {
      setPasswordLoading(false);
    }
  }

  async function handleDeleteAccount() {
    try {
      const res = await fetch("/api/users/me", { method: "DELETE" });
      const data = await res.json();

      if (res.ok) {
        signOut({ callbackUrl: "/login" });
      } else {
        alert(data.error);
      }
    } catch {
      alert("Netzwerkfehler");
    }
  }

  async function handleFeedback(e: React.FormEvent) {
    e.preventDefault();
    setFeedbackMessage(null);
    setFeedbackLoading(true);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: feedbackType,
          title: feedbackTitle,
          description: feedbackDesc,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setFeedbackMessage({ type: "success", text: "Feedback gesendet! Danke!" });
        setFeedbackTitle("");
        setFeedbackDesc("");
        setTimeout(() => {
          setShowFeedback(false);
          setFeedbackMessage(null);
        }, 2000);
      } else {
        setFeedbackMessage({ type: "error", text: data.error });
      }
    } catch {
      setFeedbackMessage({ type: "error", text: "Netzwerkfehler" });
    } finally {
      setFeedbackLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Navbar */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
            </svg>
            Zurück
          </Link>
          <h1 className="text-sm font-semibold text-gray-900 dark:text-white">
            Profil & Einstellungen
          </h1>
          <div className="w-14"></div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* --- Profil-Header --- */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full flex items-center justify-center text-2xl font-bold">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {userName}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {userEmail}
              </p>
              <span className="inline-block mt-1 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                {userRole}
              </span>
            </div>
          </div>
        </div>

        {/* --- Passwort ändern --- */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700">
          <button
            type="button"
            onClick={() => {
              setShowPasswordForm(!showPasswordForm);
              setPasswordMessage(null);
            }}
            className="w-full p-4 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-600 dark:text-gray-300">
                  <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Passwort ändern</p>
                <p className="text-xs text-gray-400">Aktualisiere dein Passwort</p>
              </div>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 text-gray-400 transition-transform ${showPasswordForm ? "rotate-180" : ""}`}>
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </button>

          {showPasswordForm && (
            <form onSubmit={handlePasswordChange} className="px-4 pb-4 space-y-3">
              {passwordMessage && (
                <div className={`text-sm p-3 rounded-lg ${passwordMessage.type === "success" ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                  {passwordMessage.text}
                </div>
              )}
              <input
                type="password"
                placeholder="Aktuelles Passwort"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
              />
              <input
                type="password"
                placeholder="Neues Passwort (min. 6 Zeichen)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
              />
              <input
                type="password"
                placeholder="Neues Passwort bestätigen"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
              />
              <button
                type="submit"
                disabled={passwordLoading}
                className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {passwordLoading ? "Wird geändert..." : "Passwort ändern"}
              </button>
            </form>
          )}
        </div>

        {/* --- Design / Theme --- */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-600 dark:text-gray-300">
                <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM10 7a3 3 0 100 6 3 3 0 000-6zM15.657 5.404a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.06l1.06-1.06zM6.464 14.596a.75.75 0 10-1.06-1.06l-1.06 1.06a.75.75 0 001.06 1.06l1.06-1.06zM18 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0118 10zM5 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 015 10zM14.596 15.657a.75.75 0 001.06-1.06l-1.06-1.061a.75.75 0 10-1.06 1.06l1.06 1.06zM5.404 6.464a.75.75 0 001.06-1.06l-1.06-1.06a.75.75 0 10-1.06 1.06l1.06 1.06z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Design</p>
              <p className="text-xs text-gray-400">Wähle dein bevorzugtes Design</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(["light", "dark", "system"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                className={`p-3 rounded-xl border-2 text-center transition-all ${
                  theme === t
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                    : "border-gray-200 dark:border-gray-600 hover:border-gray-300"
                }`}
              >
                <div className="text-lg mb-1">
                  {t === "light" ? "☀️" : t === "dark" ? "🌙" : "💻"}
                </div>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {t === "light" ? "Hell" : t === "dark" ? "Dunkel" : "System"}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* --- Bug melden / Feedback --- */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700">
          <button
            type="button"
            onClick={() => {
              setShowFeedback(!showFeedback);
              setFeedbackMessage(null);
            }}
            className="w-full p-4 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-600 dark:text-gray-300">
                  <path fillRule="evenodd" d="M2 3.5A1.5 1.5 0 013.5 2h9A1.5 1.5 0 0114 3.5v11.75A2.75 2.75 0 0016.75 18h-12A2.75 2.75 0 012 15.25V3.5zm3.75 7a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5zm0-3a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5zM5 5.75A.75.75 0 015.75 5h4.5a.75.75 0 010 1.5h-4.5A.75.75 0 015 5.75z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Feedback & Bugs</p>
                <p className="text-xs text-gray-400">Melde Probleme oder schlage Verbesserungen vor</p>
              </div>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 text-gray-400 transition-transform ${showFeedback ? "rotate-180" : ""}`}>
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </button>

          {showFeedback && (
            <form onSubmit={handleFeedback} className="px-4 pb-4 space-y-3">
              {feedbackMessage && (
                <div className={`text-sm p-3 rounded-lg ${feedbackMessage.type === "success" ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                  {feedbackMessage.text}
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { value: "BUG", label: "Bug", icon: "🐛" },
                    { value: "FEATURE", label: "Idee", icon: "💡" },
                    { value: "OTHER", label: "Sonstiges", icon: "💬" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFeedbackType(opt.value)}
                    className={`p-2 rounded-lg border-2 text-center transition-all text-xs font-medium ${
                      feedbackType === opt.value
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                        : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Kurzer Titel"
                value={feedbackTitle}
                onChange={(e) => setFeedbackTitle(e.target.value)}
                required
                className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
              />
              <textarea
                placeholder="Beschreibe das Problem oder deine Idee..."
                value={feedbackDesc}
                onChange={(e) => setFeedbackDesc(e.target.value)}
                required
                rows={3}
                className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none dark:text-white"
              />
              <button
                type="submit"
                disabled={feedbackLoading}
                className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {feedbackLoading ? "Wird gesendet..." : "Absenden"}
              </button>
            </form>
          )}
        </div>

        {/* --- Über die App --- */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-600 dark:text-gray-300">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Über AbiOrga</p>
              <p className="text-xs text-gray-400">App-Informationen</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-1.5 border-b dark:border-gray-700">
              <span className="text-gray-500 dark:text-gray-400">Version</span>
              <span className="text-gray-900 dark:text-white font-medium">1.0.0</span>
            </div>
            <div className="flex justify-between py-1.5 border-b dark:border-gray-700">
              <span className="text-gray-500 dark:text-gray-400">Entwickelt von</span>
              <span className="text-gray-900 dark:text-white font-medium">Abi-Komitee</span>
            </div>
            <div className="flex justify-between py-1.5 border-b dark:border-gray-700">
              <span className="text-gray-500 dark:text-gray-400">Framework</span>
              <span className="text-gray-900 dark:text-white font-medium">Next.js</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500 dark:text-gray-400">Registrierte User</span>
              <span className="text-gray-900 dark:text-white font-medium">—</span>
            </div>
          </div>
        </div>

        {/* --- Account löschen --- */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-900">
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
            className="w-full p-4 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-red-50 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-red-500">
                  <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-red-600 dark:text-red-400">Account löschen</p>
                <p className="text-xs text-gray-400">Alle Daten werden unwiderruflich gelöscht</p>
              </div>
            </div>
          </button>

          {showDeleteConfirm && (
            <div className="px-4 pb-4 space-y-3">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">
                  Das kann nicht rückgängig gemacht werden. Alle deine Daten,
                  Aufgaben-Zuweisungen und Bewertungen werden gelöscht. Tippe
                  <span className="font-bold"> LÖSCHEN </span>
                  ein um zu bestätigen.
                </p>
              </div>
              <input
                type="text"
                placeholder='Tippe "LÖSCHEN" ein'
                value={deleteText}
                onChange={(e) => setDeleteText(e.target.value)}
                className="w-full border border-red-300 dark:border-red-800 bg-white dark:bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500 dark:text-white"
              />
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteText !== "LÖSCHEN"}
                className="w-full py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Account endgültig löschen
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}