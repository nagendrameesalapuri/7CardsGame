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
  | "support";

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
          label="Tournament Banner"
          desc="Show the Bot Tournament banner on the lobby page"
          value={flags.tournamentBannerEnabled ?? true}
          onChange={(v) =>
            setFlags((f: any) => ({ ...f, tournamentBannerEnabled: v }))
          }
        />
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

function WalletConfigSection({
  config,
  onSave,
}: {
  config: any;
  onSave: (data: any) => void;
}) {
  const [wc, setWc] = useState({ ...config.walletConfig });
  const [saving, setSaving] = useState(false);
  const [uploadingQr, setUploadingQr] = useState(false);

  useEffect(() => {
    setWc({ ...config.walletConfig });
  }, [config]);

  const save = async () => {
    setSaving(true);
    await onSave({ walletConfig: wc });
    setSaving(false);
  };

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingQr(true);
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setWc((w: any) => ({ ...w, qrCodeUrl: base64 }));
        setUploadingQr(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Failed to upload QR code", err);
      setUploadingQr(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-white">Wallet Configuration</h2>
      <p className="text-xs text-dark-muted">
        Control deposit/withdraw buttons and UPI payment details.
      </p>

      {/* Feature toggles */}
      <div className="space-y-3">
        <Toggle
          label="Deposit Button Enabled"
          desc="Allow users to add money to their wallet"
          value={wc.depositEnabled}
          onChange={(v) => setWc((w: any) => ({ ...w, depositEnabled: v }))}
        />
        <Toggle
          label="Withdraw Button Enabled"
          desc="Allow users to withdraw money from their wallet"
          value={wc.withdrawEnabled}
          onChange={(v) => setWc((w: any) => ({ ...w, withdrawEnabled: v }))}
        />
        <Toggle
          label="QR Code Enabled"
          desc="Show QR code for UPI payments"
          value={wc.qrEnabled}
          onChange={(v) => setWc((w: any) => ({ ...w, qrEnabled: v }))}
        />
      </div>

      {/* UPI Details */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-dark-muted uppercase tracking-wide">
          UPI Details
        </p>
        <div>
          <label className="text-xs text-dark-muted block mb-1">UPI ID</label>
          <input
            type="text"
            value={wc.upiId}
            onChange={(e) =>
              setWc((w: any) => ({ ...w, upiId: e.target.value }))
            }
            placeholder="e.g. paytmqr5p0dyv@ptys"
            className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text text-sm focus:outline-none focus:border-neon-green"
          />
        </div>
        <div>
          <label className="text-xs text-dark-muted block mb-1">UPI Name</label>
          <input
            type="text"
            value={wc.upiName}
            onChange={(e) =>
              setWc((w: any) => ({ ...w, upiName: e.target.value }))
            }
            placeholder="e.g. 7Cards Game"
            className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text text-sm focus:outline-none focus:border-neon-green"
          />
        </div>
      </div>

      {/* QR Code Upload */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-dark-muted uppercase tracking-wide">
          QR Code Image
        </p>
        <div
          className="rounded-lg p-4 border-2 border-dashed border-dark-border hover:border-neon-green/50 transition-colors cursor-pointer"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <label className="cursor-pointer flex flex-col items-center gap-2">
            <span className="text-2xl">📱</span>
            <span className="text-xs text-dark-muted text-center">
              {wc.qrCodeUrl
                ? "Click to change QR code"
                : "Click to upload QR code (PNG/JPG)"}
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={handleQrUpload}
              disabled={uploadingQr}
              className="hidden"
            />
          </label>
        </div>
        {wc.qrCodeUrl && (
          <div className="rounded-lg p-3 bg-dark-surface flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-green-400">✓</span>
              <span className="text-xs text-dark-text truncate">
                QR code uploaded ({Math.round(wc.qrCodeUrl.length / 1024)} KB)
              </span>
            </div>
            <button
              onClick={() => setWc((w: any) => ({ ...w, qrCodeUrl: "" }))}
              className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
            >
              Remove
            </button>
          </div>
        )}
      </div>

      {/* Preview */}
      {wc.qrCodeUrl && (
        <div className="rounded-lg p-4 bg-dark-surface text-center">
          <p className="text-xs text-dark-muted mb-2">QR Code Preview</p>
          <img
            src={wc.qrCodeUrl}
            alt="QR Code"
            className="max-w-[200px] mx-auto rounded-lg border border-dark-border"
          />
        </div>
      )}

      <button
        onClick={save}
        disabled={saving || uploadingQr}
        className="w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
        style={{ background: "rgba(147,51,234,0.8)", color: "white" }}
      >
        {saving ? "Saving…" : uploadingQr ? "Uploading…" : "Save Config"}
      </button>
    </div>
  );
}

// ── Deposits Section ─────────────────────────────────────────────────────────

const DEP_STATUS_STYLE: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-300",
  approved: "bg-green-500/20 text-green-400",
  rejected: "bg-red-500/20 text-red-400",
};

function DepositsSection() {
  const [deposits, setDeposits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("pending");

  const load = useCallback(async () => {
    try {
      const { data } = await admin.getDeposits();
      setDeposits(data.deposits);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const process = async (id: string, status: "approved" | "rejected") => {
    try {
      await admin.processDeposit(id, status, noteMap[id]);
      setDeposits((prev) =>
        prev.map((d) => (d._id === id ? { ...d, status } : d)),
      );
    } catch {
      /* ignore */
    }
  };

  const filtered =
    filter === "all" ? deposits : deposits.filter((d) => d.status === filter);
  const pendingCount = deposits.filter((d) => d.status === "pending").length;

  if (loading)
    return <p className="text-dark-muted text-sm py-8 text-center">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-bold text-white">
          Deposit Requests
          {pendingCount > 0 && (
            <span className="ml-2 text-sm px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300">
              {pendingCount} pending
            </span>
          )}
        </h2>
        <div className="flex gap-1.5">
          {(["pending", "approved", "rejected", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                "px-3 py-1 rounded-lg text-xs font-semibold transition-all capitalize",
                filter === f
                  ? "bg-neon-green text-dark-bg"
                  : "bg-dark-surface text-dark-muted border border-dark-border",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-dark-muted text-sm py-8 text-center">
          No {filter === "all" ? "" : filter} deposit requests
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => (
            <div
              key={d._id}
              className="rounded-2xl p-4 space-y-3"
              style={cardStyle}
            >
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <p className="font-semibold text-white">{d.username}</p>
                  <p className="text-xs text-dark-muted">
                    UTR:{" "}
                    <span className="font-mono text-white">{d.utrNumber}</span>
                  </p>
                  <p className="text-xs text-dark-muted">
                    {new Date(d.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-neon-green">
                    ₹{d.amount}
                  </p>
                  <span
                    className={clsx(
                      "text-xs px-2 py-0.5 rounded-full",
                      DEP_STATUS_STYLE[d.status] ?? "",
                    )}
                  >
                    {d.status}
                  </span>
                </div>
              </div>

              {d.status === "pending" && (
                <div className="flex gap-2 flex-wrap items-center">
                  <input
                    placeholder="Admin note (optional)"
                    value={noteMap[d._id] ?? ""}
                    onChange={(e) =>
                      setNoteMap((p) => ({ ...p, [d._id]: e.target.value }))
                    }
                    className="flex-1 min-w-[140px] bg-dark-bg border border-dark-border rounded-lg px-3 py-1.5 text-xs text-dark-text focus:outline-none"
                  />
                  <button
                    onClick={() => process(d._id, "approved")}
                    className="px-4 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition-colors"
                  >
                    ✓ Approve & Credit
                  </button>
                  <button
                    onClick={() => process(d._id, "rejected")}
                    className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors"
                  >
                    ✗ Reject
                  </button>
                </div>
              )}
              {d.adminNote && (
                <p className="text-xs text-dark-muted italic">
                  Note: {d.adminNote}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Withdrawals Section ────────────────────────────────────────────────────────

const WD_STATUS_STYLE: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-300",
  approved: "bg-green-500/20 text-green-400",
  rejected: "bg-red-500/20 text-red-400",
};

function WithdrawalsSection() {
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const { data } = await admin.getWithdrawals();
      setWithdrawals(data.withdrawals);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const process = async (id: string, status: "approved" | "rejected") => {
    try {
      await admin.processWithdrawal(id, status, noteMap[id]);
      setWithdrawals((prev) =>
        prev.map((w) => (w._id === id ? { ...w, status } : w)),
      );
    } catch {
      /* ignore */
    }
  };

  if (loading)
    return <p className="text-dark-muted text-sm py-8 text-center">Loading…</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">Withdrawal Requests</h2>
      {withdrawals.length === 0 ? (
        <p className="text-dark-muted text-sm py-8 text-center">
          No withdrawal requests
        </p>
      ) : (
        <div className="space-y-3">
          {withdrawals.map((w) => (
            <div
              key={w._id}
              className="rounded-2xl p-4 space-y-2"
              style={cardStyle}
            >
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <p className="font-semibold text-white">{w.username}</p>
                  <p className="text-sm text-dark-muted">
                    {w.upiId
                      ? `UPI: ${w.upiId}`
                      : `Bank: ${w.bankDetails?.accountName}`}
                  </p>
                  <p className="text-xs text-dark-muted">
                    {new Date(w.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-neon-green">
                    ₹{w.amount}
                  </p>
                  <span
                    className={clsx(
                      "text-xs px-2 py-0.5 rounded-full",
                      WD_STATUS_STYLE[w.status] ?? "",
                    )}
                  >
                    {w.status}
                  </span>
                </div>
              </div>
              {w.status === "pending" && (
                <div className="flex gap-2 flex-wrap items-center pt-1">
                  <input
                    placeholder="Admin note (optional)"
                    value={noteMap[w._id] ?? ""}
                    onChange={(e) =>
                      setNoteMap((p) => ({ ...p, [w._id]: e.target.value }))
                    }
                    className="flex-1 min-w-[140px] bg-dark-bg border border-dark-border rounded-lg px-3 py-1.5 text-xs text-dark-text focus:outline-none"
                  />
                  <button
                    onClick={() => process(w._id, "approved")}
                    className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => process(w._id, "rejected")}
                    className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors"
                  >
                    Reject
                  </button>
                </div>
              )}
              {w.adminNote && (
                <p className="text-xs text-dark-muted italic">{w.adminNote}</p>
              )}
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
              ➕ Add Money
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
              ➖ Remove Money
            </button>
          </div>

          {tab === "add" ? (
            <>
              <p className="text-sm font-semibold text-white">
                💸 Credit User Wallet
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
                  ? "Adding…"
                  : selected
                    ? `Add Money to ${selected.username}`
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
                🗑️ Debit User Wallet
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
                  ? "Removing…"
                  : selected
                    ? `Remove Money from ${selected.username}`
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

function TournamentsSection() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(
    (p = 1, s = filter) => {
      setLoading(true);
      admin
        .getTournaments({ page: p, status: s || undefined })
        .then((r) => setData(r.data))
        .catch(() => {})
        .finally(() => setLoading(false));
    },
    [filter],
  );

  useEffect(() => {
    load(1);
  }, []);

  const applyFilter = (s: string) => {
    setFilter(s);
    setPage(1);
    load(1, s);
  };

  const changePage = (p: number) => {
    setPage(p);
    load(p);
  };

  const STATUS_FILTERS = [
    { value: "", label: "All" },
    { value: "active", label: "Active" },
    { value: "won", label: "Won" },
    { value: "lost", label: "Lost" },
    { value: "draw", label: "Draw" },
  ];

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      {data?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            {
              label: "Active",
              value: data.summary.totalActive,
              color: "#60a5fa",
            },
            { label: "Won", value: data.summary.totalWon, color: "#00ff88" },
            { label: "Lost", value: data.summary.totalLost, color: "#ff6b6b" },
            { label: "Draws", value: data.summary.totalDraw, color: "#fbbf24" },
            {
              label: "Prize Paid",
              value: `₹${data.summary.totalPrizePaid}`,
              color: "#ffd700",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl p-3 text-center"
              style={cardStyle}
            >
              <p className="text-[10px] text-dark-muted uppercase tracking-wider mb-1">
                {s.label}
              </p>
              <p className="text-xl font-black" style={{ color: s.color }}>
                {s.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => applyFilter(f.value)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={
              filter === f.value
                ? {
                    background: "rgba(0,255,136,0.15)",
                    color: "#00ff88",
                    border: "1px solid rgba(0,255,136,0.4)",
                  }
                : {
                    background: "rgba(255,255,255,0.04)",
                    color: "#8b949e",
                    border: "1px solid rgba(255,255,255,0.07)",
                  }
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-neon-green border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !data?.tournaments?.length ? (
        <p className="text-center text-dark-muted py-10">
          No tournaments found.
        </p>
      ) : (
        <div className="space-y-2">
          {data.tournaments.map((t: any) => (
            <div
              key={t.id}
              className="rounded-2xl p-4 space-y-2"
              style={cardStyle}
            >
              {/* Row 1: user + status + fee */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar avatar={t.avatar} username={t.username} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-dark-text truncate">
                      {t.username}
                    </p>
                    <p className="text-[10px] text-dark-muted truncate">
                      {t.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusBadge status={t.status} />
                  <span className="text-xs text-dark-muted">₹{t.entryFee}</span>
                </div>
              </div>

              {/* Row 2: game dots + series score */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 3 }, (_, i) => {
                    const gr = t.gameResults?.[i];
                    const bg = !gr
                      ? "rgba(255,255,255,0.05)"
                      : gr.isDraw
                        ? "rgba(251,191,36,0.2)"
                        : gr.playerWon
                          ? "rgba(0,255,136,0.2)"
                          : "rgba(255,107,107,0.2)";
                    const border = !gr
                      ? "rgba(255,255,255,0.08)"
                      : gr.isDraw
                        ? "rgba(251,191,36,0.5)"
                        : gr.playerWon
                          ? "rgba(0,255,136,0.5)"
                          : "rgba(255,107,107,0.5)";
                    return (
                      <div
                        key={i}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                        style={{
                          background: bg,
                          border: `1px solid ${border}`,
                        }}
                      >
                        {!gr
                          ? String(i + 1)
                          : gr.isDraw
                            ? "="
                            : gr.playerWon
                              ? "✓"
                              : "✗"}
                      </div>
                    );
                  })}
                </div>
                <span className="text-xs text-dark-muted">
                  {t.playerWins}W – {t.botWins}L
                  {(t.draws ?? 0) > 0 ? ` – ${t.draws}D` : ""} · {t.gamesPlayed}{" "}
                  game{t.gamesPlayed !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Row 3: prize / refund + date */}
              <div className="flex justify-between items-center text-xs">
                <span
                  style={{
                    color:
                      t.status === "won"
                        ? "#00ff88"
                        : t.status === "draw"
                          ? "#fbbf24"
                          : t.status === "lost"
                            ? "#ff6b6b"
                            : "#60a5fa",
                  }}
                >
                  {t.status === "won"
                    ? `+₹${t.prizeAmount} prize`
                    : t.status === "draw"
                      ? `₹${t.entryFee} refunded`
                      : t.status === "lost"
                        ? `−₹${t.entryFee}`
                        : "In progress"}
                </span>
                <span className="text-dark-muted">
                  {new Date(t.createdAt).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => changePage(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-30"
            style={{ background: "rgba(255,255,255,0.06)", color: "#e6edf3" }}
          >
            ← Prev
          </button>
          <span className="text-xs text-dark-muted self-center">
            Page {page} of {data.pages} ({data.total} total)
          </span>
          <button
            onClick={() => changePage(page + 1)}
            disabled={page >= data.pages}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-30"
            style={{ background: "rgba(255,255,255,0.06)", color: "#e6edf3" }}
          >
            Next →
          </button>
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

// ── Main Admin Page ────────────────────────────────────────────────────────────

const NAV: { key: Section; icon: string; label: string }[] = [
  { key: "overview", icon: "📊", label: "Overview" },
  { key: "rooms", icon: "🎮", label: "Live Rooms" },
  { key: "users", icon: "👤", label: "Users" },
  { key: "leaderboard", icon: "🏆", label: "Leaderboard" },
  { key: "deposits", icon: "📥", label: "Deposits" },
  { key: "withdrawals", icon: "💸", label: "Withdrawals" },
  { key: "wallets", icon: "💰", label: "Wallets" },
  { key: "tournaments", icon: "⚔️", label: "Tournaments" },
  { key: "support", icon: "🎧", label: "Support" },
  { key: "features", icon: "⚙️", label: "Features" },
  { key: "gameconfig", icon: "🎯", label: "Game Config" },
  { key: "walletconfig", icon: "💳", label: "Wallet Config" },
];

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

  return (
    <div
      className="min-h-screen bg-dark-bg flex"
      style={{
        background: "linear-gradient(135deg, #0a0b0e 0%, #0d0e14 100%)",
      }}
    >
      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside
        className={clsx(
          "fixed top-0 left-0 h-full z-50 lg:relative lg:translate-x-0 flex flex-col w-56 flex-shrink-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
        style={{
          background: "rgba(10,11,14,0.98)",
          borderRight: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        {/* Logo */}
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔐</span>
            <div>
              <p className="font-bold text-white text-sm">Admin Panel</p>
              <p className="text-[10px] text-dark-muted">7 Cards Show</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map((item) => (
            <button
              key={item.key}
              onClick={() => {
                setSection(item.key);
                setSidebarOpen(false);
              }}
              className={clsx(
                "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left",
                section === item.key
                  ? "bg-purple-500/20 text-purple-300"
                  : "text-dark-muted hover:text-dark-text hover:bg-white/5",
              )}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t border-white/5 space-y-1">
          <button
            onClick={() => navigate("/lobby")}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-dark-muted hover:text-dark-text hover:bg-white/5 transition-all"
          >
            🎮 Back to Game
          </button>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-neon-red/70 hover:text-neon-red hover:bg-neon-red/5 transition-all"
          >
            🔓 Logout
          </button>
        </div>
      </motion.aside>

      {/* ── Main content ────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        {/* Mobile header */}
        <div className="flex items-center gap-3 mb-6 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-xl bg-dark-surface border border-dark-border"
          >
            <svg
              className="w-4 h-4 text-dark-text"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <span className="font-bold text-white">
            {NAV.find((n) => n.key === section)?.icon}{" "}
            {NAV.find((n) => n.key === section)?.label}
          </span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={section}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {section === "overview" && <OverviewSection />}
            {section === "rooms" && <RoomsSection />}
            {section === "users" && <UsersSection />}
            {section === "leaderboard" && <LeaderboardSection />}
            {section === "deposits" && <DepositsSection />}
            {section === "withdrawals" && <WithdrawalsSection />}
            {section === "wallets" && <WalletsSection />}
            {section === "tournaments" && <TournamentsSection />}
            {section === "support" && <SupportSection />}
            {section === "features" && (
              <FeaturesSection config={config} onSave={saveConfig} />
            )}
            {section === "gameconfig" && (
              <GameConfigSection config={config} onSave={saveConfig} />
            )}
            {section === "walletconfig" && (
              <WalletConfigSection config={config} onSave={saveConfig} />
            )}
          </motion.div>
        </AnimatePresence>
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
