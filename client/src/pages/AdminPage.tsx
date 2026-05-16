import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";
import { admin } from "../services/api";
import { on } from "../services/socket";
import { Avatar } from "../components/ui/Avatar";

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
  | "survivalconfig"
  | "analytics"
  | "aiguide";

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

  useEffect(() => {
    admin
      .getStats()
      .then((r) => setStats(r.data))
      .catch(console.error);
    const t = setInterval(() => {
      admin
        .getStats()
        .then((r) => setStats(r.data))
        .catch(console.error);
    }, 10000);
    return () => clearInterval(t);
  }, []);

  if (!stats)
    return (
      <div className="text-dark-muted text-sm animate-pulse">Loading…</div>
    );

  return (
    <div className="space-y-4">
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-bold text-white">User Management</h2>
        <div className="flex items-center gap-2">
          {!loading && (
            <span className="text-xs text-dark-muted">
              {total} user{total !== 1 ? "s" : ""}
            </span>
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
        <div className="space-y-2">
          {users.map((u) => (
            <motion.div
              key={String(u.id)}
              layout
              className="p-3 rounded-xl flex items-center gap-3"
              style={{ ...cardStyle, opacity: u.isBanned ? 0.6 : 1 }}
            >
              <Avatar avatar={u.avatar} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-sm text-dark-text truncate">
                    {u.username}
                  </span>
                  {u.isOnline && (
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-neon-green flex-shrink-0"
                      title="Online"
                    />
                  )}
                  {u.isGuest && (
                    <span className="text-[10px] bg-dark-border text-dark-muted px-1.5 py-0.5 rounded">
                      Guest
                    </span>
                  )}
                  {u.isBanned && (
                    <span className="text-[10px] text-neon-red font-bold">
                      BANNED
                    </span>
                  )}
                </div>
                {u.email && (
                  <p className="text-[11px] text-dark-muted truncate">
                    {u.email}
                  </p>
                )}
                {/* ID row with copy button */}
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className="text-[10px] text-dark-muted font-mono truncate max-w-[160px]"
                    title={String(u.id)}
                  >
                    {String(u.id)}
                  </span>
                  <button
                    onClick={() => copyId(String(u.id))}
                    className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded transition-all font-medium"
                    style={
                      copiedId === String(u.id)
                        ? {
                            background: "rgba(0,255,136,0.15)",
                            color: "#00ff88",
                            border: "1px solid rgba(0,255,136,0.3)",
                          }
                        : {
                            background: "rgba(255,255,255,0.05)",
                            color: "#8b949e",
                            border: "1px solid rgba(255,255,255,0.08)",
                          }
                    }
                  >
                    {copiedId === String(u.id) ? "✓ Copied" : "Copy ID"}
                  </button>
                </div>
                <p className="text-[11px] text-dark-muted mt-0.5">
                  {u.stats.gamesPlayed}G · {u.stats.gamesWon}W ·{" "}
                  {u.stats.gamesPlayed > 0
                    ? Math.round((u.stats.gamesWon / u.stats.gamesPlayed) * 100)
                    : 0}
                  % win
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: u.isOnline ? "#00ff88" : "#6b7280" }}>
                  {formatLastSeen(u.lastSeenAt, u.isOnline)}
                </p>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                {u.isBanned ? (
                  <button
                    onClick={() => doAction(() => admin.unbanUser(u.id))}
                    disabled={actionId === u.id}
                    className="text-[11px] px-2 py-1 rounded-lg font-semibold"
                    style={{
                      background: "rgba(0,255,136,0.12)",
                      color: "#00ff88",
                      border: "1px solid rgba(0,255,136,0.3)",
                    }}
                  >
                    Unban
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setActionId(u.id);
                      doAction(() => admin.banUser(u.id)).finally(() =>
                        setActionId(null),
                      );
                    }}
                    disabled={actionId === u.id}
                    className="text-[11px] px-2 py-1 rounded-lg font-semibold"
                    style={{
                      background: "rgba(255,59,92,0.12)",
                      color: "#ff3b5c",
                      border: "1px solid rgba(255,59,92,0.3)",
                    }}
                  >
                    Ban
                  </button>
                )}
                <button
                  onClick={() => doAction(() => admin.kickUser(u.id))}
                  className="text-[11px] px-2 py-1 rounded-lg font-semibold"
                  style={{
                    background: "rgba(251,191,36,0.12)",
                    color: "#fbbf24",
                    border: "1px solid rgba(251,191,36,0.3)",
                  }}
                  title="Disconnect user"
                >
                  Kick
                </button>
                <button
                  onClick={() => {
                    if (confirm("Reset stats for " + u.username + "?"))
                      doAction(() => admin.resetUserStats(u.id));
                  }}
                  className="text-[11px] px-2 py-1 rounded-lg font-semibold"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    color: "rgba(255,255,255,0.4)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  Reset
                </button>
                <button
                  onClick={() => {
                    if (
                      confirm(
                        `Permanently delete "${u.username}"? This cannot be undone.`,
                      )
                    )
                      doAction(() => admin.deleteUser(u.id));
                  }}
                  className="text-[11px] px-2 py-1 rounded-lg font-semibold"
                  style={{
                    background: "rgba(255,59,92,0.2)",
                    color: "#ff3b5c",
                    border: "1px solid rgba(255,59,92,0.5)",
                  }}
                  title="Delete account permanently"
                >
                  🗑 Delete
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="text-xs text-dark-muted disabled:opacity-30 hover:text-dark-text"
          >
            ← Prev
          </button>
          <span className="text-xs text-dark-muted">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="text-xs text-dark-muted disabled:opacity-30 hover:text-dark-text"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

function LeaderboardSection() {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = () => {
    admin
      .getLeaderboard()
      .then((r) => {
        setLeaderboard(r.data.leaderboard);
        setLoading(false);
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetch();
  }, []);

  const resetAll = async () => {
    if (!confirm("Reset ALL user stats? This cannot be undone.")) return;
    await admin.resetLeaderboard().catch(console.error);
    fetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Leaderboard</h2>
        <button
          onClick={resetAll}
          className="text-xs px-3 py-1.5 rounded-lg font-semibold"
          style={{
            background: "rgba(255,59,92,0.12)",
            color: "#ff3b5c",
            border: "1px solid rgba(255,59,92,0.3)",
          }}
        >
          Reset All
        </button>
      </div>

      {loading ? (
        <p className="text-dark-muted text-sm animate-pulse">Loading…</p>
      ) : (
        <div className="space-y-2">
          {leaderboard.slice(0, 50).map((u) => (
            <div
              key={String(u.id)}
              className="p-3 rounded-xl flex items-center gap-3"
              style={cardStyle}
            >
              <span className="w-8 text-center font-bold text-dark-muted text-sm">
                #{u.rank}
              </span>
              <Avatar avatar={u.avatar} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-dark-text truncate">
                  {u.username}
                </p>
                <p className="text-[11px] text-dark-muted">
                  {u.gamesPlayed} played · {u.winRate}% win
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-neon-green text-sm">
                  {u.gamesWon}W
                </p>
                {u.isBanned && (
                  <p className="text-[10px] text-neon-red">BANNED</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FeaturesSection({
  config,
  onSave,
}: {
  config: any;
  onSave: (data: any) => void;
}) {
  const [flags, setFlags] = useState({ ...config.featureFlags });
  const [saving, setSaving] = useState(false);

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
        msg: `Added ₹${amt} to ${data.username} — new balance: ₹${data.balance}`,
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
        msg: `Removed ₹${amt} from ${data.username} — new balance: ₹${data.balance}`,
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
                          ₹{selected.balance}
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
                              ₹{w.balance}
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
                          ₹{selected.balance}
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
                              ₹{w.balance}
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
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tierFilter, setTierFilter] = useState("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(
    (p = 1, t = tierFilter) => {
      setLoading(true);
      admin
        .getSurvivalChampionship({ page: p, tier: t || undefined })
        .then((r) => setData(r.data))
        .catch(() => {})
        .finally(() => setLoading(false));
    },
    [tierFilter],
  );

  useEffect(() => { load(1); }, []);

  const applyTier = (t: string) => { setTierFilter(t); setPage(1); load(1, t); };
  const changePage = (p: number) => { setPage(p); load(p); };

  const TIER_FILTERS = [
    { value: "", label: "All Tiers" },
    { value: "beginner", label: "🌱 Beginner" },
    { value: "pro", label: "⚡ Pro" },
    { value: "elite", label: "🔥 Elite" },
    { value: "boss_arena", label: "💀 Boss Arena" },
  ];

  const STATUS_COLOR: Record<string, string> = {
    active: "#60a5fa",
    won: "#00ff88",
    lost: "#ff6b6b",
    abandoned: "#6b7280",
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl p-5" style={{ background: "linear-gradient(135deg,rgba(16,185,129,0.12),rgba(245,158,11,0.08))", border: "1px solid rgba(16,185,129,0.2)" }}>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">🤖</span>
          <div>
            <h2 className="text-base font-black text-white">AI Survival Championship</h2>
            <p className="text-xs text-dark-muted">Survive 5 AI stages across 4 tiers · Beginner → Boss Arena</p>
          </div>
        </div>
        <div className="flex gap-4 mt-3 flex-wrap">
          {STAGE_PERSONALITIES.map((s, i) => (
            <span key={s} className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)", color: "#8b949e" }}>
              Stage {i + 1}: {s} AI
            </span>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      {data?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Active",    value: data.summary.totalActive,    color: "#60a5fa" },
            { label: "Completed", value: data.summary.totalWon,       color: "#00ff88" },
            { label: "Lost",      value: data.summary.totalLost,      color: "#ff6b6b" },
            { label: "Abandoned", value: data.summary.totalAbandoned, color: "#6b7280" },
            { label: "Pts Paid",  value: (data.summary.totalPointsPaid ?? 0).toLocaleString(), color: "#ffd700" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl p-3 text-center" style={cardStyle}>
              <p className="text-[10px] text-dark-muted uppercase tracking-wider mb-1">{s.label}</p>
              <p className="text-xl font-black" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tier breakdown */}
      {data?.summary?.tierBreakdown?.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {data.summary.tierBreakdown.map((tb: any) => {
            const meta = TIER_META[tb._id] ?? { label: tb._id, color: "#8b949e", icon: "🎮" };
            const winRate = tb.count > 0 ? Math.round((tb.won / tb.count) * 100) : 0;
            return (
              <div key={tb._id} className="rounded-2xl p-3" style={{ ...cardStyle, border: `1px solid ${meta.color}22` }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <span>{meta.icon}</span>
                  <p className="text-xs font-bold" style={{ color: meta.color }}>{meta.label}</p>
                </div>
                <p className="text-lg font-black text-white">{tb.count}</p>
                <p className="text-[10px] text-dark-muted">{tb.won} won · {winRate}% win rate</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Tier filter */}
      <div className="flex gap-2 flex-wrap">
        {TIER_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => applyTier(f.value)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={tierFilter === f.value
              ? { background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.4)" }
              : { background: "rgba(255,255,255,0.04)", color: "#8b949e", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-neon-green border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !data?.records?.length ? (
        <p className="text-center text-dark-muted py-10">No survival runs found.</p>
      ) : (
        <div className="space-y-2">
          {data.records.map((r: any) => {
            const meta = TIER_META[r.tier] ?? { label: r.tier, color: "#8b949e", icon: "🎮" };
            const isExpanded = expandedId === r.id;
            return (
              <div key={r.id} className="rounded-2xl overflow-hidden" style={cardStyle}>
                <button
                  className="w-full p-4 text-left"
                  onClick={() => setExpandedId(isExpanded ? null : r.id)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar avatar={r.avatar} username={r.username} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-dark-text truncate">{r.username}</p>
                        <p className="text-[10px] text-dark-muted truncate">{r.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${meta.color}22`, color: meta.color, border: `1px solid ${meta.color}44` }}>
                        {meta.icon} {meta.label}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize" style={{ background: `${STATUS_COLOR[r.status] ?? "#8b949e"}22`, color: STATUS_COLOR[r.status] ?? "#8b949e", border: `1px solid ${STATUS_COLOR[r.status] ?? "#8b949e"}44` }}>
                        {r.status}
                      </span>
                    </div>
                  </div>

                  {/* Stage progress dots */}
                  <div className="flex items-center gap-2 mt-3">
                    <div className="flex gap-1">
                      {Array.from({ length: 5 }, (_, i) => {
                        const sr = r.stageResults?.[i];
                        const done = !!sr;
                        const won = sr?.playerWon;
                        const bg = !done ? "rgba(255,255,255,0.05)" : won ? "rgba(0,255,136,0.2)" : "rgba(255,107,107,0.2)";
                        const border = !done ? "rgba(255,255,255,0.08)" : won ? "rgba(0,255,136,0.5)" : "rgba(255,107,107,0.5)";
                        return (
                          <div key={i} className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: bg, border: `1px solid ${border}` }}>
                            {!done ? String(i + 1) : won ? "✓" : "✗"}
                          </div>
                        );
                      })}
                    </div>
                    <span className="text-xs text-dark-muted">{r.stagesCompleted}/5 stages · {r.totalPointsEarned ?? 0} pts</span>
                    <span className="ml-auto text-[10px] text-dark-muted">{new Date(r.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
                  </div>
                </button>

                {/* Expanded stage detail */}
                {isExpanded && r.stageResults?.length > 0 && (
                  <div className="border-t border-white/5 p-4 space-y-2">
                    {r.stageResults.map((sr: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="text-dark-muted">Stage {idx + 1} · {STAGE_PERSONALITIES[idx] ?? sr.personality} AI</span>
                        <div className="flex items-center gap-3">
                          <span style={{ color: sr.playerWon ? "#00ff88" : "#ff6b6b" }}>
                            {sr.playerWon ? "Win" : "Loss"} · You {sr.playerScore} – Bot {sr.botScore}
                          </span>
                          <span style={{ color: "#ffd700" }}>+{sr.pointsEarned ?? 0} pts</span>
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
      {data && data.pages > 1 && (
        <div className="flex justify-center gap-2">
          <button onClick={() => changePage(page - 1)} disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-30"
            style={{ background: "rgba(255,255,255,0.06)", color: "#e6edf3" }}>← Prev</button>
          <span className="text-xs text-dark-muted self-center">Page {page} of {data.pages} ({data.total} total)</span>
          <button onClick={() => changePage(page + 1)} disabled={page >= data.pages}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-30"
            style={{ background: "rgba(255,255,255,0.06)", color: "#e6edf3" }}>Next →</button>
        </div>
      )}
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

function NotifySection() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"info" | "warning" | "success">("info");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; msg: string } | null>(null);

  const send = async () => {
    if (!title.trim() || !message.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const res = await admin.sendNotification(title.trim(), message.trim(), type);
      setResult({ success: true, msg: `Sent to ${res.data.recipients} connected user(s)` });
      setTitle("");
      setMessage("");
    } catch (err: any) {
      setResult({ success: false, msg: err.response?.data?.error ?? "Failed to send" });
    } finally {
      setSending(false);
    }
  };

  const typeOptions: { value: "info" | "warning" | "success"; label: string; color: string }[] = [
    { value: "info",    label: "ℹ️ Info",    color: "#60a5fa" },
    { value: "warning", label: "⚠️ Warning", color: "#fbbf24" },
    { value: "success", label: "✅ Success", color: "#00ff88" },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-dark-text">Push Notification</h2>
      <p className="text-xs text-dark-muted">Send a real-time notification to all currently connected users.</p>

      <div className="rounded-2xl p-5 space-y-4" style={cardStyle}>
        {/* Type selector */}
        <div>
          <p className="text-xs text-dark-muted mb-2">Type</p>
          <div className="flex gap-2">
            {typeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setType(opt.value)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: type === opt.value ? `${opt.color}22` : "rgba(255,255,255,0.04)",
                  border: `1px solid ${type === opt.value ? opt.color : "rgba(255,255,255,0.08)"}`,
                  color: type === opt.value ? opt.color : "#6b7280",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <p className="text-xs text-dark-muted mb-1.5">Title</p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder="e.g. Maintenance in 30 minutes"
            className="w-full px-3 py-2 rounded-xl text-sm text-dark-text bg-transparent outline-none"
            style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }}
          />
        </div>

        {/* Message */}
        <div>
          <p className="text-xs text-dark-muted mb-1.5">Message</p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder="Detailed message visible in the notification bell…"
            className="w-full px-3 py-2 rounded-xl text-sm text-dark-text bg-transparent outline-none resize-none"
            style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }}
          />
          <p className="text-[10px] text-dark-muted/60 text-right mt-0.5">{message.length}/300</p>
        </div>

        {/* Send button */}
        <button
          onClick={send}
          disabled={sending || !title.trim() || !message.trim()}
          className="w-full py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff" }}
        >
          {sending ? "Sending…" : "📢 Send to All Users"}
        </button>

        {result && (
          <p className="text-xs text-center font-medium" style={{ color: result.success ? "#00ff88" : "#ff6b6b" }}>
            {result.success ? "✓ " : "✗ "}{result.msg}
          </p>
        )}
      </div>
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
      { key: "overview",      icon: "📊", label: "Dashboard" },
      { key: "rooms",         icon: "🎮", label: "Live Rooms" },
      { key: "tournaments",   icon: "🤖", label: "AI Championship" },
      { key: "gameconfig",    icon: "🎯", label: "Game Config" },
      { key: "survivalconfig",icon: "🛡️", label: "Survival Config" },
      { key: "analytics",     icon: "📈", label: "Analytics" },
      { key: "aiguide",       icon: "🧬", label: "AI Strategy Guide" },
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
      { key: "walletconfig",  icon: "⚙️", label: "Reward Config" },
    ],
  },
  {
    label: "SYSTEM",
    accent: "#6b7280",
    bg: "rgba(107,114,128,0.06)",
    items: [
      { key: "features",      icon: "🔧", label: "Feature Flags" },
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
  }, [navigate]);

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
              {section === "survivalconfig" && <SurvivalConfigSection config={config} onSave={saveConfig} />}
              {section === "analytics" && <AnalyticsSection />}
              {section === "aiguide" && <AiGuideSection />}
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
