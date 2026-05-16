import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface GameGuideModalProps {
  onClose: () => void;
}

type Section =
  | 'rules'
  | 'multiplayer'
  | 'vsai'
  | 'survival'
  | 'xp'
  | 'wallet';

const SECTIONS: { key: Section; icon: string; label: string }[] = [
  { key: 'rules',       icon: '🃏', label: 'Game Rules'     },
  { key: 'multiplayer', icon: '👥', label: 'Multiplayer'    },
  { key: 'vsai',        icon: '🤖', label: 'Play vs AI'     },
  { key: 'survival',    icon: '🏆', label: 'AI Tournament'  },
  { key: 'xp',         icon: '⭐', label: 'XP & Rewards'   },
  { key: 'wallet',      icon: '💰', label: 'Wallet'         },
];

function Divider() {
  return <div className="my-3 h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.07),transparent)' }} />;
}

function SectionTitle({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-lg">{icon}</span>
      <h3 className="text-sm font-black text-white uppercase tracking-widest">{text}</h3>
    </div>
  );
}

function Rule({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5"
        style={{ background: 'rgba(99,102,241,0.25)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.35)' }}>
        {n}
      </div>
      <p className="text-xs text-dark-text leading-relaxed" style={{ color: 'rgba(203,213,225,0.85)' }}>{text}</p>
    </div>
  );
}

function InfoBox({ icon, title, text, color = '#6366f1' }: { icon: string; title: string; text: string; color?: string }) {
  return (
    <div className="flex gap-3 p-3 rounded-xl" style={{ background: `${color}10`, border: `1px solid ${color}25` }}>
      <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>
      <div>
        <p className="text-xs font-black text-white mb-0.5">{title}</p>
        <p className="text-xs leading-relaxed" style={{ color: 'rgba(203,213,225,0.75)' }}>{text}</p>
      </div>
    </div>
  );
}

function Tag({ text, color }: { text: string; color: string }) {
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: `${color}20`, color, border: `1px solid ${color}35` }}>
      {text}
    </span>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
      <table className="w-full text-xs">
        <thead>
          <tr style={{ background: 'rgba(99,102,241,0.12)' }}>
            {headers.map(h => (
              <th key={h} className="px-3 py-2 text-left font-black uppercase tracking-wider"
                style={{ color: 'rgba(165,180,252,0.9)', fontSize: 9 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2" style={{ color: 'rgba(203,213,225,0.8)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Section content ────────────────────────────────────────────────────────────

function RulesSection() {
  return (
    <div className="space-y-4">
      <SectionTitle icon="🃏" text="Game Rules — 7 Cards" />

      <div className="space-y-2.5">
        <Rule n={1} text="Each player is dealt 7 cards. One card is revealed as the Joker — all cards of that rank score 0 points." />
        <Rule n={2} text="On your turn, draw one card from the closed deck or the top of the discard pile, then discard one card." />
        <Rule n={3} text="The goal is to get your hand total as LOW as possible. Lower score = better position." />
        <Rule n={4} text="When your hand total is 5 or less, you can press SHOW to declare. Other players reveal their hands." />
        <Rule n={5} text="The player with the lowest hand score wins the round. All others add their hand total to their running score." />
        <Rule n={6} text="After all rounds, the player with the LOWEST total score wins the match." />
      </div>

      <Divider />
      <SectionTitle icon="📊" text="Card Values" />
      <div className="grid grid-cols-2 gap-2">
        {[
          { cards: 'A',              pts: '1 pt',   note: 'Ace' },
          { cards: '2 – 9',          pts: 'Face value', note: 'e.g. 5♥ = 5 pts' },
          { cards: '10, J, Q, K',    pts: '10 pts', note: 'High cards' },
          { cards: 'Joker rank',     pts: '0 pts',  note: 'Revealed at start' },
          { cards: 'Printed Joker',  pts: '0 pts',  note: 'Wild card' },
        ].map(r => (
          <div key={r.cards} className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-white font-black text-xs w-20 flex-shrink-0">{r.cards}</span>
            <div>
              <p className="text-xs font-bold" style={{ color: '#a5b4fc' }}>{r.pts}</p>
              <p className="text-[10px]" style={{ color: 'rgba(148,163,184,0.6)' }}>{r.note}</p>
            </div>
          </div>
        ))}
      </div>

      <Divider />
      <SectionTitle icon="⚡" text="Special Cards" />
      <div className="space-y-2">
        <InfoBox icon="7️⃣" title="Seven — Attack Card" color="#ef4444"
          text="Discard a 7 to attack the next player. They must throw back a 7 to counter, or pick up penalty cards." />
        <InfoBox icon="🃏" title="Jack — Skip Card" color="#f59e0b"
          text="Discard a Jack to skip the next player's turn entirely." />
        <InfoBox icon="✂️" title="Cut Rule" color="#6366f1"
          text="If the top of the discard pile matches a card in your hand (same rank, non-7), you can cut in out of turn to discard it immediately." />
      </div>
    </div>
  );
}

function MultiplayerSection() {
  return (
    <div className="space-y-4">
      <SectionTitle icon="👥" text="Multiplayer — Real Players" />

      <InfoBox icon="➕" title="Create a Room" color="#10b981"
        text="Tap 'Create Room' to host a game. Set player count (2–6), number of rounds (1–20), turn timer (15–60s), and whether it's private or public." />
      <InfoBox icon="🔑" title="Join with Code" color="#6366f1"
        text="Every room gets a unique 6-digit code. Share it with friends or enter someone else's code to join their game." />
      <InfoBox icon="🌐" title="Public Rooms" color="#06b6d4"
        text="Browse open public rooms on the lobby. See player counts, round counts, and wager amounts before joining." />

      <Divider />
      <SectionTitle icon="⚔️" text="Wager Games" />
      <div className="space-y-2">
        <InfoBox icon="💰" title="How Wagers Work" color="#f59e0b"
          text="Create a room with a wager amount. Each player who joins pays that amount from their wallet. Winner takes the entire pot." />
        <div className="p-3 rounded-xl space-y-1.5" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}>
          <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: '#fbbf24' }}>Example</p>
          <p className="text-xs" style={{ color: 'rgba(203,213,225,0.8)' }}>₹10 wager · 4 players → <span className="text-yellow-300 font-bold">₹40 pot</span> to winner</p>
        </div>
        <InfoBox icon="🔒" title="Entry locked on join" color="#f87171"
          text="Once you join a wager room, the entry fee is deducted immediately. If the host cancels before the game starts, you are refunded." />
      </div>

      <Divider />
      <SectionTitle icon="🎮" text="Game Modes in Multiplayer" />
      <div className="space-y-2">
        {[
          { icon: '🆓', label: 'Free Play',    desc: 'Casual game, no entry fee, no wager. Just for fun.' },
          { icon: '⚔️', label: 'Wager Game',   desc: 'Competitive — pay an entry fee, winner takes the pot.' },
          { icon: '🔒', label: 'Private Room', desc: 'Invite-only room via code. Not visible in public lobby.' },
          { icon: '🌐', label: 'Public Room',  desc: 'Visible in the lobby. Anyone can join.' },
        ].map(m => (
          <div key={m.label} className="flex gap-3 items-start p-2.5 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-base flex-shrink-0">{m.icon}</span>
            <div>
              <p className="text-xs font-bold text-white">{m.label}</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'rgba(148,163,184,0.75)' }}>{m.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VsAISection() {
  return (
    <div className="space-y-4">
      <SectionTitle icon="🤖" text="Play vs AI — Practice & Fun" />

      <InfoBox icon="🎯" title="What is Play vs AI?" color="#6366f1"
        text="Play a private game against AI bots without needing other players. Great for practicing, learning the rules, or a quick solo game." />

      <Divider />
      <SectionTitle icon="🎮" text="4 Game Modes" />
      <div className="space-y-2">
        {[
          { icon: '⚔️', name: 'Casual Duel',    bots: '1 Bot',   desc: 'Relaxed 1v1 against a single AI. Best for beginners.' },
          { icon: '🔥', name: 'Survival Clash',  bots: '2 Bots',  desc: '1 vs 2 bots. Mid-difficulty. Practice multi-opponent tactics.' },
          { icon: '🌀', name: 'Chaos Arena',     bots: '3 Bots',  desc: '1 vs 3 bots. High pressure — keep your score low.' },
          { icon: '👑', name: 'Boss Rush',       bots: '4 Bots',  desc: '1 vs 4 bots. Maximum chaos. Survive to prove mastery.' },
        ].map(m => (
          <div key={m.name} className="flex gap-3 p-3 rounded-xl"
            style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
            <span className="text-xl flex-shrink-0">{m.icon}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-xs font-black text-white">{m.name}</p>
                <Tag text={m.bots} color="#a5b4fc" />
              </div>
              <p className="text-[11px]" style={{ color: 'rgba(148,163,184,0.75)' }}>{m.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <Divider />
      <SectionTitle icon="🧠" text="5 AI Personalities" />
      <div className="space-y-1.5">
        {[
          { icon: '🛡️', name: 'Safe AI',        color: '#22c55e', desc: 'Plays conservatively, discards high cards early.' },
          { icon: '⚡', name: 'Aggressive AI',  color: '#f59e0b', desc: 'Uses 7s and Jacks frequently to disrupt you.' },
          { icon: '🎭', name: 'Bluff AI',       color: '#a855f7', desc: 'Unpredictable discard patterns — hard to read.' },
          { icon: '🧠', name: 'Smart AI',       color: '#3b82f6', desc: 'Analyzes the discard pile and plays optimally.' },
          { icon: '💀', name: 'Boss AI',        color: '#ef4444', desc: 'Hardest AI — aggressive, smart, and nearly perfect.' },
        ].map(a => (
          <div key={a.name} className="flex gap-2.5 items-center px-3 py-2 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <span className="text-base">{a.icon}</span>
            <p className="text-xs font-bold w-28 flex-shrink-0" style={{ color: a.color }}>{a.name}</p>
            <p className="text-[11px] flex-1" style={{ color: 'rgba(148,163,184,0.7)' }}>{a.desc}</p>
          </div>
        ))}
      </div>

      <Divider />
      <InfoBox icon="💡" title="Tip" color="#22c55e"
        text="Bot games earn less XP than real player games to prevent farming, but are great for improving your skills before entering AI Survival or wager rooms." />
    </div>
  );
}

function SurvivalSection() {
  return (
    <div className="space-y-4">
      <SectionTitle icon="🏆" text="AI Survival Championship" />

      <InfoBox icon="🎯" title="What is AI Survival?" color="#10b981"
        text="A 5-stage tournament where you fight progressively harder AI opponents. Beat all 5 stages to become Champion and earn major rewards." />

      <Divider />
      <SectionTitle icon="🗂️" text="4 Difficulty Tiers" />
      <div className="space-y-2">
        {[
          { icon: '🟢', name: 'Beginner',   entry: '1,000 pts',  color: '#22c55e',  desc: 'New players. Lower entry, lower rewards.' },
          { icon: '🔵', name: 'Pro',        entry: '2,000 pts',  color: '#3b82f6',  desc: 'Intermediate players with solid fundamentals.' },
          { icon: '🟣', name: 'Elite',      entry: '5,000 pts',  color: '#a855f7',  desc: 'Experienced players. High risk, high reward.' },
          { icon: '🔴', name: 'Boss Arena', entry: '10,000 pts', color: '#ef4444',  desc: 'Top-tier only. Maximum challenge and payout.' },
        ].map(t => (
          <div key={t.name} className="flex gap-3 items-center p-3 rounded-xl"
            style={{ background: `${t.color}08`, border: `1px solid ${t.color}20` }}>
            <span className="text-xl">{t.icon}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-xs font-black" style={{ color: t.color }}>{t.name}</p>
                <Tag text={`Entry: ${t.entry}`} color={t.color} />
              </div>
              <p className="text-[11px] mt-0.5" style={{ color: 'rgba(148,163,184,0.7)' }}>{t.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <Divider />
      <SectionTitle icon="⚔️" text="5 Stages" />
      <div className="space-y-1.5">
        {[
          { stage: 1, vs: '1 Bot',   ai: 'Safe AI',                   color: '#22c55e' },
          { stage: 2, vs: '1 Bot',   ai: 'Aggressive AI',             color: '#f59e0b' },
          { stage: 3, vs: '1 Bot',   ai: 'Bluff AI',                  color: '#a855f7' },
          { stage: 4, vs: '2 Bots',  ai: 'Smart AI + Aggressive AI',  color: '#3b82f6' },
          { stage: 5, vs: '3 Bots',  ai: 'Boss + Smart + Aggressive', color: '#ef4444' },
        ].map(s => (
          <div key={s.stage} className="flex gap-3 items-center px-3 py-2.5 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0"
              style={{ background: `${s.color}22`, color: s.color, border: `1px solid ${s.color}40` }}>
              {s.stage}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold text-white">Stage {s.stage}</span>
              <span className="text-[10px] ml-2" style={{ color: 'rgba(148,163,184,0.6)' }}>{s.vs} · {s.ai}</span>
            </div>
          </div>
        ))}
      </div>

      <Divider />
      <SectionTitle icon="🏅" text="Win Condition" />
      <div className="space-y-2">
        <InfoBox icon="✅" title="You Win a Stage" color="#22c55e"
          text="Your hand score must be STRICTLY LOWER than ALL bots in the final round. Even a tie counts as a loss." />
        <InfoBox icon="❌" title="You're Eliminated" color="#ef4444"
          text="If any bot scores equal to or lower than you, you're eliminated. No refund once rounds have been played." />
        <InfoBox icon="💰" title="Rewards per Stage" color="#f59e0b"
          text="Each stage cleared earns you wallet points. Higher tiers earn more. Completing all 5 stages earns a Champion bonus on top." />
      </div>
    </div>
  );
}

function XPSection() {
  return (
    <div className="space-y-4">
      <SectionTitle icon="⭐" text="XP, Levels & Ranks" />

      <InfoBox icon="📈" title="What is XP?" color="#6366f1"
        text="XP (Experience Points) measure your progress. Earn XP by playing and winning games. XP fills your level bar and unlocks higher ranks." />

      <Divider />
      <SectionTitle icon="🎮" text="XP Earned Per Action" />
      <Table
        headers={['Action', 'XP']}
        rows={[
          ['Win vs real player', <span style={{ color: '#4ade80', fontWeight: 700 }}>+40 XP</span>],
          ['Lose a game',        '+10 XP'],
          ['Win vs AI bot',      '+15 XP'],
          ['Clear Survival Stage 1–4', '+30 XP each'],
          ['Clear Survival Stage 5 (Boss)', <span style={{ color: '#f59e0b', fontWeight: 700 }}>+80 XP</span>],
          ['Complete Championship', <span style={{ color: '#a855f7', fontWeight: 700 }}>+220 XP</span>],
        ]}
      />

      <Divider />
      <SectionTitle icon="🏅" text="Ranks" />
      <div className="space-y-1.5">
        {[
          { icon: '🥉', rank: 'Bronze',   levels: '1–5',   color: '#cd7f32' },
          { icon: '🥈', rank: 'Silver',   levels: '6–15',  color: '#c0c0c0' },
          { icon: '🥇', rank: 'Gold',     levels: '16–30', color: '#ffd700' },
          { icon: '💎', rank: 'Platinum', levels: '31–50', color: '#e5e4e2' },
          { icon: '💠', rank: 'Diamond',  levels: '51–75', color: '#b9f2ff' },
          { icon: '👑', rank: 'Master',   levels: '76+',   color: '#ff6b35' },
        ].map(r => (
          <div key={r.rank} className="flex items-center gap-3 px-3 py-2 rounded-lg"
            style={{ background: `${r.color}08`, border: `1px solid ${r.color}20` }}>
            <span className="text-base">{r.icon}</span>
            <p className="text-xs font-black w-20" style={{ color: r.color }}>{r.rank}</p>
            <p className="text-xs" style={{ color: 'rgba(148,163,184,0.7)' }}>Levels {r.levels}</p>
          </div>
        ))}
      </div>

      <Divider />
      <SectionTitle icon="🎁" text="Reward Points (Wallet)" />
      <InfoBox icon="💡" title="XP ≠ Points" color="#6366f1"
        text="XP is for progression only. Points are a separate currency that converts to wallet balance at 100 pts = ₹1." />

      <div className="mt-2 space-y-2">
        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'rgba(165,180,252,0.7)' }}>Daily Login Streak</p>
        <Table
          headers={['Day', 'Points', 'Wallet']}
          rows={[
            ['Day 1', '20 pts', '₹0.20'],
            ['Day 2', '30 pts', '₹0.30'],
            ['Day 3', '50 pts', '₹0.50'],
            ['Day 4', '40 pts', '₹0.40'],
            ['Day 5', '50 pts', '₹0.50'],
            ['Day 6', '75 pts', '₹0.75'],
            [<span className="font-bold" style={{ color: '#fbbf24' }}>Day 7 🏆</span>, <span style={{ color: '#fbbf24', fontWeight: 700 }}>150 pts</span>, <span style={{ color: '#4ade80', fontWeight: 700 }}>₹1.50</span>],
          ]}
        />
      </div>

      <div className="mt-2 space-y-2">
        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'rgba(165,180,252,0.7)' }}>Lucky Spin (once/day)</p>
        <Table
          headers={['Prize', 'Chance', 'Wallet']}
          rows={[
            ['Blank', '30%', '—'],
            ['+20 pts', '25%', '₹0.20'],
            ['+40 pts', '20%', '₹0.40'],
            ['+100 pts', '12%', '₹1.00'],
            ['+200 pts', '8%', '₹2.00'],
            [<span style={{ color: '#fbbf24' }}>Jackpot +400</span>, '4%', <span style={{ color: '#fbbf24' }}>₹4.00</span>],
            [<span style={{ color: '#ef4444', fontWeight: 700 }}>MEGA +1500</span>, '1%', <span style={{ color: '#ef4444', fontWeight: 700 }}>₹15.00</span>],
          ]}
        />
      </div>

      <div className="mt-2 space-y-2">
        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'rgba(165,180,252,0.7)' }}>Top Achievement Rewards</p>
        <Table
          headers={['Achievement', 'Trigger', 'Points']}
          rows={[
            ['First Blood', 'First win', '25 pts'],
            ['Hot Streak', '3-win streak', '50 pts'],
            ['On Fire', '5-win streak', '100 pts'],
            ['Unstoppable', '10-win streak', '400 pts'],
            ['Boss Slayer', 'Beat Boss AI', '100 pts'],
            ['Loyal Player', '30-day login', '400 pts'],
            [<span style={{ color: '#ff6b35', fontWeight: 700 }}>Grand Master</span>, 'Reach Master', <span style={{ color: '#ff6b35', fontWeight: 700 }}>1,000 pts</span>],
          ]}
        />
      </div>
    </div>
  );
}

function WalletSection() {
  return (
    <div className="space-y-4">
      <SectionTitle icon="💰" text="Wallet — Deposit & Withdrawal" />

      <InfoBox icon="💡" title="How the Wallet Works" color="#6366f1"
        text="Your wallet holds real money used for wager games and AI Survival entry fees. You earn wallet balance by winning games, completing achievements, and daily rewards." />

      <Divider />
      <SectionTitle icon="⬇️" text="Deposit (Add Money)" />
      <div className="space-y-2">
        <InfoBox icon="🎟️" title="Submit a Gift Voucher" color="#6366f1"
          text="Have an Amazon, Flipkart, Myntra, Ajio, Swiggy, or Zomato gift voucher? Submit it in your Wallet page. Admin verifies and credits your wallet within 24 hours." />
        <div className="p-3 rounded-xl space-y-2" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
          <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: '#a5b4fc' }}>How to Submit</p>
          <div className="space-y-1">
            {[
              '1. Go to Wallet → Submit Voucher',
              '2. Choose the voucher brand',
              '3. Select amount (₹50 or ₹100)',
              '4. Enter voucher code, PIN, and expiry',
              '5. Optionally upload a screenshot',
              '6. Submit — admin approves within 24h',
            ].map(s => (
              <p key={s} className="text-xs" style={{ color: 'rgba(203,213,225,0.75)' }}>{s}</p>
            ))}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {['📦 Amazon', '🛒 Flipkart', '👗 Myntra', '👔 Ajio', '🍔 Swiggy', '🍕 Zomato'].map(b => (
            <Tag key={b} text={b} color="#6366f1" />
          ))}
        </div>
        <InfoBox icon="⚠️" title="Daily Limit" color="#f59e0b"
          text="Maximum ₹300 deposit per day via gift vouchers. Vouchers must be ₹50 or ₹100 denomination only." />
      </div>

      <Divider />
      <SectionTitle icon="⬆️" text="Withdrawal (Redeem Rewards)" />
      <div className="space-y-2">
        <InfoBox icon="🎁" title="Redeem as Gift Voucher" color="#a855f7"
          text="Once you have ₹50 or more in your wallet, you can redeem it as a gift voucher from any supported brand. Admin delivers the voucher within 24 hours." />
        <div className="p-3 rounded-xl space-y-2" style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.15)' }}>
          <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: '#d8b4fe' }}>How to Redeem</p>
          <div className="space-y-1">
            {[
              '1. Go to Wallet → Redeem Rewards',
              '2. Choose your preferred brand',
              '3. Enter amount (₹50 – ₹500)',
              '4. Submit redemption request',
              '5. Admin delivers voucher within 24h',
              '6. View code in Wallet → Received tab',
            ].map(s => (
              <p key={s} className="text-xs" style={{ color: 'rgba(203,213,225,0.75)' }}>{s}</p>
            ))}
          </div>
        </div>
        <InfoBox icon="🔒" title="Voucher Privacy" color="#3b82f6"
          text="Received voucher codes are masked by default. Tap the eye icon to reveal your voucher code and PIN securely." />
      </div>

      <Divider />
      <SectionTitle icon="📊" text="Conversion Rate" />
      <div className="grid grid-cols-3 gap-2">
        {[
          { from: '100 pts', to: '₹1.00', color: '#6366f1' },
          { from: '500 pts', to: '₹5.00', color: '#a855f7' },
          { from: '1000 pts', to: '₹10.00', color: '#f59e0b' },
        ].map(c => (
          <div key={c.from} className="flex flex-col items-center gap-1 p-3 rounded-xl text-center"
            style={{ background: `${c.color}0d`, border: `1px solid ${c.color}25` }}>
            <p className="text-xs font-bold" style={{ color: c.color }}>{c.from}</p>
            <p className="text-[10px]" style={{ color: 'rgba(148,163,184,0.6)' }}>equals</p>
            <p className="text-sm font-black text-white">{c.to}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Modal ─────────────────────────────────────────────────────────────────

export function GameGuideModal({ onClose }: GameGuideModalProps) {
  const [active, setActive] = useState<Section>('rules');

  const CONTENT: Record<Section, React.ReactNode> = {
    rules:       <RulesSection />,
    multiplayer: <MultiplayerSection />,
    vsai:        <VsAISection />,
    survival:    <SurvivalSection />,
    xp:          <XPSection />,
    wallet:      <WalletSection />,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 60 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="relative w-full sm:max-w-2xl flex flex-col"
        style={{
          height: '90dvh',
          background: 'rgba(6,6,20,0.97)',
          border: '1px solid rgba(99,102,241,0.25)',
          borderRadius: '24px 24px 0 0',
          boxShadow: '0 -20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
          ...(window.innerWidth >= 640 ? { borderRadius: 24 } : {}),
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <h2 className="text-base font-black text-white">📖 How to Play</h2>
            <p className="text-[10px] mt-0.5" style={{ color: 'rgba(148,163,184,0.6)' }}>
              Complete guide — Arena of Sevens
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-sm transition-all"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
            ✕
          </button>
        </div>

        {/* Section tabs — horizontal scroll */}
        <div className="relative flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div
            className="flex gap-1.5 px-4 py-3 overflow-x-auto"
            style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
          >
            {SECTIONS.map(s => (
              <button
                key={s.key}
                onClick={() => setActive(s.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all flex-shrink-0 text-xs"
                style={active === s.key
                  ? { background: 'linear-gradient(135deg,rgba(99,102,241,0.35),rgba(168,85,247,0.2))', color: '#c7d2fe', border: '1px solid rgba(99,102,241,0.4)', boxShadow: '0 0 12px rgba(99,102,241,0.2)' }
                  : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span>{s.icon}</span>
                <span>{s.label}</span>
              </button>
            ))}
            {/* Extra right padding so last tab isn't hidden under fade */}
            <div className="w-8 flex-shrink-0" />
          </div>
          {/* Right-edge fade — signals more tabs to scroll */}
          <div className="absolute right-0 top-0 bottom-0 w-12 pointer-events-none"
            style={{ background: 'linear-gradient(to left, rgba(6,6,20,0.97) 20%, transparent)' }} />
          {/* Scroll hint arrow */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[10px] font-black"
            style={{ color: 'rgba(165,180,252,0.5)' }}>›</div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(99,102,241,0.3) transparent' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18 }}
            >
              {CONTENT[active]}
            </motion.div>
          </AnimatePresence>
          <div className="h-6" />
        </div>
      </motion.div>
    </div>
  );
}
