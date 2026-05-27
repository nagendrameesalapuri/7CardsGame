import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";
import { admin } from "../services/api";
import { on } from "../services/socket";
import { useAuthStore } from "../store/authStore";
import { Avatar } from "../components/ui/Avatar";
import PlayerIntelligencePage from "./PlayerIntelligencePage";
import GameReviewPage from "./GameReviewPage";

// Status badge helper shared across sections
function StatusBadge({ status }: { status: string }) {
  const MAP: Record<string, { color: string; bg: string; label: string }> = {
    won: { color: "#00ff88", bg: "rgba(0,255,136,0.12)", label: "Won" },
    lost: { color: "#ff6b6b", bg: "rgba(255,107,107,0.12)", label: "Lost" },
    draw: { color: "#fbbf24", bg: "rgba(251,191,36,0.12)", label: "Draw" },
    active: { color: "#60a5fa", bg: "rgba(96,165,250,0.12)", label: "Active" },
  };
  const m = MAP[status] ?? MAP.active;
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[10px] font-bold"
      style={{ color: m.color, background: m.bg }}
    >
      {m.label}
    </span>
  );
}

type Section =
  | "overview"
  | "rooms"
  | "users"
  | "leaderboard"
  | "features"
  | "gameconfig"
  | "walletconfig"
  | "deposits"
  | "withdrawals"
  | "wallets"
  | "tournaments"
  | "support"
  | "notify"
  | "announcements"
  | "survivalconfig"
  | "analytics"
  | "aiguide"
  | "playerintel"
  | "missedpayouts"
  | "gamereview"
  | "holdsystem"
  | "spinanalytics"
  | "roomtracker"
  | "referrals";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatLastSeen(lastSeenAt: string | null, isOnline: boolean): string {
  if (isOnline) return "Online now";
  if (!lastSeenAt) return "Never";
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(lastSeenAt).toLocaleDateString();
}

// ── Shared styles ────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: "rgba(12,14,18,0.95)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 16,
};

function StatCard({
  icon,
  label,
  value,
  color = "#00ff88",
}: {
  icon: string;
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="rounded-2xl p-4 flex items-center gap-3" style={cardStyle}>
      <div className="text-2xl">{icon}</div>
      <div>
        <p className="text-xs text-dark-muted">{label}</p>
        <p className="text-xl font-bold" style={{ color }}>
          {value}
        </p>
      </div>
    </div>
  );
}

function Toggle({
  label,
  desc,
  value,
  onChange,
}: {
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className="flex items-center justify-between p-4 rounded-xl"
      style={cardStyle}
    >
      <div>
        <p className="font-semibold text-dark-text text-sm">{label}</p>
        <p className="text-xs text-dark-muted mt-0.5">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={clsx(
          "relative w-12 h-6 rounded-full transition-colors flex-shrink-0",
          value ? "bg-neon-green" : "bg-dark-border",
        )}
      >
        <motion.span
          layout
          className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow"
          animate={{ x: value ? 26 : 2 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </button>
    </div>
  );
}

function NumberInput({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div
      className="flex items-center justify-between p-3 rounded-xl"
      style={cardStyle}
    >
      <span className="text-sm text-dark-text">{label}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-7 h-7 rounded-lg bg-dark-border text-dark-text font-bold text-sm flex items-center justify-center hover:bg-dark-border/80"
        >
          −
        </button>
        <span className="w-8 text-center font-bold text-neon-green text-sm">
          {value}
        </span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          className="w-7 h-7 rounded-lg bg-dark-border text-dark-text font-bold text-sm flex items-center justify-center hover:bg-dark-border/80"
        >
          +
        </button>
      </div>
    </div>
  );
}

// ── Sections ──────────────────────────────────────────────────────────────────

function OverviewSection() {
  const [stats, setStats] = useState<any>(null);
  const [rooms, setRooms] = useState<any[]>([]);

  const fetchAll = useCallback(() => {
    admin.getStats().then((r) => setStats(r.data)).catch(console.error);
    admin.getRooms().then((r) => setRooms(r.data.rooms ?? [])).catch(console.error);
  }, []);

  useEffect(() => {
    fetchAll();
    const t = setInterval(fetchAll, 10000);
    return () => clearInterval(t);
  }, [fetchAll]);

  if (!stats)
    return (
      <div className="text-dark-muted text-sm animate-pulse">Loading…</div>
    );

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold text-white">Platform Overview</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard icon="👥" label="Total Users" value={stats.totalUsers} />
        <StatCard
          icon="🟢"
          label="Online Now"
          value={stats.onlineCount}
          color="#00ff88"
        />
        <StatCard
          icon="🎮"
          label="Live Games"
          value={stats.liveGames}
          color="#00d4ff"
        />
        <StatCard
          icon="🏠"
          label="Active Rooms"
          value={stats.activeRooms}
          color="#a855f7"
        />
        <StatCard
          icon="🏆"
          label="Total Games"
          value={stats.totalGames}
          color="#fbbf24"
        />
      </div>

      {/* ── Active Rooms inline panel ── */}
      <div className="rounded-2xl overflow-hidden" style={cardStyle}>
        <div className="flex items-center justify-between px-4 pt-4 pb-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="flex items-center gap-2">
            <span className="text-base">🏠</span>
            <span className="text-sm font-bold text-white">Active Rooms</span>
            {rooms.length > 0 && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                style={{ background: "rgba(168,85,247,0.18)", color: "#c084fc" }}>
                {rooms.length}
              </span>
            )}
          </div>
          <button onClick={fetchAll} className="text-[11px] text-dark-muted hover:text-neon-green transition-colors px-2 py-1 rounded">
            ↺ Refresh
          </button>
        </div>

        {rooms.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-dark-muted">No active rooms right now</div>
        ) : (
          <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
            {rooms.map((room) => (
              <div key={room.code} className="px-4 py-3 flex items-center gap-3">
                {/* Status dot */}
                <div className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: room.status === "playing" ? "#22c55e" : "#fbbf24",
                    boxShadow: room.status === "playing" ? "0 0 6px #22c55e" : "0 0 6px #fbbf24" }} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-dark-text truncate">{room.name || room.code}</span>
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{
                        background: room.status === "playing" ? "rgba(34,197,94,0.15)" : "rgba(251,191,36,0.15)",
                        color: room.status === "playing" ? "#22c55e" : "#fbbf24",
                      }}>
                      {room.status === "playing" ? "LIVE" : "WAITING"}
                    </span>
                    {(room.config?.isPrivate ?? room.isPrivate) && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.06)", color: "#6b7280" }}>🔒 Private</span>
                    )}
                  </div>
                  <p className="text-[11px] text-dark-muted mt-0.5">
                    {room.code} · {room.playerCount}/{room.maxPlayers} players
                    {room.status === "playing" && ` · Round ${room.roundNumber ?? "?"}/${room.roundCount ?? "?"}`}
                    {room.spectatorCount > 0 && ` · 👁 ${room.spectatorCount}`}
                    {(room.config?.entryFee ?? 0) > 0 && ` · 💰 ₹${room.config?.entryFee}`}
                  </p>
                </div>

                {/* Player avatars / count */}
                <div className="flex items-center flex-shrink-0 text-[11px] text-dark-muted gap-1">
                  {(room.players ?? []).slice(0, 4).map((p: any, i: number) => (
                    <div key={p.userId ?? i}
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px]"
                      style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", marginLeft: i > 0 ? -6 : 0, zIndex: 4 - i }}
                      title={p.username}>
                      {p.isBot ? "🤖" : "👤"}
                    </div>
                  ))}
                  {(room.players ?? []).length > 4 && (
                    <span className="ml-1">+{(room.players ?? []).length - 4}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl p-4 text-sm text-dark-muted" style={cardStyle}>
        Auto-refreshes every 10 seconds. Changes made here are applied
        instantly.
      </div>
    </div>
  );
}

function RoomsSection() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionRoom, setActionRoom] = useState<string | null>(null);

  const fetchRooms = useCallback(() => {
    admin
      .getRooms()
      .then((r) => {
        setRooms(r.data.rooms);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetchRooms();
    const t = setInterval(fetchRooms, 5000);
    return () => clearInterval(t);
  }, [fetchRooms]);

  const endRoom = async (code: string) => {
    if (!confirm(`End room ${code}? All players will be disconnected.`)) return;
    setActionRoom(code);
    await admin.endRoom(code).catch(console.error);
    fetchRooms();
    setActionRoom(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Live Rooms</h2>
        <button
          onClick={fetchRooms}
          className="text-xs text-dark-muted hover:text-neon-green px-2 py-1 rounded"
        >
          ↺ Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-dark-muted text-sm animate-pulse">Loading rooms…</p>
      ) : rooms.length === 0 ? (
        <div className="text-center py-12 text-dark-muted" style={cardStyle}>
          <p className="text-3xl mb-2">🏠</p>
          <p className="text-sm">No active rooms</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rooms.map((room) => (
            <motion.div
              key={room.code}
              layout
              className="p-4 rounded-xl"
              style={cardStyle}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-dark-text">
                      {room.name || room.code}
                    </span>
                    <span
                      className={clsx(
                        "text-[10px] font-black px-2 py-0.5 rounded-full",
                        room.status === "playing"
                          ? "bg-neon-green/20 text-neon-green"
                          : "bg-yellow-500/20 text-yellow-400",
                      )}
                    >
                      {room.status === "playing" ? "● LIVE" : "⏳ WAITING"}
                    </span>
                  </div>
                  <p className="text-xs text-dark-muted mt-0.5">
                    {room.code} · {room.playerCount}/{room.maxPlayers} players
                    {room.spectatorCount > 0 &&
                      ` · ${room.spectatorCount} watching`}
                    {room.status === "playing" &&
                      ` · Round ${room.roundNumber}/${room.roundCount}`}
                  </p>
                </div>
                <button
                  onClick={() => endRoom(room.code)}
                  disabled={actionRoom === room.code}
                  className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors disabled:opacity-40"
                  style={{
                    background: "rgba(255,59,92,0.15)",
                    color: "#ff3b5c",
                    border: "1px solid rgba(255,59,92,0.3)",
                  }}
                >
                  {actionRoom === room.code ? "…" : "End"}
                </button>
              </div>

              {/* Player list */}
              <div className="flex flex-wrap gap-1.5">
                {room.players.map((p: any) => (
                  <div
                    key={p.userId}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    {p.isBot ? "🤖" : "👤"} {p.username}
                    {!p.isBot && (
                      <button
                        onClick={async () => {
                          await admin
                            .kickFromRoom(room.code, p.userId)
                            .catch(console.error);
                          fetchRooms();
                        }}
                        className="ml-1 text-neon-red hover:opacity-80"
                        title="Kick"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function UsersSection() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionId, setActionId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editPointsUser, setEditPointsUser] = useState<{ id: string; username: string; aiPoints: number } | null>(null);
  const [pointsDelta, setPointsDelta] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Debounce search — only fire query 400 ms after user stops typing
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    admin
      .getUsers({ page, search: debouncedSearch || undefined })
      .then((r) => {
        setUsers(r.data.users);
        setTotalPages(r.data.pages);
        setTotal(r.data.total);
        setLoading(false);
      })
      .catch(console.error);
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const doAction = async (fn: () => Promise<any>) => {
    await fn().catch(console.error);
    fetchUsers();
  };

  const copyId = (id: string) => {
    navigator.clipboard.writeText(String(id));
    setCopiedId(String(id));
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const pageIds = users.map(u => String(u.id));
    const allSelected = pageIds.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) pageIds.forEach(id => next.delete(id));
      else pageIds.forEach(id => next.add(id));
      return next;
    });
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Permanently delete ${selectedIds.size} selected user${selectedIds.size > 1 ? 's' : ''}? This cannot be undone.`)) return;
    setBulkDeleting(true);
    try {
      const { data } = await admin.deleteBulkUsers([...selectedIds]);
      setSelectedIds(new Set());
      fetchUsers();
      alert(`Deleted ${data.deleted} user${data.deleted !== 1 ? 's' : ''}`);
    } catch {
      alert('Failed to delete selected users');
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-bold text-white">User Management</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {!loading && (
            <span className="text-xs text-dark-muted">
              {total} user{total !== 1 ? "s" : ""}
            </span>
          )}
          {/* Select All toggle */}
          {!loading && users.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className="text-[11px] px-3 py-1.5 rounded-lg font-semibold"
              style={{
                background: users.every(u => selectedIds.has(String(u.id))) ? "rgba(99,102,241,0.25)" : "rgba(99,102,241,0.1)",
                color: "#818cf8",
                border: "1px solid rgba(99,102,241,0.35)",
              }}
            >
              {users.every(u => selectedIds.has(String(u.id))) ? "✓ Deselect All" : "Select All"}
            </button>
          )}
          {/* Delete selected */}
          {selectedIds.size > 0 && (
            <button
              onClick={deleteSelected}
              disabled={bulkDeleting}
              className="text-[11px] px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1"
              style={{
                background: "rgba(255,59,92,0.2)",
                color: "#ff6b8a",
                border: "1px solid rgba(255,59,92,0.5)",
                opacity: bulkDeleting ? 0.6 : 1,
              }}
            >
              🗑 Delete Selected ({selectedIds.size})
            </button>
          )}
          <button
            onClick={async () => {
              if (!confirm("Delete ALL guest accounts? This cannot be undone."))
                return;
              try {
                const { data } = await admin.deleteAllGuests();
                fetchUsers();
                alert(
                  `Deleted ${data.deleted} guest account${data.deleted !== 1 ? "s" : ""}`,
                );
              } catch {
                alert("Failed to delete guest accounts");
              }
            }}
            className="text-[11px] px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1"
            style={{
              background: "rgba(255,59,92,0.15)",
              color: "#ff3b5c",
              border: "1px solid rgba(255,59,92,0.35)",
            }}
          >
            🗑 Delete All Guests
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
          />
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by username or email…"
          className="w-full bg-dark-bg border border-dark-border rounded-xl pl-9 pr-9 py-2.5 text-sm text-dark-text placeholder-dark-muted focus:outline-none focus:border-purple-500 transition-colors"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-muted hover:text-dark-text text-lg leading-none"
          >
            ×
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-dark-muted text-sm animate-pulse">Loading users…</p>
      ) : users.length === 0 ? (
        <div
          className="text-center py-10 text-dark-muted text-sm"
          style={cardStyle}
        >
          {search ? `No users found for "${search}"` : "No users yet"}
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))" }}>
          {users.map((u) => {
            const winRate = u.stats.gamesPlayed > 0 ? Math.round((u.stats.gamesWon / u.stats.gamesPlayed) * 100) : 0;
            const isSelected = selectedIds.has(String(u.id));
            const accentColor = isSelected ? "#f87171" : u.isAdmin ? "#a855f7" : u.isBanned ? "#ff3b5c" : u.isOnline ? "#4ade80" : "#6366f1";
            const glowColor   = isSelected ? "rgba(248,113,113,0.18)" : u.isAdmin ? "rgba(168,85,247,0.18)" : u.isBanned ? "rgba(255,59,92,0.12)" : u.isOnline ? "rgba(74,222,128,0.1)" : "rgba(99,102,241,0.1)";
            return (
              <motion.div
                key={String(u.id)}
                layout
                className="rounded-2xl flex flex-col overflow-hidden"
                style={{
                  background: isSelected
                    ? "linear-gradient(160deg, rgba(40,15,15,0.97) 0%, rgba(28,8,8,0.99) 100%)"
                    : "linear-gradient(160deg, rgba(15,12,35,0.95) 0%, rgba(10,8,28,0.98) 100%)",
                  border: `1px solid ${accentColor}${isSelected ? '80' : '40'}`,
                  boxShadow: `0 4px 24px ${glowColor}, 0 1px 0 rgba(255,255,255,0.04) inset`,
                  opacity: u.isBanned ? 0.7 : 1,
                }}
              >
                {/* Accent top bar */}
                <div style={{ height: 2, background: `linear-gradient(90deg, ${accentColor}80, ${accentColor}20)` }} />

                {/* Card body */}
                <div className="p-4 flex flex-col gap-3">
                  {/* Header: avatar + name + online dot */}
                  <div className="flex items-center gap-3">
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleSelect(String(u.id))}
                      className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center transition-all"
                      style={{
                        background: isSelected ? "rgba(248,113,113,0.25)" : "rgba(255,255,255,0.05)",
                        border: `2px solid ${isSelected ? "#f87171" : "rgba(255,255,255,0.15)"}`,
                      }}
                    >
                      {isSelected && <span style={{ color: "#f87171", fontSize: 10, fontWeight: 900 }}>✓</span>}
                    </button>
                    <div className="relative flex-shrink-0">
                      <Avatar avatar={u.avatar} size="sm" />
                      {u.isOnline && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0a081c]"
                          style={{ background: "#4ade80", boxShadow: "0 0 6px #4ade80" }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-black text-sm text-white truncate">{u.username}</span>
                        {u.isAdmin && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full tracking-wide"
                            style={{ background: "rgba(168,85,247,0.25)", color: "#c084fc", border: "1px solid rgba(168,85,247,0.5)", letterSpacing: "0.05em" }}>ADMIN</span>
                        )}
                        {u.isGuest && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)", color: "#6b7280", border: "1px solid rgba(255,255,255,0.08)" }}>Guest</span>
                        )}
                        {u.isBanned && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full" style={{ background: "rgba(255,59,92,0.2)", color: "#ff6b8a", border: "1px solid rgba(255,59,92,0.4)" }}>BANNED</span>
                        )}
                      </div>
                      {u.email && <p className="text-[10px] truncate mt-0.5" style={{ color: "#6b7280" }}>{u.email}</p>}
                    </div>
                  </div>

                  {/* ID row */}
                  <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <span className="text-[9px] font-mono truncate flex-1" style={{ color: "#4b5563" }} title={String(u.id)}>{String(u.id)}</span>
                    <button onClick={() => copyId(String(u.id))}
                      className="flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded font-bold transition-all"
                      style={copiedId === String(u.id)
                        ? { background: "rgba(74,222,128,0.15)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)" }
                        : { background: "rgba(255,255,255,0.04)", color: "#6b7280", border: "1px solid rgba(255,255,255,0.08)" }}>
                      {copiedId === String(u.id) ? "✓ Copied" : "Copy ID"}
                    </button>
                  </div>

                  {/* Stats: wallet · games · last seen */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl p-2 text-center" style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.1), rgba(34,197,94,0.04))", border: "1px solid rgba(34,197,94,0.2)" }}>
                      <p className="text-xs font-black" style={{ color: "#4ade80" }}>₹{(u.walletBalance ?? 0).toFixed(2)}</p>
                      <p className="text-[9px] mt-0.5" style={{ color: "#4b5563" }}>Wallet</p>
                    </div>
                    <div className="rounded-xl p-2 text-center" style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(99,102,241,0.04))", border: "1px solid rgba(99,102,241,0.2)" }}>
                      <p className="text-xs font-black" style={{ color: "#818cf8" }}>{u.stats.gamesPlayed}G · {u.stats.gamesWon}W</p>
                      <p className="text-[9px] mt-0.5" style={{ color: "#4b5563" }}>{winRate}% win</p>
                    </div>
                    <div className="rounded-xl p-2 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <p className="text-xs font-black" style={{ color: u.isOnline ? "#4ade80" : "#6b7280" }}>
                        {u.isOnline ? "● Live" : formatLastSeen(u.lastSeenAt, false)}
                      </p>
                      <p className="text-[9px] mt-0.5" style={{ color: "#4b5563" }}>Last seen</p>
                    </div>
                  </div>

                  {/* Divider */}
                  <div style={{ height: 1, background: "rgba(255,255,255,0.05)" }} />

                  {/* Action buttons */}
                  <div className="flex items-center gap-1" style={{ flexWrap: "nowrap" }}>
                    {u.isBanned ? (
                      <button onClick={() => doAction(() => admin.unbanUser(u.id))} disabled={actionId === u.id}
                        className="text-[10px] px-2 py-1 rounded-lg font-bold flex-shrink-0 transition-all hover:opacity-80"
                        style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)" }}>
                        Unban
                      </button>
                    ) : (
                      <button onClick={() => { setActionId(u.id); doAction(() => admin.banUser(u.id)).finally(() => setActionId(null)); }}
                        disabled={actionId === u.id}
                        className="text-[10px] px-2 py-1 rounded-lg font-bold flex-shrink-0 transition-all hover:opacity-80"
                        style={{ background: "rgba(255,59,92,0.12)", color: "#ff6b8a", border: "1px solid rgba(255,59,92,0.3)" }}>
                        Ban
                      </button>
                    )}
                    <button onClick={() => { if (confirm(`${u.isAdmin ? "Remove Admin" : "Make Admin"} for "${u.username}"?`)) doAction(() => admin.setAdmin(u.id, !u.isAdmin)); }}
                      className="text-[10px] px-2 py-1 rounded-lg font-bold flex-shrink-0 transition-all hover:opacity-80"
                      style={u.isAdmin
                        ? { background: "rgba(168,85,247,0.2)", color: "#c084fc", border: "1px solid rgba(168,85,247,0.45)" }
                        : { background: "rgba(168,85,247,0.07)", color: "#9b87cc", border: "1px solid rgba(168,85,247,0.2)" }}>
                      {u.isAdmin ? "🛡 Admin" : "Mk Admin"}
                    </button>
                    <button onClick={() => { setPointsDelta(""); setEditPointsUser({ id: String(u.id), username: u.username, aiPoints: u.aiPoints ?? 0 }); }}
                      className="text-[10px] px-2 py-1 rounded-lg font-bold flex-shrink-0 transition-all hover:opacity-80"
                      style={{ background: "rgba(34,197,94,0.1)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.25)" }}>
                      ⭐ {u.aiPoints ?? 0}
                    </button>
                    <button onClick={() => { if (confirm("Reset stats for " + u.username + "?")) doAction(() => admin.resetUserStats(u.id)); }}
                      className="text-[10px] px-2 py-1 rounded-lg font-bold flex-shrink-0 transition-all hover:opacity-80"
                      style={{ background: "rgba(255,255,255,0.05)", color: "#6b7280", border: "1px solid rgba(255,255,255,0.1)" }}>
                      Reset
                    </button>
                    <button onClick={() => { if (confirm(`Permanently delete "${u.username}"? This cannot be undone.`)) doAction(() => admin.deleteUser(u.id)); }}
                      className="text-[10px] px-2 py-1 rounded-lg font-bold flex-shrink-0 transition-all hover:opacity-80"
                      style={{ background: "rgba(255,59,92,0.15)", color: "#ff6b8a", border: "1px solid rgba(255,59,92,0.4)" }}>
                      🗑 Delete
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="text-xs text-dark-muted disabled:opacity-30 hover:text-dark-text">← Prev</button>
          <span className="text-xs text-dark-muted">{page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="text-xs text-dark-muted disabled:opacity-30 hover:text-dark-text">Next →</button>
        </div>
      )}

      {/* ── Edit AI Points modal ─────────────────────────────────────────── */}
      {editPointsUser && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
          onClick={e => { if (e.target === e.currentTarget) setEditPointsUser(null); }}>
          <div style={{ background: 'linear-gradient(160deg,#0d0b20,#130d2e)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 340, boxShadow: '0 0 40px rgba(34,197,94,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ color: '#fff', fontWeight: 900, fontSize: 16, margin: 0 }}>⭐ AI Points</h3>
                <p style={{ color: '#22c55e', fontSize: 11, margin: '2px 0 0' }}>{editPointsUser.username} · Current: {editPointsUser.aiPoints}</p>
              </div>
              <button onClick={() => setEditPointsUser(null)} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', color: '#9ca3af', cursor: 'pointer', width: 28, height: 28, borderRadius: '50%', fontSize: 14 }}>✕</button>
            </div>
            <input
              type="number"
              value={pointsDelta}
              onChange={e => setPointsDelta(e.target.value)}
              placeholder="e.g. 500 or -100"
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
            />
            <p style={{ color: '#6b7280', fontSize: 10, marginTop: 6 }}>Positive = add points · Negative = deduct points</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button
                onClick={async () => {
                  const delta = parseInt(pointsDelta);
                  if (!delta || isNaN(delta)) return;
                  try {
                    const r = await admin.adjustAiPoints(editPointsUser.id, delta);
                    setUsers(prev => prev.map(u => String(u.id) === editPointsUser.id ? { ...u, aiPoints: r.data.aiPoints } : u));
                    setEditPointsUser(prev => prev ? { ...prev, aiPoints: r.data.aiPoints } : null);
                    setPointsDelta('');
                  } catch (e: any) { alert(e?.response?.data?.error ?? 'Failed'); }
                }}
                disabled={!pointsDelta || isNaN(parseInt(pointsDelta))}
                style={{ flex: 1, padding: '10px 0', borderRadius: 12, fontWeight: 900, fontSize: 13, color: '#fff', background: 'linear-gradient(135deg,#16a34a,#22c55e)', border: 'none', cursor: 'pointer', opacity: !pointsDelta ? 0.5 : 1 }}
              >
                Apply
              </button>
              <button
                onClick={() => { setPointsDelta(''); setEditPointsUser(null); }}
                style={{ padding: '10px 16px', borderRadius: 12, fontWeight: 700, fontSize: 13, color: '#9ca3af', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const RANK_COLORS: Record<string, string> = {
  bronze: '#cd7f32', silver: '#c0c0c0', gold: '#fbbf24',
  platinum: '#67e8f9', diamond: '#a78bfa', master: '#f43f5e',
};

const DUMMY_XP = [
  { username: 'RajeshKumar',       avatar: 'avatar_1',  xp: 4820, level: 18, playerRank: 'gold'     },
  { username: 'PriyaSharma',       avatar: 'avatar_2',  xp: 4210, level: 16, playerRank: 'gold'     },
  { username: 'ArjunReddy',        avatar: 'avatar_3',  xp: 3780, level: 14, playerRank: 'silver'   },
  { username: 'PoornimaPanjagalla',avatar: 'avatar_4',  xp: 3540, level: 14, playerRank: 'silver'   },
  { username: 'SunitaVerma',       avatar: 'avatar_5',  xp: 3120, level: 12, playerRank: 'silver'   },
  { username: 'VikramSingh',       avatar: 'avatar_6',  xp: 2870, level: 11, playerRank: 'silver'   },
  { username: 'DeepikaNair',       avatar: 'avatar_7',  xp: 2540, level: 10, playerRank: 'bronze'   },
  { username: 'AmitPatel',         avatar: 'avatar_8',  xp: 2340, level: 9,  playerRank: 'bronze'   },
  { username: 'KavyaMenon',        avatar: 'avatar_9',  xp: 2100, level: 8,  playerRank: 'bronze'   },
  { username: 'SandeepRao',        avatar: 'avatar_10', xp: 1890, level: 7,  playerRank: 'bronze'   },
  { username: 'MeenakshiIyer',     avatar: 'avatar_11', xp: 1650, level: 7,  playerRank: 'bronze'   },
  { username: 'RohitMishra',       avatar: 'avatar_12', xp: 1410, level: 6,  playerRank: 'bronze'   },
  { username: 'AnanyaDas',         avatar: 'avatar_1',  xp: 1250, level: 5,  playerRank: 'bronze'   },
  { username: 'NehaSaxena',        avatar: 'avatar_2',  xp: 1080, level: 5,  playerRank: 'bronze'   },
  { username: 'PrakashGupta',      avatar: 'avatar_3',  xp: 920,  level: 4,  playerRank: 'bronze'   },
  { username: 'LalithaKumar',      avatar: 'avatar_4',  xp: 780,  level: 4,  playerRank: 'bronze'   },
  { username: 'ManishBansal',      avatar: 'avatar_5',  xp: 640,  level: 3,  playerRank: 'bronze'   },
  { username: 'PreethaRajan',      avatar: 'avatar_6',  xp: 490,  level: 2,  playerRank: 'bronze'   },
  { username: 'HarshVardhan',      avatar: 'avatar_7',  xp: 310,  level: 2,  playerRank: 'bronze'   },
  { username: 'ShreyaTiwari',      avatar: 'avatar_8',  xp: 180,  level: 1,  playerRank: 'bronze'   },
];

const DUMMY_ACHIEVEMENTS = [
  { username: 'RajeshKumar',       avatar: 'avatar_1',  achievementCount: 14, level: 18, playerRank: 'gold'   },
  { username: 'PriyaSharma',       avatar: 'avatar_2',  achievementCount: 12, level: 16, playerRank: 'gold'   },
  { username: 'ArjunReddy',        avatar: 'avatar_3',  achievementCount: 11, level: 14, playerRank: 'silver' },
  { username: 'PoornimaPanjagalla',avatar: 'avatar_4',  achievementCount: 10, level: 14, playerRank: 'silver' },
  { username: 'SunitaVerma',       avatar: 'avatar_5',  achievementCount: 9,  level: 12, playerRank: 'silver' },
  { username: 'VikramSingh',       avatar: 'avatar_6',  achievementCount: 8,  level: 11, playerRank: 'silver' },
  { username: 'DeepikaNair',       avatar: 'avatar_7',  achievementCount: 7,  level: 10, playerRank: 'bronze' },
  { username: 'AmitPatel',         avatar: 'avatar_8',  achievementCount: 7,  level: 9,  playerRank: 'bronze' },
  { username: 'KavyaMenon',        avatar: 'avatar_9',  achievementCount: 6,  level: 8,  playerRank: 'bronze' },
  { username: 'SandeepRao',        avatar: 'avatar_10', achievementCount: 6,  level: 7,  playerRank: 'bronze' },
  { username: 'MeenakshiIyer',     avatar: 'avatar_11', achievementCount: 5,  level: 7,  playerRank: 'bronze' },
  { username: 'RohitMishra',       avatar: 'avatar_12', achievementCount: 5,  level: 6,  playerRank: 'bronze' },
  { username: 'AnanyaDas',         avatar: 'avatar_1',  achievementCount: 4,  level: 5,  playerRank: 'bronze' },
  { username: 'NehaSaxena',        avatar: 'avatar_2',  achievementCount: 4,  level: 5,  playerRank: 'bronze' },
  { username: 'PrakashGupta',      avatar: 'avatar_3',  achievementCount: 3,  level: 4,  playerRank: 'bronze' },
  { username: 'LalithaKumar',      avatar: 'avatar_4',  achievementCount: 3,  level: 4,  playerRank: 'bronze' },
  { username: 'ManishBansal',      avatar: 'avatar_5',  achievementCount: 2,  level: 3,  playerRank: 'bronze' },
  { username: 'PreethaRajan',      avatar: 'avatar_6',  achievementCount: 2,  level: 2,  playerRank: 'bronze' },
  { username: 'HarshVardhan',      avatar: 'avatar_7',  achievementCount: 1,  level: 2,  playerRank: 'bronze' },
  { username: 'ShreyaTiwari',      avatar: 'avatar_8',  achievementCount: 1,  level: 1,  playerRank: 'bronze' },
];

const DUMMY_WINS = [
  { username: 'RajeshKumar',       avatar: 'avatar_1',  gamesWon: 184, gamesPlayed: 247, winRate: 74 },
  { username: 'PriyaSharma',       avatar: 'avatar_2',  gamesWon: 152, gamesPlayed: 211, winRate: 72 },
  { username: 'ArjunReddy',        avatar: 'avatar_3',  gamesWon: 127, gamesPlayed: 189, winRate: 67 },
  { username: 'PoornimaPanjagalla',avatar: 'avatar_4',  gamesWon: 122, gamesPlayed: 178, winRate: 69 },
  { username: 'SunitaVerma',       avatar: 'avatar_5',  gamesWon: 98,  gamesPlayed: 152, winRate: 64 },
  { username: 'VikramSingh',       avatar: 'avatar_6',  gamesWon: 87,  gamesPlayed: 134, winRate: 65 },
  { username: 'DeepikaNair',       avatar: 'avatar_7',  gamesWon: 76,  gamesPlayed: 128, winRate: 59 },
  { username: 'AmitPatel',         avatar: 'avatar_8',  gamesWon: 71,  gamesPlayed: 119, winRate: 60 },
  { username: 'KavyaMenon',        avatar: 'avatar_9',  gamesWon: 65,  gamesPlayed: 109, winRate: 60 },
  { username: 'SandeepRao',        avatar: 'avatar_10', gamesWon: 59,  gamesPlayed: 101, winRate: 58 },
  { username: 'MeenakshiIyer',     avatar: 'avatar_11', gamesWon: 52,  gamesPlayed: 96,  winRate: 54 },
  { username: 'RohitMishra',       avatar: 'avatar_12', gamesWon: 44,  gamesPlayed: 87,  winRate: 51 },
  { username: 'AnanyaDas',         avatar: 'avatar_1',  gamesWon: 39,  gamesPlayed: 81,  winRate: 48 },
  { username: 'NehaSaxena',        avatar: 'avatar_2',  gamesWon: 35,  gamesPlayed: 76,  winRate: 46 },
  { username: 'PrakashGupta',      avatar: 'avatar_3',  gamesWon: 29,  gamesPlayed: 69,  winRate: 42 },
  { username: 'LalithaKumar',      avatar: 'avatar_4',  gamesWon: 24,  gamesPlayed: 63,  winRate: 38 },
  { username: 'ManishBansal',      avatar: 'avatar_5',  gamesWon: 21,  gamesPlayed: 59,  winRate: 36 },
  { username: 'PreethaRajan',      avatar: 'avatar_6',  gamesWon: 17,  gamesPlayed: 54,  winRate: 31 },
  { username: 'HarshVardhan',      avatar: 'avatar_7',  gamesWon: 12,  gamesPlayed: 48,  winRate: 25 },
  { username: 'ShreyaTiwari',      avatar: 'avatar_8',  gamesWon: 8,   gamesPlayed: 39,  winRate: 21 },
];

function LeaderboardSection() {
  type Tab = 'wins' | 'xp' | 'achievements';
  const [tab, setTab] = useState<Tab>('wins');
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [xpBoard, setXpBoard] = useState<any[]>([]);
  const [achBoard, setAchBoard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [progLoading, setProgLoading] = useState(false);

  const fetchWins = () => {
    admin.getLeaderboard()
      .then((r) => { setLeaderboard(r.data.leaderboard); setLoading(false); })
      .catch(console.error);
  };

  const fetchProg = (category: 'xp' | 'achievements', setter: (d: any[]) => void) => {
    setProgLoading(true);
    admin.getProgressionLeaderboard(category)
      .then((r) => { setter(r.data.leaderboard); })
      .catch(console.error)
      .finally(() => setProgLoading(false));
  };

  useEffect(() => { fetchWins(); }, []);

  useEffect(() => {
    if (tab === 'xp' && xpBoard.length === 0) fetchProg('xp', setXpBoard);
    if (tab === 'achievements' && achBoard.length === 0) fetchProg('achievements', setAchBoard);
  }, [tab]);

  const resetAll = async () => {
    if (!confirm("Reset ALL user stats? This cannot be undone.")) return;
    await admin.resetLeaderboard().catch(console.error);
    fetchWins();
  };

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'wins',         label: 'Game Wins',    icon: '🏆' },
    { key: 'xp',          label: 'XP & Levels',  icon: '⭐' },
    { key: 'achievements', label: 'Achievements', icon: '🎖️' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Leaderboard</h2>
        {tab === 'wins' && (
          <button
            onClick={resetAll}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold"
            style={{ background: "rgba(255,59,92,0.12)", color: "#ff3b5c", border: "1px solid rgba(255,59,92,0.3)" }}
          >
            Reset All
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={tab === t.key
              ? { background: 'rgba(0,255,136,0.15)', color: '#00ff88', border: '1px solid rgba(0,255,136,0.4)' }
              : { background: 'rgba(255,255,255,0.04)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Wins tab */}
      {tab === 'wins' && (
        loading ? (
          <p className="text-dark-muted text-sm animate-pulse">Loading…</p>
        ) : (() => {
          const realNames = new Set(leaderboard.map((u) => u.username.toLowerCase()));
          const dummyFiltered = DUMMY_WINS.filter((d) => !realNames.has(d.username.toLowerCase()));
          const merged = [
            ...leaderboard.map((u) => ({ ...u, isReal: true })),
            ...dummyFiltered.map((d, i) => ({ ...d, id: `dummy_${i}`, rank: 0, isBanned: false, isReal: false })),
          ]
            .sort((a, b) => b.gamesWon - a.gamesWon)
            .map((u, i) => ({ ...u, rank: i + 1 }));

          return (
            <div className="space-y-2">
              {merged.slice(0, 50).map((u) => (
                <div key={String(u.id ?? u.username)} className="p-3 rounded-xl flex items-center gap-3" style={cardStyle}>
                  <span className="w-8 text-center font-bold text-dark-muted text-sm">#{u.rank}</span>
                  <Avatar avatar={u.avatar} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-dark-text truncate">{u.username}</p>
                    <p className="text-[11px] text-dark-muted">{u.gamesPlayed} played · {u.winRate}% win</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-neon-green text-sm">{u.gamesWon}W</p>
                    {u.isBanned && <p className="text-[10px] text-neon-red">BANNED</p>}
                  </div>
                </div>
              ))}
            </div>
          );
        })()
      )}

      {/* XP & Levels tab */}
      {tab === 'xp' && (
        progLoading ? (
          <p className="text-dark-muted text-sm animate-pulse">Loading…</p>
        ) : (() => {
          const realNames = new Set(xpBoard.map((u) => u.username.toLowerCase()));
          const dummyFiltered = DUMMY_XP.filter((d) => !realNames.has(d.username.toLowerCase()));
          const merged = [
            ...xpBoard.map((u) => ({ ...u, userId: u.userId ?? u.username })),
            ...dummyFiltered.map((d, i) => ({ ...d, userId: `dummy_xp_${i}` })),
          ]
            .sort((a, b) => b.xp - a.xp)
            .map((u, i) => ({ ...u, rank: i + 1 }));
          return (
            <div className="space-y-2">
              {merged.map((u) => (
                <div key={String(u.userId)} className="p-3 rounded-xl flex items-center gap-3" style={cardStyle}>
                  <span className="w-8 text-center font-bold text-dark-muted text-sm">#{u.rank}</span>
                  <Avatar avatar={u.avatar} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-dark-text truncate">{u.username}</p>
                    <p className="text-[11px] text-dark-muted">
                      Level {u.level} · <span style={{ color: RANK_COLORS[u.playerRank] ?? '#6b7280', textTransform: 'capitalize' }}>{u.playerRank}</span>
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-sm" style={{ color: '#fbbf24' }}>{u.xp.toLocaleString()} XP</p>
                  </div>
                </div>
              ))}
            </div>
          );
        })()
      )}

      {/* Achievements tab */}
      {tab === 'achievements' && (
        progLoading ? (
          <p className="text-dark-muted text-sm animate-pulse">Loading…</p>
        ) : (() => {
          const realNames = new Set(achBoard.map((u) => u.username.toLowerCase()));
          const dummyFiltered = DUMMY_ACHIEVEMENTS.filter((d) => !realNames.has(d.username.toLowerCase()));
          const merged = [
            ...achBoard.map((u) => ({ ...u, userId: u.userId ?? u.username })),
            ...dummyFiltered.map((d, i) => ({ ...d, userId: `dummy_ach_${i}` })),
          ]
            .sort((a, b) => b.achievementCount - a.achievementCount)
            .map((u, i) => ({ ...u, rank: i + 1 }));
          return (
            <div className="space-y-2">
              {merged.map((u) => (
                <div key={String(u.userId)} className="p-3 rounded-xl flex items-center gap-3" style={cardStyle}>
                  <span className="w-8 text-center font-bold text-dark-muted text-sm">#{u.rank}</span>
                  <Avatar avatar={u.avatar} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-dark-text truncate">{u.username}</p>
                    <p className="text-[11px] text-dark-muted">
                      Level {u.level} · <span style={{ color: RANK_COLORS[u.playerRank] ?? '#6b7280', textTransform: 'capitalize' }}>{u.playerRank}</span>
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-sm" style={{ color: '#a78bfa' }}>{u.achievementCount} 🎖️</p>
                  </div>
                </div>
              ))}
            </div>
          );
        })()
      )}
    </div>
  );
}

const TEAM_ARENA_REASONS = ['Maintenance', 'Upgrading', 'Fixing Bugs', 'Temporarily Closed'];

function FeaturesSection({
  config,
  onSave,
}: {
  config: any;
  onSave: (data: any) => void;
}) {
  const [flags, setFlags] = useState({ ...config.featureFlags });
  const [saving, setSaving] = useState(false);
  const [customReason, setCustomReason] = useState('');

  useEffect(() => {
    setFlags({ ...config.featureFlags });
  }, [config]);

  const save = async () => {
    setSaving(true);
    await onSave({ featureFlags: flags });
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-white">Feature Controls</h2>
      <p className="text-xs text-dark-muted">
        Changes apply live without requiring a server restart.
      </p>

      <div className="space-y-3">
        <Toggle
          label="Spectator Mode"
          desc="Allow users to watch live games"
          value={flags.spectatorModeEnabled}
          onChange={(v) =>
            setFlags((f: any) => ({ ...f, spectatorModeEnabled: v }))
          }
        />
        <Toggle
          label="Public Rooms"
          desc="Show public rooms in the lobby"
          value={flags.publicRoomsEnabled}
          onChange={(v) =>
            setFlags((f: any) => ({ ...f, publicRoomsEnabled: v }))
          }
        />
        <Toggle
          label="AI Survival Championship"
          desc="Show the AI Survival Championship banner on the lobby page"
          value={flags.survivalEnabled ?? true}
          onChange={(v) =>
            setFlags((f: any) => ({ ...f, survivalEnabled: v }))
          }
        />
      </div>

      <div className="pt-2">
        <p className="text-xs font-semibold text-dark-muted uppercase tracking-wide mb-3">AI Survival Championship Tiers</p>
        <div className="space-y-3">
          {(
            [
              { key: "beginner",  label: "Beginner Tier",   desc: "1,000 pts entry · max +5,000 pts reward" },
              { key: "pro",       label: "Pro Tier",        desc: "2,000 pts entry · max +10,000 pts reward" },
              { key: "elite",     label: "Elite Tier",      desc: "5,000 pts entry · max +25,000 pts reward" },
              { key: "boss_arena",label: "Boss Arena Tier", desc: "10,000 pts entry · max +50,000 pts reward" },
            ] as const
          ).map(({ key, label, desc }) => (
            <Toggle
              key={key}
              label={label}
              desc={desc}
              value={flags.survivalTiers?.[key] ?? true}
              onChange={(v) =>
                setFlags((f: any) => ({
                  ...f,
                  survivalTiers: { ...(f.survivalTiers ?? { beginner: true, pro: true, elite: true, boss_arena: true }), [key]: v },
                }))
              }
            />
          ))}
        </div>
      </div>

      <div className="pt-2">
        <p className="text-xs font-semibold text-dark-muted uppercase tracking-wide mb-3">Team Arena</p>
        <div className="space-y-3 rounded-xl p-4" style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.18)' }}>
          <Toggle
            label="Team Arena"
            desc="Enable the 2v2 team survival tournament mode"
            value={flags.teamArenaEnabled ?? true}
            onChange={(v) => setFlags((f: any) => ({ ...f, teamArenaEnabled: v }))}
          />
          {!(flags.teamArenaEnabled ?? true) && (
            <div className="space-y-2">
              <p className="text-[11px] text-dark-muted">Reason shown to players:</p>
              <div className="flex flex-wrap gap-2">
                {TEAM_ARENA_REASONS.map(reason => (
                  <button
                    key={reason}
                    onClick={() => {
                      setCustomReason('');
                      setFlags((f: any) => ({ ...f, teamArenaDisabledReason: reason }));
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: flags.teamArenaDisabledReason === reason ? 'rgba(168,85,247,0.35)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${flags.teamArenaDisabledReason === reason ? 'rgba(168,85,247,0.6)' : 'rgba(255,255,255,0.1)'}`,
                      color: flags.teamArenaDisabledReason === reason ? '#c084fc' : '#9ca3af',
                    }}
                  >
                    {reason}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Or type a custom reason…"
                value={customReason}
                onChange={(e) => {
                  setCustomReason(e.target.value);
                  if (e.target.value) setFlags((f: any) => ({ ...f, teamArenaDisabledReason: e.target.value }));
                }}
                maxLength={100}
                className="w-full px-3 py-2 rounded-lg text-xs text-white placeholder-dark-muted focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              />
              {flags.teamArenaDisabledReason && (
                <p className="text-[11px]" style={{ color: '#a855f7' }}>
                  Banner will show: "<span className="font-semibold">{flags.teamArenaDisabledReason}</span>"
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="pt-2">
        <p className="text-xs font-semibold text-dark-muted uppercase tracking-wide mb-3">Leaderboard</p>
        <div className="rounded-xl p-4" style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.18)' }}>
          <Toggle
            label="Leaderboard"
            desc="Show the public leaderboard page to all players"
            value={flags.leaderboardEnabled ?? true}
            onChange={(v) => setFlags((f: any) => ({ ...f, leaderboardEnabled: v }))}
          />
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
        style={{ background: "rgba(147,51,234,0.8)", color: "white" }}
      >
        {saving ? "Saving…" : "Save Changes"}
      </button>
    </div>
  );
}

function GameConfigSection({
  config,
  onSave,
}: {
  config: any;
  onSave: (data: any) => void;
}) {
  const [gc, setGc] = useState({ ...config.gameConfig });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setGc({ ...config.gameConfig });
  }, [config]);

  const set = (key: string, v: number) =>
    setGc((g: any) => ({ ...g, [key]: v }));

  const save = async () => {
    setSaving(true);
    await onSave({ gameConfig: gc });
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-white">Game Configuration</h2>
      <p className="text-xs text-dark-muted">
        These limits apply to all new rooms and bot games.
      </p>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-dark-muted uppercase tracking-wide">
          Players
        </p>
        <NumberInput
          label="Min Players"
          value={gc.minPlayers}
          min={2}
          max={gc.maxPlayers}
          onChange={(v) => set("minPlayers", v)}
        />
        <NumberInput
          label="Max Players"
          value={gc.maxPlayers}
          min={gc.minPlayers}
          max={10}
          onChange={(v) => set("maxPlayers", v)}
        />

        <p className="text-xs font-semibold text-dark-muted uppercase tracking-wide pt-2">
          Rounds
        </p>
        <NumberInput
          label="Min Rounds"
          value={gc.minRounds}
          min={1}
          max={gc.maxRounds}
          onChange={(v) => set("minRounds", v)}
        />
        <NumberInput
          label="Max Rounds"
          value={gc.maxRounds}
          min={gc.minRounds}
          max={50}
          onChange={(v) => set("maxRounds", v)}
        />

        <p className="text-xs font-semibold text-dark-muted uppercase tracking-wide pt-2">
          Limits
        </p>
        <NumberInput
          label="Max Spectators"
          value={gc.maxSpectators}
          min={0}
          max={50}
          onChange={(v) => set("maxSpectators", v)}
        />
        <NumberInput
          label="Max Bots"
          value={gc.maxBots}
          min={0}
          max={9}
          onChange={(v) => set("maxBots", v)}
        />
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
        style={{ background: "rgba(147,51,234,0.8)", color: "white" }}
      >
        {saving ? "Saving…" : "Save Config"}
      </button>
    </div>
  );
}

function WalletConfigSection({ config, onSave }: { config: any; onSave: (data: any) => void }) {
  const [wc, setWc] = useState({ ...config.walletConfig });
  const [saving, setSaving] = useState(false);

  useEffect(() => { setWc({ ...config.walletConfig }); }, [config]);

  const save = async () => { setSaving(true); await onSave({ walletConfig: wc }); setSaving(false); };

  const InfoCard = ({ icon, title, desc }: { icon: string; title: string; desc: string }) => (
    <div className="flex items-start gap-3 p-4 rounded-2xl"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <span className="text-2xl flex-shrink-0">{icon}</span>
      <div>
        <p className="text-sm font-bold text-white">{title}</p>
        <p className="text-xs text-dark-muted mt-0.5">{desc}</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-white">⚙️ Reward Config</h2>
        <p className="text-sm text-dark-muted mt-1">Control voucher submission and reward redemption for players.</p>
      </div>

      {/* System overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <InfoCard icon="🎟️" title="Submit Vouchers" desc="Players submit gift cards (₹50/₹100) to earn Tournament Credits" />
        <InfoCard icon="⚔️" title="Play & Win" desc="Players use credits to enter arenas and compete for prizes" />
        <InfoCard icon="🎁" title="Redeem Rewards" desc="Winners redeem up to ₹500 in brand gift vouchers" />
      </div>

      {/* Controls */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="px-5 py-3" style={{ background: "rgba(167,139,250,0.08)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <p className="text-xs font-black uppercase tracking-wider" style={{ color: "#a78bfa" }}>Feature Controls</p>
        </div>
        <div className="divide-y divide-white/5">
          <div className="px-5 py-4">
            <Toggle
              label="Voucher Submission Enabled"
              desc="Allow players to submit gift vouchers and earn Tournament Credits"
              value={wc.depositEnabled}
              onChange={(v) => setWc((w: any) => ({ ...w, depositEnabled: v }))}
            />
          </div>
          <div className="px-5 py-4">
            <Toggle
              label="Reward Redemption Enabled"
              desc="Allow players to redeem their Reward Balance for brand gift vouchers"
              value={wc.withdrawEnabled}
              onChange={(v) => setWc((w: any) => ({ ...w, withdrawEnabled: v }))}
            />
          </div>
        </div>
      </div>

      {/* Limits reference */}
      <div className="rounded-2xl p-5 space-y-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
        <p className="text-xs font-black uppercase tracking-wider text-dark-muted">System Limits (hardcoded)</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            { label: "Voucher amounts", value: "₹50 or ₹100 only" },
            { label: "Daily voucher limit", value: "₹300 per player" },
            { label: "Min redemption", value: "₹50" },
            { label: "Max redemption", value: "₹500" },
            { label: "Supported brands", value: "6 brands" },
            { label: "Credits per ₹1", value: "100 credits" },
          ].map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-2 py-2 px-3 rounded-xl"
              style={{ background: "rgba(255,255,255,0.03)" }}>
              <span className="text-dark-muted text-xs">{r.label}</span>
              <span className="text-white font-bold text-xs">{r.value}</span>
            </div>
          ))}
        </div>
      </div>

      <button onClick={save} disabled={saving}
        className="px-8 py-3 rounded-xl font-black text-sm transition-all disabled:opacity-50"
        style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff" }}>
        {saving ? "Saving…" : "Save Reward Config"}
      </button>
    </div>
  );
}

// ── Voucher Queue Section (Deposits) ─────────────────────────────────────────

const DEP_STATUS_STYLE: Record<string, string> = {
  pending:  "bg-yellow-500/20 text-yellow-300",
  approved: "bg-green-500/20 text-green-400",
  rejected: "bg-red-500/20 text-red-400",
};

const BRAND_ICONS: Record<string, string> = {
  Amazon: "📦", Flipkart: "🛒", Myntra: "👗", Ajio: "👔", Swiggy: "🍔", Zomato: "🍕",
};

function DepositsSection() {
  const [deposits, setDeposits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [screenshotModal, setScreenshotModal] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await admin.getDeposits();
      setDeposits(data.deposits);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const process = async (id: string, status: "approved" | "rejected") => {
    setProcessingId(id);
    try {
      await admin.processDeposit(id, status, noteMap[id]);
      setDeposits((prev) => prev.map((d) => (d._id === id ? { ...d, status } : d)));
    } catch { /* ignore */ } finally { setProcessingId(null); }
  };

  const filtered = filter === "all" ? deposits : deposits.filter((d) => d.status === filter);
  const pendingCount = deposits.filter((d) => d.status === "pending").length;

  if (loading) return <p className="text-dark-muted text-sm py-8 text-center">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-bold text-white">
          🎟️ Voucher Verification Queue
          {pendingCount > 0 && (
            <span className="ml-2 text-sm px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300">
              {pendingCount} pending
            </span>
          )}
        </h2>
        <div className="flex gap-1.5">
          {(["pending", "approved", "rejected", "all"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={clsx("px-3 py-1 rounded-lg text-xs font-semibold transition-all capitalize",
                filter === f ? "bg-indigo-500 text-white" : "bg-dark-surface text-dark-muted border border-dark-border")}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-dark-muted text-sm py-8 text-center">
          No {filter === "all" ? "" : filter} voucher submissions
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => (
            <div key={d._id} className="rounded-2xl p-4 space-y-3" style={cardStyle}>
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <p className="font-semibold text-white flex items-center gap-1.5">
                    {BRAND_ICONS[d.voucherBrand] ?? "🎟️"} {d.username}
                  </p>
                  {d.submissionType === "voucher" ? (
                    <div className="space-y-0.5 mt-1">
                      <p className="text-xs text-indigo-300 font-semibold">{d.voucherBrand} Voucher</p>
                      {d.voucherNumber && (
                        <p className="text-xs text-dark-muted font-mono">
                          Code: <span className="text-white">{d.voucherNumber}</span>
                        </p>
                      )}
                      {d.voucherPin && (
                        <p className="text-xs text-dark-muted font-mono">
                          PIN: <span className="text-white">{d.voucherPin}</span>
                        </p>
                      )}
                      {d.voucherExpiry && (
                        <p className="text-xs text-dark-muted">
                          Expiry: <span className="text-white">{d.voucherExpiry}</span>
                        </p>
                      )}
                      {d.screenshotUrl && (
                        <button onClick={() => setScreenshotModal(d.screenshotUrl)}
                          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors underline text-left">
                          📸 View Screenshot
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-dark-muted mt-1">
                      UTR: <span className="font-mono text-white">{d.utrNumber}</span>
                    </p>
                  )}
                  <p className="text-xs text-dark-muted mt-1">{new Date(d.createdAt).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-indigo-300">₹{d.amount}</p>
                  <span className={clsx("text-xs px-2 py-0.5 rounded-full", DEP_STATUS_STYLE[d.status] ?? "")}>
                    {d.status}
                  </span>
                </div>
              </div>

              {d.status === "pending" && (
                <div className="flex gap-2 flex-wrap items-center">
                  <input placeholder="Admin note (optional)" value={noteMap[d._id] ?? ""}
                    onChange={(e) => setNoteMap((p) => ({ ...p, [d._id]: e.target.value }))}
                    className="flex-1 min-w-[140px] bg-dark-bg border border-dark-border rounded-lg px-3 py-1.5 text-xs text-dark-text focus:outline-none"
                  />
                  <button onClick={() => process(d._id, "approved")} disabled={processingId === d._id}
                    className="px-4 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition-colors disabled:opacity-50">
                    ✓ Approve & Credit
                  </button>
                  <button onClick={() => process(d._id, "rejected")} disabled={processingId === d._id}
                    className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors disabled:opacity-50">
                    ✗ Reject
                  </button>
                </div>
              )}
              {d.adminNote && (
                <p className="text-xs text-dark-muted italic">Note: {d.adminNote}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Screenshot lightbox */}
      {screenshotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
          onClick={() => setScreenshotModal(null)}>
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setScreenshotModal(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-dark-surface border border-dark-border text-white flex items-center justify-center text-sm z-10 hover:bg-dark-border transition-colors">
              ×
            </button>
            <img src={screenshotModal} alt="Voucher screenshot"
              className="w-full rounded-2xl object-contain max-h-[80vh]"
              style={{ border: "1px solid rgba(99,102,241,0.4)" }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Reward Delivery Section (Withdrawals) ────────────────────────────────────

const WD_STATUS_STYLE: Record<string, string> = {
  pending:   "bg-yellow-500/20 text-yellow-300",
  approved:  "bg-green-500/20 text-green-400",
  rejected:  "bg-red-500/20 text-red-400",
  delivered: "bg-indigo-500/20 text-indigo-400",
};

function WithdrawalsSection() {
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [deliverMap, setDeliverMap] = useState<Record<string, {
    voucherNumber: string; voucherPin: string; voucherExpiry: string; adminMessage: string;
  }>>({});
  const [deliverOpen, setDeliverOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await admin.getWithdrawals();
      setWithdrawals(data.withdrawals);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const process = async (id: string, status: "approved" | "rejected") => {
    setProcessingId(id);
    try {
      await admin.processWithdrawal(id, status, noteMap[id]);
      setWithdrawals((prev) => prev.map((w) => (w._id === id ? { ...w, status } : w)));
    } catch { /* ignore */ } finally { setProcessingId(null); }
  };

  const deliver = async (id: string) => {
    const d = deliverMap[id];
    if (!d?.voucherNumber?.trim() || !d?.voucherPin?.trim() || !d?.voucherExpiry?.trim()) return;
    setProcessingId(id);
    try {
      await admin.deliverVoucher(id, {
        deliveredVoucherNumber: d.voucherNumber.trim(),
        deliveredVoucherPin: d.voucherPin.trim(),
        deliveredVoucherExpiry: d.voucherExpiry.trim(),
        adminMessage: d.adminMessage?.trim() || undefined,
      });
      setWithdrawals((prev) => prev.map((w) => (w._id === id ? { ...w, status: "delivered" } : w)));
      setDeliverOpen(null);
    } catch { /* ignore */ } finally { setProcessingId(null); }
  };

  const setDeliverField = (id: string, field: string, value: string) => {
    setDeliverMap((p) => ({ ...p, [id]: { ...p[id], [field]: value } }));
  };

  const pendingCount = withdrawals.filter((w) => w.status === "pending").length;

  if (loading) return <p className="text-dark-muted text-sm py-8 text-center">Loading…</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">
        🎁 Reward Delivery
        {pendingCount > 0 && (
          <span className="ml-2 text-sm px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300">
            {pendingCount} pending
          </span>
        )}
      </h2>
      {withdrawals.length === 0 ? (
        <p className="text-dark-muted text-sm py-8 text-center">No reward redemption requests</p>
      ) : (
        <div className="space-y-3">
          {withdrawals.map((w) => (
            <div key={w._id} className="rounded-2xl p-4 space-y-2" style={cardStyle}>
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <p className="font-semibold text-white flex items-center gap-1.5">
                    {BRAND_ICONS[w.voucherBrand] ?? "🎁"} {w.username}
                  </p>
                  {w.redemptionType === "voucher" ? (
                    <p className="text-xs text-purple-300 mt-0.5">{w.voucherBrand} voucher redemption</p>
                  ) : (
                    <p className="text-xs text-dark-muted mt-0.5">
                      {w.upiId ? `UPI: ${w.upiId}` : w.bankDetails?.accountName ? `Bank: ${w.bankDetails.accountName}` : "Bank transfer"}
                    </p>
                  )}
                  <p className="text-xs text-dark-muted">{new Date(w.createdAt).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-purple-400">₹{w.amount}</p>
                  <span className={clsx("text-xs px-2 py-0.5 rounded-full", WD_STATUS_STYLE[w.status] ?? "")}>
                    {w.status}
                  </span>
                </div>
              </div>

              {/* Pending: approve/reject + option to deliver directly */}
              {w.status === "pending" && (
                <div className="space-y-2 pt-1">
                  <div className="flex gap-2 flex-wrap items-center">
                    <input placeholder="Admin note (optional)" value={noteMap[w._id] ?? ""}
                      onChange={(e) => setNoteMap((p) => ({ ...p, [w._id]: e.target.value }))}
                      className="flex-1 min-w-[140px] bg-dark-bg border border-dark-border rounded-lg px-3 py-1.5 text-xs text-dark-text focus:outline-none"
                    />
                    <button onClick={() => process(w._id, "approved")} disabled={processingId === w._id}
                      className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition-colors disabled:opacity-50">
                      Approve
                    </button>
                    <button onClick={() => process(w._id, "rejected")} disabled={processingId === w._id}
                      className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors disabled:opacity-50">
                      Reject
                    </button>
                    {w.redemptionType === "voucher" && (
                      <button onClick={() => setDeliverOpen(deliverOpen === w._id ? null : w._id)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors">
                        🎁 Deliver Voucher
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Approved voucher: deliver form */}
              {w.status === "approved" && w.redemptionType === "voucher" && (
                <div className="pt-1">
                  <button onClick={() => setDeliverOpen(deliverOpen === w._id ? null : w._id)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors">
                    🎁 Deliver Voucher
                  </button>
                </div>
              )}

              {/* Deliver voucher form */}
              {deliverOpen === w._id && (
                <div className="mt-2 p-3 rounded-xl space-y-2"
                  style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
                  <p className="text-xs font-bold text-indigo-300">Enter {w.voucherBrand} Voucher Details</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-dark-muted block mb-1">Voucher Code *</label>
                      <input placeholder="Code / Number"
                        value={deliverMap[w._id]?.voucherNumber ?? ""}
                        onChange={(e) => setDeliverField(w._id, "voucherNumber", e.target.value)}
                        className="w-full bg-dark-bg border border-dark-border rounded-lg px-2 py-1.5 text-xs font-mono text-dark-text focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-dark-muted block mb-1">PIN *</label>
                      <input placeholder="PIN"
                        value={deliverMap[w._id]?.voucherPin ?? ""}
                        onChange={(e) => setDeliverField(w._id, "voucherPin", e.target.value)}
                        className="w-full bg-dark-bg border border-dark-border rounded-lg px-2 py-1.5 text-xs font-mono text-dark-text focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-dark-muted block mb-1">Expiry *</label>
                      <input placeholder="MM/YY"
                        value={deliverMap[w._id]?.voucherExpiry ?? ""}
                        onChange={(e) => setDeliverField(w._id, "voucherExpiry", e.target.value)}
                        className="w-full bg-dark-bg border border-dark-border rounded-lg px-2 py-1.5 text-xs font-mono text-dark-text focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-dark-muted block mb-1">Message (optional)</label>
                      <input placeholder="e.g. Enjoy!"
                        value={deliverMap[w._id]?.adminMessage ?? ""}
                        onChange={(e) => setDeliverField(w._id, "adminMessage", e.target.value)}
                        className="w-full bg-dark-bg border border-dark-border rounded-lg px-2 py-1.5 text-xs text-dark-text focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <button onClick={() => deliver(w._id)} disabled={processingId === w._id ||
                    !deliverMap[w._id]?.voucherNumber?.trim() || !deliverMap[w._id]?.voucherPin?.trim() || !deliverMap[w._id]?.voucherExpiry?.trim()}
                    className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors disabled:opacity-40">
                    {processingId === w._id ? "Delivering…" : "✓ Mark as Delivered"}
                  </button>
                </div>
              )}

              {/* Delivered: show delivered voucher details */}
              {w.status === "delivered" && w.deliveredVoucherNumber && (
                <div className="mt-1 p-3 rounded-xl space-y-1"
                  style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)" }}>
                  <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">Delivered Voucher</p>
                  <p className="text-xs font-mono text-white">Code: {w.deliveredVoucherNumber}</p>
                  <p className="text-xs font-mono text-white">PIN: {w.deliveredVoucherPin} · Exp: {w.deliveredVoucherExpiry}</p>
                  {w.adminMessage && <p className="text-xs text-dark-muted italic">"{w.adminMessage}"</p>}
                </div>
              )}

              {w.adminNote && <p className="text-xs text-dark-muted italic">Note: {w.adminNote}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Admin Tx History panel ────────────────────────────────────────────────────

function AdminTxHistory({ credits }: { credits: any[] }) {
  const [filter, setFilter] = useState<"all" | "credit" | "debit">("all");

  const shown = credits.filter((c) => {
    if (filter === "credit") return c.type === "deposit";
    if (filter === "debit")  return c.type === "withdrawal";
    return true;
  });

  const creditCount = credits.filter((c) => c.type === "deposit").length;
  const debitCount  = credits.filter((c) => c.type === "withdrawal").length;

  return (
    <div className="rounded-2xl p-5 space-y-3" style={cardStyle}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white">📋 Admin Transaction History</p>
        <span className="text-xs text-dark-muted">{credits.length} total</span>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 rounded-lg bg-dark-bg">
        {(
          [
            { key: "all",    label: "All",     count: credits.length },
            { key: "credit", label: "Credits", count: creditCount },
            { key: "debit",  label: "Debits",  count: debitCount },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={clsx(
              "flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors",
              filter === t.key
                ? t.key === "debit"
                  ? "bg-red-500/20 text-red-400"
                  : t.key === "credit"
                    ? "bg-neon-green/20 text-neon-green"
                    : "bg-dark-border text-white"
                : "text-dark-muted hover:text-white",
            )}
          >
            {t.label}
            {t.count > 0 && (
              <span className="ml-1 opacity-70">({t.count})</span>
            )}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="text-dark-muted text-sm py-6 text-center">
          No {filter === "all" ? "admin transactions" : filter === "credit" ? "credits" : "debits"} yet
        </p>
      ) : (
        <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
          {shown.map((c) => {
            const isDebit = c.type === "withdrawal";
            return (
              <div
                key={String(c.id)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{
                  background: isDebit ? "rgba(255,60,60,0.04)" : "rgba(0,255,136,0.03)",
                  border: isDebit ? "1px solid rgba(255,60,60,0.12)" : "1px solid rgba(0,255,136,0.08)",
                }}
              >
                <Avatar avatar={c.avatar} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white truncate">
                      {c.username}
                    </p>
                    <span
                      className={clsx(
                        "text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0",
                        isDebit
                          ? "bg-red-500/20 text-red-400"
                          : "bg-green-500/20 text-green-400",
                      )}
                    >
                      {isDebit ? "DEBIT" : "CREDIT"}
                    </span>
                  </div>
                  <p className="text-[11px] text-dark-muted truncate">
                    {c.description.replace(/^\[Admin\]\s*/, "")}
                  </p>
                  <p className="text-[10px] text-dark-muted opacity-60">
                    {new Date(c.createdAt).toLocaleString("en-IN", {
                      day: "2-digit", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
                <p
                  className={clsx(
                    "font-bold text-sm flex-shrink-0",
                    isDebit ? "text-red-400" : "text-neon-green",
                  )}
                >
                  {isDebit ? "-" : "+"}₹{c.amount}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Wallets Section ────────────────────────────────────────────────────────────

function WalletsSection() {
  const [wallets, setWallets] = useState<any[]>([]);
  const [credits, setCredits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dropdownSearch, setDropdownSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [tab, setTab] = useState<"add" | "remove">("add");

  // Add Money state
  const [creditAmount, setCreditAmount] = useState("");
  const [creditNote, setCreditNote] = useState("");
  const [crediting, setCrediting] = useState(false);
  const [creditResult, setCreditResult] = useState<{
    ok: boolean;
    msg: string;
  } | null>(null);

  // Remove Money state
  const [debitAmount, setDebitAmount] = useState("");
  const [debitNote, setDebitNote] = useState("");
  const [debiting, setDebiting] = useState(false);
  const [debitResult, setDebitResult] = useState<{
    ok: boolean;
    msg: string;
  } | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadWallets = useCallback(() => {
    Promise.all([admin.getWallets(), admin.getAdminCredits()])
      .then(([w, c]) => {
        setWallets(w.data.wallets);
        setCredits(c.data.credits);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadWallets();
  }, [loadWallets]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = wallets.filter((w) => {
    const q = dropdownSearch.toLowerCase();
    return (
      w.username?.toLowerCase().includes(q) ||
      w.email?.toLowerCase().includes(q) ||
      String(w.id).toLowerCase().includes(q)
    );
  });

  const handleSelect = (w: any) => {
    setSelected(w);
    setDropdownSearch("");
    setDropdownOpen(false);
    setCreditResult(null);
    setDebitResult(null);
  };

  const handleCredit = async () => {
    const amt = parseInt(creditAmount);
    if (!selected)
      return setCreditResult({ ok: false, msg: "Select a user first" });
    if (!amt || amt <= 0)
      return setCreditResult({ ok: false, msg: "Enter a valid amount" });
    setCrediting(true);
    setCreditResult(null);
    try {
      const { data } = await admin.creditWallet(
        String(selected.id),
        amt,
        creditNote || undefined,
      );
      setCreditResult({
        ok: true,
        msg: `Added ₹${amt} to ${data.username} — new balance: ₹${Number(data.balance).toFixed(2)}`,
      });
      setCreditAmount("");
      setCreditNote("");
      loadWallets();
    } catch (err: any) {
      setCreditResult({
        ok: false,
        msg: err?.response?.data?.error ?? "Failed",
      });
    } finally {
      setCrediting(false);
    }
  };

  const handleDebit = async () => {
    const amt = parseInt(debitAmount);
    if (!selected)
      return setDebitResult({ ok: false, msg: "Select a user first" });
    if (!amt || amt <= 0)
      return setDebitResult({ ok: false, msg: "Enter a valid amount" });
    if (amt > selected.balance)
      return setDebitResult({ ok: false, msg: "Insufficient balance" });
    setDebiting(true);
    setDebitResult(null);
    try {
      const { data } = await admin.debitWallet(
        String(selected.id),
        amt,
        debitNote || undefined,
      );
      setDebitResult({
        ok: true,
        msg: `Removed ₹${amt} from ${data.username} — new balance: ₹${Number(data.balance).toFixed(2)}`,
      });
      setDebitAmount("");
      setDebitNote("");
      loadWallets();
    } catch (err: any) {
      setDebitResult({
        ok: false,
        msg: err?.response?.data?.error ?? "Failed",
      });
    } finally {
      setDebiting(false);
    }
  };

  if (loading)
    return <p className="text-dark-muted text-sm py-8 text-center">Loading…</p>;

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-white">User Wallets</h2>

      <div className="grid lg:grid-cols-2 gap-5 items-start">
        {/* ── Left: Add/Remove Money form ── */}
        <div className="rounded-2xl p-5 space-y-4" style={cardStyle}>
          {/* Tabs */}
          <div className="flex gap-2 border-b border-dark-border">
            <button
              onClick={() => {
                setTab("add");
                setCreditResult(null);
                setDebitResult(null);
              }}
              className={clsx(
                "px-4 py-2 text-sm font-semibold border-b-2 transition-colors",
                tab === "add"
                  ? "border-neon-green text-neon-green"
                  : "border-transparent text-dark-muted hover:text-white",
              )}
            >
              💳 Credit Player
            </button>
            <button
              onClick={() => {
                setTab("remove");
                setCreditResult(null);
                setDebitResult(null);
              }}
              className={clsx(
                "px-4 py-2 text-sm font-semibold border-b-2 transition-colors",
                tab === "remove"
                  ? "border-neon-green text-neon-green"
                  : "border-transparent text-dark-muted hover:text-white",
              )}
            >
              🔻 Debit Player
            </button>
          </div>

          {tab === "add" ? (
            <>
              <p className="text-sm font-semibold text-white">
                💳 Credit Player Balance
              </p>

              {/* User dropdown */}
              <div>
                <label className="text-xs text-dark-muted block mb-1.5">
                  Select User
                </label>
                <div className="relative" ref={dropdownRef}>
                  {selected ? (
                    <div
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer"
                      style={{
                        background: "rgba(0,255,136,0.06)",
                        border: "1px solid rgba(0,255,136,0.35)",
                      }}
                      onClick={() => {
                        setSelected(null);
                        setCreditResult(null);
                        setDropdownOpen(true);
                      }}
                    >
                      <Avatar avatar={selected.avatar} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          {selected.username}
                        </p>
                        <p className="text-[11px] text-dark-muted truncate">
                          {selected.email ?? "—"}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0 mr-1">
                        <p className="text-xs text-dark-muted">Balance</p>
                        <p className="text-sm font-bold text-neon-green">
                          ₹{Number(selected.balance).toFixed(2)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(null);
                          setCreditResult(null);
                        }}
                        className="text-dark-muted hover:text-red-400 text-xl leading-none flex-shrink-0"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <svg
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted pointer-events-none"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
                        />
                      </svg>
                      <input
                        value={dropdownSearch}
                        onChange={(e) => {
                          setDropdownSearch(e.target.value);
                          setDropdownOpen(true);
                        }}
                        onFocus={() => setDropdownOpen(true)}
                        placeholder="Search by name, email or ID…"
                        className="w-full bg-dark-bg border border-dark-border rounded-xl pl-9 pr-8 py-2.5 text-sm text-dark-text placeholder-dark-muted focus:outline-none focus:border-neon-green transition-colors"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-muted pointer-events-none text-xs">
                        ▼
                      </span>
                    </div>
                  )}

                  {dropdownOpen && !selected && (
                    <div
                      className="absolute z-50 w-full mt-1 rounded-xl overflow-hidden shadow-2xl"
                      style={{
                        background: "#161b22",
                        border: "1px solid rgba(255,255,255,0.1)",
                        maxHeight: "260px",
                        overflowY: "auto",
                      }}
                    >
                      {filtered.length === 0 ? (
                        <p className="text-dark-muted text-sm py-4 text-center">
                          No users found
                        </p>
                      ) : (
                        filtered.map((w, i) => (
                          <button
                            key={w.id}
                            onMouseDown={() => handleSelect(w)}
                            className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                          >
                            <span className="text-dark-muted text-xs w-5 flex-shrink-0">
                              #{i + 1}
                            </span>
                            <Avatar avatar={w.avatar} size="sm" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white truncate">
                                {w.username}
                              </p>
                              <p className="text-[11px] text-dark-muted truncate">
                                {w.email ?? "—"}
                              </p>
                              <p className="text-[10px] text-dark-muted font-mono truncate opacity-50">
                                {String(w.id)}
                              </p>
                            </div>
                            <p className="font-bold text-neon-green text-sm flex-shrink-0">
                              ₹{Number(w.balance).toFixed(2)}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="text-xs text-dark-muted block mb-1.5">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-sm text-dark-text focus:outline-none focus:border-neon-green transition-colors"
                />
              </div>

              {/* Quick presets */}
              <div className="flex gap-2 flex-wrap">
                {[50, 100, 500, 1000].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setCreditAmount(String(amt))}
                    className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                    style={
                      creditAmount === String(amt)
                        ? {
                            background: "rgba(0,255,136,0.2)",
                            color: "#00ff88",
                            border: "1px solid rgba(0,255,136,0.4)",
                          }
                        : {
                            background: "rgba(255,255,255,0.05)",
                            color: "#8b949e",
                            border: "1px solid rgba(255,255,255,0.08)",
                          }
                    }
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>

              {/* Note */}
              <input
                value={creditNote}
                onChange={(e) => setCreditNote(e.target.value)}
                placeholder="Note (optional) — e.g. Promo bonus"
                className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-xs text-dark-text focus:outline-none focus:border-neon-green transition-colors"
              />

              <button
                onClick={handleCredit}
                disabled={crediting || !selected}
                className="w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-40"
                style={{ background: "rgba(0,255,136,0.85)", color: "#0d1117" }}
              >
                {crediting
                  ? "Crediting…"
                  : selected
                    ? `Credit ₹ to ${selected.username}`
                    : "Select a user first"}
              </button>

              {creditResult && (
                <p
                  className="text-xs font-medium"
                  style={{ color: creditResult.ok ? "#00e676" : "#ff6b6b" }}
                >
                  {creditResult.ok ? "✅" : "❌"} {creditResult.msg}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-white">
                🔻 Debit Player Balance
              </p>

              {/* User dropdown - reuse same logic */}
              <div>
                <label className="text-xs text-dark-muted block mb-1.5">
                  Select User
                </label>
                <div className="relative" ref={dropdownRef}>
                  {selected ? (
                    <div
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer"
                      style={{
                        background: "rgba(255,107,107,0.06)",
                        border: "1px solid rgba(255,107,107,0.35)",
                      }}
                      onClick={() => {
                        setSelected(null);
                        setDebitResult(null);
                        setDropdownOpen(true);
                      }}
                    >
                      <Avatar avatar={selected.avatar} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          {selected.username}
                        </p>
                        <p className="text-[11px] text-dark-muted truncate">
                          {selected.email ?? "—"}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0 mr-1">
                        <p className="text-xs text-dark-muted">Balance</p>
                        <p className="text-sm font-bold text-neon-green">
                          ₹{Number(selected.balance).toFixed(2)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(null);
                          setDebitResult(null);
                        }}
                        className="text-dark-muted hover:text-red-400 text-xl leading-none flex-shrink-0"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <svg
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted pointer-events-none"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
                        />
                      </svg>
                      <input
                        value={dropdownSearch}
                        onChange={(e) => {
                          setDropdownSearch(e.target.value);
                          setDropdownOpen(true);
                        }}
                        onFocus={() => setDropdownOpen(true)}
                        placeholder="Search by name, email or ID…"
                        className="w-full bg-dark-bg border border-dark-border rounded-xl pl-9 pr-8 py-2.5 text-sm text-dark-text placeholder-dark-muted focus:outline-none focus:border-red-500 transition-colors"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-muted pointer-events-none text-xs">
                        ▼
                      </span>
                    </div>
                  )}

                  {dropdownOpen && !selected && (
                    <div
                      className="absolute z-50 w-full mt-1 rounded-xl overflow-hidden shadow-2xl"
                      style={{
                        background: "#161b22",
                        border: "1px solid rgba(255,255,255,0.1)",
                        maxHeight: "260px",
                        overflowY: "auto",
                      }}
                    >
                      {filtered.length === 0 ? (
                        <p className="text-dark-muted text-sm py-4 text-center">
                          No users found
                        </p>
                      ) : (
                        filtered.map((w, i) => (
                          <button
                            key={w.id}
                            onMouseDown={() => handleSelect(w)}
                            className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                          >
                            <span className="text-dark-muted text-xs w-5 flex-shrink-0">
                              #{i + 1}
                            </span>
                            <Avatar avatar={w.avatar} size="sm" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white truncate">
                                {w.username}
                              </p>
                              <p className="text-[11px] text-dark-muted truncate">
                                {w.email ?? "—"}
                              </p>
                              <p className="text-[10px] text-dark-muted font-mono truncate opacity-50">
                                {String(w.id)}
                              </p>
                            </div>
                            <p className="font-bold text-neon-green text-sm flex-shrink-0">
                              ₹{Number(w.balance).toFixed(2)}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="text-xs text-dark-muted block mb-1.5">
                  Amount to Remove (₹)
                </label>
                <input
                  type="number"
                  value={debitAmount}
                  onChange={(e) => setDebitAmount(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-sm text-dark-text focus:outline-none focus:border-red-500 transition-colors"
                />
              </div>

              {/* Quick presets */}
              <div className="flex gap-2 flex-wrap">
                {[50, 100, 500, 1000].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setDebitAmount(String(amt))}
                    className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                    style={
                      debitAmount === String(amt)
                        ? {
                            background: "rgba(255,107,107,0.2)",
                            color: "#ff6b6b",
                            border: "1px solid rgba(255,107,107,0.4)",
                          }
                        : {
                            background: "rgba(255,255,255,0.05)",
                            color: "#8b949e",
                            border: "1px solid rgba(255,255,255,0.08)",
                          }
                    }
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>

              {/* Note */}
              <input
                value={debitNote}
                onChange={(e) => setDebitNote(e.target.value)}
                placeholder="Reason (optional) — e.g. Account violation"
                className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-xs text-dark-text focus:outline-none focus:border-red-500 transition-colors"
              />

              <button
                onClick={handleDebit}
                disabled={debiting || !selected}
                className="w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-40"
                style={{ background: "rgba(255,107,107,0.85)", color: "#fff" }}
              >
                {debiting
                  ? "Debiting…"
                  : selected
                    ? `Debit ₹ from ${selected.username}`
                    : "Select a user first"}
              </button>

              {debitResult && (
                <p
                  className="text-xs font-medium"
                  style={{ color: debitResult.ok ? "#00e676" : "#ff6b6b" }}
                >
                  {debitResult.ok ? "✅" : "❌"} {debitResult.msg}
                </p>
              )}
            </>
          )}
        </div>

        {/* ── Right: Admin transaction history ── */}
        <AdminTxHistory credits={credits} />
      </div>
    </div>
  );
}

// ── Tournaments Section ────────────────────────────────────────────────────────

const TIER_META: Record<string, { label: string; color: string; icon: string }> = {
  beginner:   { label: "Beginner",   color: "#60a5fa", icon: "🌱" },
  pro:        { label: "Pro",        color: "#a78bfa", icon: "⚡" },
  elite:      { label: "Elite",      color: "#f59e0b", icon: "🔥" },
  boss_arena: { label: "Boss Arena", color: "#ff6b6b", icon: "💀" },
};

const STAGE_PERSONALITIES = ["Safe", "Aggressive", "Bluff", "Smart", "Boss"];

function TournamentsSection() {
  const [soloData,   setSoloData]   = useState<any>(null);
  const [teamData,   setTeamData]   = useState<any>(null);
  const [soloLoad,   setSoloLoad]   = useState(true);
  const [teamLoad,   setTeamLoad]   = useState(true);
  const [tierFilter, setTierFilter] = useState("");
  const [soloPage,   setSoloPage]   = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadSolo = useCallback((p = 1, t = tierFilter) => {
    setSoloLoad(true);
    admin.getSurvivalChampionship({ page: p, tier: t || undefined })
      .then(r => setSoloData(r.data)).catch(() => {}).finally(() => setSoloLoad(false));
  }, [tierFilter]);

  const loadTeam = useCallback(() => {
    setTeamLoad(true);
    admin.getTeamArenaAnalytics()
      .then(r => setTeamData(r.data)).catch(() => {}).finally(() => setTeamLoad(false));
  }, []);

  useEffect(() => { loadSolo(1); loadTeam(); }, []);

  const applyTier = (t: string) => { setTierFilter(t); setSoloPage(1); loadSolo(1, t); };
  const changePage = (p: number) => { setSoloPage(p); loadSolo(p); };

  const STATUS_COLOR: Record<string, string> = {
    active: "#60a5fa", won: "#00ff88", lost: "#f87171", abandoned: "#6b7280",
  };

  const TIER_FILTERS = [
    { value: "", label: "All", icon: "🗂️" },
    { value: "beginner", label: "Beginner", icon: "🌱" },
    { value: "pro", label: "Pro", icon: "⚡" },
    { value: "elite", label: "Elite", icon: "🔥" },
    { value: "boss_arena", label: "Boss Arena", icon: "💀" },
  ];

  return (
    <div className="space-y-6">

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">🏆 Tournaments</h2>
          <p className="text-xs mt-0.5" style={{ color: "#4b5563" }}>Solo AI Championship · Team Arena — live stats and run history</p>
        </div>
        <button onClick={() => { loadSolo(soloPage); loadTeam(); }}
          className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all hover:scale-105"
          style={{ background:"rgba(99,102,241,0.15)", color:"#818cf8", border:"1px solid rgba(99,102,241,0.3)" }}>
          ↺ Refresh All
        </button>
      </div>

      {/* ── Side-by-side overview ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ── Solo AI Championship ── */}
        <div className="rounded-2xl overflow-hidden flex flex-col"
          style={{ background:"linear-gradient(160deg,rgba(12,10,30,0.98),rgba(8,6,20,0.99))", border:"1px solid rgba(16,185,129,0.25)", boxShadow:"0 4px 24px rgba(16,185,129,0.07)" }}>
          {/* Header bar */}
          <div style={{ height:2, background:"linear-gradient(90deg,#10b981cc,#10b98120)" }} />
          <div className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background:"rgba(16,185,129,0.15)", border:"1px solid rgba(16,185,129,0.3)" }}>🤖</div>
              <div>
                <h3 className="font-black text-white text-sm">Solo AI Championship</h3>
                <p className="text-[10px]" style={{ color:"#4b5563" }}>5 stages · 4 tiers · Beginner → Boss Arena</p>
              </div>
            </div>

            {/* Stage pills */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {STAGE_PERSONALITIES.map((s, i) => (
                <span key={s} className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background:"rgba(16,185,129,0.08)", color:"#34d399", border:"1px solid rgba(16,185,129,0.2)" }}>
                  S{i+1}: {s} AI
                </span>
              ))}
            </div>

            {/* Summary stats */}
            {soloData?.summary ? (
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label:"Active",    val: soloData.summary.totalActive,    color:"#60a5fa" },
                  { label:"Won",       val: soloData.summary.totalWon,       color:"#4ade80" },
                  { label:"Lost",      val: soloData.summary.totalLost,      color:"#f87171" },
                  { label:"Abandoned", val: soloData.summary.totalAbandoned, color:"#6b7280" },
                  { label:"Pts Paid",  val: (soloData.summary.totalPointsPaid??0).toLocaleString(), color:"#fbbf24" },
                  { label:"Total",     val: (soloData.total??0), color:"#a78bfa" },
                ].map(s => (
                  <div key={s.label} className="rounded-xl p-2.5 text-center"
                    style={{ background:`${s.color}0d`, border:`1px solid ${s.color}25` }}>
                    <p className="text-base font-black" style={{ color:s.color }}>{s.val}</p>
                    <p className="text-[9px] mt-0.5" style={{ color:"#4b5563" }}>{s.label}</p>
                  </div>
                ))}
              </div>
            ) : soloLoad ? (
              <div className="flex justify-center py-4"><div className="w-5 h-5 rounded-full border-2 border-green-500/30 border-t-green-500 animate-spin" /></div>
            ) : null}

            {/* Tier breakdown */}
            {soloData?.summary?.tierBreakdown?.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mb-4">
                {soloData.summary.tierBreakdown.map((tb: any) => {
                  const meta = TIER_META[tb._id] ?? { label: tb._id, color:"#8b949e", icon:"🎮" };
                  const wr = tb.count > 0 ? Math.round((tb.won / tb.count) * 100) : 0;
                  return (
                    <div key={tb._id} className="rounded-xl p-2.5 flex items-center gap-2"
                      style={{ background:`${meta.color}0d`, border:`1px solid ${meta.color}25` }}>
                      <span className="text-base">{meta.icon}</span>
                      <div>
                        <p className="text-xs font-black" style={{ color:meta.color }}>{meta.label}</p>
                        <p className="text-[9px]" style={{ color:"#4b5563" }}>{tb.count} runs · {wr}% win</p>
                      </div>
                      <p className="text-lg font-black ml-auto text-white">{tb.count}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Team Arena ── */}
        <div className="rounded-2xl overflow-hidden flex flex-col"
          style={{ background:"linear-gradient(160deg,rgba(12,10,30,0.98),rgba(8,6,20,0.99))", border:"1px solid rgba(244,114,182,0.25)", boxShadow:"0 4px 24px rgba(244,114,182,0.07)" }}>
          <div style={{ height:2, background:"linear-gradient(90deg,#f472b6cc,#f472b620)" }} />
          <div className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background:"rgba(244,114,182,0.15)", border:"1px solid rgba(244,114,182,0.3)" }}>👥</div>
              <div>
                <h3 className="font-black text-white text-sm">Team Arena</h3>
                <p className="text-[10px]" style={{ color:"#4b5563" }}>5 stages · Host Pays or Split entry · Team survival</p>
              </div>
            </div>

            {teamLoad ? (
              <div className="flex justify-center py-8"><div className="w-5 h-5 rounded-full border-2 border-pink-500/30 border-t-pink-500 animate-spin" /></div>
            ) : teamData ? (
              <>
                {/* Overview stats */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { label:"Total Runs",    val: teamData.overview.totalRuns,       color:"#a78bfa" },
                    { label:"Completed",     val: teamData.overview.completedRuns,   color:"#4ade80" },
                    { label:"Abandoned",     val: teamData.overview.abandonedRuns,   color:"#f87171" },
                    { label:"Completion %",  val: `${teamData.overview.completionRate}%`, color:"#34d399" },
                    { label:"Avg Stage",     val: teamData.overview.avgStageReached?.toFixed(1) ?? "—", color:"#60a5fa" },
                    { label:"S5 Win Rate",   val: `${teamData.stage5WinRate}%`,      color:"#fbbf24" },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl p-2.5 text-center"
                      style={{ background:`${s.color}0d`, border:`1px solid ${s.color}25` }}>
                      <p className="text-base font-black" style={{ color:s.color }}>{s.val}</p>
                      <p className="text-[9px] mt-0.5" style={{ color:"#4b5563" }}>{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Stage clear rates */}
                {teamData.stageClearRates?.length > 0 && (
                  <div className="mb-4">
                    <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color:"#4b5563" }}>Stage Clear Rates</p>
                    <div className="space-y-1.5">
                      {teamData.stageClearRates.map((s: any) => (
                        <div key={s.stage} className="flex items-center gap-2">
                          <span className="text-[10px] font-bold w-14 flex-shrink-0" style={{ color:"#6b7280" }}>
                            S{s.stage}: {STAGE_PERSONALITIES[s.stage-1]} AI
                          </span>
                          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background:"rgba(255,255,255,0.06)" }}>
                            <div className="h-full rounded-full transition-all"
                              style={{ width:`${s.clearRate}%`, background: s.clearRate > 60 ? "#4ade80" : s.clearRate > 30 ? "#fbbf24" : "#f87171" }} />
                          </div>
                          <span className="text-[10px] font-black w-8 text-right" style={{ color: s.clearRate > 60 ? "#4ade80" : s.clearRate > 30 ? "#fbbf24" : "#f87171" }}>
                            {s.clearRate}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Entry mode breakdown */}
                {teamData.feeModeBreakdown?.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {teamData.feeModeBreakdown.map((m: any) => (
                      <div key={m.mode} className="rounded-xl p-2.5 flex items-center gap-2"
                        style={{ background:"rgba(244,114,182,0.06)", border:"1px solid rgba(244,114,182,0.18)" }}>
                        <span className="text-base">{m.mode === "host_pays" ? "🎯" : "🤝"}</span>
                        <div>
                          <p className="text-[10px] font-black text-white">{m.mode === "host_pays" ? "Host Pays" : "Split"}</p>
                          <p className="text-[9px]" style={{ color:"#4b5563" }}>{m.count} teams</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tier breakdown */}
                {teamData.tierBreakdown?.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {teamData.tierBreakdown.map((tb: any) => {
                      const meta = TIER_META[tb.tier] ?? { label: tb.tier, color:"#8b949e", icon:"🎮" };
                      return (
                        <div key={tb.tier} className="rounded-xl p-2.5 flex items-center gap-2"
                          style={{ background:`${meta.color}0d`, border:`1px solid ${meta.color}25` }}>
                          <span>{meta.icon}</span>
                          <div>
                            <p className="text-xs font-black" style={{ color:meta.color }}>{meta.label}</p>
                            <p className="text-[9px]" style={{ color:"#4b5563" }}>{tb.count} runs · {tb.winRate}% win</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <p className="text-center text-dark-muted text-xs py-6">No team arena data</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Solo Run History ── */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background:"linear-gradient(160deg,rgba(12,10,30,0.98),rgba(8,6,20,0.99))", border:"1px solid rgba(16,185,129,0.2)" }}>
        <div style={{ height:2, background:"linear-gradient(90deg,#10b981cc,transparent)" }} />
        <div className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <h3 className="font-black text-white text-sm">Solo Run History</h3>
            <div className="flex gap-1.5 flex-wrap">
              {TIER_FILTERS.map(f => (
                <button key={f.value} onClick={() => applyTier(f.value)}
                  className="text-[10px] px-2.5 py-1 rounded-lg font-bold transition-all"
                  style={tierFilter === f.value
                    ? { background:"rgba(16,185,129,0.2)", color:"#34d399", border:"1px solid rgba(16,185,129,0.4)" }
                    : { background:"rgba(255,255,255,0.04)", color:"#6b7280", border:"1px solid rgba(255,255,255,0.08)" }}>
                  {f.icon} {f.label}
                </button>
              ))}
            </div>
          </div>

          {soloLoad ? (
            <div className="flex justify-center py-10"><div className="w-6 h-6 rounded-full border-2 border-green-500/30 border-t-green-500 animate-spin" /></div>
          ) : !soloData?.records?.length ? (
            <p className="text-center text-dark-muted text-sm py-8">No runs found.</p>
          ) : (
            <div className="grid gap-2" style={{ gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))" }}>
              {soloData.records.map((r: any) => {
                const meta = TIER_META[r.tier] ?? { label: r.tier, color:"#8b949e", icon:"🎮" };
                const sColor = STATUS_COLOR[r.status] ?? "#8b949e";
                const isEx = expandedId === r.id;
                const wonStages = (r.stageResults??[]).filter((s:any)=>s.playerWon).length;
                return (
                  <div key={r.id} className="rounded-2xl overflow-hidden cursor-pointer transition-all"
                    style={{
                      background: isEx ? "rgba(16,185,129,0.04)" : "rgba(255,255,255,0.02)",
                      border: `1px solid ${isEx ? meta.color+"50" : "rgba(255,255,255,0.07)"}`,
                      boxShadow: isEx ? `0 0 16px ${meta.color}15` : "none",
                    }}
                    onClick={() => setExpandedId(isEx ? null : r.id)}>
                    {/* Top accent */}
                    <div style={{ height:2, background:`linear-gradient(90deg,${meta.color}aa,transparent)` }} />

                    <div className="p-3">
                      {/* Player row */}
                      <div className="flex items-center gap-2 mb-2.5">
                        <Avatar avatar={r.avatar} username={r.username} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black text-white truncate">{r.username}</p>
                          <p className="text-[9px] truncate" style={{ color:"#4b5563" }}>{r.email}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                            style={{ background:`${meta.color}18`, color:meta.color, border:`1px solid ${meta.color}35` }}>
                            {meta.icon} {meta.label}
                          </span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize"
                            style={{ background:`${sColor}18`, color:sColor, border:`1px solid ${sColor}35` }}>
                            {r.status}
                          </span>
                        </div>
                      </div>

                      {/* Stage dots */}
                      <div className="flex gap-1 mb-2">
                        {Array.from({ length:5 }, (_,i) => {
                          const sr = r.stageResults?.[i];
                          const done = !!sr; const won = sr?.playerWon;
                          return (
                            <div key={i} className="flex-1 h-6 rounded-lg flex items-center justify-center text-[9px] font-black transition-all"
                              style={{
                                background: !done ? "rgba(255,255,255,0.04)" : won ? "rgba(74,222,128,0.18)" : "rgba(248,113,113,0.18)",
                                border: `1px solid ${!done ? "rgba(255,255,255,0.07)" : won ? "rgba(74,222,128,0.4)" : "rgba(248,113,113,0.4)"}`,
                                color: !done ? "#374151" : won ? "#4ade80" : "#f87171",
                              }}>
                              {!done ? i+1 : won ? "✓" : "✗"}
                            </div>
                          );
                        })}
                      </div>

                      {/* Bottom stats */}
                      <div className="flex items-center justify-between text-[10px]">
                        <span style={{ color:"#6b7280" }}>
                          <span className="font-black text-white">{wonStages}</span>/5 won
                          <span className="ml-2 font-black" style={{ color:"#fbbf24" }}>+{r.totalPointsEarned??0} pts</span>
                        </span>
                        <span style={{ color:"#374151" }}>
                          {new Date(r.createdAt).toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}
                        </span>
                      </div>
                    </div>

                    {/* Expanded */}
                    {isEx && r.stageResults?.length > 0 && (
                      <div className="px-3 pb-3 space-y-1.5">
                        <div style={{ height:1, background:"rgba(255,255,255,0.05)", marginBottom:8 }} />
                        {r.stageResults.map((sr: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[10px]"
                            style={{ background: sr.playerWon ? "rgba(74,222,128,0.06)" : "rgba(248,113,113,0.06)", border:`1px solid ${sr.playerWon?"rgba(74,222,128,0.18)":"rgba(248,113,113,0.18)"}` }}>
                            <span style={{ color:"#6b7280" }}>S{idx+1} · {STAGE_PERSONALITIES[idx]} AI</span>
                            <div className="flex items-center gap-3">
                              <span className="font-bold" style={{ color: sr.playerWon?"#4ade80":"#f87171" }}>
                                {sr.playerWon?"Win":"Loss"} · {sr.playerScore} – {sr.botScore}
                              </span>
                              <span className="font-black" style={{ color:"#fbbf24" }}>+{sr.pointsEarned??0}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {soloData && soloData.pages > 1 && (
            <div className="flex justify-center gap-3 mt-4">
              <button onClick={() => changePage(soloPage-1)} disabled={soloPage<=1}
                className="px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-30 hover:scale-105"
                style={{ background:"rgba(16,185,129,0.1)", color:"#34d399", border:"1px solid rgba(16,185,129,0.25)" }}>← Prev</button>
              <span className="text-xs text-dark-muted self-center">
                {soloPage} / {soloData.pages} ({soloData.total} total)
              </span>
              <button onClick={() => changePage(soloPage+1)} disabled={soloPage>=soloData.pages}
                className="px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-30 hover:scale-105"
                style={{ background:"rgba(16,185,129,0.1)", color:"#34d399", border:"1px solid rgba(16,185,129,0.25)" }}>Next →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Support Section ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  open: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  in_progress: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  resolved: "bg-neon-green/20 text-neon-green border-neon-green/30",
};
const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
};
const CAT_LABELS: Record<string, string> = {
  payment: "💳 Payment",
  game: "🎮 Game",
  account: "👤 Account",
  bug: "🐛 Bug",
  other: "💬 Other",
};

function SupportSection() {
  const [data, setData] = useState<{ tickets: any[]; summary: any } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(
    (f = filter) => {
      setLoading(true);
      admin
        .getSupport(f)
        .then((r) => setData(r.data))
        .catch(() => {})
        .finally(() => setLoading(false));
    },
    [filter],
  );

  useEffect(() => {
    load();
  }, []);

  const applyFilter = (f: string) => {
    setFilter(f);
    load(f);
  };

  const save = async (id: string, status?: string) => {
    setSaving(id);
    try {
      await admin.updateSupport(id, {
        ...(status ? { status } : {}),
        adminNote: noteDraft[id] ?? undefined,
        adminReply: replyDraft[id] ?? undefined,
      });
      load();
      setExpanded(null);
    } catch {
      /* keep open */
    } finally {
      setSaving(null);
    }
  };

  const tickets = data?.tickets ?? [];
  const summary = data?.summary ?? { open: 0, in_progress: 0, resolved: 0 };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-dark-text">🎧 Support Tickets</h2>
        <div className="flex gap-3 text-xs">
          <span className="px-2 py-1 rounded-lg bg-yellow-500/20 text-yellow-300">
            {summary.open} Open
          </span>
          <span className="px-2 py-1 rounded-lg bg-blue-500/20 text-blue-300">
            {summary.in_progress} In Progress
          </span>
          <span className="px-2 py-1 rounded-lg bg-neon-green/20 text-neon-green">
            {summary.resolved} Resolved
          </span>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {["all", "open", "in_progress", "resolved"].map((f) => (
          <button
            key={f}
            onClick={() => applyFilter(f)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              filter === f
                ? "bg-purple-500/30 text-purple-300 border border-purple-500/40"
                : "text-dark-muted hover:text-dark-text border border-dark-border"
            }`}
          >
            {f === "all"
              ? "All"
              : f === "in_progress"
                ? "In Progress"
                : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <button
          onClick={() => load()}
          className="ml-auto text-xs text-dark-muted hover:text-dark-text"
        >
          ⟳ Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-dark-muted animate-pulse">
          Loading tickets…
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-dark-border rounded-2xl text-dark-muted">
          <p className="text-4xl mb-2">🎧</p>
          <p>
            No support tickets
            {filter !== "all" ? ` with status "${filter}"` : ""}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t: any) => {
            const isOpen = expanded === t._id;
            return (
              <div
                key={t._id}
                className="bg-dark-surface border border-dark-border rounded-xl overflow-hidden"
              >
                {/* Row */}
                <div
                  className="flex items-start gap-3 p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => {
                    setExpanded(isOpen ? null : t._id);
                    if (!replyDraft[t._id])
                      setReplyDraft((d) => ({
                        ...d,
                        [t._id]: t.adminReply ?? "",
                      }));
                    if (!noteDraft[t._id])
                      setNoteDraft((d) => ({
                        ...d,
                        [t._id]: t.adminNote ?? "",
                      }));
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${STATUS_COLORS[t.status]}`}
                      >
                        {STATUS_LABELS[t.status]}
                      </span>
                      <span className="text-[10px] text-dark-muted bg-white/5 px-1.5 py-0.5 rounded-full">
                        {CAT_LABELS[t.category] ?? t.category}
                      </span>
                    </div>
                    <p className="font-semibold text-dark-text text-sm truncate">
                      {t.subject}
                    </p>
                    <p className="text-dark-muted text-xs mt-0.5">
                      @{t.username} ·{" "}
                      {new Date(t.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-dark-muted text-xs flex-shrink-0 mt-1">
                    {isOpen ? "▲" : "▼"}
                  </span>
                </div>

                {/* Expanded */}
                {isOpen && (
                  <div className="border-t border-dark-border p-4 space-y-4">
                    {/* User message */}
                    <div>
                      <p className="text-xs font-semibold text-dark-muted uppercase tracking-wide mb-1">
                        User Message
                      </p>
                      <p className="text-dark-text text-sm whitespace-pre-wrap bg-dark-bg rounded-xl p-3">
                        {t.message}
                      </p>
                    </div>

                    {/* Admin Reply */}
                    <div>
                      <label className="block text-xs font-semibold text-dark-muted uppercase tracking-wide mb-1">
                        Reply to User
                      </label>
                      <textarea
                        rows={3}
                        value={replyDraft[t._id] ?? ""}
                        onChange={(e) =>
                          setReplyDraft((d) => ({
                            ...d,
                            [t._id]: e.target.value,
                          }))
                        }
                        placeholder="Write a reply that will be visible to the user…"
                        className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2 text-sm text-dark-text placeholder:text-dark-muted focus:outline-none focus:border-neon-green resize-none"
                      />
                    </div>

                    {/* Internal Note */}
                    <div>
                      <label className="block text-xs font-semibold text-dark-muted uppercase tracking-wide mb-1">
                        Internal Note{" "}
                        <span className="font-normal normal-case">
                          (not shown to user)
                        </span>
                      </label>
                      <textarea
                        rows={2}
                        value={noteDraft[t._id] ?? ""}
                        onChange={(e) =>
                          setNoteDraft((d) => ({
                            ...d,
                            [t._id]: e.target.value,
                          }))
                        }
                        placeholder="Admin-only note…"
                        className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2 text-sm text-dark-text placeholder:text-dark-muted focus:outline-none focus:border-purple-500 resize-none"
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => save(t._id, "in_progress")}
                        disabled={!!saving}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 transition-all disabled:opacity-50"
                      >
                        Mark In Progress
                      </button>
                      <button
                        onClick={() => save(t._id, "resolved")}
                        disabled={!!saving}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-neon-green/20 text-neon-green border border-neon-green/30 hover:bg-neon-green/30 transition-all disabled:opacity-50"
                      >
                        Mark Resolved
                      </button>
                      <button
                        onClick={() => save(t._id)}
                        disabled={!!saving}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 text-dark-text hover:bg-white/15 transition-all disabled:opacity-50"
                      >
                        {saving === t._id ? "Saving…" : "Save Reply & Note"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Notify Section ─────────────────────────────────────────────────────────────

const NOTIF_CATEGORIES = [
  { value: "system",          label: "🔔 System" },
  { value: "tournament",      label: "⚔️ Tournament" },
  { value: "boss_arena",      label: "👑 Boss Arena" },
  { value: "rewards",         label: "🎁 Rewards" },
  { value: "daily_missions",  label: "🎯 Daily Missions" },
  { value: "survival_streak", label: "🔥 Survival Streak" },
  { value: "multiplayer",     label: "👥 Multiplayer" },
  { value: "events",          label: "🎉 Events" },
] as const;

type NotifTarget = "global" | "specific" | "inactive";

interface NotifTemplate {
  label: string;
  title: string;
  message: string;
  type: "info" | "warning" | "success";
  category: string;
  actionUrl?: string;
  hasAmount?: boolean; // if true, show an amount input to substitute {amount}
}

const NOTIF_TEMPLATES: Record<string, NotifTemplate[]> = {
  "🎁 Bonuses & Rewards": [
    {
      label: "Joining Bonus",
      title: "🎁 Welcome Bonus Credited!",
      message: "A joining bonus of {amount} points has been added to your account. Start playing and Master the SHOW!",
      type: "success", category: "rewards", actionUrl: "/wallet", hasAmount: true,
    },
    {
      label: "Deposit Bonus",
      title: "💰 Deposit Bonus Unlocked",
      message: "Your deposit bonus of {amount} points is now live in your wallet. Use it in your next game!",
      type: "success", category: "rewards", actionUrl: "/wallet", hasAmount: true,
    },
    {
      label: "Loyalty Reward",
      title: "🏅 Loyalty Reward Credited",
      message: "Thank you for being a valued player! {amount} loyalty points have been added to your wallet.",
      type: "success", category: "rewards", actionUrl: "/wallet", hasAmount: true,
    },
    {
      label: "Referral Bonus",
      title: "👥 Referral Bonus Earned!",
      message: "Your referral reward of {amount} points has been credited. Keep inviting friends to earn more!",
      type: "success", category: "rewards", actionUrl: "/wallet", hasAmount: true,
    },
    {
      label: "Special Cashback",
      title: "💸 Cashback Applied",
      message: "A cashback of {amount} points has been added to your account. Keep playing to earn more!",
      type: "success", category: "rewards", actionUrl: "/wallet", hasAmount: true,
    },
  ],
  "💳 Deposits": [
    {
      label: "Deposit Approved",
      title: "✅ Deposit Approved",
      message: "Your deposit of ₹{amount} has been successfully approved and added to your wallet.",
      type: "success", category: "rewards", actionUrl: "/wallet", hasAmount: true,
    },
    {
      label: "Deposit Pending",
      title: "⏳ Deposit Under Review",
      message: "Your deposit of ₹{amount} is being reviewed. It will be credited within 24 hours.",
      type: "info", category: "system", actionUrl: "/wallet", hasAmount: true,
    },
    {
      label: "Deposit Rejected",
      title: "❌ Deposit Could Not Be Processed",
      message: "Your deposit of ₹{amount} could not be verified. Please re-submit with a clear screenshot.",
      type: "warning", category: "system", actionUrl: "/wallet", hasAmount: true,
    },
    {
      label: "Deposit Reminder",
      title: "💳 Add Funds to Keep Playing",
      message: "Your balance is running low. Deposit now to continue competing in the Arena of Sevens.",
      type: "info", category: "system", actionUrl: "/wallet",
    },
  ],
  "💸 Withdrawals": [
    {
      label: "Withdrawal Approved",
      title: "✅ Withdrawal Approved",
      message: "Your withdrawal of ₹{amount} has been approved and is being processed. Expect it within 24–48 hrs.",
      type: "success", category: "rewards", actionUrl: "/wallet", hasAmount: true,
    },
    {
      label: "Withdrawal Delivered",
      title: "🎉 Payment Sent!",
      message: "Your withdrawal of ₹{amount} has been successfully transferred to your account.",
      type: "success", category: "rewards", actionUrl: "/wallet", hasAmount: true,
    },
    {
      label: "Withdrawal Rejected",
      title: "⚠️ Withdrawal Request Issue",
      message: "Your withdrawal of ₹{amount} could not be processed. Please check your bank details and retry.",
      type: "warning", category: "system", actionUrl: "/wallet", hasAmount: true,
    },
    {
      label: "Withdrawal Processing",
      title: "🔄 Withdrawal In Progress",
      message: "Your withdrawal request of ₹{amount} is being processed. We'll notify you once complete.",
      type: "info", category: "system", actionUrl: "/wallet", hasAmount: true,
    },
  ],
  "⚔️ Tournament": [
    {
      label: "Tournament Starting",
      title: "⚔️ Tournament Starts Now!",
      message: "The Arena of Sevens tournament is LIVE! Register now and compete for the top spot.",
      type: "info", category: "tournament", actionUrl: "/survival",
    },
    {
      label: "Tournament Ending Soon",
      title: "⏰ Tournament Ends in 1 Hour",
      message: "Last chance to enter! The current tournament closes soon. Join now before seats fill up.",
      type: "warning", category: "tournament", actionUrl: "/survival",
    },
    {
      label: "New Tournament Open",
      title: "🏆 New Tournament is Open",
      message: "A new ranked tournament has started. Entry is open — prove your skills and claim glory!",
      type: "info", category: "tournament", actionUrl: "/survival",
    },
    {
      label: "Tournament Results",
      title: "🏅 Tournament Results Are In",
      message: "The latest tournament has ended. Check the leaderboard to see the final rankings!",
      type: "success", category: "tournament", actionUrl: "/leaderboard",
    },
    {
      label: "Special Prize Pool",
      title: "💎 Special Prize Pool — {amount} Points",
      message: "This weekend's tournament has a prize pool of {amount} points! Register now to compete.",
      type: "success", category: "tournament", actionUrl: "/survival", hasAmount: true,
    },
  ],
  "👑 Boss Arena": [
    {
      label: "Boss Arena Unlocked",
      title: "👑 Boss Arena is OPEN",
      message: "You've unlocked the Boss Arena! The ultimate challenge awaits — enter if you dare.",
      type: "success", category: "boss_arena", actionUrl: "/survival",
    },
    {
      label: "Boss Arena Event",
      title: "🔥 Boss Arena Special Event",
      message: "A limited Boss Arena event is live! Defeat the champion and claim massive rewards.",
      type: "warning", category: "boss_arena", actionUrl: "/survival",
    },
  ],
  "🔥 Streaks & Live": [
    {
      label: "Win Streak Alert",
      title: "🔥 You're on a Hot Streak!",
      message: "Your current win streak is live on the leaderboard. Keep it up and dominate the Arena!",
      type: "success", category: "survival_streak", actionUrl: "/leaderboard",
    },
    {
      label: "Streak at Risk",
      title: "⚠️ Your Streak is at Risk",
      message: "You haven't played today! Log in now to keep your survival streak alive.",
      type: "warning", category: "survival_streak", actionUrl: "/survival",
    },
    {
      label: "Live Game Alert",
      title: "🎮 Game is Live — Join Now!",
      message: "A live multiplayer game is waiting for you. Jump in and show your skills!",
      type: "info", category: "multiplayer", actionUrl: "/lobby",
    },
    {
      label: "Come Back",
      title: "👋 We Miss You!",
      message: "It's been a while since your last game. Return to the Arena and continue your climb!",
      type: "info", category: "survival_streak", actionUrl: "/lobby",
    },
  ],
  "🎉 Events & System": [
    {
      label: "Special Event Live",
      title: "🎉 Special Event is LIVE",
      message: "A limited-time event has started in Arena of Sevens. Play now to earn double rewards!",
      type: "success", category: "events", actionUrl: "/lobby",
    },
    {
      label: "Maintenance Notice",
      title: "🔧 Scheduled Maintenance",
      message: "The server will undergo maintenance in 30 minutes. Please complete your current games.",
      type: "warning", category: "system",
    },
    {
      label: "App Update",
      title: "🆕 New Update Available",
      message: "Arena of Sevens has been updated with new features! Refresh the app to get the latest.",
      type: "info", category: "system",
    },
    {
      label: "Weekend Offer",
      title: "🎊 Weekend Special Offer",
      message: "This weekend only — play 3 games and get {amount} bonus points! Offer ends Sunday.",
      type: "success", category: "events", actionUrl: "/lobby", hasAmount: true,
    },
  ],
};

type BroadcastRecord = {
  _id: string;
  title: string;
  message: string;
  category: string;
  type: string;
  targetType: 'global' | 'targeted' | 'inactive';
  intendedCount: number;
  deliveredCount: number;
  readCount: number;
  createdAt: string;
};

function NotifySection() {
  const [tab, setTab] = useState<"push" | "live" | "history">("push");

  // Live (socket) state
  const [liveTitle, setLiveTitle] = useState("");
  const [liveMessage, setLiveMessage] = useState("");
  const [liveType, setLiveType] = useState<"info" | "warning" | "success">("info");
  const [liveSending, setLiveSending] = useState(false);
  const [liveResult, setLiveResult] = useState<{ success: boolean; msg: string } | null>(null);

  // Broadcast history state
  const [broadcasts, setBroadcasts] = useState<BroadcastRecord[]>([]);
  const [broadcastsLoading, setBroadcastsLoading] = useState(false);
  const [broadcastPage, setBroadcastPage] = useState(1);
  const [broadcastPages, setBroadcastPages] = useState(1);

  // Push (FCM) state
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"info" | "warning" | "success">("info");
  const [category, setCategory] = useState("system");
  const [actionUrl, setActionUrl] = useState("");
  const [target, setTarget] = useState<NotifTarget>("global");
  const [userIds, setUserIds] = useState("");
  const [inactiveHours, setInactiveHours] = useState("24");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; msg: string } | null>(null);
  const [tokenUsers, setTokenUsers] = useState<number | null>(null);

  // Template picker state
  const [templateGroup, setTemplateGroup] = useState<string | null>(null);
  const [amountValue, setAmountValue] = useState("");
  const [activeTemplate, setActiveTemplate] = useState<NotifTemplate | null>(null);

  // Health state
  const [health, setHealth] = useState<{ envVarsSet: boolean; tokenCount: number; hint: string } | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  // Load FCM user count on mount
  useEffect(() => {
    admin.getPushUsers().then(r => setTokenUsers(r.data.total)).catch(() => {});
  }, []);

  const loadBroadcasts = useCallback(async (page = 1) => {
    setBroadcastsLoading(true);
    try {
      const r = await admin.getPushBroadcasts(page);
      setBroadcasts(r.data.broadcasts);
      setBroadcastPages(r.data.pages);
      setBroadcastPage(page);
    } catch { /* silent */ }
    finally { setBroadcastsLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === "history") loadBroadcasts(1);
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const checkHealth = async () => {
    setHealthLoading(true);
    try {
      const r = await admin.getPushHealth();
      setHealth(r.data);
    } catch { setHealth(null); }
    finally { setHealthLoading(false); }
  };

  const applyTemplate = (tpl: NotifTemplate) => {
    setActiveTemplate(tpl);
    setAmountValue("");
    setType(tpl.type);
    setCategory(tpl.category);
    setActionUrl(tpl.actionUrl ?? "");
    if (!tpl.hasAmount) {
      setTitle(tpl.title);
      setMessage(tpl.message);
    }
    // If has amount, wait until user fills amount
  };

  const applyAmountToTemplate = (amt: string) => {
    if (!activeTemplate) return;
    setTitle(activeTemplate.title.replace("{amount}", amt));
    setMessage(activeTemplate.message.replace("{amount}", amt));
  };

  const typeOptions: { value: "info" | "warning" | "success"; label: string; color: string }[] = [
    { value: "info",    label: "ℹ️ Info",    color: "#60a5fa" },
    { value: "warning", label: "⚠️ Warning", color: "#fbbf24" },
    { value: "success", label: "✅ Success", color: "#00ff88" },
  ];

  const sendLive = async () => {
    if (!liveTitle.trim() || !liveMessage.trim()) return;
    setLiveSending(true);
    setLiveResult(null);
    try {
      const res = await admin.sendNotification(liveTitle.trim(), liveMessage.trim(), liveType);
      setLiveResult({ success: true, msg: `Sent to ${res.data.recipients} connected user(s)` });
      setLiveTitle("");
      setLiveMessage("");
    } catch (err: any) {
      setLiveResult({ success: false, msg: err.response?.data?.error ?? "Failed to send" });
    } finally {
      setLiveSending(false);
    }
  };

  const sendPush = async () => {
    if (!title.trim() || !message.trim()) return;
    setSending(true);
    setResult(null);
    try {
      let targetOpts: { global?: boolean; userIds?: string[]; inactiveHours?: number } = {};
      if (target === "global") {
        targetOpts = { global: true };
      } else if (target === "inactive") {
        targetOpts = { inactiveHours: parseInt(inactiveHours, 10) || 24 };
      } else {
        const ids = userIds.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
        if (!ids.length) {
          setResult({ success: false, msg: "Enter at least one User ID" });
          setSending(false);
          return;
        }
        targetOpts = { userIds: ids };
      }
      const res = await admin.sendPushNotification({
        title: title.trim(),
        message: message.trim(),
        category,
        type,
        actionUrl: actionUrl.trim() || undefined,
        ...targetOpts,
      });
      const d = res.data;
      const modeLabel = d.mode === "global" ? "all users" : d.mode === "inactive" ? "inactive users" : `${d.count} user(s)`;
      setResult({ success: true, msg: `Push sent to ${modeLabel}` });
      setTitle(""); setMessage(""); setUserIds(""); setActionUrl("");
      setActiveTemplate(null); setAmountValue(""); setTemplateGroup(null);
      // Refresh history if it was already loaded
      if (broadcasts.length > 0) loadBroadcasts(1);
    } catch (err: any) {
      setResult({ success: false, msg: err.response?.data?.error ?? "Failed to send" });
    } finally {
      setSending(false);
    }
  };

  const inputStyle = { border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-dark-text">Notifications</h2>
        {tokenUsers !== null && (
          <span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
            style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }}>
            📱 {tokenUsers} FCM device{tokenUsers !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
        {([
          { id: "push",    label: "📲 Push (FCM)" },
          { id: "live",    label: "⚡ Live (Socket)" },
          { id: "history", label: "📊 History" },
        ] as const).map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setResult(null); setLiveResult(null); }}
            className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: tab === t.id ? "rgba(99,102,241,0.25)" : "transparent",
              color: tab === t.id ? "#a5b4fc" : "#6b7280",
              border: tab === t.id ? "1px solid rgba(99,102,241,0.4)" : "1px solid transparent",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "push" && (
        <div className="rounded-2xl p-5 space-y-4" style={cardStyle}>

          {/* ── Firebase Health Check ── */}
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={checkHealth} disabled={healthLoading}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8" }}>
              {healthLoading ? "Checking…" : "🔍 Check Firebase"}
            </button>
            {health && (
              <span className="text-[11px] px-2.5 py-1 rounded-full font-medium flex-1"
                style={{
                  background: health.envVarsSet && health.tokenCount > 0 ? "rgba(0,255,136,0.1)" : "rgba(251,191,36,0.1)",
                  color:      health.envVarsSet && health.tokenCount > 0 ? "#00ff88"              : "#fbbf24",
                  border:     `1px solid ${health.envVarsSet && health.tokenCount > 0 ? "rgba(0,255,136,0.2)" : "rgba(251,191,36,0.2)"}`,
                }}>
                {health.envVarsSet ? "✓ Firebase OK" : "✗ Firebase not configured"} · {health.tokenCount} token{health.tokenCount !== 1 ? "s" : ""}
              </span>
            )}
            {health && (
              <p className="w-full text-[10px] text-dark-muted/70 -mt-2">{health.hint}</p>
            )}
          </div>

          {health && !health.envVarsSet && (
            <div className="rounded-xl p-3 text-xs space-y-1"
              style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", color: "#fbbf24" }}>
              <p className="font-bold">Add these to Render env vars:</p>
              <p className="font-mono">FIREBASE_PROJECT_ID</p>
              <p className="font-mono">FIREBASE_CLIENT_EMAIL</p>
              <p className="font-mono">FIREBASE_PRIVATE_KEY</p>
            </div>
          )}

          <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />

          {/* ── Template Picker ── */}
          <div>
            <p className="text-xs text-dark-muted mb-2">Quick Templates</p>
            {/* Group tabs */}
            <div className="flex gap-1.5 flex-wrap mb-3">
              {Object.keys(NOTIF_TEMPLATES).map(group => (
                <button
                  key={group}
                  onClick={() => setTemplateGroup(templateGroup === group ? null : group)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all"
                  style={{
                    background: templateGroup === group ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${templateGroup === group ? "#6366f1" : "rgba(255,255,255,0.08)"}`,
                    color: templateGroup === group ? "#a5b4fc" : "#64748b",
                  }}>
                  {group}
                </button>
              ))}
            </div>

            {/* Template cards */}
            {templateGroup && (
              <div className="flex flex-col gap-2 mb-1">
                {(NOTIF_TEMPLATES[templateGroup] ?? []).map((tpl) => {
                  const isActive = activeTemplate?.label === tpl.label && activeTemplate?.title === tpl.title;
                  return (
                    <button
                      key={tpl.label}
                      onClick={() => applyTemplate(tpl)}
                      className="w-full text-left rounded-xl px-3 py-2.5 transition-all"
                      style={{
                        background: isActive ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${isActive ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.07)"}`,
                      }}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold" style={{ color: isActive ? "#a5b4fc" : "#cbd5e1" }}>
                          {tpl.label}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0" style={{
                          background: tpl.type === "success" ? "rgba(0,255,136,0.1)" : tpl.type === "warning" ? "rgba(251,191,36,0.1)" : "rgba(96,165,250,0.1)",
                          color: tpl.type === "success" ? "#00ff88" : tpl.type === "warning" ? "#fbbf24" : "#60a5fa",
                        }}>
                          {tpl.type}
                        </span>
                      </div>
                      <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: "#64748b" }}>
                        {tpl.title}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Amount input when template needs it */}
            {activeTemplate?.hasAmount && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  value={amountValue}
                  onChange={e => {
                    setAmountValue(e.target.value);
                    applyAmountToTemplate(e.target.value);
                  }}
                  placeholder="Enter amount (e.g. 30 or ₹500)"
                  className="flex-1 px-3 py-2 rounded-xl text-sm text-dark-text bg-transparent outline-none"
                  style={{ border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.07)" }}
                />
                <span className="text-[11px] text-dark-muted shrink-0">fills {"{amount}"}</span>
              </div>
            )}
          </div>

          <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />

          {/* Target mode */}
          <div>
            <p className="text-xs text-dark-muted mb-2">Target</p>
            <div className="flex gap-2 flex-wrap">
              {([
                { v: "global",   l: "🌐 All Users" },
                { v: "specific", l: "👤 Specific Users" },
                { v: "inactive", l: "💤 Inactive Users" },
              ] as { v: NotifTarget; l: string }[]).map(({ v, l }) => (
                <button key={v} onClick={() => setTarget(v)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: target === v ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${target === v ? "#6366f1" : "rgba(255,255,255,0.08)"}`,
                    color: target === v ? "#a5b4fc" : "#6b7280",
                  }}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Conditional target inputs */}
          {target === "specific" && (
            <div>
              <p className="text-xs text-dark-muted mb-1.5">User IDs <span className="text-dark-muted/50">(one per line or comma-separated)</span></p>
              <textarea
                value={userIds}
                onChange={e => setUserIds(e.target.value)}
                rows={3}
                placeholder="64abc123…&#10;64def456…"
                className="w-full px-3 py-2 rounded-xl text-xs text-dark-text bg-transparent outline-none resize-none font-mono"
                style={inputStyle}
              />
            </div>
          )}

          {target === "inactive" && (
            <div>
              <p className="text-xs text-dark-muted mb-1.5">Inactive for at least (hours)</p>
              <input
                type="number" min={1} max={720}
                value={inactiveHours}
                onChange={e => setInactiveHours(e.target.value)}
                className="w-32 px-3 py-2 rounded-xl text-sm text-dark-text bg-transparent outline-none"
                style={inputStyle}
              />
            </div>
          )}

          {/* Category */}
          <div>
            <p className="text-xs text-dark-muted mb-1.5">Category</p>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm text-dark-text outline-none"
              style={{ ...inputStyle, appearance: "none" as any }}>
              {NOTIF_CATEGORIES.map(c => (
                <option key={c.value} value={c.value} style={{ background: "#1a1a2e" }}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Type */}
          <div>
            <p className="text-xs text-dark-muted mb-2">Type</p>
            <div className="flex gap-2">
              {typeOptions.map((opt) => (
                <button key={opt.value} onClick={() => setType(opt.value)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: type === opt.value ? `${opt.color}22` : "rgba(255,255,255,0.04)",
                    border: `1px solid ${type === opt.value ? opt.color : "rgba(255,255,255,0.08)"}`,
                    color: type === opt.value ? opt.color : "#6b7280",
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <p className="text-xs text-dark-muted mb-1.5">Title</p>
            <input
              value={title} onChange={e => setTitle(e.target.value)}
              maxLength={80} placeholder="e.g. Maintenance in 30 minutes"
              className="w-full px-3 py-2 rounded-xl text-sm text-dark-text bg-transparent outline-none"
              style={inputStyle}
            />
          </div>

          {/* Message */}
          <div>
            <p className="text-xs text-dark-muted mb-1.5">Message</p>
            <textarea
              value={message} onChange={e => setMessage(e.target.value)}
              maxLength={300} rows={3}
              placeholder="Notification body text…"
              className="w-full px-3 py-2 rounded-xl text-sm text-dark-text bg-transparent outline-none resize-none"
              style={inputStyle}
            />
            <p className="text-[10px] text-dark-muted/60 text-right mt-0.5">{message.length}/300</p>
          </div>

          {/* Action URL */}
          <div>
            <p className="text-xs text-dark-muted mb-1.5">Action URL <span className="text-dark-muted/50">(optional deep link)</span></p>
            <input
              value={actionUrl} onChange={e => setActionUrl(e.target.value)}
              placeholder="/lobby  or  /survival"
              className="w-full px-3 py-2 rounded-xl text-sm text-dark-text bg-transparent outline-none"
              style={inputStyle}
            />
          </div>

          <button
            onClick={sendPush}
            disabled={sending || !title.trim() || !message.trim()}
            className="w-full py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff" }}>
            {sending ? "Sending…" : target === "global" ? "📢 Send to All Users" : target === "inactive" ? "💤 Send to Inactive" : "📲 Send to Selected Users"}
          </button>

          {result && (
            <p className="text-xs text-center font-medium" style={{ color: result.success ? "#00ff88" : "#ff6b6b" }}>
              {result.success ? "✓ " : "✗ "}{result.msg}
            </p>
          )}
        </div>
      )}

      {tab === "live" && (
        <div className="rounded-2xl p-5 space-y-4" style={cardStyle}>
          <p className="text-xs text-dark-muted">Instantly delivers an in-app toast to all currently connected users (no FCM required).</p>

          <div>
            <p className="text-xs text-dark-muted mb-2">Type</p>
            <div className="flex gap-2">
              {typeOptions.map((opt) => (
                <button key={opt.value} onClick={() => setLiveType(opt.value)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: liveType === opt.value ? `${opt.color}22` : "rgba(255,255,255,0.04)",
                    border: `1px solid ${liveType === opt.value ? opt.color : "rgba(255,255,255,0.08)"}`,
                    color: liveType === opt.value ? opt.color : "#6b7280",
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-dark-muted mb-1.5">Title</p>
            <input value={liveTitle} onChange={e => setLiveTitle(e.target.value)}
              maxLength={80} placeholder="e.g. Server restart in 5 minutes"
              className="w-full px-3 py-2 rounded-xl text-sm text-dark-text bg-transparent outline-none"
              style={inputStyle} />
          </div>

          <div>
            <p className="text-xs text-dark-muted mb-1.5">Message</p>
            <textarea value={liveMessage} onChange={e => setLiveMessage(e.target.value)}
              maxLength={300} rows={3}
              placeholder="Detailed message visible in the notification bell…"
              className="w-full px-3 py-2 rounded-xl text-sm text-dark-text bg-transparent outline-none resize-none"
              style={inputStyle} />
            <p className="text-[10px] text-dark-muted/60 text-right mt-0.5">{liveMessage.length}/300</p>
          </div>

          <button onClick={sendLive} disabled={liveSending || !liveTitle.trim() || !liveMessage.trim()}
            className="w-full py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #f59e0b, #ef4444)", color: "#fff" }}>
            {liveSending ? "Sending…" : "⚡ Broadcast Live"}
          </button>

          {liveResult && (
            <p className="text-xs text-center font-medium" style={{ color: liveResult.success ? "#00ff88" : "#ff6b6b" }}>
              {liveResult.success ? "✓ " : "✗ "}{liveResult.msg}
            </p>
          )}
        </div>
      )}

      {tab === "history" && (
        <div className="rounded-2xl p-5 space-y-4" style={cardStyle}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-dark-text">Broadcast History</p>
            <button onClick={() => loadBroadcasts(broadcastPage)}
              className="text-[11px] px-3 py-1 rounded-lg font-medium transition-all"
              style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }}>
              {broadcastsLoading ? "Loading…" : "↻ Refresh"}
            </button>
          </div>

          {broadcastsLoading && broadcasts.length === 0 ? (
            <p className="text-xs text-dark-muted text-center py-6 animate-pulse">Loading broadcasts…</p>
          ) : broadcasts.length === 0 ? (
            <p className="text-xs text-dark-muted text-center py-6">No broadcasts sent yet</p>
          ) : (
            <div className="space-y-3">
              {broadcasts.map(b => {
                const deliverPct = b.intendedCount > 0
                  ? Math.round((b.deliveredCount / b.intendedCount) * 100) : 0;
                const readPct = b.intendedCount > 0
                  ? Math.round((b.readCount / b.intendedCount) * 100) : 0;
                const targetLabel = b.targetType === 'global' ? '🌍 Global'
                  : b.targetType === 'targeted' ? '🎯 Targeted' : '⏰ Inactive';
                const typeColor = b.type === 'success' ? '#00ff88'
                  : b.type === 'warning' ? '#fbbf24' : '#60a5fa';
                return (
                  <div key={b._id} className="rounded-xl p-4 space-y-3"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-dark-text truncate">{b.title}</p>
                        <p className="text-[11px] text-dark-muted mt-0.5 line-clamp-2">{b.message}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                          style={{ background: `${typeColor}22`, color: typeColor }}>
                          {b.type}
                        </span>
                        <span className="text-[10px] text-dark-muted">{targetLabel}</span>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "Intended", value: b.intendedCount, color: "#94a3b8", pct: null },
                        { label: "Delivered", value: b.deliveredCount, color: "#60a5fa", pct: deliverPct },
                        { label: "Read", value: b.readCount, color: "#00ff88", pct: readPct },
                      ].map(stat => (
                        <div key={stat.label} className="rounded-lg p-2.5 text-center"
                          style={{ background: `${stat.color}11`, border: `1px solid ${stat.color}22` }}>
                          <p className="text-lg font-bold" style={{ color: stat.color }}>{stat.value}</p>
                          <p className="text-[10px] font-medium" style={{ color: `${stat.color}bb` }}>
                            {stat.label}
                          </p>
                          {stat.pct !== null && (
                            <p className="text-[10px]" style={{ color: `${stat.color}88` }}>
                              {stat.pct}%
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Progress bars */}
                    <div className="space-y-1.5">
                      <div>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span style={{ color: "#60a5fa99" }}>Delivery rate</span>
                          <span style={{ color: "#60a5fa" }}>{deliverPct}%</span>
                        </div>
                        <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${deliverPct}%`, background: "linear-gradient(90deg, #3b82f6, #60a5fa)" }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span style={{ color: "#00ff8899" }}>Read rate</span>
                          <span style={{ color: "#00ff88" }}>{readPct}%</span>
                        </div>
                        <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${readPct}%`, background: "linear-gradient(90deg, #00cc6a, #00ff88)" }} />
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <p className="text-[10px] text-dark-muted/60">
                      {new Date(b.createdAt).toLocaleString()} · {b.category}
                    </p>
                  </div>
                );
              })}

              {/* Pagination */}
              {broadcastPages > 1 && (
                <div className="flex justify-center gap-2 pt-1">
                  <button disabled={broadcastPage <= 1} onClick={() => loadBroadcasts(broadcastPage - 1)}
                    className="px-3 py-1 rounded-lg text-xs disabled:opacity-40"
                    style={{ background: "rgba(255,255,255,0.06)", color: "#94a3b8" }}>← Prev</button>
                  <span className="text-xs text-dark-muted self-center">
                    {broadcastPage} / {broadcastPages}
                  </span>
                  <button disabled={broadcastPage >= broadcastPages} onClick={() => loadBroadcasts(broadcastPage + 1)}
                    className="px-3 py-1 rounded-lg text-xs disabled:opacity-40"
                    style={{ background: "rgba(255,255,255,0.06)", color: "#94a3b8" }}>Next →</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Survival Config Section ───────────────────────────────────────────────────

const SURVIVAL_TIER_DEFAULTS = {
  beginner:   { entryPoints: 1000,  stageRewards: [200,  400,  700,   1200,  2500]  },
  pro:        { entryPoints: 2000,  stageRewards: [400,  800,  1400,  2400,  5000]  },
  elite:      { entryPoints: 5000,  stageRewards: [1000, 2000, 3500,  6000,  12500] },
  boss_arena: { entryPoints: 10000, stageRewards: [2000, 4000, 7000,  12000, 25000] },
} as const;

const SURVIVAL_TIER_LABELS: Record<string, string> = {
  beginner: "Beginner",
  pro: "Pro",
  elite: "Elite",
  boss_arena: "Boss Arena",
};

const SURVIVAL_TIER_ICONS: Record<string, string> = {
  beginner: "🌱",
  pro: "⚡",
  elite: "🔥",
  boss_arena: "💀",
};

const SURVIVAL_TIER_COLORS: Record<string, string> = {
  beginner: "#4ade80",
  pro: "#60a5fa",
  elite: "#a78bfa",
  boss_arena: "#f97316",
};

const STAGE_NAMES = ["Safe AI", "Aggressive AI", "Bluff AI", "Smart AI", "Boss AI"];
const STAGE_ICONS = ["🛡️", "⚔️", "🎭", "🧠", "👑"];

function SurvivalConfigSection({
  config,
  onSave,
}: {
  config: any;
  onSave: (data: any) => Promise<void>;
}) {
  const buildState = (cfg: any) => {
    const sc = cfg.survivalConfig ?? {};
    const keys = ["beginner", "pro", "elite", "boss_arena"] as const;
    const out: any = {};
    for (const k of keys) {
      const def = SURVIVAL_TIER_DEFAULTS[k];
      const src = sc[k] ?? {};
      out[k] = {
        entryPoints: typeof src.entryPoints === "number" ? src.entryPoints : def.entryPoints,
        stageRewards: Array.isArray(src.stageRewards) && src.stageRewards.length === 5
          ? [...src.stageRewards]
          : [...def.stageRewards],
      };
    }
    return out;
  };

  const [tiers, setTiers] = useState<any>(() => buildState(config));
  const [saving, setSaving] = useState(false);

  useEffect(() => { setTiers(buildState(config)); }, [config]);

  const setEntry = (tier: string, v: number) =>
    setTiers((t: any) => ({ ...t, [tier]: { ...t[tier], entryPoints: Math.max(1, v) } }));

  const setReward = (tier: string, idx: number, v: number) =>
    setTiers((t: any) => {
      const rewards = [...t[tier].stageRewards];
      rewards[idx] = Math.max(1, v);
      return { ...t, [tier]: { ...t[tier], stageRewards: rewards } };
    });

  const resetTier = async (tier: string) => {
    await onSave({ survivalConfig: { [tier]: { reset: true } } });
  };

  const saveAll = async () => {
    setSaving(true);
    await onSave({ survivalConfig: tiers });
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl p-5" style={{ background: "linear-gradient(135deg,rgba(16,185,129,0.1),rgba(139,92,246,0.08))", border: "1px solid rgba(16,185,129,0.2)" }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)" }}>🏆</div>
          <div>
            <h2 className="text-base font-black text-white">AI Survival Championship</h2>
            <p className="text-xs text-dark-muted">Configure entry costs & stage rewards for all 4 tiers</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 p-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="text-sm">💡</span>
          <p className="text-[11px] text-dark-muted"><span className="text-white font-semibold">100 pts = ₹1</span> · Players spend entry points to enter a tier and earn stage rewards for each AI they defeat.</p>
        </div>
      </div>

      {(["beginner", "pro", "elite", "boss_arena"] as const).map((tier) => {
        const color = SURVIVAL_TIER_COLORS[tier];
        const icon = SURVIVAL_TIER_ICONS[tier];
        const label = SURVIVAL_TIER_LABELS[tier];
        const totalReward = (tiers[tier].stageRewards as number[]).reduce((a: number, b: number) => a + b, 0);
        const netGain = totalReward - tiers[tier].entryPoints;

        return (
          <div key={tier} className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${color}22`, background: "rgba(13,17,23,0.8)" }}>
            {/* Tier header bar */}
            <div className="flex items-center justify-between px-5 py-3.5" style={{ background: `linear-gradient(135deg,${color}12,transparent)`, borderBottom: `1px solid ${color}18` }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: `${color}18`, border: `1px solid ${color}33` }}>
                  {icon}
                </div>
                <div>
                  <p className="text-sm font-black" style={{ color }}>{label} Tier</p>
                  <p className="text-[10px] text-dark-muted">Entry · Stage Rewards · Max Payout</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-[10px] text-dark-muted">Max Payout</p>
                  <p className="text-sm font-black" style={{ color }}>₹{(totalReward / 100).toFixed(0)}</p>
                </div>
                <button
                  onClick={() => resetTier(tier)}
                  className="text-[10px] px-2.5 py-1 rounded-lg transition-all"
                  style={{ background: "rgba(255,255,255,0.05)", color: "#8b949e", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  ↺ Reset
                </button>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Entry Fee */}
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider mb-2 block" style={{ color: `${color}aa` }}>
                    🎟️ Entry Cost (pts)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      value={tiers[tier].entryPoints}
                      onChange={(e) => setEntry(tier, parseInt(e.target.value) || 1)}
                      className="flex-1 bg-dark-bg border rounded-xl px-3 py-2.5 text-white text-sm font-bold focus:outline-none transition-all"
                      style={{ borderColor: `${color}33` }}
                    />
                    <div className="text-center px-3 py-2 rounded-xl min-w-[60px]" style={{ background: `${color}10`, border: `1px solid ${color}22` }}>
                      <p className="text-[10px] text-dark-muted">= Rupees</p>
                      <p className="text-sm font-black" style={{ color }}>₹{(tiers[tier].entryPoints / 100).toFixed(0)}</p>
                    </div>
                  </div>
                </div>
                <div className="text-center px-4 py-2 rounded-xl" style={{ background: netGain > 0 ? "rgba(0,255,136,0.08)" : "rgba(255,107,107,0.08)", border: `1px solid ${netGain > 0 ? "rgba(0,255,136,0.2)" : "rgba(255,107,107,0.2)"}` }}>
                  <p className="text-[10px] text-dark-muted">Net Gain</p>
                  <p className="text-sm font-black" style={{ color: netGain > 0 ? "#00ff88" : "#ff6b6b" }}>{netGain > 0 ? "+" : ""}₹{(netGain / 100).toFixed(0)}</p>
                </div>
              </div>

              {/* Stage Rewards */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider mb-3 block" style={{ color: `${color}aa` }}>
                  🏅 Stage Rewards — Defeat each AI to earn
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[0, 1, 2, 3, 4].map((idx) => (
                    <div key={idx} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${color}15` }}>
                      <div className="py-1.5 text-center" style={{ background: `${color}0d` }}>
                        <p className="text-[10px] font-bold" style={{ color: `${color}cc` }}>{STAGE_ICONS[idx]}</p>
                        <p className="text-[9px] text-dark-muted mt-0.5">{STAGE_NAMES[idx].split(" ")[0]}</p>
                      </div>
                      <input
                        type="number"
                        min={1}
                        value={tiers[tier].stageRewards[idx] ?? 0}
                        onChange={(e) => setReward(tier, idx, parseInt(e.target.value) || 1)}
                        className="w-full bg-dark-bg px-1 py-2 text-white text-xs text-center font-bold focus:outline-none"
                        style={{ borderTop: `1px solid ${color}15` }}
                      />
                      <div className="py-1 text-center" style={{ background: "rgba(255,255,255,0.02)" }}>
                        <p className="text-[9px] font-semibold" style={{ color: `${color}99` }}>
                          ₹{((tiers[tier].stageRewards[idx] ?? 0) / 100).toFixed(0)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <button
        onClick={saveAll}
        disabled={saving}
        className="w-full py-3.5 rounded-xl font-black text-sm transition-all disabled:opacity-50"
        style={{ background: "linear-gradient(135deg,rgba(139,92,246,0.9),rgba(16,185,129,0.7))", color: "white", boxShadow: "0 4px 20px rgba(139,92,246,0.3)" }}
      >
        {saving ? "Saving Changes…" : "💾 Save Championship Config"}
      </button>
    </div>
  );
}

// ── Analytics Section ─────────────────────────────────────────────────────────

function AnalyticsSection() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  const fetchAnalytics = useCallback(() => {
    admin
      .getAnalytics()
      .then((r) => { setData(r.data); setLoading(false); })
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetchAnalytics();
    const t = setInterval(fetchAnalytics, 15000);
    return () => clearInterval(t);
  }, [fetchAnalytics]);

  const handleReset = async () => {
    if (!confirm("Reset all analytics data? This cannot be undone.")) return;
    setResetting(true);
    await admin.resetAnalytics().catch(console.error);
    await fetchAnalytics();
    setResetting(false);
  };

  if (loading || !data)
    return <div className="text-dark-muted text-sm animate-pulse">Loading analytics…</div>;

  const s = data.summary;
  const personalities = ["safe", "aggressive", "bluff", "smart", "boss"];
  const personalityColors: Record<string, string> = {
    safe: "#00ff88", aggressive: "#ff6b6b", bluff: "#fbbf24",
    smart: "#00d4ff", boss: "#a855f7",
  };

  const bar = (pct: number | null, color: string) => (
    <div className="h-2 rounded-full bg-dark-border overflow-hidden">
      <div
        className="h-2 rounded-full transition-all duration-500"
        style={{ width: `${pct ?? 0}%`, background: color }}
      />
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Game Analytics</h2>
        <div className="flex gap-2">
          <button
            onClick={fetchAnalytics}
            className="text-xs text-dark-muted hover:text-neon-green px-2 py-1 rounded"
          >
            ↺ Refresh
          </button>
          <button
            onClick={handleReset}
            disabled={resetting}
            className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded border border-red-400/30 hover:border-red-300/50 disabled:opacity-50"
          >
            {resetting ? "Resetting…" : "Reset Data"}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard icon="🎮" label="Total Games" value={s.totalGames} color="#00ff88" />
        <StatCard icon="🔄" label="Total Rounds" value={s.totalRounds} color="#00d4ff" />
        <StatCard icon="🤖" label="Bot Win Rate" value={s.botWinRate != null ? `${s.botWinRate}%` : "—"} color="#ff6b6b" />
        <StatCard icon="👤" label="Human Win Rate" value={s.humanWinRate != null ? `${s.humanWinRate}%` : "—"} color="#00ff88" />
        <StatCard icon="📣" label="Show Success" value={s.showSuccessRate != null ? `${s.showSuccessRate}%` : "—"} color="#fbbf24" />
        <StatCard icon="⚔️" label="Attack Effective" value={s.attackEffectiveness != null ? `${s.attackEffectiveness}%` : "—"} color="#a855f7" />
        <StatCard icon="🃏" label="Jack Effective" value={s.jackEffectiveness != null ? `${s.jackEffectiveness}%` : "—"} color="#00d4ff" />
        <StatCard icon="⏱️" label="Avg Round" value={`${s.avgRoundDurationSec}s`} color="#fbbf24" />
        <StatCard icon="🚜" label="Farming Signals" value={s.farmingSignals} color="#ff6b6b" />
      </div>

      {/* Bot win rate by personality */}
      <div className="rounded-xl p-4 space-y-3" style={cardStyle}>
        <p className="text-sm font-bold text-white">Win Rate by Bot Personality</p>
        {personalities.map((p) => {
          const rate: number | null = data.winRateByPersonality?.[p] != null
            ? +(data.winRateByPersonality[p] * 100).toFixed(1)
            : null;
          return (
            <div key={p} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="capitalize font-semibold" style={{ color: personalityColors[p] }}>{p}</span>
                <span className="text-dark-muted">{rate != null ? `${rate}%` : "—"}</span>
              </div>
              {bar(rate, personalityColors[p])}
            </div>
          );
        })}
      </div>

      {/* Stage clear rates */}
      {Object.keys(data.stageClearRates ?? {}).length > 0 && (
        <div className="rounded-xl p-4 space-y-3" style={cardStyle}>
          <p className="text-sm font-bold text-white">Survival Stage Clear Rates</p>
          {Object.entries(data.stageClearRates as Record<string, number | null>)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([stage, rate]) => {
              const pct = rate != null ? +(rate * 100).toFixed(1) : null;
              return (
                <div key={stage} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-dark-text">Stage {stage}</span>
                    <span className="text-dark-muted">{pct != null ? `${pct}%` : "—"}</span>
                  </div>
                  {bar(pct, "#00d4ff")}
                </div>
              );
            })}
        </div>
      )}

      {/* Show success by hand total */}
      {Object.keys(data.showSuccessByTotal ?? {}).length > 0 && (
        <div className="rounded-xl p-4" style={cardStyle}>
          <p className="text-sm font-bold text-white mb-3">SHOW Success by Hand Total</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-dark-muted">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left pb-2">Total</th>
                  <th className="text-right pb-2">Attempts</th>
                  <th className="text-right pb-2">Successes</th>
                  <th className="text-right pb-2">Rate</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.showSuccessByTotal as Record<string, { attempts: number; successes: number }>)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([total, d]) => {
                    const rate = d.attempts > 0 ? ((d.successes / d.attempts) * 100).toFixed(0) : "—";
                    return (
                      <tr key={total} className="border-b border-white/5">
                        <td className="py-1.5 font-bold text-dark-text">≤{total}</td>
                        <td className="py-1.5 text-right">{d.attempts}</td>
                        <td className="py-1.5 text-right text-neon-green">{d.successes}</td>
                        <td className="py-1.5 text-right font-bold" style={{ color: Number(rate) > 50 ? "#00ff88" : "#ff6b6b" }}>{rate}{typeof rate === "string" ? "" : "%"}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent events log */}
      <div className="rounded-xl p-4" style={cardStyle}>
        <p className="text-sm font-bold text-white mb-3">Recent Events (last 50)</p>
        <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
          {(data.recentEvents as any[]).slice().reverse().map((ev: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-[11px] py-1 border-b border-white/5">
              <span className="text-dark-muted font-mono w-28 shrink-0">{ev.type}</span>
              <span className="text-dark-text truncate">
                {ev.isBot ? "🤖" : "👤"}
                {ev.personality ? ` [${ev.personality}]` : ""}
                {ev.handTotal != null ? ` hand=${ev.handTotal}` : ""}
                {ev.success != null ? (ev.success ? " ✅" : " ❌") : ""}
                {ev.cardsThrown != null ? ` threw=${ev.cardsThrown}` : ""}
                {ev.targetTook != null ? (ev.targetTook ? " took" : " blocked") : ""}
                {ev.winnerIsBot != null ? (ev.winnerIsBot ? " bot won" : " human won") : ""}
                {ev.durationMs != null ? ` ${(ev.durationMs / 1000).toFixed(1)}s` : ""}
                {ev.stage != null ? ` stage=${ev.stage}` : ""}
                {ev.passed != null ? (ev.passed ? " pass" : " fail") : ""}
                {ev.botCount != null ? ` bots=${ev.botCount}` : ""}
              </span>
            </div>
          ))}
          {data.recentEvents.length === 0 && (
            <p className="text-dark-muted text-xs text-center py-4">No events recorded yet. Play some games first.</p>
          )}
        </div>
      </div>

      <div className="text-xs text-dark-muted text-center">Auto-refreshes every 15 seconds · In-memory rolling window (5000 events)</div>
    </div>
  );
}

// ── AI Guide Section ──────────────────────────────────────────────────────────

function AiGuideSection() {
  const [tab, setTab] = useState<"bots" | "stages" | "tiers" | "logic">("bots");

  const tabs: { key: typeof tab; label: string; icon: string }[] = [
    { key: "bots",   label: "Bot Personalities", icon: "🤖" },
    { key: "stages", label: "Survival Stages",   icon: "⚔️" },
    { key: "tiers",  label: "Tier & Rewards",    icon: "🏆" },
    { key: "logic",  label: "Decision Logic",    icon: "🧠" },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
          style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.25),rgba(168,85,247,0.18))", border: "1px solid rgba(99,102,241,0.3)" }}>
          🧬
        </div>
        <div>
          <h2 className="text-xl font-black text-white">AI & Bot Strategy Reference</h2>
          <p className="text-xs" style={{ color: "rgba(148,163,184,0.6)" }}>Complete guide to bot personalities, survival stages, and decision logic</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all"
            style={{
              background: tab === t.key ? "linear-gradient(135deg,rgba(99,102,241,0.3),rgba(168,85,247,0.2))" : "rgba(255,255,255,0.04)",
              border: `1px solid ${tab === t.key ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.06)"}`,
              color: tab === t.key ? "#a5b4fc" : "rgba(148,163,184,0.7)",
              boxShadow: tab === t.key ? "0 0 16px rgba(99,102,241,0.2)" : "none",
            }}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }}>

          {/* ── BOT PERSONALITIES ── */}
          {tab === "bots" && (
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "rgba(99,102,241,0.7)" }}>5 Bot Personalities</p>

              {[
                {
                  name: "Safe", icon: "🛡️", color: "#34d399", glow: "rgba(52,211,153,0.15)",
                  think: "1200ms base", style: "Defensive — waits for good hands", risk: "Low",
                  key: ["High combo preservation (0.95)", "Random play 22%", "Shows at ≤5 pts", "Jack use bias 20%", "Killer instinct 15%", "Denial weight 28%"],
                  tag: "Beginner-friendly",
                },
                {
                  name: "Aggressive", icon: "⚡", color: "#f87171", glow: "rgba(248,113,113,0.15)",
                  think: "280ms base", style: "Always attacks — non-stop pressure", risk: "High",
                  key: ["Always attacks (alwaysAttack: true)", "Jack use bias 70%", "Killer instinct 85%", "Show interrupt bias 70%", "Denial weight 55%", "Random play only 6%"],
                  tag: "Stage 2 & Final Boss",
                },
                {
                  name: "Bluff", icon: "🎭", color: "#fbbf24", glow: "rgba(251,191,36,0.15)",
                  think: "700ms ± 680ms jitter", style: "Deceptive — intentionally fakes weak hands", risk: "Medium",
                  key: ["Wide timing jitter (psychological suspense)", "Breaks pairs on purpose to fake weakness", "Delays Show bluff — discards 2nd-best", "Deeper fake during bait phase", "Killer instinct 45%", "Denial weight 45%"],
                  tag: "Stage 3 — Hardest to read",
                },
                {
                  name: "Smart", icon: "🧠", color: "#60a5fa", glow: "rgba(96,165,250,0.15)",
                  think: "480ms base", style: "Balanced — denial-aware, near-optimal", risk: "Medium",
                  key: ["Denial weight 65% (avoids feeding you useful cards)", "Killer instinct 60%", "Show interrupt bias 65%", "Controlled imperfection (4% sub-optimal)", "2-turn lookahead on every discard", "Adapts to your archetype"],
                  tag: "Stage 4 leader",
                },
                {
                  name: "Boss", icon: "👑", color: "#a78bfa", glow: "rgba(167,139,250,0.15)",
                  think: "200ms base", style: "Switches sub-mode every turn — human-like", risk: "Maximum",
                  key: ["8 dynamic sub-modes per turn", "Emotional phases: building→pressure→cooldown→bait→surge", "15% chance to pick 2nd-best (controlled imperfection)", "Per-match variant seed (4 playstyles)", "Denial weight 82%, killer instinct 82%", "Show interrupt bias 90%"],
                  tag: "Stage 5 — Final Boss",
                },
              ].map((bot, i) => (
                <motion.div key={bot.name}
                  initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="rounded-2xl p-5"
                  style={{ background: bot.glow, border: `1px solid ${bot.color}28`, boxShadow: `0 4px 24px ${bot.glow}` }}>
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl font-black"
                        style={{ background: `${bot.color}20`, border: `1px solid ${bot.color}40` }}>
                        {bot.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-base font-black" style={{ color: bot.color }}>{bot.name} Bot</p>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                            style={{ background: `${bot.color}18`, color: bot.color }}>
                            {bot.tag}
                          </span>
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: "rgba(148,163,184,0.7)" }}>{bot.style}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] font-bold" style={{ color: "rgba(148,163,184,0.5)" }}>THINK TIME</p>
                      <p className="text-sm font-black" style={{ color: bot.color }}>{bot.think}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {bot.key.map(k => (
                      <div key={k} className="flex items-start gap-2 text-xs" style={{ color: "rgba(203,213,225,0.75)" }}>
                        <span style={{ color: bot.color, flexShrink: 0 }}>›</span>{k}
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}

              {/* Boss Sub-modes */}
              <div className="rounded-2xl p-5 mt-2"
                style={{ background: "rgba(167,139,250,0.07)", border: "1px solid rgba(167,139,250,0.2)" }}>
                <p className="text-sm font-black text-white mb-1">👑 Boss — 8 Dynamic Sub-modes</p>
                <p className="text-xs mb-4" style={{ color: "rgba(148,163,184,0.6)" }}>Boss picks one mode every turn based on game state. Each match also gets a random "variant seed" that biases it toward a playstyle.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { mode: "killer",         when: "You're recovering/weak",           action: "Maximum aggression — closes you out fast", color: "#f87171" },
                    { mode: "anti_show",      when: "You're close to calling Show",     action: "Burns all 7s/Js to interrupt your Show", color: "#fb923c" },
                    { mode: "pressure_mode",  when: "You're panic-drawing",             action: "Relentless — zero breathing room given", color: "#f43f5e" },
                    { mode: "tempo_control",  when: "You have a trap setup",            action: "Disrupts your rhythm with J skips", color: "#60a5fa" },
                    { mode: "aggressive",     when: "You have very few cards",          action: "Rush attack with 7s immediately", color: "#f87171" },
                    { mode: "combo_preserve", when: "Bait/cooldown phase",              action: "Builds own hand while denying yours", color: "#34d399" },
                    { mode: "defensive",      when: "Cooldown phase (planned retreat)", action: "Slows down to bait you into rushing", color: "#94a3b8" },
                    { mode: "trap",           when: "You're playing smart",             action: "Lures you into discarding useful cards", color: "#fbbf24" },
                  ].map(m => (
                    <div key={m.mode} className="rounded-xl p-3"
                      style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${m.color}22` }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-black px-2 py-0.5 rounded-full"
                          style={{ background: `${m.color}18`, color: m.color }}>
                          {m.mode}
                        </span>
                      </div>
                      <p className="text-[11px] font-semibold" style={{ color: "rgba(148,163,184,0.65)" }}>When: {m.when}</p>
                      <p className="text-[11px] mt-0.5 font-bold text-white">{m.action}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-xl p-3" style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(167,139,250,0.15)" }}>
                  <p className="text-[11px] font-black text-white mb-2">Emotional Phase Cycle</p>
                  <div className="flex items-center gap-1 flex-wrap text-[10px] font-bold">
                    {["building", "pressure", "cooldown", "bait", "surge"].map((phase, i, arr) => (
                      <React.Fragment key={phase}>
                        <span className="px-2 py-0.5 rounded-full" style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa" }}>{phase}</span>
                        {i < arr.length - 1 && <span style={{ color: "rgba(148,163,184,0.4)" }}>→</span>}
                      </React.Fragment>
                    ))}
                  </div>
                  <p className="text-[10px] mt-2" style={{ color: "rgba(148,163,184,0.55)" }}>
                    After 2 pressure turns → cooldown → bait (passive play to trick you) → surge (max spike). Creates human-like rhythm.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── SURVIVAL STAGES ── */}
          {tab === "stages" && (
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "rgba(245,158,11,0.7)" }}>5-Stage AI Championship</p>
              <p className="text-sm mb-4" style={{ color: "rgba(148,163,184,0.65)" }}>
                Win condition: your total hand score must be <strong className="text-white">strictly lower</strong> than every bot's score. 3 rounds per stage. Bots escalate each stage.
              </p>
              {[
                { stage: 1, format: "1v1",  bots: ["Safe Bot"],                              personalities: ["safe"],                           difficulty: 1, color: "#34d399", desc: "Defensive AI — learns basic strategies, safe to practice with" },
                { stage: 2, format: "1v1",  bots: ["Aggressive Bot"],                        personalities: ["aggressive"],                     difficulty: 2, color: "#fbbf24", desc: "Non-stop attack pressure — throws 7s constantly, very fast decisions" },
                { stage: 3, format: "1v1",  bots: ["Bluff Bot"],                             personalities: ["bluff"],                          difficulty: 3, color: "#f97316", desc: "Deceptive — fakes weakness, unpredictable timing, psychological warfare" },
                { stage: 4, format: "1v2",  bots: ["Smart AI", "Aggressive AI"],             personalities: ["smart", "aggressive"],            difficulty: 4, color: "#f87171", desc: "Smart controls tempo and denies your cards; Aggressive attacks simultaneously" },
                { stage: 5, format: "1v3",  bots: ["Boss AI", "Smart AI", "Aggressive AI"], personalities: ["boss", "smart", "aggressive"],    difficulty: 5, color: "#a78bfa", desc: "Final Boss Arena — Boss switches modes every turn, two supports apply constant pressure" },
              ].map((s, i) => (
                <motion.div key={s.stage}
                  initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="rounded-2xl p-5"
                  style={{ background: "rgba(0,0,0,0.35)", border: `1px solid ${s.color}28` }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg"
                        style={{ background: `${s.color}15`, border: `1px solid ${s.color}40`, color: s.color }}>
                        S{s.stage}
                      </div>
                      <div>
                        <p className="font-black text-white text-sm">{s.bots[0]}{s.bots.length > 1 ? ` + ${s.bots.length - 1} more` : ""}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                            style={{ background: `${s.color}18`, color: s.color }}>
                            {s.format}
                          </span>
                          <span className="text-[10px]" style={{ color: "rgba(148,163,184,0.5)" }}>{"★".repeat(s.difficulty)}{"☆".repeat(5 - s.difficulty)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs mb-3" style={{ color: "rgba(203,213,225,0.7)" }}>{s.desc}</p>
                  <div className="flex flex-wrap gap-2">
                    {s.bots.map((b, bi) => (
                      <div key={b} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <span className="text-[11px] font-black text-white">{b}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                          style={{ background: "rgba(0,0,0,0.3)", color: "rgba(148,163,184,0.6)" }}>
                          {s.personalities[bi]}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
              <div className="rounded-2xl p-4 mt-2"
                style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)" }}>
                <p className="text-sm font-black text-white mb-2">💡 Player Tips</p>
                <div className="space-y-1.5">
                  {[
                    "Against Safe — it rarely attacks, so focus on getting your hand to ≤5 and Show fast",
                    "Against Aggressive — counter 7-attacks with your own 7s; if you have none, take the cards calmly",
                    "Against Bluff — ignore its timing tells; just play your own optimal line",
                    "Stage 4 — target Smart AI first (it controls discard denial); Aggressive runs itself into walls",
                    "Stage 5 — Boss switches modes; don't adapt to its last move, adapt to your own hand state",
                  ].map(tip => (
                    <div key={tip} className="flex items-start gap-2 text-xs" style={{ color: "rgba(203,213,225,0.7)" }}>
                      <span style={{ color: "#34d399", flexShrink: 0 }}>›</span>{tip}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── TIER & REWARDS ── */}
          {tab === "tiers" && (
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "rgba(168,85,247,0.7)" }}>Tournament Tiers & Point Rewards</p>
              <p className="text-xs mb-4" style={{ color: "rgba(148,163,184,0.6)" }}>100 points = ₹1 wallet balance. Rewards credited per stage cleared — you keep what you earn even if eliminated later. Refund only if you quit before completing a single round.</p>

              {[
                { tier: "Beginner",    entry: 1000, rewards: [100, 200, 300, 450, 700],     total: 1750, color: "#34d399", icon: "🌱" },
                { tier: "Pro",         entry: 2000, rewards: [200, 350, 600, 900, 1500],    total: 3550, color: "#60a5fa", icon: "⚡" },
                { tier: "Elite",       entry: 5000, rewards: [600, 900, 1400, 2200, 3800],  total: 8900, color: "#f59e0b", icon: "💎" },
                { tier: "Boss Arena",  entry: 10000, rewards: [1200, 1800, 2600, 4200, 7600], total: 17400, color: "#a78bfa", icon: "👑" },
              ].map((t, i) => {
                const net = t.total - t.entry;
                const roi = Math.round((net / t.entry) * 100);
                return (
                  <motion.div key={t.tier}
                    initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="rounded-2xl p-5"
                    style={{ background: "rgba(0,0,0,0.35)", border: `1px solid ${t.color}30` }}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{t.icon}</span>
                        <div>
                          <p className="font-black text-white">{t.tier}</p>
                          <p className="text-xs" style={{ color: "rgba(148,163,184,0.6)" }}>Entry: <span style={{ color: t.color }}>{t.entry.toLocaleString()} pts</span> (₹{t.entry / 100})</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs" style={{ color: "rgba(148,163,184,0.5)" }}>Max earn</p>
                        <p className="font-black" style={{ color: t.color }}>{t.total.toLocaleString()} pts</p>
                        <p className="text-[10px]" style={{ color: net > 0 ? "#34d399" : "#f87171" }}>ROI: +{roi}%</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {t.rewards.map((r, si) => (
                        <div key={si} className="rounded-xl p-2 text-center"
                          style={{ background: `${t.color}10`, border: `1px solid ${t.color}25` }}>
                          <p className="text-[9px] font-bold mb-1" style={{ color: "rgba(148,163,184,0.5)" }}>S{si + 1}</p>
                          <p className="text-sm font-black" style={{ color: t.color }}>{r}</p>
                          <p className="text-[9px]" style={{ color: "rgba(148,163,184,0.4)" }}>pts</p>
                          <p className="text-[9px] mt-0.5 font-semibold" style={{ color: "rgba(52,211,153,0.7)" }}>₹{r / 100}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                      <div className="text-xs" style={{ color: "rgba(148,163,184,0.55)" }}>
                        Complete all 5 stages → net <span style={{ color: "#34d399" }}>+{net.toLocaleString()} pts (₹{net / 100})</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              <div className="rounded-2xl p-4" style={{ background: "rgba(96,165,250,0.07)", border: "1px solid rgba(96,165,250,0.2)" }}>
                <p className="text-sm font-black text-white mb-3">📋 Refund Policy</p>
                <div className="space-y-2 text-xs" style={{ color: "rgba(203,213,225,0.7)" }}>
                  <div className="flex items-start gap-2"><span style={{ color: "#34d399" }}>✓</span>Full refund if you quit before completing Round 1 of Stage 1</div>
                  <div className="flex items-start gap-2"><span style={{ color: "#f87171" }}>✗</span>No refund after any round has been played</div>
                  <div className="flex items-start gap-2"><span style={{ color: "#34d399" }}>✓</span>All stage rewards already credited remain in wallet</div>
                  <div className="flex items-start gap-2"><span style={{ color: "#fbbf24" }}>⚠</span>Stale/crashed sessions auto-refunded on next login</div>
                </div>
              </div>
            </div>
          )}

          {/* ── DECISION LOGIC ── */}
          {tab === "logic" && (
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "rgba(96,165,250,0.7)" }}>Bot Decision Pipeline (per turn)</p>
              <p className="text-xs mb-4" style={{ color: "rgba(148,163,184,0.6)" }}>
                Every bot executes these steps in strict priority order each turn. Higher-priority signals override lower ones.
              </p>

              {[
                { step: 1,  title: "Show Interruption",           color: "#f43f5e", icon: "🚨",
                  when: "Threat = CRITICAL, opponent within 3 cards of Show",
                  action: "Preserves 7s for attack; dumps highest-value safe card. Sacrifices own optimization to prevent your Show." },
                { step: 2,  title: "Attack: Throw All 7s",        color: "#f87171", icon: "⚔️",
                  when: "Opponent hand ≤ attackAllAt threshold (varies by personality)",
                  action: "Throws all 7s simultaneously to dump maximum cards on you. Cannot be countered unless you hold 7s." },
                { step: 3,  title: "Bluff Tactical Line",         color: "#fbbf24", icon: "🎭",
                  when: "Bluff personality only, threat is not high/critical, 20% of turns",
                  action: "Intentionally breaks a pair (medium-value) to fake a scattered hand, baiting you into thinking it's weak." },
                { step: 4,  title: "Anti-Determinism",            color: "#a78bfa", icon: "🎲",
                  when: "Boss/smart: 4-15% chance, not triggered recently",
                  action: "Picks 2nd-best option instead of optimal — prevents you from pattern-reading and exploiting predictability." },
                { step: 5,  title: "Immediate Show Check",        color: "#34d399", icon: "✅",
                  when: "Best discard would drop hand score to ≤5",
                  action: "Executes the discard immediately and calls Show next turn. Won't delay a guaranteed win." },
                { step: 6,  title: "Strategic 7 Deployment",      color: "#f97316", icon: "7️⃣",
                  when: "Has 7s; opponent hand ≤ sevenSaveThreshold OR killer instinct active",
                  action: "Deploys one or all 7s strategically. Saves them until opponent is close enough to make the attack painful." },
                { step: 7,  title: "Jack Skip for Tempo Denial",  color: "#60a5fa", icon: "🃏",
                  when: "Has J; next player hand ≤ skipAt threshold; no 7s available",
                  action: "Burns J to skip your turn and deny you a draw. Most effective when you're 1-2 cards away from winning." },
                { step: 8,  title: "Opponent-Benefit Penalty",    color: "#818cf8", icon: "🧮",
                  when: "Every discard decision (always active)",
                  action: "Scores every discard option by how much it helps you. Avoids giving away Aces, 2s, 3s, jokers. Multiplied by 2× in CRITICAL threat." },
                { step: 9,  title: "2-Turn Lookahead",            color: "#a78bfa", icon: "🔭",
                  when: "Every discard option evaluated",
                  action: "Simulates one more discard after the current one. Options that lead to ≤5 score in 2 turns get a priority bonus." },
                { step: 10, title: "Show Decision",               color: "#34d399", icon: "🏁",
                  when: "Total ≤ showHardMax (safe:5, boss:5, smart:6, bluff:9, aggressive:7)",
                  action: "Calls Show if confidence ≥ threshold. Calls sooner when you're close to Showing first (race condition logic)." },
              ].map((s, i) => (
                <motion.div key={s.step}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-2xl p-4 flex gap-4"
                  style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${s.color}22` }}>
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm"
                    style={{ background: `${s.color}15`, border: `1px solid ${s.color}35`, color: s.color }}>
                    {s.step}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span>{s.icon}</span>
                      <p className="font-black text-white text-sm">{s.title}</p>
                    </div>
                    <p className="text-[11px] mb-1" style={{ color: "rgba(148,163,184,0.55)" }}>
                      <span className="font-bold" style={{ color: s.color }}>When: </span>{s.when}
                    </p>
                    <p className="text-[11px]" style={{ color: "rgba(203,213,225,0.7)" }}>{s.action}</p>
                  </div>
                </motion.div>
              ))}

              {/* Threat Level Engine */}
              <div className="rounded-2xl p-5" style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)" }}>
                <p className="text-sm font-black text-white mb-3">🌡️ Threat Level Engine</p>
                <p className="text-xs mb-3" style={{ color: "rgba(148,163,184,0.6)" }}>
                  Computed every turn. Drives aggression multipliers across all 10 steps.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { level: "LOW",      color: "#34d399", condition: "Opponent 7+ cards, low show pressure" },
                    { level: "MEDIUM",   color: "#fbbf24", condition: "Opponent 5-6 cards OR show pressure ≥30%" },
                    { level: "HIGH",     color: "#f97316", condition: "Opponent 3-4 cards OR show pressure ≥50%" },
                    { level: "CRITICAL", color: "#f43f5e", condition: "Opponent ≤2 cards OR show pressure ≥75%" },
                  ].map(t => (
                    <div key={t.level} className="rounded-xl p-3"
                      style={{ background: `${t.color}10`, border: `1px solid ${t.color}30` }}>
                      <p className="text-xs font-black mb-1" style={{ color: t.color }}>{t.level}</p>
                      <p className="text-[10px]" style={{ color: "rgba(148,163,184,0.65)" }}>{t.condition}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Player Archetypes */}
              <div className="rounded-2xl p-5" style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)" }}>
                <p className="text-sm font-black text-white mb-3">🎯 Player Archetype Detection</p>
                <p className="text-xs mb-3" style={{ color: "rgba(148,163,184,0.6)" }}>Bots observe your play pattern and classify you. Changes how they respond to you specifically.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { arch: "fast_show",     sig: "Many Shows + high cut rate → bot rushes to Show first" },
                    { arch: "combo_hoarder", sig: "Holds pairs/triples → bot avoids giving matching ranks" },
                    { arch: "aggressive",    sig: "Many attack throws → bot goes defensive then counters" },
                    { arch: "defensive",     sig: "Many attack takes → bot increases attack frequency" },
                    { arch: "trap",          sig: "Stable high hand count → bot controls tempo to disrupt" },
                    { arch: "hold_7s",       sig: "Never throws 7s → bot adds trap signal, expects counter-attack" },
                  ].map(a => (
                    <div key={a.arch} className="flex items-start gap-2 rounded-xl p-2.5"
                      style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(245,158,11,0.1)" }}>
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0 mt-0.5"
                        style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>
                        {a.arch}
                      </span>
                      <p className="text-[11px]" style={{ color: "rgba(203,213,225,0.65)" }}>{a.sig}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ── Announcements ─────────────────────────────────────────────────────────────

interface AnnouncementRecord {
  _id: string;
  message: string;
  type: "banner" | "marquee" | "popup";
  active: boolean;
  expiresAt?: string;
  createdAt: string;
}

function AnnouncementsSection() {
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"banner" | "marquee" | "popup">("banner");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await admin.getAnnouncements();
      setAnnouncements(r.data.announcements);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!message.trim()) { setError("Message is required"); return; }
    setError(null);
    setAdding(true);
    try {
      await admin.createAnnouncement({ message: message.trim(), type });
      setMessage("");
      await load();
    } catch {
      setError("Failed to add announcement");
    } finally { setAdding(false); }
  };

  const handleToggle = async (id: string, active: boolean) => {
    try {
      await admin.updateAnnouncement(id, { active: !active });
      setAnnouncements(prev => prev.map(a => a._id === id ? { ...a, active: !active } : a));
    } catch { /* silent */ }
  };

  const handleDelete = async (id: string) => {
    try {
      await admin.deleteAnnouncement(id);
      setAnnouncements(prev => prev.filter(a => a._id !== id));
    } catch { /* silent */ }
  };

  const TYPE_LABELS: Record<string, string> = {
    banner: "Banner",
    marquee: "Marquee",
    popup: "Popup",
  };

  const TYPE_COLORS: Record<string, string> = {
    banner: "#60a5fa",
    marquee: "#fbbf24",
    popup: "#a78bfa",
  };

  const TYPE_ICONS: Record<string, string> = { banner: "🔔", marquee: "📡", popup: "💬" };
  const TYPE_DESC: Record<string, string> = {
    banner: "Pinned bar at the top of every page",
    marquee: "Animated scrolling ticker strip",
    popup: "Floating card — players must dismiss",
  };

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
          style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.3),rgba(168,85,247,0.2))", border: "1px solid rgba(99,102,241,0.4)", boxShadow: "0 0 20px rgba(99,102,241,0.2)" }}>
          📣
        </div>
        <div>
          <h2 className="text-2xl font-black text-white">Announcements</h2>
          <p className="text-sm mt-0.5" style={{ color: "rgba(148,163,184,0.6)" }}>Broadcast messages to all players in real-time</p>
        </div>
      </div>

      {/* Type cards — select visually */}
      <div className="grid grid-cols-3 gap-3">
        {(["banner","marquee","popup"] as const).map(t => (
          <button key={t} onClick={() => setType(t)}
            className="rounded-2xl p-4 text-left transition-all"
            style={{
              background: type === t
                ? `linear-gradient(135deg,${TYPE_COLORS[t]}22,${TYPE_COLORS[t]}10)`
                : "rgba(255,255,255,0.03)",
              border: `1.5px solid ${type === t ? TYPE_COLORS[t] + "60" : "rgba(255,255,255,0.07)"}`,
              boxShadow: type === t ? `0 0 20px ${TYPE_COLORS[t]}18` : "none",
              transform: type === t ? "translateY(-1px)" : "none",
            }}>
            <div className="text-xl mb-2">{TYPE_ICONS[t]}</div>
            <p className="text-sm font-black mb-1" style={{ color: type === t ? TYPE_COLORS[t] : "#e2e8f0" }}>
              {TYPE_LABELS[t]}
            </p>
            <p className="text-[10px] leading-snug" style={{ color: "rgba(148,163,184,0.55)" }}>
              {TYPE_DESC[t]}
            </p>
          </button>
        ))}
      </div>

      {/* Compose area */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: "rgba(12,14,22,0.97)", border: "1px solid rgba(255,255,255,0.07)" }}>
        {/* Top accent */}
        <div style={{ height: 3, background: `linear-gradient(90deg,${TYPE_COLORS[type]},${TYPE_COLORS[type]}80,transparent)` }} />

        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{TYPE_ICONS[type]}</span>
            <p className="text-sm font-bold text-white">Compose {TYPE_LABELS[type]}</p>
          </div>

          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder={`Write your ${TYPE_LABELS[type].toLowerCase()} message here…`}
            rows={4}
            maxLength={500}
            className="w-full rounded-xl px-4 py-3 text-sm resize-none outline-none text-dark-text placeholder-dark-muted"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${message ? TYPE_COLORS[type] + "40" : "rgba(255,255,255,0.08)"}`,
              transition: "border-color 0.2s",
            }}
          />

          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: "rgba(148,163,184,0.4)" }}>
              {message.length}/500 characters
            </p>
            <button
              onClick={handleAdd}
              disabled={adding || !message.trim()}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all disabled:opacity-40"
              style={{
                background: `linear-gradient(135deg,${TYPE_COLORS[type]}30,${TYPE_COLORS[type]}18)`,
                border: `1px solid ${TYPE_COLORS[type]}50`,
                color: TYPE_COLORS[type],
                boxShadow: !adding && message.trim() ? `0 0 16px ${TYPE_COLORS[type]}20` : "none",
              }}
            >
              {adding ? "Publishing…" : "＋ Publish Announcement"}
            </button>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      </div>

      {/* List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-widest" style={{ color: "rgba(148,163,184,0.45)" }}>
            Published ({announcements.length})
          </p>
        </div>

        {loading ? (
          <div className="rounded-2xl p-8 text-center text-sm text-dark-muted animate-pulse" style={cardStyle}>Loading…</div>
        ) : announcements.length === 0 ? (
          <div className="rounded-2xl p-10 text-center" style={cardStyle}>
            <p className="text-3xl mb-3">📭</p>
            <p className="text-sm font-semibold text-dark-muted">No announcements published yet</p>
            <p className="text-xs text-dark-muted mt-1">Compose one above and hit Publish</p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map(ann => (
              <motion.div
                key={ann._id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: ann.active ? 1 : 0.55, y: 0 }}
                className="rounded-2xl overflow-hidden"
                style={{
                  background: ann.active
                    ? `linear-gradient(135deg,${TYPE_COLORS[ann.type]}10,rgba(12,14,22,0.97))`
                    : "rgba(12,14,22,0.7)",
                  border: `1px solid ${ann.active ? TYPE_COLORS[ann.type] + "35" : "rgba(255,255,255,0.06)"}`,
                }}>
                {/* Left accent */}
                <div style={{ display: "flex" }}>
                  <div style={{ width: 4, flexShrink: 0, background: ann.active ? TYPE_COLORS[ann.type] : "rgba(255,255,255,0.08)" }} />
                  <div className="flex-1 p-5">
                    <div className="flex items-start gap-4">
                      {/* Icon circle */}
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                        style={{
                          background: `${TYPE_COLORS[ann.type]}18`,
                          border: `1px solid ${TYPE_COLORS[ann.type]}35`,
                        }}>
                        {TYPE_ICONS[ann.type]}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Badge + status */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
                            style={{ background: `${TYPE_COLORS[ann.type]}20`, color: TYPE_COLORS[ann.type], border: `1px solid ${TYPE_COLORS[ann.type]}35` }}>
                            {TYPE_LABELS[ann.type]}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: ann.active ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)", color: ann.active ? "#22c55e" : "#6b7280" }}>
                            {ann.active ? "● Live" : "○ Paused"}
                          </span>
                        </div>

                        {/* Message */}
                        <p className="text-base font-semibold text-white break-words leading-relaxed">
                          {ann.message}
                        </p>

                        <p className="text-[11px] mt-2" style={{ color: "rgba(148,163,184,0.4)" }}>
                          Published {new Date(ann.createdAt).toLocaleDateString()} at {new Date(ann.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>

                      {/* Controls */}
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        {/* Toggle */}
                        <button
                          onClick={() => handleToggle(ann._id, ann.active)}
                          className="relative flex-shrink-0"
                          style={{ width: 48, height: 26, borderRadius: 13,
                            background: ann.active ? "#22c55e" : "rgba(255,255,255,0.1)",
                            border: `1px solid ${ann.active ? "#16a34a" : "rgba(255,255,255,0.1)"}`,
                            transition: "background 0.2s", cursor: "pointer" }}
                          title={ann.active ? "Pause" : "Activate"}
                        >
                          <motion.span layout
                            className="absolute top-[3px] w-5 h-5 bg-white rounded-full shadow-md"
                            animate={{ x: ann.active ? 24 : 3 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(ann._id)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "rgba(239,68,68,0.7)", fontSize: 16 }}
                          title="Delete"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Missed Payouts Section ───────────────────────────────────────────────────

function MissedPayoutsSection({ onReview }: { onReview?: (roomId: string) => void }) {
  const [data, setData] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [repaying, setRepaying] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await admin.getMissedPayouts(page);
      setData(r.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const repay = async (userId: string, amount: number, roomCode: string, username: string) => {
    if (!confirm(`Repay ₹${amount} to ${username} for room ${roomCode}?`)) return;
    setRepaying(userId + roomCode);
    try {
      const r = await admin.repayMissedPayout({ userId, amount, roomCode, note: "Admin repay via dashboard" });
      showToast(`₹${amount} repaid to ${r.data.username}. New balance: ₹${r.data.balance}`, true);
      load();
    } catch (e: any) {
      showToast(e?.response?.data?.error ?? "Repay failed", false);
    } finally { setRepaying(null); }
  };

  const refundTeamEntry = async (entry: any) => {
    if (!confirm(`Refund ₹${entry.amount} to ${entry.username ?? entry.userId} for Team ${entry.teamCode}?`)) return;
    setRepaying(`team-${entry._id}`);
    try {
      const r = await admin.refundTeamEntry({
        userId: entry.userId,
        amount: entry.amount,
        teamId: entry.teamId,
        teamCode: entry.teamCode,
        note: "Admin refund via missed-payouts dashboard",
      });
      showToast(`₹${entry.amount} refunded to ${r.data.username}. New balance: ₹${r.data.balance}`, true);
      load();
    } catch (e: any) {
      showToast(e?.response?.data?.error ?? "Refund failed", false);
    } finally { setRepaying(null); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-white">Missed Prize Payouts</h2>
        <p className="text-xs text-dark-muted mt-1">
          Failed winning transactions and games where entry fees were paid but no prize was issued.
        </p>
      </div>

      {loading ? (
        <p className="text-dark-muted text-sm animate-pulse">Loading…</p>
      ) : (
        <>
          {/* Failed transactions */}
          <div className="rounded-2xl overflow-hidden" style={cardStyle}>
            <div className="px-4 py-3 flex items-center gap-2"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,59,92,0.06)" }}>
              <span className="text-sm font-bold text-white">Failed Prize Transactions</span>
              {(data?.total ?? 0) > 0 && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(255,59,92,0.2)", color: "#ff6b6b" }}>{data.total}</span>
              )}
            </div>
            {(data?.failed ?? []).length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-dark-muted">No failed transactions</p>
            ) : (
              <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                {data.failed.map((t: any) => (
                  <div key={t._id} className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{t.description}</p>
                      <p className="text-[11px] text-dark-muted font-mono">{t.userId} · {new Date(t.createdAt).toLocaleString()}</p>
                      {t.metadata?.failReason && (
                        <p className="text-[10px] mt-0.5" style={{ color: "#ff6b6b" }}>Reason: {t.metadata.failReason}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="font-bold text-neon-red">₹{t.amount}</span>
                      <button
                        onClick={() => repay(t.userId, t.amount, t.metadata?.roomCode ?? "", t.userId)}
                        disabled={repaying === t.userId + (t.metadata?.roomCode ?? "")}
                        className="text-[11px] px-3 py-1.5 rounded-lg font-semibold transition-colors disabled:opacity-40"
                        style={{ background: "rgba(0,255,136,0.15)", color: "#00ff88", border: "1px solid rgba(0,255,136,0.3)" }}
                      >
                        {repaying === t.userId + (t.metadata?.roomCode ?? "") ? "…" : "Repay"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Orphaned games — entry fee paid, no prize issued */}
          <div className="rounded-2xl overflow-hidden" style={cardStyle}>
            <div className="px-4 py-3"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(251,191,36,0.06)" }}>
              <span className="text-sm font-bold text-white">Games With No Prize Record</span>
              <p className="text-[11px] text-dark-muted mt-0.5">Finished games where players paid but no prize transaction exists</p>
            </div>
            {(data?.orphaned ?? []).length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-dark-muted">No orphaned games found</p>
            ) : (
              <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                {data.orphaned.map((g: any) => (
                  <div key={g.roomId} className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">Room: {g.roomId}</p>
                      <p className="text-[11px] text-dark-muted">
                        Winner: {g.winnerUsername ?? "unknown"} · {g.paidCount} paid player{g.paidCount !== 1 ? "s" : ""} · Pot: ₹{g.totalPot}
                      </p>
                      <p className="text-[11px] text-dark-muted">{g.endedAt ? new Date(g.endedAt).toLocaleString() : "—"}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                      <span className="font-bold" style={{ color: "#fbbf24" }}>₹{g.totalPot}</span>
                      {onReview && (
                        <button
                          onClick={() => onReview(g.roomId)}
                          className="text-[11px] px-2.5 py-1.5 rounded-lg font-semibold transition-colors"
                          style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.3)" }}
                        >
                          🕵️ Review
                        </button>
                      )}
                      {g.winnerId && (
                        <button
                          onClick={() => repay(g.winnerId, g.totalPot, g.roomId, g.winnerUsername ?? g.winnerId)}
                          disabled={!!repaying}
                          className="text-[11px] px-3 py-1.5 rounded-lg font-semibold transition-colors disabled:opacity-40"
                          style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)" }}
                        >
                          {repaying ? "…" : "Repay Winner"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Unrefunded Team Survival entry locks */}
          <div className="rounded-2xl overflow-hidden" style={cardStyle}>
            <div className="px-4 py-3"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(168,85,247,0.06)" }}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">Unrefunded Team Survival Entries</span>
                {(data?.unrefundedTeamEntries ?? []).length > 0 && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(168,85,247,0.2)", color: "#c084fc" }}>
                    {data.unrefundedTeamEntries.length}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-dark-muted mt-0.5">
                Entry fees locked for completed/abandoned tournaments where no refund or prize was issued
              </p>
            </div>
            {(data?.unrefundedTeamEntries ?? []).length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-dark-muted">No unrefunded team entries</p>
            ) : (
              <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                {data.unrefundedTeamEntries.map((entry: any) => (
                  <div key={entry._id} className="px-4 py-3 flex items-center gap-3">
                    <Avatar avatar={entry.avatar ?? "avatar_1"} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-white">{entry.username ?? entry.userId}</p>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: "rgba(168,85,247,0.15)", color: "#c084fc" }}>
                          Team {entry.teamCode}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full capitalize"
                          style={{
                            background: entry.teamStatus === "abandoned" ? "rgba(255,107,107,0.12)" : "rgba(99,102,241,0.12)",
                            color: entry.teamStatus === "abandoned" ? "#ff6b6b" : "#818cf8",
                          }}>
                          {entry.teamStatus}
                        </span>
                        <span className="text-[10px] text-dark-muted capitalize">{entry.teamTier}</span>
                      </div>
                      <p className="text-[11px] text-dark-muted mt-0.5">
                        {new Date(entry.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="font-bold text-sm" style={{ color: "#c084fc" }}>₹{entry.amount}</span>
                      <button
                        onClick={() => refundTeamEntry(entry)}
                        disabled={repaying === `team-${entry._id}`}
                        className="text-[11px] px-3 py-1.5 rounded-lg font-semibold transition-colors disabled:opacity-40"
                        style={{ background: "rgba(168,85,247,0.15)", color: "#c084fc", border: "1px solid rgba(168,85,247,0.35)" }}>
                        {repaying === `team-${entry._id}` ? "…" : "Refund"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pagination for failed transactions */}
          {(data?.pages ?? 1) > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="text-xs text-dark-muted disabled:opacity-30 hover:text-dark-text">← Prev</button>
              <span className="text-xs text-dark-muted">{page} / {data.pages}</span>
              <button onClick={() => setPage(p => Math.min(data.pages, p + 1))} disabled={page === data.pages}
                className="text-xs text-dark-muted disabled:opacity-30 hover:text-dark-text">Next →</button>
            </div>
          )}
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-2xl text-sm font-semibold shadow-2xl"
          style={{
            background: toast.ok ? "rgba(0,200,100,0.15)" : "rgba(220,50,50,0.15)",
            border: toast.ok ? "1px solid rgba(0,200,100,0.4)" : "1px solid rgba(220,50,50,0.4)",
            color: toast.ok ? "#00e676" : "#ff6b6b",
          }}>
          {toast.ok ? "✅" : "❌"} {toast.msg}
        </div>
      )}
    </div>
  );
}

// ── Hold System Monitor ────────────────────────────────────────────────────────

function HoldSystemSection() {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [clearing, setClearing] = React.useState(false);
  const [error, setError] = React.useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data: d } = await admin.getHoldSystemOverview();
      setData(d);
    } catch {
      setError("Failed to load hold system data");
    } finally {
      setLoading(false);
    }
  };

  const clearAll = async () => {
    if (!confirm("Clear all exploit flags and reset the anti-exploit tracker? This removes all old flagged data.")) return;
    setClearing(true);
    try {
      await admin.clearHoldExploitData();
      await load();
    } catch {
      alert("Failed to clear data");
    } finally {
      setClearing(false);
    }
  };

  React.useEffect(() => { load(); }, []);

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 rounded-full border-2 border-yellow-500/40 border-t-yellow-500 animate-spin" /></div>;
  if (error) return <div className="text-red-400 text-sm p-4">{error}</div>;
  if (!data) return null;

  const { roomsWithHolds, playersWithHolds, stats24h, exploitFlagged } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white">Hold System Monitor</h2>
          <p className="text-xs text-dark-muted mt-0.5">Active entry holds, locked entries, and exploit detection</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={clearAll} disabled={clearing}
            className="px-4 py-2 rounded-xl text-xs font-bold text-red-300 hover:text-white transition-colors disabled:opacity-50"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}>
            {clearing ? "Clearing…" : "🗑 Clear Old Data"}
          </button>
          <button onClick={load} className="px-4 py-2 rounded-xl text-xs font-bold text-yellow-300 hover:text-white transition-colors"
            style={{ background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.25)" }}>
            Refresh
          </button>
        </div>
      </div>

      {/* 24h stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Holds Placed", value: stats24h.holdCount, color: "#fde047", icon: "🔒" },
          { label: "Released", value: stats24h.releaseCount, color: "#67e8f9", icon: "🔓" },
          { label: "Abandoned", value: stats24h.abandonCount, color: "#f87171", icon: "💔" },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4 text-center"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-2xl mb-1">{s.icon}</p>
            <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[10px] text-dark-muted uppercase tracking-wider mt-0.5">{s.label}</p>
            <p className="text-[9px] text-dark-muted mt-0.5">Last 24h</p>
          </div>
        ))}
      </div>

      {/* Rooms with active holds */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(234,179,8,0.15)" }}>
        <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <span className="text-yellow-300">🔒</span>
          <h3 className="text-sm font-black text-white">Rooms With Active Holds ({roomsWithHolds.length})</h3>
        </div>
        {roomsWithHolds.length === 0 ? (
          <p className="text-dark-muted text-xs px-4 py-4">No rooms with active holds</p>
        ) : (
          <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
            {roomsWithHolds.map((r: any) => (
              <div key={r.code} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-white">{r.code} · {r.name}</p>
                  <p className="text-xs text-dark-muted">{r.heldCount} player{r.heldCount !== 1 ? "s" : ""} · ₹{r.entryFee} each · Total held: ₹{r.entryFee * r.heldCount}</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold text-yellow-300" style={{ background: "rgba(234,179,8,0.12)", border: "1px solid rgba(234,179,8,0.25)" }}>
                  {r.matchState ?? "forming"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Players with held balance */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(99,102,241,0.15)" }}>
        <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <span>👤</span>
          <h3 className="text-sm font-black text-white">Players With Non-Zero Held Balance ({playersWithHolds.length})</h3>
        </div>
        {playersWithHolds.length === 0 ? (
          <p className="text-dark-muted text-xs px-4 py-4">No players with held balance</p>
        ) : (
          <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
            {playersWithHolds.map((p: any) => (
              <div key={p.userId} className="px-4 py-3 grid grid-cols-4 gap-2 text-xs">
                <div>
                  <p className="font-bold text-white">{p.username}</p>
                  <p className="text-dark-muted">Player</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-white">₹{p.walletBalance}</p>
                  <p className="text-dark-muted">Total</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-yellow-300">₹{p.heldBalance}</p>
                  <p className="text-dark-muted">Held</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-green-400">₹{p.availableBalance}</p>
                  <p className="text-dark-muted">Available</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Exploit flagged releases */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(248,113,113,0.2)" }}>
        <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <span>🚨</span>
          <h3 className="text-sm font-black text-white">Exploit-Flagged Releases (24h) — {exploitFlagged.length}</h3>
        </div>
        {exploitFlagged.length === 0 ? (
          <p className="text-dark-muted text-xs px-4 py-4">No suspicious patterns detected</p>
        ) : (
          <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
            {exploitFlagged.map((tx: any) => (
              <div key={tx._id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-red-300">{tx.description}</p>
                  <p className="text-[10px] text-dark-muted">{new Date(tx.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <p className="text-[10px] text-dark-muted mt-0.5">User: {tx.userId} · ₹{tx.amount} · Room: {tx.metadata?.roomCode ?? "—"}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Spin Analytics Section ────────────────────────────────────────────────────

interface SpinUserStat {
  id: string;
  username: string;
  avatar: string;
  moneySpinsToday: number;
  moneySpinLimit: number;
  pointsSpinsToday: number;
  pointsSpinLimit: number;
  allTimeMoneySpin: number;
  allTimePointsSpin: number;
  totalMoneyWon: number;
  totalMoneySpent: number;
  totalPointsSpent: number;
  totalPointsWon: number;
  lastSpinAt?: string;
}

interface DailySpinPlayerRow {
  userId: string;
  username: string;
  avatar?: string;
  moneyCount: number;
  pointsCount: number;
  freeCount: number;
  moneySpent: number;
  pointsSpent: number;
  moneyWon: number;
  pointsWon: number;
  lastSpin?: string;
}

interface DailySpinRow {
  date: string;
  moneyCount: number;
  pointsCount: number;
  freeCount: number;
  moneySpent: number;
  pointsSpent: number;
  moneyWon: number;
  uniqueUsers: number;
  players?: DailySpinPlayerRow[];
}

function SpinAnalyticsSection() {
  const [view, setView] = React.useState<"users" | "daily">("users");
  const [users, setUsers] = React.useState<SpinUserStat[]>([]);
  const [dailyRows, setDailyRows] = React.useState<DailySpinRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dailyLoading, setDailyLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [moneyLimit, setMoneyLimit] = React.useState(3);
  const [pointsLimit, setPointsLimit] = React.useState(10);
  const [savingLimits, setSavingLimits] = React.useState(false);
  const [resettingId, setResettingId] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [expandedDays, setExpandedDays] = React.useState<Set<string>>(new Set());

  const toggleDay = (date: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      next.has(date) ? next.delete(date) : next.add(date);
      return next;
    });
  };

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await admin.getSpinAnalytics();
      setUsers(data.users ?? []);
      setMoneyLimit(data.moneySpinLimit ?? 3);
      setPointsLimit(data.pointsSpinLimit ?? 10);
    } catch {
      setError("Failed to load spin analytics");
    } finally {
      setLoading(false);
    }
  };

  const loadDaily = async () => {
    setDailyLoading(true);
    try {
      const { data } = await admin.getSpinAnalyticsDaily();
      setDailyRows(data.rows ?? []);
    } catch {
      showToast("error", "Failed to load daily report");
    } finally {
      setDailyLoading(false);
    }
  };

  React.useEffect(() => { load(); }, []);

  React.useEffect(() => {
    if (view === "daily" && dailyRows.length === 0) loadDaily();
  }, [view]);

  const handleSaveLimits = async () => {
    setSavingLimits(true);
    try {
      await admin.updateConfig({ spinConfig: { moneySpinDailyLimit: moneyLimit, pointsSpinDailyLimit: pointsLimit } });
      showToast("success", "Spin limits saved");
    } catch {
      showToast("error", "Failed to save limits");
    } finally {
      setSavingLimits(false);
    }
  };

  const handleReset = async (userId: string, type: "money" | "points") => {
    setResettingId(`${userId}-${type}`);
    try {
      await admin.resetUserSpins(userId, type);
      showToast("success", `${type === "money" ? "Money" : "Points"} spin reset`);
      await load();
    } catch {
      showToast("error", "Failed to reset");
    } finally {
      setResettingId(null);
    }
  };

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 rounded-full border-2 border-indigo-500/40 border-t-indigo-500 animate-spin" />
    </div>
  );

  if (error) return <div className="text-red-400 text-sm p-4">{error}</div>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-black text-white">Spin Analytics</h2>
          <p className="text-xs text-dark-muted mt-0.5">Daily usage, all-time stats, and limit management</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid rgba(99,102,241,0.25)" }}>
            <button onClick={() => setView("users")}
              className="px-3 py-1.5 text-xs font-bold transition-colors"
              style={{
                background: view === "users" ? "rgba(99,102,241,0.25)" : "transparent",
                color: view === "users" ? "#a5b4fc" : "#6b7280",
              }}>
              Players
            </button>
            <button onClick={() => setView("daily")}
              className="px-3 py-1.5 text-xs font-bold transition-colors"
              style={{
                background: view === "daily" ? "rgba(99,102,241,0.25)" : "transparent",
                color: view === "daily" ? "#a5b4fc" : "#6b7280",
              }}>
              Daily Report
            </button>
          </div>
          <button onClick={view === "users" ? load : loadDaily}
            className="px-3 py-1.5 rounded-xl text-xs font-bold transition-colors"
            style={{ background: "rgba(99,102,241,0.12)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.25)" }}>
            ↺
          </button>
        </div>
      </div>

      {/* Global Limits Card */}
      <div className="rounded-2xl p-4 space-y-4" style={cardStyle}>
        <p className="text-sm font-bold text-white">Global Daily Limits</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.18)" }}>
            <p className="text-xs font-semibold" style={{ color: "#818cf8" }}>Money Spin Daily Limit</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setMoneyLimit(v => Math.max(1, v - 1))}
                className="w-7 h-7 rounded-lg bg-dark-border text-dark-text font-bold text-sm flex items-center justify-center hover:bg-dark-border/80">
                −
              </button>
              <span className="w-8 text-center font-bold text-sm" style={{ color: "#818cf8" }}>{moneyLimit}</span>
              <button onClick={() => setMoneyLimit(v => Math.min(50, v + 1))}
                className="w-7 h-7 rounded-lg bg-dark-border text-dark-text font-bold text-sm flex items-center justify-center hover:bg-dark-border/80">
                +
              </button>
            </div>
          </div>
          <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.18)" }}>
            <p className="text-xs font-semibold" style={{ color: "#34d399" }}>Points Spin Daily Limit</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPointsLimit(v => Math.max(1, v - 1))}
                className="w-7 h-7 rounded-lg bg-dark-border text-dark-text font-bold text-sm flex items-center justify-center hover:bg-dark-border/80">
                −
              </button>
              <span className="w-8 text-center font-bold text-sm" style={{ color: "#34d399" }}>{pointsLimit}</span>
              <button onClick={() => setPointsLimit(v => Math.min(100, v + 1))}
                className="w-7 h-7 rounded-lg bg-dark-border text-dark-text font-bold text-sm flex items-center justify-center hover:bg-dark-border/80">
                +
              </button>
            </div>
          </div>
        </div>
        <button onClick={handleSaveLimits} disabled={savingLimits}
          className="px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.25),rgba(168,85,247,0.18))", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.35)" }}>
          {savingLimits ? "Saving…" : "Save Limits"}
        </button>
      </div>

      {/* Players view */}
      {view === "users" && (
        <div className="rounded-2xl overflow-hidden" style={cardStyle}>
          <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <span>🎰</span>
            <h3 className="text-sm font-black text-white">Player Spin Stats</h3>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full ml-1"
              style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8" }}>
              {users.length}
            </span>
          </div>

          {users.length === 0 ? (
            <p className="text-dark-muted text-xs px-4 py-6 text-center">No spin data yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.02)" }}>
                    <th className="text-left px-4 py-2 text-dark-muted font-semibold">Player</th>
                    <th className="text-center px-3 py-2 font-semibold" style={{ color: "#818cf8" }}>Money Today</th>
                    <th className="text-center px-3 py-2 font-semibold" style={{ color: "#34d399" }}>Points Today</th>
                    <th className="text-center px-3 py-2 text-dark-muted font-semibold">All-Time ₹</th>
                    <th className="text-center px-3 py-2 text-dark-muted font-semibold">All-Time Pts</th>
                    <th className="text-center px-3 py-2 font-semibold" style={{ color: "#f87171" }}>₹ Spent</th>
                    <th className="text-center px-3 py-2 font-semibold" style={{ color: "#fb923c" }}>Pts Spent</th>
                    <th className="text-center px-3 py-2 font-semibold" style={{ color: "#a78bfa" }}>Pts Won</th>
                    <th className="text-center px-3 py-2 text-dark-muted font-semibold">₹ Won</th>
                    <th className="text-center px-3 py-2 text-dark-muted font-semibold">Last Spin</th>
                    <th className="text-center px-3 py-2 text-dark-muted font-semibold">Reset</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                      className="hover:bg-white/[0.015] transition-colors">
                      {/* Player */}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar avatar={u.avatar} size="sm" />
                          <span className="font-semibold text-white truncate max-w-[90px]">{u.username}</span>
                        </div>
                      </td>
                      {/* Money Today */}
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        <span className="font-bold" style={{ color: u.moneySpinsToday >= u.moneySpinLimit ? "#f87171" : "#818cf8" }}>
                          {u.moneySpinsToday}/{u.moneySpinLimit}
                        </span>
                        <span className="ml-1 text-dark-muted">
                          ({Math.max(0, u.moneySpinLimit - u.moneySpinsToday)} left)
                        </span>
                      </td>
                      {/* Points Today */}
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        <span className="font-bold" style={{ color: u.pointsSpinsToday >= u.pointsSpinLimit ? "#f87171" : "#34d399" }}>
                          {u.pointsSpinsToday}/{u.pointsSpinLimit}
                        </span>
                        <span className="ml-1 text-dark-muted">
                          ({Math.max(0, u.pointsSpinLimit - u.pointsSpinsToday)} left)
                        </span>
                      </td>
                      {/* All-Time Money Spins */}
                      <td className="px-3 py-2.5 text-center text-dark-muted font-medium">{u.allTimeMoneySpin}</td>
                      {/* All-Time Points Spins */}
                      <td className="px-3 py-2.5 text-center text-dark-muted font-medium">{u.allTimePointsSpin}</td>
                      {/* ₹ Spent */}
                      <td className="px-3 py-2.5 text-center font-bold" style={{ color: "#f87171" }}>
                        ₹{u.totalMoneySpent.toLocaleString("en-IN")}
                      </td>
                      {/* Pts Spent */}
                      <td className="px-3 py-2.5 text-center font-bold" style={{ color: "#fb923c" }}>
                        {u.totalPointsSpent.toLocaleString("en-IN")}
                      </td>
                      {/* Pts Won */}
                      <td className="px-3 py-2.5 text-center font-bold" style={{ color: "#a78bfa" }}>
                        {(u.totalPointsWon ?? 0).toLocaleString("en-IN")}
                      </td>
                      {/* ₹ Won */}
                      <td className="px-3 py-2.5 text-center font-bold" style={{ color: "#fbbf24" }}>
                        ₹{u.totalMoneyWon.toLocaleString("en-IN")}
                      </td>
                      {/* Last Spin */}
                      <td className="px-3 py-2.5 text-center text-dark-muted whitespace-nowrap">
                        {u.lastSpinAt
                          ? new Date(u.lastSpinAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
                          : "—"}
                      </td>
                      {/* Reset Buttons */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1 justify-center">
                          <button
                            onClick={() => handleReset(u.id, "money")}
                            disabled={resettingId === `${u.id}-money`}
                            className="text-[10px] px-2 py-1 rounded-lg font-semibold transition-all disabled:opacity-40 whitespace-nowrap"
                            style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.25)" }}>
                            {resettingId === `${u.id}-money` ? "…" : "₹ Reset"}
                          </button>
                          <button
                            onClick={() => handleReset(u.id, "points")}
                            disabled={resettingId === `${u.id}-points`}
                            className="text-[10px] px-2 py-1 rounded-lg font-semibold transition-all disabled:opacity-40 whitespace-nowrap"
                            style={{ background: "rgba(16,185,129,0.12)", color: "#34d399", border: "1px solid rgba(16,185,129,0.25)" }}>
                            {resettingId === `${u.id}-points` ? "…" : "Pts Reset"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Daily Report view */}
      {view === "daily" && (
        <div className="rounded-2xl overflow-hidden" style={cardStyle}>
          <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <span>📅</span>
            <h3 className="text-sm font-black text-white">Daily Spin Report</h3>
            {dailyRows.length > 0 && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full ml-1"
                style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8" }}>
                {dailyRows.length} days
              </span>
            )}
          </div>

          {dailyLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 rounded-full border-2 border-indigo-500/40 border-t-indigo-500 animate-spin" />
            </div>
          ) : dailyRows.length === 0 ? (
            <p className="text-dark-muted text-xs px-4 py-6 text-center">No daily spin data yet</p>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {/* All-time totals banner */}
              {dailyRows.length > 1 && (() => {
                const totals = dailyRows.reduce((acc, r) => ({
                  moneyCount:  acc.moneyCount  + r.moneyCount,
                  pointsCount: acc.pointsCount + r.pointsCount,
                  freeCount:   acc.freeCount   + r.freeCount,
                  moneySpent:  acc.moneySpent  + r.moneySpent,
                  pointsSpent: acc.pointsSpent + r.pointsSpent,
                  moneyWon:    acc.moneyWon    + r.moneyWon,
                }), { moneyCount: 0, pointsCount: 0, freeCount: 0, moneySpent: 0, pointsSpent: 0, moneyWon: 0 });
                const totalNet = Math.round((totals.moneySpent - totals.moneyWon) * 100) / 100;
                return (
                  <div className="px-4 py-3 flex flex-wrap gap-4 items-center text-[11px]"
                    style={{ background: "rgba(99,102,241,0.06)", borderBottom: "1px solid rgba(99,102,241,0.15)" }}>
                    <span className="font-black text-white text-xs">All Time</span>
                    <span style={{ color: "#818cf8" }}><b>{totals.moneyCount}</b> ₹ spins</span>
                    <span style={{ color: "#34d399" }}><b>{totals.pointsCount}</b> pts spins</span>
                    <span className="text-dark-muted"><b>{totals.freeCount}</b> free</span>
                    <span style={{ color: "#f87171" }}>₹<b>{totals.moneySpent}</b> spent</span>
                    <span style={{ color: "#fbbf24" }}>₹<b>{totals.moneyWon}</b> won</span>
                    <span style={{ color: totalNet >= 0 ? "#4ade80" : "#f87171" }} className="font-black">
                      Net: {totalNet >= 0 ? "+" : ""}₹{totalNet}
                    </span>
                  </div>
                );
              })()}

              {/* Per-day rows */}
              {dailyRows.map((r) => {
                const net = Math.round((r.moneySpent - r.moneyWon) * 100) / 100;
                const isExpanded = expandedDays.has(r.date);
                const hasPlayers = (r.players?.length ?? 0) > 0;
                const dateLabel = new Date(r.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "2-digit" });
                return (
                  <div key={r.date}>
                    {/* Day summary row */}
                    <div
                      className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 transition-colors"
                      style={{ background: isExpanded ? "rgba(99,102,241,0.04)" : undefined, cursor: hasPlayers ? "pointer" : undefined }}
                      onClick={() => hasPlayers && toggleDay(r.date)}>
                      {/* Date + expand arrow */}
                      <div className="flex items-center gap-1.5 min-w-[110px]">
                        {hasPlayers && (
                          <span className="text-dark-muted text-[10px] transition-transform" style={{ display: "inline-block", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
                        )}
                        <span className="font-black text-white text-xs">{dateLabel}</span>
                      </div>

                      {/* Player count badge */}
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(129,140,248,0.12)", color: "#818cf8" }}>
                        {r.uniqueUsers} player{r.uniqueUsers !== 1 ? "s" : ""}
                      </span>

                      {/* Spin counts */}
                      <span className="text-[11px]" style={{ color: "#818cf8" }}>
                        <b>{r.moneyCount}</b><span className="text-dark-muted"> ₹spins</span>
                      </span>
                      <span className="text-[11px]" style={{ color: "#34d399" }}>
                        <b>{r.pointsCount}</b><span className="text-dark-muted"> ptspins</span>
                      </span>
                      {r.freeCount > 0 && (
                        <span className="text-[11px] text-dark-muted"><b>{r.freeCount}</b> free</span>
                      )}

                      {/* Financials */}
                      <span className="text-[11px]" style={{ color: "#f87171" }}>
                        <span className="text-dark-muted">spent </span>₹<b>{r.moneySpent}</b>
                      </span>
                      <span className="text-[11px]" style={{ color: "#fbbf24" }}>
                        <span className="text-dark-muted">won </span>₹<b>{r.moneyWon}</b>
                      </span>
                      <span className="text-[11px] font-black" style={{ color: net >= 0 ? "#4ade80" : "#f87171" }}>
                        net {net >= 0 ? "+" : ""}₹{net}
                      </span>
                    </div>

                    {/* Expanded per-player breakdown */}
                    {isExpanded && hasPlayers && (
                      <div className="px-4 pb-3" style={{ background: "rgba(0,0,0,0.15)" }}>
                        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(99,102,241,0.12)" }}>
                          <table className="w-full text-[11px]">
                            <thead>
                              <tr style={{ background: "rgba(99,102,241,0.08)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                <th className="text-left px-3 py-2 text-dark-muted font-semibold">Player</th>
                                <th className="text-center px-2 py-2 font-semibold" style={{ color: "#818cf8" }}>₹ Spins</th>
                                <th className="text-center px-2 py-2 font-semibold" style={{ color: "#34d399" }}>Pts Spins</th>
                                <th className="text-center px-2 py-2 text-dark-muted font-semibold">Free</th>
                                <th className="text-center px-2 py-2 font-semibold" style={{ color: "#f87171" }}>₹ Spent</th>
                                <th className="text-center px-2 py-2 font-semibold" style={{ color: "#fb923c" }}>Pts Spent</th>
                                <th className="text-center px-2 py-2 font-semibold" style={{ color: "#fbbf24" }}>₹ Won</th>
                                <th className="text-center px-2 py-2 font-semibold" style={{ color: "#a78bfa" }}>Pts Won</th>
                                <th className="text-center px-2 py-2 font-semibold" style={{ color: "#4ade80" }}>Net ₹</th>
                                <th className="text-center px-2 py-2 text-dark-muted font-semibold">Last Spin</th>
                              </tr>
                            </thead>
                            <tbody>
                              {r.players!.map((p) => {
                                const pNet = Math.round((p.moneySpent - p.moneyWon) * 100) / 100;
                                return (
                                  <tr key={p.userId}
                                    style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                                    className="hover:bg-white/[0.02] transition-colors">
                                    <td className="px-3 py-2 font-semibold text-white">
                                      <div className="flex items-center gap-1.5">
                                        {p.avatar ? (
                                          <img src={p.avatar} className="w-5 h-5 rounded-full" />
                                        ) : (
                                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black"
                                            style={{ background: "rgba(99,102,241,0.2)", color: "#818cf8" }}>
                                            {(p.username ?? "?")[0].toUpperCase()}
                                          </div>
                                        )}
                                        <span>{p.username ?? p.userId.slice(-6)}</span>
                                      </div>
                                    </td>
                                    <td className="px-2 py-2 text-center font-bold" style={{ color: "#818cf8" }}>{p.moneyCount}</td>
                                    <td className="px-2 py-2 text-center font-bold" style={{ color: "#34d399" }}>{p.pointsCount}</td>
                                    <td className="px-2 py-2 text-center text-dark-muted">{p.freeCount}</td>
                                    <td className="px-2 py-2 text-center font-bold" style={{ color: "#f87171" }}>
                                      {p.moneySpent > 0 ? `₹${p.moneySpent}` : "—"}
                                    </td>
                                    <td className="px-2 py-2 text-center font-bold" style={{ color: "#fb923c" }}>
                                      {p.pointsSpent > 0 ? p.pointsSpent : "—"}
                                    </td>
                                    <td className="px-2 py-2 text-center font-bold" style={{ color: "#fbbf24" }}>
                                      {p.moneyWon > 0 ? `₹${p.moneyWon}` : "—"}
                                    </td>
                                    <td className="px-2 py-2 text-center font-bold" style={{ color: "#a78bfa" }}>
                                      {p.pointsWon > 0 ? p.pointsWon : "—"}
                                    </td>
                                    <td className="px-2 py-2 text-center font-bold"
                                      style={{ color: pNet >= 0 ? "#4ade80" : "#f87171" }}>
                                      {pNet >= 0 ? "+" : ""}₹{pNet}
                                    </td>
                                    <td className="px-2 py-2 text-center text-dark-muted">
                                      {p.lastSpin
                                        ? new Date(p.lastSpin).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                                        : "—"}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Inline toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl text-sm font-semibold"
          style={{
            background: toast.type === "success"
              ? "linear-gradient(135deg,rgba(0,200,100,0.18),rgba(0,200,100,0.08))"
              : "linear-gradient(135deg,rgba(220,50,50,0.18),rgba(220,50,50,0.08))",
            border: toast.type === "success"
              ? "1px solid rgba(0,200,100,0.45)"
              : "1px solid rgba(220,50,50,0.45)",
            backdropFilter: "blur(16px)",
            color: toast.type === "success" ? "#00e676" : "#ff6b6b",
          }}>
          <span>{toast.type === "success" ? "✅" : "❌"}</span>
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}

// ── Room Tracker ───────────────────────────────────────────────────────────────
const RT_TYPE_TABS = [
  { key:"all",           label:"All Rooms",     icon:"🗂️",  color:"#818cf8" },
  { key:"multiplayer_wager", label:"Wager MP",  icon:"💰",  color:"#fbbf24" },
  { key:"multiplayer_free",  label:"Free MP",   icon:"🤝",  color:"#34d399" },
  { key:"ai_game",       label:"vs AI",         icon:"🤖",  color:"#c084fc" },
  { key:"survival_solo", label:"Solo Survival", icon:"🛡️",  color:"#60a5fa" },
  { key:"survival_team", label:"Team Arena",    icon:"👥",  color:"#f472b6" },
];
const RT_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  playing:   { bg:"rgba(0,255,136,0.12)",   color:"#00ff88" },
  finished:  { bg:"rgba(96,165,250,0.12)",  color:"#60a5fa" },
  abandoned: { bg:"rgba(255,107,107,0.12)", color:"#f87171" },
  forming:   { bg:"rgba(251,191,36,0.12)",  color:"#fbbf24" },
};
const RT_TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  multiplayer_wager: { bg:"rgba(251,191,36,0.15)",  color:"#fbbf24" },
  multiplayer_free:  { bg:"rgba(52,211,153,0.15)",  color:"#34d399" },
  ai_game:           { bg:"rgba(192,132,252,0.15)", color:"#c084fc" },
  survival_solo:     { bg:"rgba(96,165,250,0.15)",  color:"#60a5fa" },
  survival_team:     { bg:"rgba(244,114,182,0.15)", color:"#f472b6" },
};
const RT_TYPE_LABELS: Record<string, string> = {
  multiplayer_wager:"💰 Wager MP", multiplayer_free:"🤝 Free MP",
  ai_game:"🤖 vs AI", survival_solo:"🛡️ Solo", survival_team:"👥 Team Arena",
};

function fmtDate(d: string|Date|null) {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("en-IN",{day:"2-digit",month:"short"}) + " " + dt.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});
}

// ── Referrals Section ─────────────────────────────────────────────────────────
function ReferralsSection() {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [tab, setTab] = React.useState<"events" | "leaderboard">("events");

  React.useEffect(() => {
    admin.getReferrals()
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <p className="text-dark-muted animate-pulse text-sm">Loading referrals…</p>
    </div>
  );

  const stats = data?.stats ?? {};
  const events: any[] = data?.referralEvents ?? [];
  const topReferrers: any[] = data?.topReferrers ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-white">🤝 Referral Programme</h2>
        <span className="text-xs px-3 py-1 rounded-full font-bold" style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }}>
          ₹50 referrer · ₹30 referred
        </span>
      </div>

      {/* ── Stats cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: "Total Referrals",   value: stats.totalReferrals   ?? 0,                      icon: "👥", color: "#60a5fa" },
          { label: "Rewards Paid",      value: stats.paidReferrals    ?? 0,                      icon: "✅", color: "#34d399" },
          { label: "Pending Reward",    value: stats.pendingReferrals ?? 0,                      icon: "⏳", color: "#fbbf24" },
          { label: "Total Paid Out",    value: `₹${stats.totalPaidOut ?? 0}`,                   icon: "💸", color: "#f87171" },
          { label: "Referrer Bonuses",  value: `₹${stats.totalReferrerPayout ?? 0}`,            icon: "🎁", color: "#a78bfa" },
          { label: "Referred Bonuses",  value: `₹${stats.totalReferredPayout ?? 0}`,            icon: "🌟", color: "#fb923c" },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4" style={cardStyle}>
            <p className="text-xl mb-1">{s.icon}</p>
            <p className="text-xl font-black" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[10px] text-dark-muted mt-0.5 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Tab toggle ──────────────────────────────────────────────────── */}
      <div className="flex gap-2 p-1 rounded-xl w-fit" style={{ background: "rgba(255,255,255,0.04)" }}>
        {(["events", "leaderboard"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all capitalize"
            style={tab === t
              ? { background: "rgba(52,211,153,0.18)", color: "#34d399", border: "1px solid rgba(52,211,153,0.35)" }
              : { color: "rgba(255,255,255,0.35)" }}>
            {t === "events" ? "📋 All Referrals" : "🏆 Top Referrers"}
          </button>
        ))}
      </div>

      {/* ── All Referrals table ─────────────────────────────────────────── */}
      {tab === "events" && (
        <div className="rounded-2xl overflow-hidden" style={cardStyle}>
          {events.length === 0 ? (
            <p className="text-center text-dark-muted text-sm py-10">No referrals yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    {["Referred User", "Referred By", "Code", "Joined", "Reward", "Status"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                      className="hover:bg-white/[0.015] transition-colors">
                      {/* Referred user */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar avatar={ev.referredAvatar} size="sm" />
                          <span className="font-semibold text-white text-xs">{ev.referredUsername}</span>
                        </div>
                      </td>
                      {/* Referrer */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar avatar={ev.referrerAvatar} size="sm" />
                          <span className="font-semibold text-xs" style={{ color: "#34d399" }}>{ev.referrerUsername}</span>
                        </div>
                      </td>
                      {/* Code */}
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-lg" style={{ background: "rgba(52,211,153,0.1)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }}>
                          {ev.referralCode}
                        </span>
                      </td>
                      {/* Joined */}
                      <td className="px-4 py-3 text-xs text-dark-muted whitespace-nowrap">
                        {ev.joinedAt ? new Date(ev.joinedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                      </td>
                      {/* Reward paid */}
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {ev.rewardPaid ? (
                          <span style={{ color: "#fbbf24" }}>₹50 + ₹30</span>
                        ) : (
                          <span style={{ color: "rgba(255,255,255,0.3)" }}>Awaiting deposit</span>
                        )}
                      </td>
                      {/* Status badge */}
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={ev.rewardPaid
                            ? { background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }
                            : { background: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)" }}>
                          {ev.rewardPaid ? "✓ Paid" : "⏳ Pending"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Top Referrers leaderboard ───────────────────────────────────── */}
      {tab === "leaderboard" && (
        <div className="rounded-2xl overflow-hidden" style={cardStyle}>
          {topReferrers.length === 0 ? (
            <p className="text-center text-dark-muted text-sm py-10">No referrers yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    {["Rank", "Player", "Code", "Friends Joined", "Total Earned"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topReferrers.map((r, i) => (
                    <tr key={r.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                      className="hover:bg-white/[0.015] transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-lg font-black" style={{ color: i === 0 ? "#fbbf24" : i === 1 ? "#9ca3af" : i === 2 ? "#b45309" : "rgba(255,255,255,0.3)" }}>
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar avatar={r.avatar} size="sm" />
                          <span className="font-semibold text-white text-xs">{r.username}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-lg" style={{ background: "rgba(52,211,153,0.1)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }}>
                          {r.referralCode}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-black" style={{ color: "#60a5fa" }}>{r.referralCount}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-black" style={{ color: "#fbbf24" }}>₹{r.totalEarned}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RoomTrackerSection() {
  const [items,    setItems]    = React.useState<any[]>([]);
  const [total,    setTotal]    = React.useState(0);
  const [page,     setPage]     = React.useState(1);
  const [pages,    setPages]    = React.useState(1);
  const [loading,  setLoading]  = React.useState(true);
  const [type,     setType]     = React.useState("all");
  const [status,   setStatus]   = React.useState("all");
  const [days,     setDays]     = React.useState(30);
  const [search,   setSearch]   = React.useState("");
  const [draftSearch, setDraftSearch] = React.useState("");
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [refunding,    setRefunding]    = React.useState<string | null>(null);
  const [refundingAll, setRefundingAll] = React.useState<string | null>(null);
  const [toast,    setToast]    = React.useState<{ ok: boolean; msg: string } | null>(null);
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null);

  const copyCode = (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    e.preventDefault();
    const text = String(code);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    } else {
      const el = document.createElement('textarea');
      el.value = text; el.style.position = 'fixed'; el.style.opacity = '0';
      document.body.appendChild(el); el.select();
      document.execCommand('copy'); document.body.removeChild(el);
    }
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const showToast = (ok: boolean, msg: string) => { setToast({ ok, msg }); setTimeout(() => setToast(null), 3500); };

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await admin.getRoomHistory({ page, type, status, days, search });
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
      setPages(data.pages ?? 1);
    } catch { showToast(false, "Failed to load room history"); }
    finally { setLoading(false); }
  }, [page, type, status, days, search]);

  React.useEffect(() => { load(); }, [load]);

  const handleTypeChange = (t: string) => { setType(t); setPage(1); setExpanded(null); };
  const handleStatusChange = (s: string) => { setStatus(s); setPage(1); };
  const handleDaysChange = (d: number) => { setDays(d); setPage(1); };
  const handleSearch = () => { setSearch(draftSearch); setPage(1); };

  const doRefund = async (userId: string, amount: number, roomCode: string, username: string, itemId: string) => {
    if (!confirm(`Refund ₹${amount} to ${username} for room ${roomCode}?`)) return;
    setRefunding(`${itemId}-${userId}`);
    try {
      const r = await admin.repayMissedPayout({ userId, amount, roomCode, note: "Admin refund via Room Tracker" });
      showToast(true, `₹${amount} refunded to ${r.data.username}`);
      load();
    } catch (e: any) {
      showToast(false, e?.response?.data?.error ?? "Refund failed");
    } finally { setRefunding(null); }
  };

  const doRefundAll = async (item: any) => {
    const humanPlayers = (item.players ?? []).filter((p: any) => !p.isBot);
    const perPlayerFees: Record<string, number> = item.perPlayerFees ?? {};
    const alreadyRefundedIds = new Set(
      (item.list ?? []).filter((t: any) => t.type === "refund").map((t: any) => t.userId)
    );
    const toRefund = humanPlayers
      .map((p: any) => ({ userId: p.userId, username: p.username, amount: perPlayerFees[p.userId] ?? 0 }))
      .filter((r: { userId: string; username: string; amount: number }) => r.amount > 0 && !alreadyRefundedIds.has(r.userId));

    if (toRefund.length === 0) { showToast(false, "No refundable amounts found"); return; }

    const total = toRefund.reduce((s: number, r: { amount: number }) => s + r.amount, 0);
    const names = toRefund.map((r: { username: string; amount: number }) => `${r.username} ₹${r.amount}`).join(", ");
    if (!confirm(`Refund ALL players for room ${item.roomCode}?\n\n${names}\n\nTotal: ₹${total}`)) return;

    setRefundingAll(item.id);
    let ok = 0, fail = 0;
    for (const { userId, username, amount } of toRefund) {
      try {
        await admin.repayMissedPayout({ userId, amount, roomCode: item.roomCode, note: "Admin bulk refund via Room Tracker" });
        ok++;
      } catch { fail++; }
    }
    setRefundingAll(null);
    showToast(fail === 0, fail === 0 ? `₹${total} refunded to ${ok} player${ok > 1 ? "s" : ""}` : `${ok} refunded, ${fail} failed`);
    load();
  };

  const toggleExpand = (id: string) => setExpanded(prev => prev === id ? null : id);

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">🗂️ Room Tracker</h2>
          <p className="text-xs text-dark-muted mt-0.5">Full session history — players · rounds · amounts · refunds</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl text-xs font-bold"
            style={{ background:"rgba(255,255,255,0.04)", color:"#9ca3af", border:"1px solid rgba(255,255,255,0.08)" }}>
            {total.toLocaleString()} rooms
          </div>
          <button onClick={load} className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all hover:scale-105"
            style={{ background:"rgba(99,102,241,0.15)", color:"#818cf8", border:"1px solid rgba(99,102,241,0.3)" }}>
            ↺ Refresh
          </button>
        </div>
      </div>

      {/* ── Type tabs ── */}
      <div className="flex flex-wrap gap-2">
        {RT_TYPE_TABS.map(tab => (
          <button key={tab.key} onClick={() => handleTypeChange(tab.key)}
            className="px-3.5 py-2 rounded-xl text-[11px] font-bold transition-all hover:scale-105"
            style={{
              background: type === tab.key ? `${tab.color}20` : "rgba(255,255,255,0.04)",
              color: type === tab.key ? tab.color : "#6b7280",
              border: `1px solid ${type === tab.key ? `${tab.color}50` : "rgba(255,255,255,0.07)"}`,
              boxShadow: type === tab.key ? `0 0 12px ${tab.color}20` : "none",
            }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-2xl" style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.05)" }}>
        <span className="text-[10px] font-bold text-dark-muted uppercase tracking-widest mr-1">Status</span>
        {(["all","finished","playing","abandoned","no_result"] as const).map(s => (
          <button key={s} onClick={() => handleStatusChange(s)}
            className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors capitalize"
            style={{
              background: status === s ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.04)",
              color: status === s ? "#a5b4fc" : "#6b7280",
              border: `1px solid ${status === s ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.06)"}`,
            }}>
            {s === "no_result" ? "⚠ No Payout" : s === "all" ? "All" : s}
          </button>
        ))}
        <div className="w-px h-4 bg-white/10 mx-1" />
        <span className="text-[10px] font-bold text-dark-muted uppercase tracking-widest mr-1">Period</span>
        {([7,30,0] as const).map(d => (
          <button key={d} onClick={() => handleDaysChange(d)}
            className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors"
            style={{
              background: days === d ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.04)",
              color: days === d ? "#a5b4fc" : "#6b7280",
              border: `1px solid ${days === d ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.06)"}`,
            }}>
            {d === 0 ? "All Time" : `${d}d`}
          </button>
        ))}
        <div className="w-px h-4 bg-white/10 mx-1" />
        <div className="flex items-center gap-1 ml-auto">
          <input value={draftSearch} onChange={e => setDraftSearch(e.target.value)}
            onKeyDown={e => e.key==="Enter" && handleSearch()}
            placeholder="🔍 Room code / player…"
            className="text-[11px] px-3 py-1.5 rounded-xl outline-none w-44"
            style={{ background:"rgba(255,255,255,0.06)", color:"#e5e7eb", border:"1px solid rgba(255,255,255,0.1)" }}
          />
          <button onClick={handleSearch} className="px-3 py-1.5 rounded-xl text-[10px] font-bold"
            style={{ background:"rgba(99,102,241,0.2)", color:"#818cf8", border:"1px solid rgba(99,102,241,0.3)" }}>
            Go
          </button>
          {search && <button onClick={() => { setSearch(""); setDraftSearch(""); }} className="text-[10px] text-dark-muted hover:text-white px-1">✕</button>}
        </div>
      </div>

      {/* ── Room List ── */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
            <p className="text-xs text-dark-muted">Loading rooms…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 rounded-2xl"
            style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.05)" }}>
            <span className="text-4xl opacity-30">🗂️</span>
            <p className="text-dark-muted text-sm">No rooms match these filters</p>
          </div>
        ) : (
          <>
            {items.map(item => {
              const isOpen   = expanded === item.id;
              const tc       = RT_TYPE_COLORS[item.type] ?? { bg:"rgba(255,255,255,0.06)", color:"#9ca3af" };
              const sc       = RT_STATUS_COLORS[item.status] ?? { bg:"rgba(255,255,255,0.04)", color:"#9ca3af" };
              const humanPlayers = (item.players ?? []).filter((p: any) => !p.isBot);
              const botPlayers   = (item.players ?? []).filter((p: any) => p.isBot);
              const isAI     = item.type === "ai_game";
              const isSolo   = item.type === "survival_solo";
              const isTeam   = item.type === "survival_team";
              const isWager  = item.type === "multiplayer_wager";
              const isFreeMP = item.type === "multiplayer_free";
              // Survival prizes are intentionally partial (platform keeps the rake) — never "unsettled"
              const isSurvival = isSolo || isTeam;
              const hasIssue = !isSurvival && item.hasRefundIssue;
              const unsettled = isSurvival ? 0 : item.totalFees - item.totalPaid - item.totalRefunded;

              return (
                <React.Fragment key={item.id}>
                  {/* ── Collapsed Row ── */}
                  <div
                    className="rounded-2xl overflow-hidden cursor-pointer transition-all"
                    style={{
                      background: isOpen
                        ? `linear-gradient(135deg, rgba(15,12,35,0.98), rgba(10,8,28,0.99))`
                        : `linear-gradient(135deg, rgba(12,10,28,0.95), rgba(8,6,20,0.97))`,
                      border: isOpen ? `1px solid ${tc.color}40` : "1px solid rgba(255,255,255,0.07)",
                      boxShadow: isOpen ? `0 0 24px ${tc.color}10, 0 4px 12px rgba(0,0,0,0.3)` : "0 2px 8px rgba(0,0,0,0.2)",
                    }}
                    onClick={() => toggleExpand(item.id)}>
                    {/* Accent bar */}
                    <div style={{ height: 2, background: `linear-gradient(90deg, ${tc.color}cc, ${tc.color}10)` }} />

                    <div className="px-4 py-3.5">
                      <div className="flex items-start gap-3 flex-wrap">

                      {/* Left */}
                      <div className="flex-1 min-w-0 space-y-2">
                        {/* Title row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-black text-sm tracking-widest"
                            style={{ color: tc.color, textShadow: `0 0 12px ${tc.color}60` }}>
                            {item.roomCode}
                          </span>
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                            style={{ background: tc.bg, color: tc.color, border: `1px solid ${tc.color}40` }}>
                            {RT_TYPE_LABELS[item.type] ?? item.type}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize"
                            style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.color}40` }}>
                            {item.status === "playing" ? "▶ Live" : item.status}
                          </span>
                          {item.tier && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
                              style={{ background:"rgba(167,139,250,0.12)", color:"#a78bfa", border:"1px solid rgba(167,139,250,0.25)" }}>
                              {item.tier}
                            </span>
                          )}
                          {isTeam && item.entryFeeMode && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ background:"rgba(244,114,182,0.12)", color:"#f472b6", border:"1px solid rgba(244,114,182,0.25)" }}>
                              {item.entryFeeMode === "host_pays" ? "🎯 Host Pays" : "🤝 Split"}
                            </span>
                          )}
                          {hasIssue && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse"
                              style={{ background:"rgba(251,191,36,0.18)", color:"#fbbf24", border:"1px solid rgba(251,191,36,0.4)", boxShadow:"0 0 8px rgba(251,191,36,0.2)" }}>
                              ⚠ Unpaid
                            </span>
                          )}
                          <span className="text-[10px] ml-auto" style={{ color:"#4b5563" }}>{fmtDate(item.startedAt)}</span>
                        </div>

                        {/* Players row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {humanPlayers.slice(0,6).map((p: any) => (
                            <div key={p.userId} className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                              style={{
                                background: p.isWinner ? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.04)",
                                border: p.isWinner ? "1px solid rgba(251,191,36,0.3)" : "1px solid rgba(255,255,255,0.07)",
                              }}>
                              <Avatar avatar={p.avatar} size="xs" />
                              <span className="text-[11px] font-semibold" style={{ color: p.isWinner ? "#fbbf24" : "#d1d5db" }}>
                                {p.username}{p.isWinner ? " 👑" : ""}
                              </span>
                            </div>
                          ))}
                          {botPlayers.length > 0 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                              style={{ background:"rgba(192,132,252,0.1)", color:"#c084fc", border:"1px solid rgba(192,132,252,0.2)" }}>
                              🤖 {botPlayers.length} bot{botPlayers.length>1?"s":""}
                            </span>
                          )}
                          {humanPlayers.length > 6 && <span className="text-[10px] text-dark-muted">+{humanPlayers.length-6} more</span>}
                        </div>

                        {/* Quick stats row */}
                        <div className="flex items-center gap-2 flex-wrap text-[10px]">
                          {(isAI || isWager || isFreeMP) && item.roundCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full" style={{ background:"rgba(255,255,255,0.05)", color:"#9ca3af", border:"1px solid rgba(255,255,255,0.08)" }}>
                              🎲 <span className="text-white font-bold">{item.roundCount}</span> rounds
                            </span>
                          )}
                          {item.winner && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full font-bold"
                              style={{ background:"rgba(251,191,36,0.12)", color:"#fbbf24", border:"1px solid rgba(251,191,36,0.25)" }}>
                              👑 {item.winner.username}
                            </span>
                          )}
                          {(isAI || isWager || isFreeMP) && (item.players??[]).filter((p:any)=>!p.isBot).length > 0 && (
                            <span style={{ color:"#6b7280" }}>
                              Scores: {(item.players??[]).filter((p:any)=>!p.isBot).map((p:any)=>(
                                <span key={p.userId} className="font-bold mx-0.5" style={{ color: p.isWinner?"#fbbf24":"#9ca3af" }}>
                                  {p.username} {p.score}
                                </span>
                              ))}
                            </span>
                          )}
                          {isWager && item.entryFee > 0 && (
                            <span className="px-2 py-0.5 rounded-full" style={{ background:"rgba(251,191,36,0.08)", color:"#fbbf24", border:"1px solid rgba(251,191,36,0.2)" }}>
                              Entry ₹{item.entryFee}
                            </span>
                          )}
                          {isWager && item.totalPaid > 0 && (
                            <span className="px-2 py-0.5 rounded-full font-bold" style={{ background:"rgba(0,255,136,0.08)", color:"#00ff88", border:"1px solid rgba(0,255,136,0.2)" }}>
                              +₹{item.totalPaid} paid
                            </span>
                          )}
                          {(isSolo || isTeam) && item.entryPoints > 0 && (
                            <span className="px-2 py-0.5 rounded-full" style={{ background:"rgba(192,132,252,0.08)", color:"#c084fc", border:"1px solid rgba(192,132,252,0.2)" }}>
                              Entry {item.entryPoints} pts
                            </span>
                          )}
                          {(isSolo || isTeam) && item.pot > 0 && (
                            <span className="px-2 py-0.5 rounded-full font-bold" style={{ background:"rgba(0,255,136,0.08)", color:"#00ff88", border:"1px solid rgba(0,255,136,0.2)" }}>
                              +{item.pot} pts won
                            </span>
                          )}
                          {(isSolo || isTeam) && (item.stageResults??[]).length > 0 && (
                            <span className="px-2 py-0.5 rounded-full" style={{ background:"rgba(255,255,255,0.05)", color:"#9ca3af", border:"1px solid rgba(255,255,255,0.08)" }}>
                              Stages: <span className="font-bold text-white">{(item.stageResults??[]).filter((s:any)=>s.teamWon??s.playerWon).length}</span>
                              <span style={{ color:"#6b7280" }}>/{(item.stageResults??[]).length}</span>
                            </span>
                          )}
                          {isAI && (
                            <span className="px-2 py-0.5 rounded-full" style={{ background:"rgba(192,132,252,0.08)", color:"#c084fc", border:"1px solid rgba(192,132,252,0.2)" }}>
                              vs {botPlayers.length} AI bot{botPlayers.length>1?"s":""}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {unsettled > 0 && (
                          <button onClick={e => { e.stopPropagation(); doRefundAll(item); }}
                            disabled={!!refundingAll}
                            className="text-[11px] px-3 py-1.5 rounded-xl font-black disabled:opacity-40 whitespace-nowrap transition-all hover:scale-105"
                            style={{ background:"rgba(0,255,136,0.18)", color:"#00ff88", border:"1px solid rgba(0,255,136,0.35)", boxShadow:"0 0 12px rgba(0,255,136,0.15)" }}>
                            {refundingAll === item.id ? "⏳…" : `↩ ₹${unsettled}`}
                          </button>
                        )}
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                          style={{ background: isOpen ? `${tc.color}20` : "rgba(255,255,255,0.05)", color: isOpen ? tc.color : "#6b7280", border: `1px solid ${isOpen ? tc.color+"40" : "rgba(255,255,255,0.08)"}` }}>
                          <span className="text-[10px]">{isOpen ? "▲" : "▼"}</span>
                        </div>
                      </div>
                    </div>
                    </div>
                  </div>

                  {/* ── Expanded Detail ── */}
                  {isOpen && (
                    <div className="rounded-2xl overflow-hidden mt-1"
                      style={{ background:"linear-gradient(160deg,rgba(12,10,28,0.98),rgba(8,6,20,0.99))", border:`1px solid ${tc.color}30`, boxShadow:`0 4px 20px rgba(0,0,0,0.4)` }}>
                      <div style={{ height:1, background:`linear-gradient(90deg,${tc.color}80,transparent)` }} />
                      <div className="px-4 py-4 space-y-5">

                        {/* ── Game Info Banner ── */}
                        <div className="rounded-2xl p-4 flex flex-wrap gap-4"
                          style={{ background:`${tc.bg.replace("0.15","0.06")}`, border:`1px solid ${tc.color}25` }}>
                          <div>
                            <p className="text-[9px] font-black text-dark-muted uppercase tracking-widest mb-0.5">Game Type</p>
                            <p className="text-sm font-black" style={{ color:tc.color }}>{RT_TYPE_LABELS[item.type] ?? item.type}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-black text-dark-muted uppercase tracking-widest mb-0.5">Status</p>
                            <p className="text-sm font-black capitalize" style={{ color:sc.color }}>{item.status}</p>
                          </div>
                          {item.tier && (
                            <div>
                              <p className="text-[9px] font-black text-dark-muted uppercase tracking-widest mb-0.5">Tier</p>
                              <p className="text-sm font-black capitalize text-white">{item.tier}</p>
                            </div>
                          )}
                          {isTeam && (
                            <div>
                              <p className="text-[9px] font-black text-dark-muted uppercase tracking-widest mb-0.5">Entry Mode</p>
                              <p className="text-sm font-black" style={{ color:"#f472b6" }}>
                                {item.entryFeeMode === "host_pays" ? "🎯 Host Pays Full" : "🤝 Split Between Members"}
                              </p>
                            </div>
                          )}
                          <div>
                            <p className="text-[9px] font-black text-dark-muted uppercase tracking-widest mb-0.5">Started</p>
                            <p className="text-sm font-bold text-white">{fmtDate(item.startedAt)}</p>
                          </div>
                          {item.endedAt && (
                            <div>
                              <p className="text-[9px] font-black text-dark-muted uppercase tracking-widest mb-0.5">Ended</p>
                              <p className="text-sm font-bold text-white">{fmtDate(item.endedAt)}</p>
                            </div>
                          )}
                          {item.roundCount > 0 && (
                            <div>
                              <p className="text-[9px] font-black text-dark-muted uppercase tracking-widest mb-0.5">Rounds Played</p>
                              <p className="text-sm font-black text-white">{item.roundCount}</p>
                            </div>
                          )}
                          {(isSolo || isTeam) && (item.stageResults??[]).length > 0 && (
                            <div>
                              <p className="text-[9px] font-black text-dark-muted uppercase tracking-widest mb-0.5">Stages</p>
                              <p className="text-sm font-black text-white">
                                {(item.stageResults??[]).filter((s:any)=>s.teamWon??s.playerWon).length}
                                <span className="text-dark-muted text-xs font-normal"> / {(item.stageResults??[]).length} won</span>
                              </p>
                            </div>
                          )}
                          {/* Winner card */}
                          {item.winner && (
                            <div className="ml-auto px-4 py-2 rounded-xl flex items-center gap-2"
                              style={{ background:"rgba(251,191,36,0.12)", border:"1px solid rgba(251,191,36,0.3)" }}>
                              <span className="text-lg">👑</span>
                              <div>
                                <p className="text-[9px] font-black text-yellow-400/60 uppercase tracking-widest">Winner</p>
                                <p className="text-sm font-black" style={{ color:"#fbbf24" }}>{item.winner.username}</p>
                                {(() => { const wp = (item.players??[]).find((p:any)=>p.isWinner); return wp ? <p className="text-[10px] text-dark-muted">Score: {wp.score}</p> : null; })()}
                              </div>
                            </div>
                          )}
                        </div>


                        {/* ── Financials ── */}
                        {(item.totalFees > 0 || item.totalPaid > 0 || item.entryPoints > 0 || item.pot > 0) && (
                          <div>
                            <p className="text-[11px] font-black text-white mb-2.5 flex items-center gap-1.5">
                              💰 <span>Financials</span>
                              {item.totalFees > 0 && (
                                <span className="ml-2 text-[9px] font-semibold px-2 py-0.5 rounded-full"
                                  style={{ background: item.totalPaid>0||item.totalRefunded>=item.totalFees ? "rgba(0,255,136,0.12)" : "rgba(251,191,36,0.12)", color: item.totalPaid>0||item.totalRefunded>=item.totalFees ? "#00ff88" : "#fbbf24" }}>
                                  {item.totalPaid>0 ? "✅ Settled" : item.totalRefunded>=item.totalFees ? "↩ Refunded" : "⚠ Unsettled"}
                                </span>
                              )}
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {item.entryPoints > 0 && (
                                <div className="rounded-xl p-3" style={{ background:"rgba(192,132,252,0.08)", border:"1px solid rgba(192,132,252,0.2)" }}>
                                  <p className="text-[9px] text-dark-muted uppercase font-bold tracking-wide mb-1">Entry</p>
                                  <p className="text-base font-black" style={{ color:"#c084fc" }}>{item.entryPoints} pts</p>
                                  {isTeam && item.entryFeeMode && (
                                    <p className="text-[9px] text-dark-muted mt-0.5">{item.entryFeeMode==="host_pays"?"host paid":"split"}</p>
                                  )}
                                </div>
                              )}
                              {item.entryFee > 0 && (
                                <div className="rounded-xl p-3" style={{ background:"rgba(251,191,36,0.08)", border:"1px solid rgba(251,191,36,0.2)" }}>
                                  <p className="text-[9px] text-dark-muted uppercase font-bold tracking-wide mb-1">Entry Fee</p>
                                  <p className="text-base font-black" style={{ color:"#fbbf24" }}>₹{item.entryFee}</p>
                                </div>
                              )}
                              {item.totalFees > 0 && (
                                <div className="rounded-xl p-3" style={{ background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.2)" }}>
                                  <p className="text-[9px] text-dark-muted uppercase font-bold tracking-wide mb-1">Fees Collected</p>
                                  <p className="text-base font-black" style={{ color:"#f87171" }}>₹{item.totalFees}</p>
                                </div>
                              )}
                              {(item.totalPaid > 0 || item.pot > 0) && (
                                <div className="rounded-xl p-3" style={{ background:"rgba(0,255,136,0.08)", border:"1px solid rgba(0,255,136,0.2)" }}>
                                  <p className="text-[9px] text-dark-muted uppercase font-bold tracking-wide mb-1">{item.totalFees>0?"Prize Paid":"Points Won"}</p>
                                  <p className="text-base font-black" style={{ color:"#00ff88" }}>
                                    {item.totalFees>0 ? `₹${item.totalPaid}` : `${item.pot} pts`}
                                  </p>
                                </div>
                              )}
                              {item.totalRefunded > 0 && (
                                <div className="rounded-xl p-3" style={{ background:"rgba(96,165,250,0.08)", border:"1px solid rgba(96,165,250,0.2)" }}>
                                  <p className="text-[9px] text-dark-muted uppercase font-bold tracking-wide mb-1">Refunded</p>
                                  <p className="text-base font-black" style={{ color:"#60a5fa" }}>₹{item.totalRefunded}</p>
                                </div>
                              )}
                              {unsettled > 0 && (
                                <div className="rounded-xl p-3" style={{ background:"rgba(251,191,36,0.08)", border:"1px solid rgba(251,191,36,0.3)" }}>
                                  <p className="text-[9px] text-dark-muted uppercase font-bold tracking-wide mb-1">Unsettled</p>
                                  <p className="text-base font-black" style={{ color:"#fbbf24" }}>₹{unsettled}</p>
                                </div>
                              )}
                              {/* User Net P&L */}
                              {(item.totalFees > 0 || isSurvival) && (() => {
                                // User paid fees, received prize — their net outcome
                                const userPnl = item.totalPaid + item.totalRefunded - item.totalFees;
                                const uc = userPnl > 0 ? "#00ff88" : userPnl < 0 ? "#f87171" : "#9ca3af";
                                const ub = userPnl > 0 ? "rgba(0,255,136,0.08)" : userPnl < 0 ? "rgba(248,113,113,0.08)" : "rgba(255,255,255,0.04)";
                                const ubr= userPnl > 0 ? "rgba(0,255,136,0.2)" : userPnl < 0 ? "rgba(248,113,113,0.2)" : "rgba(255,255,255,0.08)";
                                return (
                                  <div className="rounded-xl p-3" style={{ background:ub, border:`1px solid ${ubr}` }}>
                                    <p className="text-[9px] text-dark-muted uppercase font-bold tracking-wide mb-1">User P&L</p>
                                    <p className="text-base font-black" style={{ color:uc }}>
                                      {userPnl >= 0 ? "+" : ""}₹{userPnl.toFixed(2)}
                                    </p>
                                  </div>
                                );
                              })()}
                              {/* Platform P&L */}
                              {(item.totalFees > 0 || isSurvival) && (() => {
                                const pnl = item.totalFees - item.totalPaid - item.totalRefunded;
                                const pnlColor = pnl > 0 ? "#00ff88" : pnl < 0 ? "#f87171" : "#9ca3af";
                                const pnlBg    = pnl > 0 ? "rgba(0,255,136,0.08)" : pnl < 0 ? "rgba(248,113,113,0.08)" : "rgba(255,255,255,0.04)";
                                const pnlBorder= pnl > 0 ? "rgba(0,255,136,0.2)" : pnl < 0 ? "rgba(248,113,113,0.2)" : "rgba(255,255,255,0.08)";
                                return (
                                  <div className="rounded-xl p-3" style={{ background:pnlBg, border:`1px solid ${pnlBorder}` }}>
                                    <p className="text-[9px] text-dark-muted uppercase font-bold tracking-wide mb-1">Platform P&L</p>
                                    <p className="text-base font-black" style={{ color:pnlColor }}>
                                      {pnl >= 0 ? "+" : ""}₹{pnl.toFixed(2)}
                                    </p>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        )}

                        {/* ── Players ── */}
                        <div>
                          <p className="text-[11px] font-black text-white mb-2.5">👥 Players</p>
                          <div className="space-y-1.5">
                            {(isTeam ? (item.allMembers ?? item.players ?? []) : (item.players ?? [])).map((p: any) => {
                              const perFee = item.perPlayerFees?.[p.userId] ?? 0;
                              const isHost = isTeam && p.userId === item.hostId;
                              return (
                                <div key={p.userId || p.username}
                                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[11px]"
                                  style={{
                                    background: p.isWinner ? "rgba(251,191,36,0.07)" : p.isBot ? "rgba(192,132,252,0.05)" : "rgba(255,255,255,0.03)",
                                    border: `1px solid ${p.isWinner ? "rgba(251,191,36,0.2)" : p.isBot ? "rgba(192,132,252,0.15)" : "rgba(255,255,255,0.05)"}`,
                                  }}>
                                  <Avatar avatar={p.avatar} size="xs" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-bold" style={{ color: p.isWinner ? "#fbbf24" : p.isBot ? "#c084fc" : "#d1d5db" }}>
                                        {p.isBot ? "🤖 " : ""}{p.username}
                                      </span>
                                      {p.isWinner && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md" style={{ background:"rgba(251,191,36,0.2)", color:"#fbbf24" }}>👑 WINNER</span>}
                                      {isHost && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md" style={{ background:"rgba(244,114,182,0.15)", color:"#f472b6" }}>HOST</span>}
                                      {p.isBot && p.personality && <span className="text-[9px] text-dark-muted capitalize">({p.personality})</span>}
                                    </div>
                                  </div>
                                  {p.score > 0 && <span className="text-dark-muted text-[10px]">Score: <span className="text-white font-semibold">{p.score}</span></span>}
                                  {!p.isBot && perFee > 0 && <span className="text-[10px] font-semibold" style={{ color:"#f87171" }}>Paid ₹{perFee}</span>}
                                  {!p.isBot && !isSurvival && (item.entryFee > 0 || perFee > 0) && (
                                    <button disabled={!!refunding}
                                      onClick={e => { e.stopPropagation(); doRefund(p.userId, perFee||item.entryFee, item.roomCode, p.username, item.id); }}
                                      className="text-[10px] px-2.5 py-1 rounded-lg font-bold disabled:opacity-40 whitespace-nowrap transition-all hover:scale-105"
                                      style={{ background:"rgba(0,255,136,0.12)", color:"#00ff88", border:"1px solid rgba(0,255,136,0.25)" }}>
                                      {refunding === `${item.id}-${p.userId}` ? "⏳" : `↩ ₹${perFee||item.entryFee}`}
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* ── Rounds (Game) ── */}
                        {(item.rounds ?? []).length > 0 && (
                          <div>
                            <p className="text-[11px] font-black text-white mb-2.5">
                              🎲 All Rounds
                              <span className="ml-2 text-[10px] font-normal text-dark-muted">({item.rounds.length} total)</span>
                            </p>
                            <div className="grid gap-2" style={{ gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))" }}>
                              {(item.rounds ?? []).map((r: any) => {
                                const won = r.showPlayerWon;
                                return (
                                  <div key={r.roundNumber} className="rounded-xl p-3 space-y-1.5"
                                    style={{
                                      background: won ? "rgba(0,255,136,0.05)" : "rgba(248,113,113,0.05)",
                                      border: `1px solid ${won ? "rgba(0,255,136,0.2)" : "rgba(248,113,113,0.2)"}`,
                                    }}>
                                    <div className="flex items-center justify-between">
                                      <span className="text-[11px] font-black text-white">R{r.roundNumber}</span>
                                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md"
                                        style={{ background: won ? "rgba(0,255,136,0.2)" : "rgba(248,113,113,0.2)", color: won ? "#00ff88" : "#f87171" }}>
                                        {won ? "WIN" : "FAIL"}
                                      </span>
                                    </div>
                                    <div className="text-[10px] space-y-0.5">
                                      <p className="text-dark-muted">Joker: <span className="font-black text-yellow-400">{r.jokerRank}</span></p>
                                      {r.winnerUsername && (
                                        <p className="text-dark-muted">Winner: <span className="font-bold" style={{ color:"#fbbf24" }}>{r.winnerIsBot?"🤖 ":""}{r.winnerUsername}</span></p>
                                      )}
                                      {r.showCallerUsername && (
                                        <p className="text-dark-muted">Show: <span style={{ color: won?"#00ff88":"#f87171" }}>{r.showCallerIsBot?"🤖 ":""}{r.showCallerUsername}</span></p>
                                      )}
                                      {(r.playerScores ?? []).length > 0 && (
                                        <div className="mt-1 pt-1 border-t border-white/5 space-y-0.5">
                                          {(r.playerScores as any[]).map((ps: any) => (
                                            <p key={ps.username} className="text-[9px]" style={{ color: ps.isBot ? "#c084fc" : "#9ca3af" }}>
                                              {ps.isBot ? "🤖 " : ""}{ps.username}: <span className="font-bold text-white">{ps.roundPoints}pts</span>
                                              <span className="text-[8px] ml-1" style={{ color:"#4b5563" }}>(total {ps.totalScore})</span>
                                            </p>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* ── Stage Results (Survival) ── */}
                        {(item.stageResults ?? []).length > 0 && (
                          <div>
                            <p className="text-[11px] font-black text-white mb-3">
                              🏟️ Stage Results
                              <span className="ml-2 text-[10px] font-normal text-dark-muted">
                                ({(item.stageResults??[]).filter((s:any)=>s.teamWon??s.playerWon).length}/{(item.stageResults??[]).length} won)
                              </span>
                            </p>
                            <div className="space-y-3">
                              {(item.stageResults ?? []).map((s: any) => {
                                const stageWon = s.teamWon ?? s.playerWon;
                                const hasRounds = (s.rounds ?? []).length > 0;
                                // Winner/loser display
                                const stageWinnerName = stageWon
                                  ? (item.players?.[0]?.username ?? 'Player')
                                  : (s.botNames?.[0] ?? s.personality ?? 'Bot');
                                const stageWinnerIsBot = !stageWon;
                                // User pts P&L for this stage
                                const stagePts = s.pointsEarned ?? 0;
                                return (
                                  <div key={s.stage} className="rounded-2xl overflow-hidden"
                                    style={{
                                      background: stageWon ? "rgba(0,255,136,0.04)" : "rgba(248,113,113,0.04)",
                                      border: `1px solid ${stageWon ? "rgba(0,255,136,0.18)" : "rgba(248,113,113,0.18)"}`,
                                    }}>
                                    {/* Stage header */}
                                    <div className="flex items-center gap-3 px-4 py-3 flex-wrap"
                                      style={{ background: stageWon?"rgba(0,255,136,0.06)":"rgba(248,113,113,0.06)", borderBottom:`1px solid ${stageWon?"rgba(0,255,136,0.1)":"rgba(248,113,113,0.1)"}` }}>
                                      <span className="text-sm font-black text-white">Stage {s.stage}</span>
                                      {/* Game type */}
                                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                                        style={{ background: isSolo?"rgba(96,165,250,0.12)":"rgba(244,114,182,0.12)", color: isSolo?"#60a5fa":"#f472b6", border:`1px solid ${isSolo?"rgba(96,165,250,0.25)":"rgba(244,114,182,0.25)"}` }}>
                                        {isSolo ? "🛡️ Solo Survival" : "👥 Team Arena"}
                                      </span>
                                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                                        style={{ background: stageWon?"rgba(0,255,136,0.2)":"rgba(248,113,113,0.2)", color: stageWon?"#00ff88":"#f87171" }}>
                                        {stageWon ? "✅ WON" : "❌ LOST"}
                                      </span>
                                      {/* Winner */}
                                      <span className="text-[10px] font-bold flex items-center gap-1"
                                        style={{ color: stageWon?"#fbbf24":"#f87171" }}>
                                        👑 {stageWinnerIsBot ? "🤖 " : ""}{stageWinnerName}
                                      </span>
                                      {s.roomCode && (
                                        <button
                                          onClick={e => copyCode(e, s.roomCode)}
                                          title="Copy room code"
                                          className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 transition-all hover:opacity-70"
                                          style={{
                                            background: copiedCode === s.roomCode ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.06)",
                                            color: copiedCode === s.roomCode ? "#4ade80" : "#9ca3af",
                                            border: copiedCode === s.roomCode ? "1px solid rgba(74,222,128,0.3)" : "1px solid rgba(255,255,255,0.1)",
                                          }}>
                                          🔑 {copiedCode === s.roomCode ? "Copied!" : s.roomCode} <span style={{ fontSize:9 }}>⎘</span>
                                        </button>
                                      )}
                                      {/* User P&L for this stage */}
                                      <span className="font-black text-[11px]" style={{ color: stagePts > 0 ? "#00ff88" : "#f87171" }}>
                                        {stagePts > 0 ? `+${stagePts} pts` : stageWon ? "0 pts" : "−0 pts"}
                                      </span>
                                      {s.roomStartedAt && (
                                        <span className="text-[10px] text-dark-muted ml-auto">{fmtDate(s.roomStartedAt)}</span>
                                      )}
                                    </div>
                                    {/* Stage details */}
                                    <div className="px-4 py-3 space-y-3">
                                      {/* Scores */}
                                      <div className="flex flex-wrap gap-4 text-[11px]">
                                        {s.playerScore != null && (
                                          <span className="text-dark-muted">Player score: <span className="font-bold text-white">{s.playerScore}</span></span>
                                        )}
                                        {s.botScore != null && (
                                          <span className="text-dark-muted">Bot score: <span className="font-bold text-white">{s.botScore}</span></span>
                                        )}
                                        {s.teamScore != null && (
                                          <span className="text-dark-muted">Team score: <span className="font-bold text-white">{s.teamScore}</span></span>
                                        )}
                                        {s.botTotalScore != null && (
                                          <span className="text-dark-muted">Bot total: <span className="font-bold text-white">{s.botTotalScore}</span></span>
                                        )}
                                        {s.botNames?.length > 0 && (
                                          <span className="text-dark-muted">vs <span className="font-semibold" style={{ color:"#c084fc" }}>🤖 {s.botNames.join(", ")}</span></span>
                                        )}
                                      </div>
                                      {/* Rounds for this stage */}
                                      {hasRounds && (
                                        <div>
                                          <p className="text-[10px] font-bold text-dark-muted mb-2">🎲 Rounds ({s.rounds.length})</p>
                                          <div className="grid gap-1.5" style={{ gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))" }}>
                                            {(s.rounds ?? []).map((r: any) => {
                                              const rWon = r.showPlayerWon;
                                              return (
                                                <div key={r.roundNumber} className="rounded-xl p-2.5 space-y-1"
                                                  style={{
                                                    background: rWon?"rgba(0,255,136,0.05)":"rgba(248,113,113,0.05)",
                                                    border:`1px solid ${rWon?"rgba(0,255,136,0.15)":"rgba(248,113,113,0.15)"}`,
                                                  }}>
                                                  <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-black text-white">R{r.roundNumber}</span>
                                                    <span className="text-[9px] font-black px-1 py-0.5 rounded"
                                                      style={{ background:rWon?"rgba(0,255,136,0.2)":"rgba(248,113,113,0.2)", color:rWon?"#00ff88":"#f87171" }}>
                                                      {rWon?"WIN":"FAIL"}
                                                    </span>
                                                  </div>
                                                  <p className="text-[9px] text-dark-muted">Joker: <span className="font-bold text-yellow-400">{r.jokerRank}</span></p>
                                                  {r.winnerUsername && (
                                                    <p className="text-[9px] text-dark-muted">Win: <span className="font-semibold" style={{ color:"#fbbf24" }}>{r.winnerIsBot?"🤖 ":""}{r.winnerUsername}</span></p>
                                                  )}
                                                  {r.showCallerUsername && (
                                                    <p className="text-[9px] text-dark-muted">Show: <span style={{ color:rWon?"#00ff88":"#f87171" }}>{r.showCallerIsBot?"🤖 ":""}{r.showCallerUsername}</span></p>
                                                  )}
                                                  {(r.playerScores ?? []).length > 0 && (
                                                    <div className="mt-1 pt-1 border-t border-white/5 space-y-0.5">
                                                      {(r.playerScores as any[]).map((ps: any) => (
                                                        <p key={ps.username} className="text-[9px]" style={{ color: ps.isBot ? "#c084fc" : "#9ca3af" }}>
                                                          {ps.isBot ? "🤖 " : ""}{ps.username}: <span className="font-bold text-white">{ps.roundPoints}pts</span>
                                                          <span className="text-[8px] ml-1" style={{ color:"#4b5563" }}>(total {ps.totalScore})</span>
                                                        </p>
                                                      ))}
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* ── Transaction Log ── */}
                        {(item.list ?? []).length > 0 && (
                          <div>
                            <p className="text-[11px] font-black text-white mb-2.5">🧾 Transaction Log</p>
                            <div className="rounded-xl overflow-hidden" style={{ border:"1px solid rgba(255,255,255,0.06)" }}>
                              <table className="w-full text-[10px]">
                                <thead style={{ background:"rgba(255,255,255,0.04)" }}>
                                  <tr>
                                    <th className="text-left px-3 py-2 text-dark-muted font-bold uppercase tracking-wide">Type</th>
                                    <th className="text-left px-3 py-2 text-dark-muted font-bold uppercase tracking-wide">Player</th>
                                    <th className="text-right px-3 py-2 text-dark-muted font-bold uppercase tracking-wide">Amount</th>
                                    <th className="text-center px-3 py-2 text-dark-muted font-bold uppercase tracking-wide">Status</th>
                                    <th className="text-right px-3 py-2 text-dark-muted font-bold uppercase tracking-wide">Time</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(item.list ?? []).map((t: any, idx: number) => {
                                    const isCredit = ['winning','match_settlement','refund'].includes(t.type);
                                    const tColor   = ['winning','match_settlement'].includes(t.type) ? '#00ff88'
                                      : t.type === 'refund' ? '#60a5fa'
                                      : ['entry_locked','entry_fee'].includes(t.type) ? '#f87171'
                                      : '#9ca3af';
                                    const allP = [...(item.players??[]), ...(item.allMembers??[])];
                                    const tPlayer = allP.find((p: any) => p.userId === t.userId);
                                    return (
                                      <tr key={t.id ?? idx}
                                        style={{ borderTop:"1px solid rgba(255,255,255,0.04)", background: idx%2===0?"transparent":"rgba(255,255,255,0.01)" }}>
                                        <td className="px-3 py-2">
                                          <span className="font-bold capitalize" style={{ color:tColor }}>
                                            {t.type.replace(/_/g,' ')}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2 text-dark-muted">{tPlayer?.username ?? t.userId?.slice(-6) ?? "—"}</td>
                                        <td className="px-3 py-2 text-right font-black" style={{ color:tColor }}>
                                          {isCredit?"+":"-"}{t.type==='entry_locked'||t.type==='entry_fee'||t.type==='winning'||t.type==='refund'||t.type==='match_settlement' ? "₹" : ""}{t.amount}
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                          <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold"
                                            style={{
                                              background: t.status==='completed'?"rgba(0,255,136,0.12)":t.status==='failed'?"rgba(248,113,113,0.12)":"rgba(251,191,36,0.12)",
                                              color: t.status==='completed'?"#00ff88":t.status==='failed'?"#f87171":"#fbbf24",
                                            }}>
                                            {t.status}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2 text-right text-dark-muted whitespace-nowrap">{fmtDate(t.createdAt)}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </>
        )}
      </div>

      {/* ── Pagination ── */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}
            className="px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-30 hover:scale-105"
            style={{ background:"rgba(99,102,241,0.12)", color:"#818cf8", border:"1px solid rgba(99,102,241,0.25)" }}>
            ← Prev
          </button>
          <span className="text-xs text-dark-muted">{page} / {pages}</span>
          <button onClick={() => setPage(p => Math.min(pages,p+1))} disabled={page===pages}
            className="px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-30 hover:scale-105"
            style={{ background:"rgba(99,102,241,0.12)", color:"#818cf8", border:"1px solid rgba(99,102,241,0.25)" }}>
            Next →
          </button>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl text-sm font-semibold"
          style={{
            background: toast.ok ? "linear-gradient(135deg,rgba(0,200,100,0.18),rgba(0,200,100,0.08))" : "linear-gradient(135deg,rgba(220,50,50,0.18),rgba(220,50,50,0.08))",
            border:`1px solid ${toast.ok?"rgba(0,200,100,0.45)":"rgba(220,50,50,0.45)"}`,
            backdropFilter:"blur(16px)", color: toast.ok?"#00e676":"#ff6b6b",
          }}>
          {toast.ok?"✅":"❌"} {toast.msg}
        </div>
      )}
    </div>
  );
}

// ── Main Admin Page ────────────────────────────────────────────────────────────

type NavGroup = {
  label: string;
  accent: string;
  bg: string;
  items: { key: Section; icon: string; label: string }[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "ARENA",
    accent: "#f59e0b",
    bg: "rgba(245,158,11,0.08)",
    items: [
      { key: "overview",     icon: "📊", label: "Dashboard" },
      { key: "tournaments",  icon: "🤖", label: "AI Championship" },
    ],
  },
  {
    label: "MONITOR",
    accent: "#10b981",
    bg: "rgba(16,185,129,0.07)",
    items: [
      { key: "rooms",        icon: "🎮", label: "Live Rooms" },
      { key: "roomtracker",  icon: "🗂️", label: "Room Tracker" },
      { key: "gamereview",   icon: "🕵️", label: "Game Review" },
      { key: "holdsystem",   icon: "🔒", label: "Hold Monitor" },
    ],
  },
  {
    label: "PLAYERS",
    accent: "#60a5fa",
    bg: "rgba(96,165,250,0.08)",
    items: [
      { key: "users",         icon: "👥", label: "Players" },
      { key: "leaderboard",   icon: "🥇", label: "Leaderboard" },
      { key: "support",       icon: "🎧", label: "Support" },
      { key: "notify",        icon: "📢", label: "Notify Players" },
      { key: "announcements", icon: "📣", label: "Announcements" },
    ],
  },
  {
    label: "ANALYTICS",
    accent: "#fb923c",
    bg: "rgba(251,146,60,0.07)",
    items: [
      { key: "analytics",     icon: "📈", label: "Game Analytics" },
      { key: "spinanalytics", icon: "🎰", label: "Spin Analytics" },
      { key: "playerintel",   icon: "🔍", label: "Player Intel" },
    ],
  },
  {
    label: "REWARDS",
    accent: "#a78bfa",
    bg: "rgba(167,139,250,0.08)",
    items: [
      { key: "deposits",      icon: "🎟️", label: "Voucher Queue" },
      { key: "withdrawals",   icon: "🎁", label: "Reward Delivery" },
      { key: "wallets",       icon: "💰", label: "Player Wallets" },
      { key: "missedpayouts", icon: "🚨", label: "Missed Payouts" },
      { key: "referrals",     icon: "🤝", label: "Referrals" },
    ],
  },
  {
    label: "CONFIG",
    accent: "#06b6d4",
    bg: "rgba(6,182,212,0.07)",
    items: [
      { key: "gameconfig",     icon: "🎯", label: "Game Config" },
      { key: "survivalconfig", icon: "🛡️", label: "Survival Config" },
      { key: "walletconfig",   icon: "💳", label: "Reward Config" },
      { key: "features",       icon: "🔧", label: "Feature Flags" },
      { key: "aiguide",        icon: "🧬", label: "AI Strategy Guide" },
    ],
  },
];

const NAV_FLAT = NAV_GROUPS.flatMap((g) => g.items.map((i) => ({ ...i, accent: g.accent })));

function findNavItem(key: Section) {
  for (const g of NAV_GROUPS) {
    const item = g.items.find((i) => i.key === key);
    if (item) return { ...item, group: g };
  }
  return null;
}

export function AdminPage() {
  const navigate = useNavigate();
  const { user, token } = useAuthStore();
  const [section, setSection] = useState<Section>("overview");
  const [config, setConfig] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    // Auto-set adminToken from the user's regular token if they are an admin
    if (user?.isAdmin && token && !localStorage.getItem("adminToken")) {
      localStorage.setItem("adminToken", token);
    }
    if (!localStorage.getItem("adminToken")) {
      navigate("/admin/login", { replace: true });
      return;
    }
    admin
      .getConfig()
      .then((r) => setConfig(r.data))
      .catch(() => {
        localStorage.removeItem("adminToken");
        navigate("/admin/login", { replace: true });
      });
  }, [navigate, user, token]);

  // Live config updates from server
  useEffect(() => {
    try {
      const unsub = on("admin:config_updated", (updated) => {
        setConfig((prev: any) => (prev ? { ...prev, ...updated } : updated));
      });
      return unsub;
    } catch {
      return () => {};
    }
  }, []);

  const saveConfig = async (data: any) => {
    try {
      const res = await admin.updateConfig(data);
      setConfig(res.data);
      showToast("success", "Configuration saved successfully");
    } catch (err: any) {
      showToast("error", err.response?.data?.error ?? "Failed to save");
    }
  };

  const logout = () => {
    localStorage.removeItem("adminToken");
    navigate("/admin/login", { replace: true });
  };

  if (!config) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-dark-muted animate-pulse text-sm">
          Loading admin dashboard…
        </div>
      </div>
    );
  }

  const currentNav = findNavItem(section);

  return (
    <div className="min-h-screen flex" style={{ background: "radial-gradient(ellipse 120% 60% at 50% 0%, rgba(20,12,50,1) 0%, rgba(6,6,18,1) 60%)" }}>
      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/70 lg:hidden" />
        )}
      </AnimatePresence>

      <motion.aside
        className={clsx(
          "fixed top-0 left-0 h-full z-50 lg:relative lg:translate-x-0 flex flex-col flex-shrink-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
        style={{ width: 220, background: "rgba(8,8,20,0.99)", borderRight: "1px solid rgba(255,255,255,0.06)" }}
      >
        {/* Logo */}
        <div className="px-4 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
              style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.3),rgba(168,85,247,0.2))", border: "1px solid rgba(99,102,241,0.4)" }}>
              ⚔️
            </div>
            <div className="min-w-0">
              <p className="font-black text-white text-sm leading-tight">Arena of Sevens</p>
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "rgba(99,102,241,0.8)" }}>Admin Panel</p>
            </div>
          </div>
        </div>

        {/* Grouped Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              {/* Group header */}
              <p className="text-[9px] font-black uppercase tracking-[0.2em] px-2 mb-1.5"
                style={{ color: group.accent, opacity: 0.7 }}>
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = section === item.key;
                  return (
                    <button key={item.key}
                      onClick={() => { setSection(item.key); setSidebarOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all text-left relative"
                      style={active ? {
                        background: group.bg,
                        color: group.accent,
                        borderLeft: `3px solid ${group.accent}`,
                      } : { color: "rgba(156,163,175,0.7)" }}>
                      {!active && <span style={{ width: 3 }} />}
                      <span className="text-sm leading-none">{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div className="px-2 py-3 space-y-0.5" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <button onClick={() => navigate("/lobby")}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] transition-all text-left"
            style={{ color: "rgba(156,163,175,0.6)" }}>
            <span className="text-sm">🎮</span>
            <span>Back to Game</span>
          </button>
          <button onClick={logout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] transition-all text-left"
            style={{ color: "rgba(239,68,68,0.7)" }}>
            <span className="text-sm">🔓</span>
            <span>Logout</span>
          </button>
        </div>
      </motion.aside>

      {/* ── Main content ────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-30 px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-4"
          style={{ background: "rgba(8,8,20,0.92)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <button onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-xl border transition-colors"
            style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}>
            <svg className="w-4 h-4 text-dark-text" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 min-w-0">
            {currentNav && (
              <>
                <span className="text-[10px] font-black uppercase tracking-[0.15em] px-2 py-0.5 rounded-md"
                  style={{ background: `${currentNav.group?.bg}`, color: currentNav.group?.accent, border: `1px solid ${currentNav.group?.accent}30` }}>
                  {currentNav.group?.label}
                </span>
                <span className="text-dark-muted text-xs">›</span>
                <span className="text-sm font-semibold text-white truncate">{currentNav.icon} {currentNav.label}</span>
              </>
            )}
          </div>
        </div>

        <div className="p-4 sm:p-6 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div key={section}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
              {section === "overview" && <OverviewSection />}
              {section === "rooms" && <RoomsSection />}
              {section === "users" && <UsersSection />}
              {section === "leaderboard" && <LeaderboardSection />}
              {section === "deposits" && <DepositsSection />}
              {section === "withdrawals" && <WithdrawalsSection />}
              {section === "wallets" && <WalletsSection />}
              {section === "tournaments" && <TournamentsSection />}
              {section === "support" && <SupportSection />}
              {section === "features" && <FeaturesSection config={config} onSave={saveConfig} />}
              {section === "gameconfig" && <GameConfigSection config={config} onSave={saveConfig} />}
              {section === "walletconfig" && <WalletConfigSection config={config} onSave={saveConfig} />}
              {section === "notify" && <NotifySection />}
              {section === "announcements" && <AnnouncementsSection />}
              {section === "survivalconfig" && <SurvivalConfigSection config={config} onSave={saveConfig} />}
              {section === "analytics" && <AnalyticsSection />}
              {section === "aiguide" && <AiGuideSection />}
              {section === "playerintel" && <PlayerIntelligencePage />}
              {section === "missedpayouts" && (
                <MissedPayoutsSection onReview={(roomId) => { setSection("gamereview"); setTimeout(() => { (window as any).__gameReviewCode = roomId; window.dispatchEvent(new CustomEvent("admin:reviewRoom", { detail: roomId })); }, 50); }} />
              )}
              {section === "gamereview" && <GameReviewPage />}
              {section === "holdsystem" && <HoldSystemSection />}
              {section === "spinanalytics" && <SpinAnalyticsSection />}
              {section === "roomtracker" && <RoomTrackerSection />}
              {section === "referrals" && <ReferralsSection />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* ── Toast notification ─────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.22 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl text-sm font-semibold"
            style={{
              background:
                toast.type === "success"
                  ? "linear-gradient(135deg, rgba(0,200,100,0.18), rgba(0,200,100,0.08))"
                  : "linear-gradient(135deg, rgba(220,50,50,0.18), rgba(220,50,50,0.08))",
              border:
                toast.type === "success"
                  ? "1px solid rgba(0,200,100,0.45)"
                  : "1px solid rgba(220,50,50,0.45)",
              backdropFilter: "blur(16px)",
              color: toast.type === "success" ? "#00e676" : "#ff6b6b",
            }}
          >
            <span>{toast.type === "success" ? "✅" : "❌"}</span>
            <span>{toast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
