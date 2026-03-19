"use client";

import { useState, useEffect } from "react";

interface Prefs {
  stories: boolean;
  chat: boolean;
  events: boolean;
  tasks: boolean;
  polls: boolean;
  transactions: boolean;
  global: boolean;
}

const PREF_ITEMS: { key: keyof Prefs; label: string; desc: string; icon: string }[] = [
  { key: "global", label: "Globale Nachrichten", desc: "Ankündigungen vom Admin/Komitee", icon: "📢" },
  { key: "stories", label: "Team-Stories", desc: "Wenn Teams denen du folgst posten", icon: "📸" },
  { key: "chat", label: "Chat-Nachrichten", desc: "Neue Nachrichten in deinen Teams", icon: "💬" },
  { key: "events", label: "Events & Klausuren", desc: "Neue Termine und Klausuren", icon: "📅" },
  { key: "tasks", label: "Aufgaben", desc: "Neue oder zugewiesene Aufgaben", icon: "📋" },
  { key: "polls", label: "Abstimmungen", desc: "Neue Abstimmungen", icon: "🗳️" },
  { key: "transactions", label: "Transaktionen", desc: "Genehmigt/abgelehnt", icon: "💰" },
];

export default function NotificationSettings() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/notifications/preferences")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data) setPrefs(data); })
      .catch(() => {});
  }, []);

  async function togglePref(key: keyof Prefs) {
    if (!prefs) return;
    const newValue = !prefs[key];
    setPrefs({ ...prefs, [key]: newValue });
    setSaving(true);

    try {
      await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: newValue }),
      });
    } catch {
      // Revert on error
      setPrefs({ ...prefs, [key]: !newValue });
    } finally {
      setSaving(false);
    }
  }

  if (!prefs) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 overflow-hidden">
      <div className="p-4 border-b dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-600 dark:text-gray-300">
              <path fillRule="evenodd" d="M10 2a6 6 0 00-6 6c0 1.887-.454 3.665-1.257 5.234a.75.75 0 00.515 1.076 32.91 32.91 0 003.256.508 3.5 3.5 0 006.972 0 32.903 32.903 0 003.256-.508.75.75 0 00.515-1.076A11.448 11.448 0 0116 8a6 6 0 00-6-6zM8.05 14.943a33.54 33.54 0 003.9 0 2 2 0 01-3.9 0z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">Benachrichtigungen</p>
            <p className="text-xs text-gray-400">Wähle worüber du informiert werden möchtest</p>
          </div>
        </div>
      </div>

      <div className="divide-y dark:divide-gray-700">
        {PREF_ITEMS.map((item) => (
          <div key={item.key} className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <span className="text-base">{item.icon}</span>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</p>
                <p className="text-[10px] text-gray-400">{item.desc}</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={prefs[item.key]}
                onChange={() => togglePref(item.key)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-gray-300 rounded-full peer peer-checked:bg-blue-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
            </label>
          </div>
        ))}
      </div>

      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50">
        <p className="text-[10px] text-gray-400 flex items-center gap-1">
          <span className="text-red-500">🚨</span>
          Wichtige Nachrichten (High Priority) werden immer zugestellt und können nicht abgestellt werden.
        </p>
      </div>
    </div>
  );
}