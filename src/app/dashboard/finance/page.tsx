"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface Transaction {
  id: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  status: "PENDING" | "APPROVED" | "REJECTED";
  reason: string;
  category: string | null;
  rejectReason: string | null;
  transactionDate: string | null;
  receiptUrl: string | null;
  receiptExpiresAt: string | null;
  createdBy: { id: string; name: string };
  reviewedBy: { id: string; name: string } | null;
  createdAt: string;
}

interface FinanceOverview {
  balance: number;
  totalIncome: number;
  totalExpense: number;
  goal: number;
  pendingCount: number;
  recentTransactions: { id: string; amount: number; type: string; reason: string; category: string | null; createdAt: string }[];
  expensesByCategory: { category: string; amount: number }[];
}

const CATEGORIES = ["Deko", "Catering", "Location", "Musik/DJ", "Motto-Woche", "Druck", "Transport", "Sonstiges"];
const STATUS_LABELS: Record<string, string> = { PENDING: "Ausstehend", APPROVED: "Genehmigt", REJECTED: "Abgelehnt" };
const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  APPROVED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });
}

export default function FinancePage() {
  const { data: session } = useSession();
  const [overview, setOverview] = useState<FinanceOverview | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pendingTx, setPendingTx] = useState<Transaction[]>([]);
  const [tab, setTab] = useState<"overview" | "transactions" | "pending">("overview");
  const [showCreate, setShowCreate] = useState(false);
  const [showGoalEdit, setShowGoalEdit] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const hasFetched = useRef(false);

  const [newTx, setNewTx] = useState({
    amount: "", type: "INCOME" as "INCOME" | "EXPENSE", reason: "", category: "",
    transactionDate: "", receiptUrl: "",
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [newGoal, setNewGoal] = useState("");
  const receiptInputRef = useRef<HTMLInputElement>(null);

  const userRole = session?.user?.role;
  const userId = session?.user?.id;
  const isAdminOrCommittee = userRole === "ADMIN" || userRole === "COMMITTEE";

  useEffect(() => {
    if (!session || hasFetched.current) return;
    hasFetched.current = true;
    loadData();
  }, [session]);

  async function loadData() {
    try {
      const [overviewRes, txRes, pendingRes] = await Promise.all([
        fetch("/api/finance"),
        fetch("/api/finance/transactions"),
        isAdminOrCommittee ? fetch("/api/finance/transactions?status=PENDING") : Promise.resolve(null),
      ]);
      if (overviewRes.ok) setOverview(await overviewRes.json());
      if (txRes.ok) setTransactions(await txRes.json());
      if (pendingRes?.ok) setPendingTx(await pendingRes.json());
    } catch (error) { console.error("Fehler:", error); }
  }

  function handleReceiptSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setCreateError("Nur Bilder erlaubt"); return; }
    if (file.size > 5 * 1024 * 1024) { setCreateError("Max. 5MB"); return; }
    setCreateError("");
    const reader = new FileReader();
    reader.onload = () => setNewTx((prev) => ({ ...prev, receiptUrl: reader.result as string }));
    reader.readAsDataURL(file);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    setCreateLoading(true);
    try {
      const res = await fetch("/api/finance/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(newTx.amount),
          type: newTx.type,
          reason: newTx.reason,
          category: newTx.category.length > 0 ? newTx.category : undefined,
          transactionDate: newTx.transactionDate.length > 0 ? newTx.transactionDate : undefined,
          receiptUrl: newTx.receiptUrl.length > 0 ? newTx.receiptUrl : undefined,
        }),
      });
      if (res.ok) {
        setShowCreate(false);
        setNewTx({ amount: "", type: "INCOME", reason: "", category: "", transactionDate: "", receiptUrl: "" });
        hasFetched.current = false;
        loadData();
      } else { const d = await res.json(); setCreateError(d.error); }
    } catch { setCreateError("Netzwerkfehler"); }
    finally { setCreateLoading(false); }
  }

  async function handleReview(txId: string, action: "APPROVE" | "REJECT") {
    try {
      const res = await fetch(`/api/finance/transactions/${txId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, rejectReason: action === "REJECT" ? rejectReason : undefined }),
      });
      if (res.ok) { setRejectId(null); setRejectReason(""); hasFetched.current = false; loadData(); }
      else { const d = await res.json(); alert(d.error); }
    } catch { alert("Netzwerkfehler"); }
  }

  async function handleGoalUpdate() {
    const goalValue = parseFloat(newGoal);
    if (!goalValue || goalValue <= 0) return;
    try {
      const res = await fetch("/api/finance", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ financeGoal: goalValue }) });
      if (res.ok) { setShowGoalEdit(false); setNewGoal(""); hasFetched.current = false; loadData(); }
    } catch { alert("Netzwerkfehler"); }
  }

  async function handleExport(txId: string) {
    try {
      const res = await fetch(`/api/finance/transactions/${txId}/export`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `transaktion-${txId.slice(0, 8)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
      } else { const d = await res.json(); alert(d.error); }
    } catch { alert("Netzwerkfehler"); }
  }

  if (!overview) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center"><p className="text-gray-400">Laden...</p></div>;
  }

  const goalPercent = Math.min(100, Math.round((overview.balance / Math.max(overview.goal, 1)) * 100));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm">← Zurück</Link>
          <h1 className="text-sm font-semibold text-gray-900 dark:text-white">Finanzen</h1>
          <button type="button" onClick={() => setShowCreate(true)} className="text-sm text-blue-600 dark:text-blue-400 font-medium">+ Neu</button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-5 space-y-5">
        {/* Kontostand */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-5">
          <div className="flex items-end justify-between mb-1">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Kontostand</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{formatCurrency(overview.balance)}</p>
            </div>
            <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 rounded-lg">{goalPercent}%</span>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <p className="text-xs text-gray-400">Ziel: {formatCurrency(overview.goal)}</p>
            {isAdminOrCommittee && (
              <button type="button" onClick={() => { setShowGoalEdit(!showGoalEdit); setNewGoal(String(overview.goal)); }}
                className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline">Ändern</button>
            )}
          </div>
          {showGoalEdit && (
            <div className="flex gap-2 mb-3">
              <input type="number" value={newGoal} onChange={(e) => setNewGoal(e.target.value)} min="1" step="100"
                className="flex-1 border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
              <button type="button" onClick={handleGoalUpdate} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">Speichern</button>
            </div>
          )}
          <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${goalPercent}%`, background: "linear-gradient(90deg, #3B82F6, #8B5CF6)" }}></div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
              <p className="text-[10px] text-green-600 dark:text-green-400 font-semibold uppercase">Einnahmen</p>
              <p className="text-lg font-bold text-green-700 dark:text-green-300">{formatCurrency(overview.totalIncome)}</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
              <p className="text-[10px] text-red-600 dark:text-red-400 font-semibold uppercase">Ausgaben</p>
              <p className="text-lg font-bold text-red-700 dark:text-red-300">{formatCurrency(overview.totalExpense)}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {[
            { key: "overview" as const, label: "Übersicht" },
            { key: "transactions" as const, label: "Transaktionen" },
            ...(isAdminOrCommittee ? [{ key: "pending" as const, label: `Genehmigungen${overview.pendingCount > 0 ? ` (${overview.pendingCount})` : ""}` }] : []),
          ].map((t) => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                tab === t.key ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400"
              }`}>{t.label}</button>
          ))}
        </div>

        {/* Tab: Übersicht */}
        {tab === "overview" && (
          <div className="space-y-4">
            {overview.expensesByCategory.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Ausgaben nach Kategorie</h3>
                <div className="space-y-2">
                  {overview.expensesByCategory.map((cat) => {
                    const percent = overview.totalExpense > 0 ? Math.round((cat.amount / overview.totalExpense) * 100) : 0;
                    return (
                      <div key={cat.category}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-700 dark:text-gray-300 font-medium">{cat.category}</span>
                          <span className="text-gray-500">{formatCurrency(cat.amount)} ({percent}%)</span>
                        </div>
                        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full bg-red-400 dark:bg-red-500 rounded-full" style={{ width: `${percent}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Letzte Transaktionen</h3>
              {overview.recentTransactions.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Noch keine Transaktionen</p>
              ) : (
                <div className="space-y-2">
                  {overview.recentTransactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between py-2 border-b dark:border-gray-700 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 dark:text-white truncate">{tx.reason}</p>
                        <div className="flex items-center gap-2">
                          {tx.category && <span className="text-[10px] text-gray-400">{tx.category}</span>}
                          <span className="text-[10px] text-gray-400">{formatDate(tx.createdAt)}</span>
                        </div>
                      </div>
                      <p className={`text-sm font-semibold ml-3 ${tx.type === "INCOME" ? "text-green-600" : "text-red-500"}`}>
                        {tx.type === "INCOME" ? "+" : "−"}{formatCurrency(tx.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Transaktionen */}
        {tab === "transactions" && (
          <div className="space-y-2">
            {transactions.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Keine Transaktionen</p>
            ) : transactions.map((tx) => (
              <div key={tx.id} className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{tx.reason}</p>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${STATUS_COLORS[tx.status]}`}>{STATUS_LABELS[tx.status]}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 flex-wrap">
                      <span>{tx.createdBy.name}</span>
                      {tx.category && <span>• {tx.category}</span>}
                      <span>• {formatDate(tx.createdAt)}</span>
                      {tx.transactionDate && <span>• Datum: {formatDate(tx.transactionDate)}</span>}
                      {tx.receiptUrl && <span className="text-blue-500">📎 Beleg</span>}
                    </div>
                    {tx.status === "REJECTED" && tx.rejectReason && (
                      <p className="text-[10px] text-red-500 mt-1">Grund: {tx.rejectReason}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                    <p className={`text-sm font-semibold ${tx.type === "INCOME" ? "text-green-600" : "text-red-500"}`}>
                      {tx.type === "INCOME" ? "+" : "−"}{formatCurrency(tx.amount)}
                    </p>
                  </div>
                </div>
                {/* Aktionen */}
                <div className="flex items-center gap-3 mt-2">
                  {tx.receiptUrl && (
                    <button type="button" onClick={() => setReceiptPreview(tx.receiptUrl)}
                      className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline">Beleg ansehen</button>
                  )}
                  {(isAdminOrCommittee || tx.createdBy.id === userId) && (
                    <button type="button" onClick={() => handleExport(tx.id)}
                      className="text-[10px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">📄 Export</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab: Genehmigungen */}
        {tab === "pending" && isAdminOrCommittee && (
          <div className="space-y-3">
            {pendingTx.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-3xl mb-2">✓</div>
                <p className="text-sm text-gray-400">Keine ausstehenden Genehmigungen</p>
              </div>
            ) : pendingTx.map((tx) => (
              <div key={tx.id} className="bg-white dark:bg-gray-800 rounded-xl border-2 border-yellow-200 dark:border-yellow-900 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{tx.reason}</p>
                    <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5 flex-wrap">
                      <span>von {tx.createdBy.name}</span>
                      {tx.category && <span>• {tx.category}</span>}
                      <span>• {formatDate(tx.createdAt)}</span>
                      {tx.transactionDate && <span>• Datum: {formatDate(tx.transactionDate)}</span>}
                    </div>
                  </div>
                  <p className={`text-lg font-bold ${tx.type === "INCOME" ? "text-green-600" : "text-red-500"}`}>
                    {tx.type === "INCOME" ? "+" : "−"}{formatCurrency(tx.amount)}
                  </p>
                </div>

                {tx.receiptUrl && (
                  <div className="mb-3">
                    <button type="button" onClick={() => setReceiptPreview(tx.receiptUrl)}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                      📎 Beleg ansehen
                    </button>
                  </div>
                )}

                {rejectId === tx.id ? (
                  <div className="space-y-2">
                    <input type="text" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Grund für die Ablehnung..."
                      className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500 dark:text-white" />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => handleReview(tx.id, "REJECT")} disabled={rejectReason.trim().length === 0}
                        className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">Ablehnen</button>
                      <button type="button" onClick={() => { setRejectId(null); setRejectReason(""); }}
                        className="px-3 py-1.5 text-gray-500 text-xs">Abbrechen</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => handleReview(tx.id, "APPROVE")}
                      className="flex-1 py-2 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors">Genehmigen</button>
                    <button type="button" onClick={() => setRejectId(tx.id)}
                      className="flex-1 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-xs font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors">Ablehnen</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Neue Transaktion Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-xl p-6 w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Neue Transaktion</h3>
              <button type="button" onClick={() => { setShowCreate(false); setCreateError(""); }} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            {createError && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg p-3 mb-4 text-sm">{createError}</div>
            )}
            <form onSubmit={handleCreate} className="space-y-4">
              {/* Typ */}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setNewTx({ ...newTx, type: "INCOME" })}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${newTx.type === "INCOME" ? "border-green-500 bg-green-50 dark:bg-green-900/30" : "border-gray-200 dark:border-gray-600"}`}>
                  <div className="text-lg mb-0.5">💰</div>
                  <div className="text-xs font-medium text-gray-900 dark:text-white">Einzahlung</div>
                </button>
                <button type="button" onClick={() => setNewTx({ ...newTx, type: "EXPENSE" })}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${newTx.type === "EXPENSE" ? "border-red-500 bg-red-50 dark:bg-red-900/30" : "border-gray-200 dark:border-gray-600"}`}>
                  <div className="text-lg mb-0.5">🧾</div>
                  <div className="text-xs font-medium text-gray-900 dark:text-white">Ausgabe</div>
                </button>
              </div>

              {/* Betrag */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Betrag (€) *</label>
                <input type="number" required min="0.01" step="0.01" value={newTx.amount}
                  onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })} placeholder="0,00"
                  className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2.5 text-lg font-semibold outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
              </div>

              {/* Grund */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Grund *</label>
                <input type="text" required value={newTx.reason} onChange={(e) => setNewTx({ ...newTx, reason: e.target.value })}
                  placeholder="z.B. Abi-Beitrag, Deko-Einkauf..."
                  className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
              </div>

              {/* Kategorie */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Kategorie</label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((cat) => (
                    <button key={cat} type="button" onClick={() => setNewTx({ ...newTx, category: newTx.category === cat ? "" : cat })}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        newTx.category === cat ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                      }`}>{cat}</button>
                  ))}
                </div>
              </div>

              {/* Datum */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Transaktionsdatum <span className="text-gray-300 dark:text-gray-600">(optional)</span>
                </label>
                <p className="text-[10px] text-gray-400 mb-1.5">
                  {newTx.type === "INCOME" ? "Wann wird/wurde die Einzahlung getätigt?" : "Wann wurde der Kauf getätigt?"}
                </p>
                <input type="date" value={newTx.transactionDate} onChange={(e) => setNewTx({ ...newTx, transactionDate: e.target.value })}
                  className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
              </div>

              {/* Beleg */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Beleg <span className="text-gray-300 dark:text-gray-600">(optional)</span>
                </label>
                <input type="file" ref={receiptInputRef} accept="image/*" onChange={handleReceiptSelect} className="hidden" />
                {newTx.receiptUrl ? (
                  <div className="relative rounded-lg overflow-hidden border dark:border-gray-700">
                    <img src={newTx.receiptUrl} alt="Beleg" className="w-full max-h-32 object-contain bg-gray-100 dark:bg-gray-900" />
                    <button type="button" onClick={() => { setNewTx({ ...newTx, receiptUrl: "" }); if (receiptInputRef.current) receiptInputRef.current.value = ""; }}
                      className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center text-xs hover:bg-black/80">×</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => receiptInputRef.current?.click()}
                    className="w-full py-4 border-2 border-dashed dark:border-gray-600 rounded-lg text-center hover:border-blue-400 transition-colors">
                    <p className="text-sm text-gray-500 dark:text-gray-400">📷 Beleg-Foto hochladen</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Wird 48h nach Bearbeitung gelöscht</p>
                  </button>
                )}
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <p className="text-xs text-yellow-700 dark:text-yellow-400">
                  Transaktionen müssen genehmigt werden. Beleg-Fotos werden 48h nach Bearbeitung automatisch gelöscht.
                </p>
              </div>

              <button type="submit" disabled={createLoading}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {createLoading ? "Wird erstellt..." : "Transaktion einreichen"}</button>
            </form>
          </div>
        </div>
      )}

      {/* Beleg-Vorschau Modal */}
      {receiptPreview && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setReceiptPreview(null)}>
          <div className="max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end mb-2">
              <button type="button" onClick={() => setReceiptPreview(null)}
                className="w-8 h-8 bg-white/20 text-white rounded-full flex items-center justify-center hover:bg-white/30">×</button>
            </div>
            <img src={receiptPreview} alt="Beleg" className="w-full max-h-[70vh] object-contain rounded-xl" />
          </div>
        </div>
      )}
    </div>
  );
}