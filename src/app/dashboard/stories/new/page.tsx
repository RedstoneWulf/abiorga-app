"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Team {
  id: string;
  name: string;
  color: string;
  isMember: boolean;
}

export default function NewStoryPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchTeams = useCallback(async () => {
    try {
      const res = await fetch("/api/teams");
      if (res.ok) {
        const data = await res.json();
        setTeams(data.filter((t: Team) => t.isMember));
      }
    } catch {
      console.error("Fehler");
    }
  }, []);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Nur Bilder sind erlaubt");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Bild darf maximal 5MB groß sein");
      return;
    }

    setError("");
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  function removeImage() {
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!selectedTeam) {
      setError("Wähle ein Team aus");
      return;
    }

    if (!text.trim() && !imagePreview) {
      setError("Text oder Bild ist erforderlich");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim().length > 0 ? text.trim() : undefined,
          mediaUrl: imagePreview || undefined,
          teamId: selectedTeam,
        }),
      });

      if (res.ok) {
        router.push("/dashboard/stories");
      } else {
        const data = await res.json();
        setError(data.error);
      }
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setLoading(false);
    }
  }

  const selectedTeamObj = teams.find((t) => t.id === selectedTeam);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button type="button" onClick={() => router.back()} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm">
            ← Zurück
          </button>
          <h1 className="text-sm font-semibold text-gray-900 dark:text-white">Neue Story</h1>
          <div className="w-14"></div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Info-Banner */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 mb-5">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            Stories sind 48 Stunden sichtbar und verschwinden dann automatisch.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg p-3 mb-5 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Team-Auswahl */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
              Posten als Team *
            </label>
            {teams.length === 0 ? (
              <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">Du bist in keinem Team</p>
                <p className="text-xs text-gray-400 mt-1">Tritt einem Team bei um Stories zu posten</p>
              </div>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {teams.map((team) => (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => setSelectedTeam(team.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 flex-shrink-0 transition-all ${
                      selectedTeam === team.id
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                        : "border-gray-200 dark:border-gray-600 hover:border-gray-300"
                    }`}
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: team.color }}
                    >
                      {team.name.charAt(0)}
                    </div>
                    <span className="text-xs font-medium text-gray-900 dark:text-white">{team.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bild-Upload */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
              Bild (optional)
            </label>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />

            {imagePreview ? (
              <div className="relative rounded-xl overflow-hidden border dark:border-gray-700">
                <img src={imagePreview} alt="Vorschau" className="w-full max-h-[400px] object-contain bg-gray-100 dark:bg-gray-900" />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute top-2 right-2 w-8 h-8 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 transition-colors"
                >
                  ×
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-8 border-2 border-dashed dark:border-gray-600 rounded-xl text-center hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors"
              >
                <div className="text-3xl mb-2">📷</div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Bild auswählen</p>
                <p className="text-[10px] text-gray-400 mt-0.5">JPG, PNG, max. 5MB</p>
              </button>
            )}
          </div>

          {/* Text */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Text {imagePreview ? "(optional)" : "*"}
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Was gibt's Neues? 🎉"
              rows={imagePreview ? 2 : 4}
              maxLength={1000}
              className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none dark:text-white"
            />
            <p className="text-[10px] text-gray-400 text-right mt-0.5">{text.length}/1000</p>
          </div>

          {/* Vorschau */}
          {(text.trim() || imagePreview) && selectedTeamObj && (
            <div className="border dark:border-gray-700 rounded-xl overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
                <p className="text-[10px] text-gray-400 font-medium uppercase">Vorschau</p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: selectedTeamObj.color }}>
                    {selectedTeamObj.name.charAt(0)}
                  </div>
                  <span className="text-xs font-semibold text-gray-900 dark:text-white">{selectedTeamObj.name}</span>
                  <span className="text-[10px] text-gray-400">• gerade eben</span>
                </div>
                {imagePreview && (
                  <img src={imagePreview} alt="Vorschau" className="w-full max-h-[200px] object-contain rounded-lg mb-2 bg-gray-100 dark:bg-gray-900" />
                )}
                {text.trim() && (
                  <p className="text-sm text-gray-900 dark:text-white">{text}</p>
                )}
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => router.back()}
              className="flex-1 py-2.5 border dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-sm">
              Abbrechen
            </button>
            <button type="submit" disabled={loading || !selectedTeam || (!text.trim() && !imagePreview)}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-50">
              {loading ? "Wird gepostet..." : "Story posten"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}