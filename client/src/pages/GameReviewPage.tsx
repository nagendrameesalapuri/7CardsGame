import React, { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { admin } from "../services/api";

// ── Card rendering ────────────────────────────────────────────────────────────

const SUIT_SYMBOL: Record<string, string> = {
  hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠", none: "★",
};
const SUIT_COLOR: Record<string, string> = {
  hearts: "#ef4444", diamonds: "#ef4444", clubs: "#e2e8f0", spades: "#e2e8f0", none: "#a78bfa",
};

function MiniCard({ card, isJoker }: { card: any; isJoker?: boolean }) {
  const sym = SUIT_SYMBOL[card.suit] ?? "?";
  const col = isJoker ? "#fbbf24" : SUIT_COLOR[card.suit] ?? "#e2e8f0";
  return (
    <div
      title={`${card.rank}${sym}`}
      style={{
        display: "inline-flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", width: 30, height: 42, borderRadius: 5,
        background: isJoker ? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.07)",
        border: `1px solid ${isJoker ? "rgba(251,191,36,0.5)" : "rgba(255,255,255,0.12)"}`,
        fontSize: 9, fontWeight: 700, color: col, flexShrink: 0, gap: 1,
        boxShadow: isJoker ? "0 0 8px rgba(251,191,36,0.25)" : "none",
        cursor: "default",
      }}
    >
      <span style={{ fontSize: 10, lineHeight: 1 }}>{card.rank}</span>
      <span style={{ fontSize: 11, lineHeight: 1 }}>{sym}</span>
    </div>
  );
}

function HandDisplay({ hand, jokerRank, label }: { hand: any[]; jokerRank?: string; label?: string }) {
  if (!hand?.length) return <span className="text-dark-muted text-xs">—</span>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 3, alignItems: "flex-start" }}>
      {hand.map((c: any, i: number) => (
        <MiniCard key={i} card={c} isJoker={jokerRank ? c.rank === jokerRank : false} />
      ))}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function dur(start: any, end: any) {
  if (!start || !end) return "—";
  const s = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}m ${sec}s`;
}

const AVATARS: Record<string, string> = {
  avatar_1: "🐯", avatar_2: "🦁", avatar_3: "🐺", avatar_4: "🦊",
  avatar_5: "🐻", avatar_6: "🦝", avatar_7: "🐸", avatar_8: "🦋",
  avatar_9: "🌟", avatar_10: "🔥", avatar_11: "💎", avatar_12: "🚀",
};
function ava(a: string) { return AVATARS[a] ?? "👤"; }

const TX_COLOR: Record<string, string> = {
  entry_fee: "#60a5fa", winning: "#00ff88", refund: "#fbbf24", failed: "#ff6b6b",
};
const TX_ICON: Record<string, string> = {
  entry_fee: "🎟️", winning: "🏆", refund: "↩️", failed: "❌",
};

const cardStyle: React.CSSProperties = {
  background: "rgba(12,14,18,0.95)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 16,
};

// ── Score Progression SVG Chart ───────────────────────────────────────────────

const PLAYER_COLORS = ["#00ff88", "#60a5fa", "#f59e0b", "#f43f5e", "#a78bfa", "#34d399"];

function ScoreChart({ game }: { game: any }) {
  const rounds = game.rounds ?? [];
  if (rounds.length === 0) return null;

  const players = game.players.filter((p: any) => !p.isBot);
  if (players.length === 0) return null;

  // Build per-player score series: [0, r1total, r2total, ...]
  const series: Record<string, number[]> = {};
  for (const p of players) {
    series[p.userId] = [0];
  }
  for (const r of rounds) {
    for (const p of players) {
      const pr = (r.playerResults ?? []).find((x: any) => x.username === p.username);
      const prev = series[p.userId][series[p.userId].length - 1];
      series[p.userId].push(pr ? pr.totalScore : prev);
    }
  }

  const allScores = Object.values(series).flat();
  const maxScore = Math.max(...allScores, 1);
  const W = 520, H = 160, PAD = 32;
  const innerW = W - PAD * 2, innerH = H - PAD * 2;
  const steps = rounds.length;

  const px = (i: number) => PAD + (i / steps) * innerW;
  const py = (s: number) => PAD + innerH - (s / maxScore) * innerH;

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(maxScore * f));

  return (
    <div className="rounded-2xl overflow-hidden" style={cardStyle}>
      <div className="px-5 pt-4 pb-2">
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#6b7280" }}>Score Progression</p>
        <p className="text-[10px] text-dark-muted mt-0.5">Cumulative round points per player</p>
      </div>
      <div className="px-3 pb-4" style={{ overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 320, height: H }}>
          {/* Grid */}
          {gridLines.map(v => (
            <g key={v}>
              <line x1={PAD} x2={W - PAD} y1={py(v)} y2={py(v)}
                stroke="rgba(255,255,255,0.05)" strokeWidth={1} strokeDasharray="4 4" />
              <text x={PAD - 4} y={py(v) + 3} textAnchor="end" fontSize={8} fill="#4b5563">{v}</text>
            </g>
          ))}
          {/* X axis labels */}
          {rounds.map((_: any, i: number) => (
            <text key={i} x={px(i + 1)} y={H - 6} textAnchor="middle" fontSize={8} fill="#4b5563">R{i + 1}</text>
          ))}
          {/* Lines */}
          {players.map((p: any, pi: number) => {
            const pts = series[p.userId];
            const color = PLAYER_COLORS[pi % PLAYER_COLORS.length];
            const d = pts.map((s, i) => `${i === 0 ? "M" : "L"}${px(i)},${py(s)}`).join(" ");
            return (
              <g key={p.userId}>
                <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
                  opacity={0.85} />
                {pts.map((s, i) => (
                  <circle key={i} cx={px(i)} cy={py(s)} r={3} fill={color} opacity={0.9} />
                ))}
              </g>
            );
          })}
        </svg>
        {/* Legend */}
        <div className="flex flex-wrap gap-3 px-2 pt-1">
          {players.map((p: any, pi: number) => (
            <div key={p.userId} className="flex items-center gap-1.5">
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: PLAYER_COLORS[pi % PLAYER_COLORS.length] }} />
              <span className="text-[11px]" style={{ color: PLAYER_COLORS[pi % PLAYER_COLORS.length] }}>{p.username}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Round Card ────────────────────────────────────────────────────────────────

function RoundCard({ round, players, roundIndex }: { round: any; players: any[]; roundIndex: number }) {
  const [open, setOpen] = useState(roundIndex === 0);
  const jokerRank: string = round.jokerRank;

  // Map showPlayerId to username
  const showPlayer = (round.playerResults ?? []).find((pr: any) => pr.playerId === round.showPlayerId);
  const showName = showPlayer?.username ?? round.showPlayerId?.slice(0, 8) ?? "—";
  const roundWinner = (round.playerResults ?? []).find((pr: any) => pr.playerId === round.winnerId);
  const winnerName = roundWinner?.username ?? "—";

  return (
    <div className="rounded-2xl overflow-hidden" style={cardStyle}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-white/[0.02]"
        style={{ borderBottom: open ? "1px solid rgba(255,255,255,0.06)" : "none" }}
      >
        <div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm"
          style={{ background: "rgba(99,102,241,0.18)", color: "#818cf8" }}>
          {round.roundNumber}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-white">Round {round.roundNumber}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
              style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24" }}>
              Joker: {jokerRank}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: "rgba(255,255,255,0.06)", color: "#9ca3af" }}>
              Show: {showName} {round.showPlayerWon ? "✅ Won" : "❌ Lost"}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
              style={{ background: "rgba(0,255,136,0.12)", color: "#00ff88" }}>
              🏆 {winnerName}
            </span>
          </div>
          {round.endedAt && (
            <p className="text-[10px] text-dark-muted mt-0.5">{fmt(round.endedAt)}</p>
          )}
        </div>
        <span className="text-dark-muted text-lg flex-shrink-0">{open ? "▲" : "▼"}</span>
      </button>

      {/* Body */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-5 py-4 space-y-3">
              {(round.playerResults ?? []).map((pr: any, i: number) => {
                const isRoundWinner = pr.playerId === round.winnerId;
                const isShowPlayer = pr.playerId === round.showPlayerId;
                const color = PLAYER_COLORS[i % PLAYER_COLORS.length];
                return (
                  <div
                    key={pr.playerId ?? i}
                    className="rounded-xl p-3"
                    style={{
                      background: isRoundWinner
                        ? "rgba(0,255,136,0.05)"
                        : "rgba(255,255,255,0.02)",
                      border: `1px solid ${isRoundWinner ? "rgba(0,255,136,0.2)" : "rgba(255,255,255,0.05)"}`,
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0"
                        style={{ background: color + "33", color }}>
                        {i + 1}
                      </div>
                      <span className="font-semibold text-sm text-white">{pr.username}</span>
                      {isShowPlayer && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                          style={{ background: "rgba(99,102,241,0.2)", color: "#818cf8" }}>SHOW</span>
                      )}
                      {isRoundWinner && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                          style={{ background: "rgba(0,255,136,0.18)", color: "#00ff88" }}>ROUND WIN</span>
                      )}
                      <div className="ml-auto flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-[10px] text-dark-muted">Points</p>
                          <p className="text-sm font-bold" style={{ color: pr.roundPoints === 0 ? "#00ff88" : "#fbbf24" }}>
                            +{pr.roundPoints}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-dark-muted">Total</p>
                          <p className="text-sm font-bold text-white">{pr.totalScore}</p>
                        </div>
                      </div>
                    </div>
                    {pr.hand && pr.hand.length > 0 && (
                      <HandDisplay hand={pr.hand} jokerRank={jokerRank} />
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main GameReview view ──────────────────────────────────────────────────────

function GameView({ game, transactions }: { game: any; transactions: any[] }) {
  const [roundPage, setRoundPage] = useState(0);
  const ROUNDS_PER_PAGE = 5;
  const rounds: any[] = game.rounds ?? [];
  const pageRounds = rounds.slice(roundPage * ROUNDS_PER_PAGE, (roundPage + 1) * ROUNDS_PER_PAGE);
  const totalRoundPages = Math.ceil(rounds.length / ROUNDS_PER_PAGE);

  // Compute net pot from actual transactions (entry_fee count − refund count) × fee
  // This is accurate even when players joined+paid then left before game started.
  const feeCount = transactions.filter((t: any) => t.type === "entry_fee").length;
  const refundCount = transactions.filter((t: any) => t.type === "refund").length;
  const netPaidCount = Math.max(0, feeCount - refundCount);
  const pot = game.entryFee * netPaidCount;
  const winnerObj = game.players?.find((p: any) => p.userId === game.winnerId || p.username === game.winnerUsername);
  const durationStr = dur(game.startedAt, game.endedAt);

  return (
    <div className="space-y-5">

      {/* ── Game Header ── */}
      <div className="rounded-2xl p-5" style={{
        background: "linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(168,85,247,0.08) 100%)",
        border: "1px solid rgba(99,102,241,0.25)",
      }}>
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-2xl font-black tracking-widest text-white font-mono">{game.roomId}</span>
              <span className="text-[11px] font-black px-2.5 py-1 rounded-full"
                style={{
                  background: game.status === "finished" ? "rgba(0,255,136,0.15)" : "rgba(251,191,36,0.15)",
                  color: game.status === "finished" ? "#00ff88" : "#fbbf24",
                  border: `1px solid ${game.status === "finished" ? "rgba(0,255,136,0.3)" : "rgba(251,191,36,0.3)"}`,
                }}>
                {game.status === "finished" ? "✓ FINISHED" : "● LIVE"}
              </span>
              {game.entryFee > 0 && (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)" }}>
                  💰 Cash ₹{game.entryFee}/player
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-dark-muted">
              <span>🕐 Started: <span className="text-white">{fmt(game.startedAt)}</span></span>
              {game.endedAt && <span>🏁 Ended: <span className="text-white">{fmt(game.endedAt)}</span></span>}
              <span>⏱ Duration: <span className="text-white">{durationStr}</span></span>
              <span>🔄 Rounds: <span className="text-white">{rounds.length}/{game.roundCount}</span></span>
            </div>
          </div>
          {winnerObj && (
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className="text-3xl">{ava(winnerObj.avatar)}</div>
              <div className="text-center">
                <p className="text-[10px] text-dark-muted">Winner</p>
                <p className="text-sm font-black text-neon-green">{winnerObj.username}</p>
                {pot > 0 && <p className="text-[11px] font-bold" style={{ color: "#fbbf24" }}>+₹{pot}</p>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Players Roster ── */}
      <div className="rounded-2xl overflow-hidden" style={cardStyle}>
        <div className="px-5 py-3 flex items-center justify-between flex-wrap gap-2"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <p className="text-xs font-bold uppercase tracking-wider text-dark-muted">
            Players · {game.players?.length ?? 0} played
          </p>
          {feeCount > netPaidCount && (
            <p className="text-[11px]" style={{ color: "#6b7280" }}>
              +{feeCount - netPaidCount} joined &amp; left before game started (refunded)
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-px" style={{ background: "rgba(255,255,255,0.04)" }}>
          {(game.players ?? []).map((p: any, i: number) => {
            const isWinner = p.userId === game.winnerId || p.username === game.winnerUsername;
            const color = PLAYER_COLORS[i % PLAYER_COLORS.length];
            return (
              <div key={p.userId ?? i} className="flex items-center gap-3 p-4"
                style={{ background: isWinner ? "rgba(0,255,136,0.04)" : "rgba(12,14,18,0.95)" }}>
                <div className="text-2xl flex-shrink-0">{p.isBot ? "🤖" : ava(p.avatar)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-bold text-white truncate">{p.username}</p>
                    {isWinner && <span className="text-[9px] px-1.5 py-0.5 rounded font-black"
                      style={{ background: "rgba(0,255,136,0.2)", color: "#00ff88" }}>WIN</span>}
                    {p.isBot && <span className="text-[9px] px-1.5 py-0.5 rounded"
                      style={{ background: "rgba(255,255,255,0.06)", color: "#6b7280" }}>BOT</span>}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color }}>
                    {p.totalScore} pts
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Financial Summary ── */}
      {transactions.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={cardStyle}>
          {/* Header with pot summary */}
          <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(251,191,36,0.04)" }}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-dark-muted">Financials</p>
              <div className="flex items-center gap-3 text-xs flex-wrap">
                <span className="text-dark-muted">{feeCount} paid · {refundCount} refunded · {netPaidCount} net played</span>
                {pot > 0 && (
                  <span className="font-black px-3 py-1 rounded-lg"
                    style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)" }}>
                    Prize Pot: ₹{pot}
                  </span>
                )}
              </div>
            </div>
            {refundCount > 0 && (
              <p className="text-[11px] mt-2 flex items-center gap-1.5" style={{ color: "#6b7280" }}>
                <span>ℹ️</span>
                {refundCount} player{refundCount > 1 ? "s" : ""} joined and paid but left before the game started — their entry fee was automatically refunded. Only {netPaidCount} player{netPaidCount !== 1 ? "s" : ""} actually played.
              </p>
            )}
          </div>

          <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
            {transactions.map((t: any, idx: number) => {
              const isFailed = t.status === "failed";
              const txKey = t.type as string;
              const col = TX_COLOR[isFailed ? "failed" : txKey] ?? "#9ca3af";
              const icon = TX_ICON[isFailed ? "failed" : txKey] ?? "💳";
              const isDebit = t.type === "entry_fee";
              const sign = isDebit ? "−" : "+";

              // Build a human-readable label
              const typeLabel: Record<string, string> = {
                entry_fee: "Entry Fee Paid",
                winning: "Prize Awarded",
                refund: "Entry Fee Refunded",
                failed: "Payment Failed",
              };
              const label = isFailed ? "Payment Failed" : (typeLabel[txKey] ?? txKey);

              // Refund context: explain why
              const refundReason = t.type === "refund"
                ? "Left room before game started"
                : null;

              return (
                <div key={t._id ?? idx} className="px-5 py-3.5"
                  style={{ background: isFailed ? "rgba(255,59,92,0.03)" : "transparent" }}>
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-base"
                      style={{ background: `${col}18`, border: `1px solid ${col}30` }}>
                      {icon}
                    </div>

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Player name — prominent */}
                        <span className="font-bold text-sm text-white">
                          {t.playerUsername ?? "Unknown"}
                        </span>
                        {/* Transaction type badge */}
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                          style={{ background: `${col}20`, color: col }}>
                          {label}
                        </span>
                        {isFailed && (
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded"
                            style={{ background: "rgba(255,59,92,0.2)", color: "#ff6b6b" }}>
                            FAILED
                          </span>
                        )}
                      </div>

                      {/* Refund reason */}
                      {refundReason && (
                        <p className="text-[11px] mt-0.5" style={{ color: "#6b7280" }}>
                          ↳ {refundReason}
                        </p>
                      )}

                      {/* Timestamp */}
                      <p className="text-[11px] text-dark-muted mt-0.5">{fmt(t.createdAt)}</p>

                      {/* Balance trail */}
                      {t.balanceBefore != null && t.balanceAfter != null && (t.balanceBefore !== 0 || t.balanceAfter !== 0) && (
                        <p className="text-[10px] mt-0.5 font-mono" style={{ color: "#374151" }}>
                          Wallet: ₹{t.balanceBefore} → ₹{t.balanceAfter}
                        </p>
                      )}
                    </div>

                    {/* Amount */}
                    <div className="text-right flex-shrink-0">
                      <p className="font-black text-base" style={{ color: isFailed ? "#ff6b6b" : col }}>
                        {sign}₹{t.amount}
                      </p>
                      <p className="text-[10px] capitalize" style={{ color: isFailed ? "#ff6b6b" : "#374151" }}>
                        {t.status}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Score Chart ── */}
      <ScoreChart game={game} />

      {/* ── Round Timeline ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold uppercase tracking-wider text-dark-muted">
            Round-by-Round Replay · {rounds.length} rounds
          </p>
          {totalRoundPages > 1 && (
            <div className="flex items-center gap-2">
              <button onClick={() => setRoundPage(p => Math.max(0, p - 1))} disabled={roundPage === 0}
                className="text-xs text-dark-muted disabled:opacity-30 hover:text-white px-2 py-1">← Prev</button>
              <span className="text-xs text-dark-muted">{roundPage + 1}/{totalRoundPages}</span>
              <button onClick={() => setRoundPage(p => Math.min(totalRoundPages - 1, p + 1))} disabled={roundPage === totalRoundPages - 1}
                className="text-xs text-dark-muted disabled:opacity-30 hover:text-white px-2 py-1">Next →</button>
            </div>
          )}
        </div>
        <div className="space-y-3">
          {pageRounds.map((r: any, i: number) => (
            <RoundCard
              key={r.roundNumber ?? i}
              round={r}
              players={game.players ?? []}
              roundIndex={i}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Root exported component ───────────────────────────────────────────────────

export default function GameReviewPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ game: any; transactions: any[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentCodes, setRecentCodes] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load recent missed payout codes for quick access
  useEffect(() => {
    admin.getMissedPayouts(1).then(r => {
      const codes = (r.data.orphaned ?? []).slice(0, 6).map((g: any) => g.roomId).filter(Boolean);
      setRecentCodes(codes);
    }).catch(() => {});
  }, []);

  // Listen for cross-navigation from MissedPayouts → GameReview
  useEffect(() => {
    const handler = (e: Event) => {
      const code = (e as CustomEvent).detail as string;
      if (code) { setQuery(code); search(code); }
    };
    window.addEventListener("admin:reviewRoom", handler);
    const pre = (window as any).__gameReviewCode as string | undefined;
    if (pre) { delete (window as any).__gameReviewCode; setQuery(pre); search(pre); }
    return () => window.removeEventListener("admin:reviewRoom", handler);
  }, []);

  const search = useCallback(async (code: string) => {
    const q = code.trim().toUpperCase();
    if (!q) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await admin.getGameReview(q);
      setResult(r.data);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? "Game not found");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="space-y-5">
      {/* ── Title ── */}
      <div>
        <h2 className="text-lg font-bold text-white">Game Review</h2>
        <p className="text-xs text-dark-muted mt-1">
          Search any room code to inspect round-by-round play, player hands, scores, and transactions.
        </p>
      </div>

      {/* ── Search Bar ── */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base pointer-events-none">🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === "Enter") search(query); }}
            placeholder="Enter Room Code (e.g. LKJ7SR)"
            maxLength={10}
            className="w-full pl-10 pr-4 py-3 rounded-xl text-sm font-mono font-bold text-white placeholder-dark-muted focus:outline-none transition-colors tracking-widest"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          />
          {query && (
            <button onClick={() => { setQuery(""); setResult(null); setError(null); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-muted hover:text-white text-xl leading-none">×</button>
          )}
        </div>
        <button
          onClick={() => search(query)}
          disabled={!query.trim() || loading}
          className="px-6 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-40 flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, rgba(99,102,241,0.8), rgba(168,85,247,0.8))",
            color: "#fff",
          }}
        >
          {loading ? (
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          ) : "Review"}
        </button>
      </div>

      {/* ── Quick links from missed payouts ── */}
      {recentCodes.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-dark-muted">⚠️ Missed payouts:</span>
          {recentCodes.map(code => (
            <button key={code} onClick={() => { setQuery(code); search(code); }}
              className="text-[11px] px-2.5 py-1 rounded-lg font-mono font-bold transition-all hover:bg-white/10"
              style={{ background: "rgba(251,191,36,0.08)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)" }}>
              {code}
            </button>
          ))}
        </div>
      )}

      {/* ── States ── */}
      <AnimatePresence mode="wait">
        {error && (
          <motion.div key="error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-2xl p-6 text-center"
            style={{ background: "rgba(255,59,92,0.06)", border: "1px solid rgba(255,59,92,0.2)" }}>
            <p className="text-3xl mb-2">🔍</p>
            <p className="text-sm font-bold text-white">Game not found</p>
            <p className="text-xs text-dark-muted mt-1">{error}</p>
          </motion.div>
        )}

        {!result && !error && !loading && (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="rounded-2xl p-10 text-center"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.06)" }}>
            <p className="text-4xl mb-3">🎮</p>
            <p className="text-sm font-bold text-white">Enter a Room Code</p>
            <p className="text-xs text-dark-muted mt-1 max-w-xs mx-auto">
              Search by 6-character room code to see full match details, player hands, round history, and financial audit.
            </p>
          </motion.div>
        )}

        {result && (
          <motion.div key="result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <GameView game={result.game} transactions={result.transactions} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
