"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface StoryTeam {
  id: string;
  name: string;
  color: string;
  icon: string | null;
}

interface EmojiGroup {
  count: number;
  hasMyReaction: boolean;
}

interface Story {
  id: string;
  text: string | null;
  mediaUrl: string | null;
  createdBy: { id: string; name: string };
  team: StoryTeam | null;
  emojiGroups: Record<string, EmojiGroup>;
  commentCount: number;
  viewCount: number;
  hoursLeft: number;
  minutesLeft: number;
  isSeen: boolean;
  isFollowedTeam: boolean;
  createdAt: string;
  expiresAt: string;
}

interface Comment {
  id: string;
  content: string;
  user: { id: string; name: string };
  createdAt: string;
}

const REACTION_SETS = [
  { label: "Beliebt", emojis: ["🎉", "❤️", "👍", "🔥", "😂", "😮"] },
  { label: "Gefühle", emojis: ["😍", "🥺", "😭", "🤣", "😎", "🤔"] },
  { label: "Objekte", emojis: ["🏆", "💯", "⭐", "💎", "🚀", "🎯"] },
];

export default function StoriesPage() {
  const { data: session } = useSession();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedStory, setExpandedStory] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [newComment, setNewComment] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [emojiTab, setEmojiTab] = useState(0);

  const fetchStories = useCallback(async () => {
    try {
      const res = await fetch("/api/stories");
      if (res.ok) setStories(await res.json());
    } catch (error) { console.error("Fehler:", error); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchStories();
    const interval = setInterval(fetchStories, 30000);
    return () => clearInterval(interval);
  }, [fetchStories]);

  async function markSeen(storyId: string) {
    try {
      await fetch(`/api/stories/${storyId}/view`, { method: "POST" });
      setStories((prev) =>
        prev.map((s) => (s.id === storyId ? { ...s, isSeen: true } : s))
      );
    } catch {}
  }

  async function handleReact(storyId: string, emoji: string) {
    try {
      const res = await fetch(`/api/stories/${storyId}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      if (res.ok) {
        fetchStories();
        setShowEmojiPicker(null);
      }
    } catch {}
  }

  async function fetchComments(storyId: string) {
    try {
      const res = await fetch(`/api/stories/${storyId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments((prev) => ({ ...prev, [storyId]: data }));
      }
    } catch {}
  }

  async function handleComment(storyId: string) {
    if (!newComment.trim() || commentLoading) return;
    setCommentLoading(true);
    try {
      const res = await fetch(`/api/stories/${storyId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment.trim() }),
      });
      if (res.ok) { setNewComment(""); fetchComments(storyId); fetchStories(); }
      else { const d = await res.json(); alert(d.error); }
    } catch { alert("Netzwerkfehler"); }
    finally { setCommentLoading(false); }
  }

  function toggleComments(storyId: string) {
    if (expandedStory === storyId) {
      setExpandedStory(null);
    } else {
      setExpandedStory(storyId);
      if (!comments[storyId]) fetchComments(storyId);
    }
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "gerade eben";
    if (mins < 60) return `vor ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `vor ${hours}h`;
    return `vor ${Math.floor(hours / 24)}d`;
  }

  function getTeamIcon(team: StoryTeam | null) {
    if (!team) return "?";
    return team.icon || team.name.charAt(0);
  }

  // Team-Ringe oben
  const teamMap = new Map<string, { team: StoryTeam; count: number; hasUnseen: boolean }>();
  for (const story of stories) {
    if (story.team) {
      const existing = teamMap.get(story.team.id);
      if (existing) {
        existing.count++;
        if (!story.isSeen) existing.hasUnseen = true;
      } else {
        teamMap.set(story.team.id, { team: story.team, count: 1, hasUnseen: !story.isSeen });
      }
    }
  }
  // Sortiere: Ungesehene zuerst, dann gefolgte
  const activeTeams = Array.from(teamMap.values()).sort((a, b) => {
    if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
    return 0;
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm">← Zurück</Link>
          <h1 className="text-sm font-semibold text-gray-900 dark:text-white">Stories</h1>
          <Link href="/dashboard/stories/new" className="text-sm text-blue-600 dark:text-blue-400 font-medium">+ Posten</Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto">
        {/* Team-Ringe */}
        {activeTeams.length > 0 && (
          <div className="flex gap-4 overflow-x-auto px-4 py-4 border-b dark:border-gray-800">
            {activeTeams.map(({ team, count, hasUnseen }) => (
              <div key={team.id} className="flex flex-col items-center gap-1 flex-shrink-0">
                <div className="p-[3px] rounded-full" style={{
                  background: hasUnseen
                    ? `linear-gradient(135deg, ${team.color}, ${team.color}88)`
                    : "rgba(156,163,175,0.3)",
                }}>
                  <div className="w-14 h-14 rounded-full bg-white dark:bg-gray-900 flex items-center justify-center p-[2px]">
                    <div className="w-full h-full rounded-full flex items-center justify-center text-white font-bold text-lg"
                      style={{ backgroundColor: team.color }}>
                      {getTeamIcon(team)}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 max-w-[64px] truncate text-center">{team.name}</span>
                {hasUnseen && <span className="text-[9px] text-blue-500 font-medium">Neu</span>}
              </div>
            ))}
          </div>
        )}

        {/* Feed */}
        <div className="divide-y dark:divide-gray-800">
          {loading ? (
            <div className="text-center py-16 text-gray-400">Laden...</div>
          ) : stories.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="text-4xl mb-3">📸</div>
              <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">Noch keine Stories</p>
              <p className="text-gray-400 text-sm mt-1">Stories verschwinden nach 48 Stunden</p>
              <Link href="/dashboard/stories/new" className="inline-block mt-4 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">
                Erste Story posten
              </Link>
            </div>
          ) : (
            stories.map((story) => (
              <StoryCard
                key={story.id}
                story={story}
                getTeamIcon={getTeamIcon}
                timeAgo={timeAgo}
                onMarkSeen={markSeen}
                onReact={handleReact}
                showEmojiPicker={showEmojiPicker}
                setShowEmojiPicker={setShowEmojiPicker}
                emojiTab={emojiTab}
                setEmojiTab={setEmojiTab}
                expandedStory={expandedStory}
                toggleComments={toggleComments}
                comments={comments}
                newComment={newComment}
                setNewComment={setNewComment}
                commentLoading={commentLoading}
                handleComment={handleComment}
              />
            ))
          )}
        </div>
      </main>

      {showEmojiPicker && (
        <div className="fixed inset-0 z-0" onClick={() => setShowEmojiPicker(null)}></div>
      )}
    </div>
  );
}

function StoryCard({
  story, getTeamIcon, timeAgo, onMarkSeen, onReact,
  showEmojiPicker, setShowEmojiPicker, emojiTab, setEmojiTab,
  expandedStory, toggleComments, comments, newComment, setNewComment,
  commentLoading, handleComment,
}: {
  story: Story;
  getTeamIcon: (t: StoryTeam | null) => string;
  timeAgo: (d: string) => string;
  onMarkSeen: (id: string) => void;
  onReact: (id: string, emoji: string) => void;
  showEmojiPicker: string | null;
  setShowEmojiPicker: (id: string | null) => void;
  emojiTab: number;
  setEmojiTab: (n: number) => void;
  expandedStory: string | null;
  toggleComments: (id: string) => void;
  comments: Record<string, Comment[]>;
  newComment: string;
  setNewComment: (s: string) => void;
  commentLoading: boolean;
  handleComment: (id: string) => void;
}) {
  // Auto-mark als gesehen wenn sichtbar
  useEffect(() => {
    if (!story.isSeen) {
      const timer = setTimeout(() => onMarkSeen(story.id), 1500);
      return () => clearTimeout(timer);
    }
  }, [story.id, story.isSeen, onMarkSeen]);

  return (
    <div className={`bg-white dark:bg-gray-800 ${!story.isSeen ? "border-l-4 border-l-blue-500" : ""}`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold"
          style={{ backgroundColor: story.team?.color || "#4472C4" }}>
          {getTeamIcon(story.team)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">{story.team?.name}</span>
            {story.isFollowedTeam && <span className="text-[9px] text-pink-500">❤️</span>}
            <span className="text-[10px] text-gray-400">• {timeAgo(story.createdAt)}</span>
          </div>
          <p className="text-[10px] text-gray-400">{story.createdBy.name}</p>
        </div>
        <div className="flex items-center gap-2">
          {!story.isSeen && (
            <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></span>
          )}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-full px-2 py-0.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 text-gray-400">
              <path fillRule="evenodd" d="M1 8a7 7 0 1 1 14 0A7 7 0 0 1 1 8Zm7.75-4.25a.75.75 0 0 0-1.5 0V8c0 .414.336.75.75.75h3.25a.75.75 0 0 0 0-1.5h-2.5v-3.5Z" clipRule="evenodd" />
            </svg>
            <span className="text-[10px] text-gray-500 dark:text-gray-400">
              {story.hoursLeft > 0 ? `${story.hoursLeft}h` : `${story.minutesLeft}m`}
            </span>
          </div>
        </div>
      </div>

      {/* Image */}
      {story.mediaUrl && (
        <div className="bg-gray-100 dark:bg-gray-900">
          <img src={story.mediaUrl} alt="Story" className="w-full max-h-[500px] object-contain" />
        </div>
      )}

      {/* Text */}
      {story.text && (
        <div className={`px-4 ${story.mediaUrl ? "pt-3" : ""} ${!story.mediaUrl ? "py-4" : ""}`}>
          <p className={`text-gray-900 dark:text-white leading-relaxed ${!story.mediaUrl ? "text-lg" : "text-sm"}`}>{story.text}</p>
        </div>
      )}

      {/* Reaktionen */}
      <div className="px-4 py-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {Object.entries(story.emojiGroups).map(([emoji, group]) => (
            <button key={emoji} type="button" onClick={() => onReact(story.id, emoji)}
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${
                group.hasMyReaction
                  ? "bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700"
                  : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}>
              <span>{emoji}</span>
              <span className={`font-medium ${group.hasMyReaction ? "text-blue-700 dark:text-blue-300" : "text-gray-600 dark:text-gray-400"}`}>{group.count}</span>
            </button>
          ))}

          {/* Emoji Picker */}
          <div className="relative">
            <button type="button" onClick={() => setShowEmojiPicker(showEmojiPicker === story.id ? null : story.id)}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 text-sm transition-colors">+</button>

            {showEmojiPicker === story.id && (
              <div className="absolute bottom-full left-0 mb-1 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl shadow-xl z-10 w-56 overflow-hidden">
                {/* Tabs */}
                <div className="flex border-b dark:border-gray-700">
                  {REACTION_SETS.map((set, i) => (
                    <button key={i} type="button" onClick={() => setEmojiTab(i)}
                      className={`flex-1 py-1.5 text-[10px] font-medium transition-colors ${
                        emojiTab === i ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-400"
                      }`}>{set.label}</button>
                  ))}
                </div>
                <div className="p-2 flex flex-wrap gap-1">
                  {REACTION_SETS[emojiTab].emojis.map((emoji) => (
                    <button key={emoji} type="button" onClick={() => onReact(story.id, emoji)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-lg transition-colors">{emoji}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* View count */}
        {story.viewCount > 0 && (
          <p className="text-[9px] text-gray-400 mt-1">{story.viewCount} gesehen</p>
        )}
      </div>

      {/* Kommentar-Toggle */}
      <div className="px-4 pb-2">
        <button type="button" onClick={() => toggleComments(story.id)}
          className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
          {story.commentCount > 0
            ? `${story.commentCount} Kommentar${story.commentCount !== 1 ? "e" : ""} ansehen`
            : "Kommentieren"}
        </button>
      </div>

      {/* Kommentare */}
      {expandedStory === story.id && (
        <div className="px-4 pb-4 border-t dark:border-gray-700 pt-3">
          <div className="space-y-2 mb-3">
            {(comments[story.id] || []).map((comment) => (
              <div key={comment.id} className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-500 flex-shrink-0">
                  {comment.user.name.charAt(0)}
                </div>
                <div>
                  <p className="text-xs">
                    <span className="font-semibold text-gray-900 dark:text-white">{comment.user.name}</span>{" "}
                    <span className="text-gray-700 dark:text-gray-300">{comment.content}</span>
                  </p>
                  <p className="text-[9px] text-gray-400 mt-0.5">{timeAgo(comment.createdAt)}</p>
                </div>
              </div>
            ))}
            {comments[story.id]?.length === 0 && <p className="text-xs text-gray-400">Noch keine Kommentare</p>}
          </div>
          <div className="flex gap-2">
            <input type="text" value={expandedStory === story.id ? newComment : ""} onChange={(e) => setNewComment(e.target.value)}
              placeholder="Kommentar schreiben..." maxLength={500}
              onKeyDown={(e) => { if (e.key === "Enter") handleComment(story.id); }}
              className="flex-1 border dark:border-gray-600 bg-gray-50 dark:bg-gray-700 rounded-full px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
            <button type="button" onClick={() => handleComment(story.id)}
              disabled={commentLoading || !newComment.trim()}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-full text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">Senden</button>
          </div>
        </div>
      )}
    </div>
  );
}

interface Comment {
  id: string;
  content: string;
  user: { id: string; name: string };
  createdAt: string;
}