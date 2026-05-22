import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { useSurvivalStore } from '../store/survivalStore';
import { useGameStore } from '../store/gameStore';
import { socketSurvival, socketTeam, socketGame, on } from '../services/socket';
import { survivalApi, walletApi, configApi } from '../services/api';
import { StageIntro } from '../components/survival/StageIntro';
import { Layout } from '../components/layout/Layout';

function loadSurvivalStatus(setActiveStatus: (v: any) => void, setStatusChecked: (v: boolean) => void) {
  survivalApi.status()
    .then(r => { setActiveStatus(r.data.survival); setStatusChecked(true); })
    .catch(() => setStatusChecked(true));
}

// ── Constants ─────────────────────────────────────────────────────────────────

const POINTS_PER_RUPEE = 100;

const STAGES = [
  { stage: 1, name: 'Warmup Duel',       botCount: 1, emojis: ['🥊'],             color: '#22c55e', desc: 'Defensive & cautious opener',            difficulty: 'Easy'   },
  { stage: 2, name: 'Tactical Pressure', botCount: 1, emojis: ['⚡'],             color: '#f59e0b', desc: 'Fast attacks & relentless pressure',      difficulty: 'Medium' },
  { stage: 3, name: 'Mind Games',        botCount: 1, emojis: ['🎭'],             color: '#a855f7', desc: 'Deceptive bluffs & unpredictable plays',  difficulty: 'Hard'   },
  { stage: 4, name: 'Survival Clash',    botCount: 2, emojis: ['🧠','⚔️'],       color: '#3b82f6', desc: 'Dual threat — Smart + Aggressive AI',     difficulty: 'Expert' },
  { stage: 5, name: 'Final Arena',       botCount: 3, emojis: ['💀','🧠','⚔️'], color: '#ef4444', desc: 'Boss + Elite Duo — survive to win',       difficulty: 'Boss'   },
];

const AI_PERSONALITIES = [
  { stage: 1, icon: '🛡️', name: 'Iron Fist',   type: 'The Cautious Defender',     desc: 'Patient and methodical. Waits for your mistakes before striking.',    color: '#22c55e', accent: 'rgba(34,197,94,0.07)'   },
  { stage: 2, icon: '🔥', name: 'Blaze',        type: 'The Relentless Attacker',   desc: 'Constant pressure. Never lets you breathe. Attack or be overwhelmed.', color: '#f59e0b', accent: 'rgba(245,158,11,0.07)'  },
  { stage: 3, icon: '🌀', name: 'Phantom',      type: 'The Mind Bender',           desc: 'Unpredictable bluffs and misdirection. You can never read its hand.',  color: '#a855f7', accent: 'rgba(168,85,247,0.07)'  },
  { stage: 4, icon: '🧠', name: 'Dual Core',    type: 'Smart + Aggressive Tandem', desc: 'Two coordinated AIs with opposing styles. Split your focus or fall.',  color: '#3b82f6', accent: 'rgba(59,130,246,0.07)'  },
  { stage: 5, icon: '👑', name: 'Apex Trinity', type: 'Final Boss + Elite Guard',  desc: 'Three synchronized AIs. One wrong move ends everything. Win or die.',  color: '#ef4444', accent: 'rgba(239,68,68,0.07)'   },
];

const TEAM_STAGES = [
  { stage: 1, name: 'Guardian Clash',  botCount: 2, emojis: ['🛡️','🔥'],  color: '#22c55e', desc: 'Defender + Attacker',        difficulty: 'Easy'   },
  { stage: 2, name: 'Force & Mind',    botCount: 2, emojis: ['💥','🧠'],  color: '#f59e0b', desc: 'Aggression + Strategy',      difficulty: 'Medium' },
  { stage: 3, name: 'Shadow Minds',    botCount: 2, emojis: ['🌀','🧠'],  color: '#a855f7', desc: 'Deception + Strategy',       difficulty: 'Hard'   },
  { stage: 4, name: 'Chaos Duo',       botCount: 2, emojis: ['🌀','🌪️'], color: '#3b82f6', desc: 'Bluff + Relentless Force',   difficulty: 'Expert' },
  { stage: 5, name: 'Final Overlords', botCount: 2, emojis: ['💀','🔒'],  color: '#ef4444', desc: 'Boss + Warden (Care AI)',    difficulty: 'Boss'   },
];

const TIER_DISPLAY = [
  { id: 'beginner',   label: 'Beginner',   icon: '🥉', color: '#22c55e', glow: 'rgba(34,197,94,0.15)',  defaultPoints: 1000,  defaultRewards: [200, 400, 700, 1200, 2500]   },
  { id: 'pro',        label: 'Pro',        icon: '🥈', color: '#60a5fa', glow: 'rgba(96,165,250,0.15)', defaultPoints: 2000,  defaultRewards: [400, 800, 1400, 2400, 5000]  },
  { id: 'elite',      label: 'Elite',      icon: '🥇', color: '#fbbf24', glow: 'rgba(251,191,36,0.15)', defaultPoints: 5000,  defaultRewards: [1000, 2000, 3500, 6000, 12500] },
  { id: 'boss_arena', label: 'Boss Arena', icon: '💎', color: '#ef4444', glow: 'rgba(239,68,68,0.15)',  defaultPoints: 10000, defaultRewards: [2000, 4000, 7000, 12000, 25000] },
];

// ── Battle Illustration ───────────────────────────────────────────────────────

function BattleIllustration() {
  // AI personality data for the banner
  const AIS = [
    { x: 418, y: 148, r: 22, emoji: '🛡️', color: '#22c55e', label: 'Iron Fist',   fs: 14 },
    { x: 468, y: 142, r: 22, emoji: '🔥', color: '#f59e0b', label: 'Blaze',        fs: 14 },
    { x: 518, y: 148, r: 22, emoji: '🌀', color: '#a855f7', label: 'Phantom',      fs: 14 },
    { x: 432, y: 105, r: 26, emoji: '🧠', color: '#3b82f6', label: 'Smart AI',     fs: 16 },
    { x: 504, y: 105, r: 26, emoji: '⚡', color: '#f59e0b', label: 'Aggressive',   fs: 16 },
  ];

  return (
    <div className="relative rounded-2xl overflow-hidden w-full"
      style={{ background: 'linear-gradient(160deg,#04060e 0%,#0a0d1f 55%,#060410 100%)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <svg viewBox="0 0 600 230" xmlns="http://www.w3.org/2000/svg" className="w-full" style={{ display: 'block' }}>
        <defs>
          {/* Atmospheric glows */}
          <radialGradient id="bi-lg" cx="20%" cy="55%" r="45%">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.2"/>
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="bi-rg" cx="80%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.22"/>
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="bi-cg" cx="50%" cy="45%" r="28%">
            <stop offset="0%" stopColor="#6d28d9" stopOpacity="0.35"/>
            <stop offset="100%" stopColor="#6d28d9" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="bi-boss" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.45"/>
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="bi-human" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.35"/>
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0"/>
          </radialGradient>
          {/* VS gradient */}
          <linearGradient id="bi-vs" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fbbf24"/>
            <stop offset="50%" stopColor="#ffffff"/>
            <stop offset="100%" stopColor="#ef4444"/>
          </linearGradient>
          {/* Trophy gradient */}
          <linearGradient id="bi-trophy" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fbbf24"/>
            <stop offset="100%" stopColor="#d97706"/>
          </linearGradient>
          {/* Filters */}
          <filter id="bi-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="bi-softglow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="8" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="bi-bloom" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="12" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <style>{`
            @keyframes bi-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
            @keyframes bi-float2{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
            @keyframes bi-pulse{0%,100%{opacity:.6}50%{opacity:1}}
            @keyframes bi-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
            @keyframes bi-spark{0%,100%{opacity:0;transform:scale(0)}45%,55%{opacity:1;transform:scale(1)}}
            @keyframes bi-blink{0%,85%,100%{opacity:1}92%{opacity:0.1}}
            @keyframes bi-hb{0%,100%{transform:scale(1)}20%{transform:scale(1.06)}40%{transform:scale(1)}}
            .bif{animation:bi-float 3.2s ease-in-out infinite}
            .bif2{animation:bi-float2 2.8s ease-in-out infinite .6s}
            .bif3{animation:bi-float2 3.6s ease-in-out infinite 1.2s}
            .bip{animation:bi-pulse 2s ease-in-out infinite}
            .bihb{animation:bi-hb 1.4s ease-in-out infinite}
            .bibl{animation:bi-blink 3s ease-in-out infinite}
            .bis1{animation:bi-spark 2.2s ease-in-out infinite}
            .bis2{animation:bi-spark 2.2s ease-in-out infinite .4s}
            .bis3{animation:bi-spark 2.2s ease-in-out infinite .8s}
            .bis4{animation:bi-spark 2.2s ease-in-out infinite 1.2s}
            .bis5{animation:bi-spark 2.2s ease-in-out infinite 1.6s}
          `}</style>
        </defs>

        {/* ── Atmosphere ── */}
        <rect width="600" height="230" fill="url(#bi-lg)"/>
        <rect width="600" height="230" fill="url(#bi-rg)"/>
        <rect width="600" height="230" fill="url(#bi-cg)"/>

        {/* Subtle grid lines */}
        <g opacity="0.03" stroke="#fff" strokeWidth="0.5">
          {[0,1,2,3,4,5,6,7,8,9,10].map(i=><line key={`h${i}`} x1="0" y1={i*23} x2="600" y2={i*23}/>)}
          {[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29].map(i=><line key={`v${i}`} x1={i*21} y1="0" x2={i*21} y2="230"/>)}
        </g>

        {/* Arena floor glow line */}
        <rect x="0" y="180" width="600" height="1" fill="none" opacity="0"/>
        <line x1="50" y1="182" x2="550" y2="182" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>

        {/* ══════════════════════════════════════════
            HUMAN CHAMPION — LEFT
        ══════════════════════════════════════════ */}
        <g className="bif">
          {/* Outer aura ring */}
          <circle cx="110" cy="100" r="72" fill="url(#bi-human)" opacity="0.5"/>
          <circle cx="110" cy="100" r="62" fill="none" stroke="#fbbf24" strokeWidth="0.5" opacity="0.12" className="bip"/>

          {/* Champion ring (spinning dashes) */}
          <circle cx="110" cy="100" r="52" fill="none" stroke="#fbbf24" strokeWidth="1.2" strokeDasharray="6 4" opacity="0.3" className="bip"/>

          {/* Shield body */}
          <path d="M110 52 L140 68 L140 100 Q140 122 110 134 Q80 122 80 100 L80 68 Z"
            fill="#0d1117" stroke="#fbbf24" strokeWidth="2" filter="url(#bi-glow)"/>
          {/* Shield inner border */}
          <path d="M110 60 L133 74 L133 100 Q133 117 110 126 Q87 117 87 100 L87 74 Z"
            fill="none" stroke="#fbbf24" strokeWidth="0.6" opacity="0.35"/>

          {/* Sword on shield */}
          <line x1="110" y1="72" x2="110" y2="118" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" filter="url(#bi-glow)"/>
          <line x1="98" y1="87" x2="122" y2="87" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" filter="url(#bi-glow)"/>
          <circle cx="110" cy="72" r="4" fill="#fbbf24" filter="url(#bi-glow)"/>

          {/* Star badge */}
          <text x="110" y="147" textAnchor="middle" fill="#fbbf24" fontSize="9" fontWeight="900" letterSpacing="4" opacity="0.8">YOU</text>
          <text x="110" y="157" textAnchor="middle" fill="#fbbf24" fontSize="7" fontWeight="700" letterSpacing="2" opacity="0.5">CHAMPION</text>
        </g>

        {/* Card fan (human) */}
        <g className="bif">
          <g transform="translate(54,118) rotate(-20,12,17)">
            <rect width="25" height="35" rx="3" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1"/>
            <text x="12" y="22" textAnchor="middle" fill="#09090f" fontSize="12" fontWeight="900">7</text>
          </g>
          <g transform="translate(74,112) rotate(-7,12,17)">
            <rect width="25" height="35" rx="3" fill="#fff" stroke="#e5e7eb" strokeWidth="0.8"/>
            <text x="12" y="22" textAnchor="middle" fill="#dc2626" fontSize="12" fontWeight="900">♥</text>
          </g>
          <g transform="translate(93,112) rotate(6,12,17)">
            <rect width="25" height="35" rx="3" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1"/>
            <text x="12" y="22" textAnchor="middle" fill="#09090f" fontSize="12" fontWeight="900">K</text>
          </g>
          <g transform="translate(112,116) rotate(19,12,17)">
            <rect width="25" height="35" rx="3" fill="#fff" stroke="#e5e7eb" strokeWidth="0.8"/>
            <text x="12" y="22" textAnchor="middle" fill="#1e293b" fontSize="12" fontWeight="900">♠</text>
          </g>
        </g>

        {/* Human spark particles */}
        <circle cx="72"  cy="68" r="2.5" fill="#fbbf24" className="bis1"/>
        <circle cx="55"  cy="90" r="2"   fill="#fbbf24" className="bis3"/>
        <circle cx="150" cy="70" r="2.5" fill="#fbbf24" className="bis5"/>
        <circle cx="160" cy="108"r="2"   fill="#fbbf24" className="bis2"/>

        {/* ══════════════════════════════════════════
            CENTER — VS + CHAMPIONSHIP
        ══════════════════════════════════════════ */}

        {/* Orbit rings */}
        <circle cx="295" cy="98" r="50" fill="none" stroke="#6d28d9" strokeWidth="0.5" strokeDasharray="4 5" opacity="0.3" className="bip"/>
        <circle cx="295" cy="98" r="35" fill="none" stroke="#7c3aed" strokeWidth="0.5" opacity="0.2" className="bip"/>

        {/* Trophy shape */}
        <g filter="url(#bi-glow)" opacity="0.9">
          {/* Cup body */}
          <path d="M283 62 L307 62 L307 88 Q307 96 295 98 Q283 96 283 88 Z" fill="url(#bi-trophy)"/>
          {/* Cup handles */}
          <path d="M283 66 Q272 66 272 76 Q272 86 283 86" fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round"/>
          <path d="M307 66 Q318 66 318 76 Q318 86 307 86" fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round"/>
          {/* Stem */}
          <rect x="291" y="98" width="8" height="10" fill="#fbbf24"/>
          {/* Base */}
          <rect x="284" y="108" width="22" height="4" rx="2" fill="#fbbf24"/>
          {/* Star on cup */}
          <text x="295" y="84" textAnchor="middle" fontSize="12" fill="#0d1117" fontWeight="900">★</text>
        </g>

        {/* VS text */}
        <text x="295" y="136" textAnchor="middle" fill="#6d28d9" fontSize="28" fontWeight="900" fontFamily="Arial Black,Arial" opacity="0.4" filter="url(#bi-bloom)">VS</text>
        <text x="295" y="136" textAnchor="middle" fill="url(#bi-vs)" fontSize="28" fontWeight="900" fontFamily="Arial Black,Arial" letterSpacing="-1">VS</text>

        {/* "1 vs 5" badge */}
        <rect x="270" y="143" width="50" height="14" rx="7" fill="rgba(109,40,217,0.25)" stroke="rgba(109,40,217,0.5)" strokeWidth="1"/>
        <text x="295" y="153" textAnchor="middle" fill="#a78bfa" fontSize="7" fontWeight="800" letterSpacing="2">1 vs 5 AI</text>

        {/* Energy bolts (left→right) */}
        <path d="M175 92 L220 105 L205 105 L248 118" stroke="#fbbf24" strokeWidth="1.8" fill="none" strokeLinecap="round" opacity="0.6" filter="url(#bi-glow)"/>
        <path d="M415 92 L370 105 L385 105 L342 118" stroke="#ef4444" strokeWidth="1.8" fill="none" strokeLinecap="round" opacity="0.6" filter="url(#bi-glow)"/>

        {/* Center sparks */}
        <circle cx="260" cy="80" r="3" fill="#a855f7" className="bis2"/>
        <circle cx="330" cy="80" r="3" fill="#a855f7" className="bis4"/>
        <circle cx="275" cy="120" r="2" fill="#60a5fa" className="bis1"/>
        <circle cx="315" cy="120" r="2" fill="#f59e0b" className="bis3"/>

        {/* ══════════════════════════════════════════
            5 AI PERSONALITIES — RIGHT PYRAMID
            Row 1 (small): Iron Fist · Blaze · Phantom
            Row 2 (medium): Smart AI · Aggressive AI
            Row 3 (BOSS): Apex Trinity
        ══════════════════════════════════════════ */}

        {/* Row 1 — small AI cards */}
        {AIS.map((ai, i) => (
          <g key={i} className={i % 2 === 0 ? 'bif3' : 'bif2'}>
            {/* Glow halo */}
            <circle cx={ai.x} cy={ai.y} r={ai.r + 6} fill="none" stroke={ai.color} strokeWidth="1" opacity="0.2" className="bip"/>
            {/* Circle body */}
            <circle cx={ai.x} cy={ai.y} r={ai.r} fill="#0d1117" stroke={ai.color} strokeWidth="1.8" filter="url(#bi-glow)"
              style={{ filter: `drop-shadow(0 0 6px ${ai.color}60)` }}/>
            {/* Emoji */}
            <text x={ai.x} y={ai.y + 6} textAnchor="middle" fontSize={ai.fs}>{ai.emoji}</text>
            {/* Name label */}
            <text x={ai.x} y={ai.y + ai.r + 10} textAnchor="middle" fill={ai.color} fontSize="6.5" fontWeight="800" opacity="0.85">
              {ai.label.split(' ')[0].toUpperCase()}
            </text>
          </g>
        ))}

        {/* Connector lines between AIs */}
        <line x1="418" y1="127" x2="432" y2="131" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="2 3"/>
        <line x1="468" y1="122" x2="468" y2="131" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="2 3"/>
        <line x1="518" y1="127" x2="504" y2="131" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="2 3"/>
        <line x1="432" y1="79"  x2="468" y2="62"  stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="2 3"/>
        <line x1="504" y1="79"  x2="468" y2="62"  stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="2 3"/>

        {/* ── BOSS AI — Apex Trinity (top center of pyramid) ── */}
        <g className="bif">
          {/* Boss outer bloom */}
          <circle cx="468" cy="55" r="50" fill="url(#bi-boss)" opacity="0.6"/>
          {/* Boss orbit ring */}
          <circle cx="468" cy="55" r="40" fill="none" stroke="#ef4444" strokeWidth="0.8" strokeDasharray="5 4" opacity="0.35" className="bip"/>
          <circle cx="468" cy="55" r="32" fill="none" stroke="#ef4444" strokeWidth="0.5" opacity="0.2" className="bip"/>
          {/* Boss circle body */}
          <circle cx="468" cy="55" r="28" fill="#130509" stroke="#ef4444" strokeWidth="2.5"
            style={{ filter: 'drop-shadow(0 0 14px rgba(239,68,68,0.8))' }}/>
          {/* Inner ring */}
          <circle cx="468" cy="55" r="22" fill="none" stroke="#ef4444" strokeWidth="0.6" opacity="0.4"/>
          {/* Skull emoji */}
          <text x="468" y="64" textAnchor="middle" fontSize="26" className="bihb">💀</text>
          {/* BOSS label */}
          <rect x="449" y="85" width="38" height="13" rx="6.5" fill="rgba(239,68,68,0.2)" stroke="rgba(239,68,68,0.5)" strokeWidth="1"/>
          <text x="468" y="95" textAnchor="middle" fill="#ef4444" fontSize="7.5" fontWeight="900" letterSpacing="3">BOSS</text>
          {/* Apex Trinity sub-label */}
          <text x="468" y="108" textAnchor="middle" fill="#ef4444" fontSize="6" fontWeight="700" letterSpacing="1" opacity="0.6">APEX TRINITY</text>
        </g>

        {/* Boss spark particles */}
        <circle cx="438" cy="30" r="3" fill="#ef4444" className="bis1"/>
        <circle cx="499" cy="28" r="2" fill="#ef4444" className="bis3"/>
        <circle cx="428" cy="52" r="2" fill="#ef4444" className="bis5"/>
        <circle cx="508" cy="48" r="2" fill="#ef4444" className="bis2"/>
        <circle cx="455" cy="18" r="2.5" fill="#ff6b6b" className="bis4"/>
        <circle cx="482" cy="15" r="2"   fill="#ff6b6b" className="bis1"/>

        {/* ── Bottom strip ── */}
        <line x1="30" y1="195" x2="570" y2="195" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>

        {/* Stage progression dots */}
        {[
          { n:1, label:'WARMUP',    color:'#22c55e' },
          { n:2, label:'TACTICAL',  color:'#f59e0b' },
          { n:3, label:'MIND',      color:'#a855f7' },
          { n:4, label:'CLASH',     color:'#3b82f6' },
          { n:5, label:'FINALE',    color:'#ef4444' },
        ].map((s,i)=>(
          <g key={s.n} transform={`translate(${160+i*71},208)`}>
            <circle r="9" fill={`${s.color}18`} stroke={s.color} strokeWidth="1.2" opacity="0.7"/>
            <text y="4" textAnchor="middle" fill={s.color} fontSize="8" fontWeight="900">{s.n}</text>
            <text y="18" textAnchor="middle" fill={s.color} fontSize="5.5" fontWeight="700" letterSpacing="1" opacity="0.6">{s.label}</text>
          </g>
        ))}

        {/* Connecting arrows between stage dots */}
        {[0,1,2,3].map(i=>(
          <line key={i} x1={173+i*71} y1="208" x2={224+i*71} y2="208" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="3 2"/>
        ))}

        {/* Tagline */}
        <text x="295" y="172" textAnchor="middle" fill="rgba(255,255,255,0.18)" fontSize="7" letterSpacing="5" fontWeight="700">
          5 STAGES · ONE LIFE · BECOME CHAMPION
        </text>
      </svg>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PointsBalance({ rupees }: { rupees: number }) {
  const pts = rupees * POINTS_PER_RUPEE;
  return (
    <div className="rounded-2xl p-4 text-center" style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.08), rgba(234,88,12,0.08))', border: '1px solid rgba(251,191,36,0.2)' }}>
      <p className="text-[10px] text-dark-muted uppercase tracking-widest mb-1">Tournament Wallet</p>
      <p className="text-3xl font-black" style={{ color: '#fbbf24' }}>{pts.toLocaleString()} <span className="text-sm font-semibold">pts</span></p>
      <p className="text-xs text-dark-muted mt-0.5">≡ ₹{rupees.toFixed(2)} real money</p>
      <p className="text-[10px] text-dark-muted/60 mt-1">1 Rupee = {POINTS_PER_RUPEE} Points</p>
    </div>
  );
}

// ── Progression Map (replaces StageTracker) ───────────────────────────────────

function ProgressionMap({ currentStage, stageResults }: { currentStage: number; stageResults: any[] }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <p className="text-[10px] text-dark-muted uppercase tracking-[0.2em] mb-4 text-center font-semibold">Championship Path</p>
      <div className="flex items-center justify-between">
        {STAGES.map((s, idx) => {
          const result = stageResults.find(r => r.stage === s.stage);
          const isActive = s.stage === currentStage;
          const isCleared = result?.playerWon;
          const isFailed = result && !result.playerWon;
          const isLocked = s.stage > currentStage && !result;
          const isBoss = s.stage === 5;

          return (
            <React.Fragment key={s.stage}>
              <div className="flex flex-col items-center gap-1.5">
                <div className="relative">
                  {isActive && (
                    <motion.div
                      animate={{ scale: [1, 1.7, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ repeat: Infinity, duration: isBoss ? 0.9 : 1.6 }}
                      className="absolute rounded-full pointer-events-none"
                      style={{ border: `2px solid ${s.color}`, inset: -5, borderRadius: '50%' }} />
                  )}
                  <motion.div
                    animate={isActive ? { scale: [1, 1.07, 1] } : {}}
                    transition={{ repeat: Infinity, duration: isBoss ? 0.9 : 1.5 }}
                    className="w-11 h-11 rounded-full flex items-center justify-center text-base"
                    style={{
                      background: isCleared ? `${s.color}25` : isFailed ? 'rgba(255,107,107,0.15)' : isActive ? `${s.color}18` : 'rgba(255,255,255,0.04)',
                      border: `2px solid ${isCleared ? s.color : isFailed ? '#ff6b6b' : isActive ? s.color : 'rgba(255,255,255,0.1)'}`,
                      opacity: isLocked ? 0.3 : 1,
                      boxShadow: isCleared ? `0 0 14px ${s.color}45` : isActive && isBoss ? `0 0 22px ${s.color}65` : isActive ? `0 0 12px ${s.color}35` : 'none',
                    }}>
                    {isCleared ? '✓' : isFailed ? '✗' : s.emojis[0]}
                  </motion.div>
                </div>
                <div className="text-center w-14">
                  <p className="text-[8px] font-bold leading-tight truncate" style={{ color: isActive ? s.color : isCleared ? `${s.color}bb` : 'rgba(139,148,158,0.5)' }}>
                    {s.name.split(' ')[0]}
                  </p>
                  {isBoss && (
                    <p className="text-[7px] font-black" style={{ color: 'rgba(239,68,68,0.55)' }}>BOSS</p>
                  )}
                </div>
              </div>
              {idx < STAGES.length - 1 && (
                <div className="flex-1 h-0.5 mx-1 relative overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  {isCleared && (
                    <>
                      <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, ${s.color}, ${STAGES[idx+1].color})` }} />
                      <motion.div
                        initial={{ x: '-100%' }} animate={{ x: '200%' }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: idx * 0.25 }}
                        className="absolute inset-0 w-1/3"
                        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent)' }} />
                    </>
                  )}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ── Boss Cinematic ────────────────────────────────────────────────────────────

function BossCinematic({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const t = setTimeout(onComplete, 4200);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at center, rgba(25,4,4,0.98) 0%, rgba(0,0,0,0.99) 100%)' }}>

      {/* Ambient pulse rings */}
      {[1, 2, 3].map(n => (
        <motion.div key={n}
          animate={{ scale: [0.8, 3], opacity: [0.35, 0] }}
          transition={{ duration: 2.2, delay: n * 0.35, repeat: Infinity, ease: 'easeOut' }}
          className="absolute rounded-full border border-red-700/60"
          style={{ width: 100, height: 100 }} />
      ))}

      <div className="text-center px-8 relative z-10">
        <motion.div
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 180, damping: 12, delay: 0.15 }}
          className="text-8xl mb-6"
          style={{ filter: 'drop-shadow(0 0 48px rgba(239,68,68,0.9)) drop-shadow(0 0 20px rgba(239,68,68,0.5))' }}>
          💀
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.5 }}>
          <p className="text-[10px] tracking-[0.35em] font-black mb-2" style={{ color: 'rgba(239,68,68,0.6)' }}>STAGE 5</p>
          <h2 className="text-5xl font-black tracking-tight mb-3"
            style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #ff6b6b 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            FINAL ARENA
          </h2>
          <p className="text-sm font-semibold mb-1" style={{ color: 'rgba(148,163,184,0.85)' }}>The Apex Trinity awaits.</p>
          <p className="text-xs" style={{ color: 'rgba(239,68,68,0.5)' }}>Three elite AIs. One chance. No mercy.</p>
        </motion.div>

        <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 1.8, duration: 0.9 }}
          className="mt-8 h-px w-52 mx-auto"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(239,68,68,0.7), transparent)' }} />

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.6 }}
          className="text-[10px] mt-3 tracking-[0.25em] uppercase font-medium"
          style={{ color: 'rgba(100,116,139,0.6)' }}>
          Entering arena...
        </motion.p>
      </div>
    </motion.div>
  );
}

// ── Tiebreaker Overlay ────────────────────────────────────────────────────────

function TiebreakerOverlay() {
  const { tiebreakerResult, playTiebreaker } = useSurvivalStore();
  const { reset: resetGame } = useGameStore();

  if (!tiebreakerResult) return null;

  const { stage, stageName, botNames, playerScore, botScore, scoreboard } = tiebreakerResult;
  const stageInfo = STAGES.find(s => s.stage === stage)!;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.93)', backdropFilter: 'blur(16px)' }}>
      <motion.div
        initial={{ scale: 0.75, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: 'linear-gradient(160deg, #0d1117, #111827)', border: '1px solid rgba(251,191,36,0.35)' }}>

        <div className="pt-8 pb-4 px-6 text-center relative"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(251,191,36,0.15) 0%, transparent 70%)' }}>
          <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: 4, duration: 0.45 }} className="text-5xl mb-3">⚡</motion.div>
          <h2 className="text-2xl font-black text-white">It's a Tie!</h2>
          <p className="text-sm mt-1 font-semibold" style={{ color: stageInfo.color }}>
            {stageInfo.emojis[0]} Stage {stage}: {stageName}
          </p>
          <p className="text-xs mt-2" style={{ color: 'rgba(148,163,184,0.7)' }}>One tiebreaker round — lowest score wins</p>
        </div>

        <div className="mx-5 mb-3 rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="py-1.5 px-4 text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <p className="text-[10px] uppercase tracking-widest text-dark-muted font-semibold">Match Scores · Tied</p>
          </div>
          {(scoreboard ?? [
            { name: 'You', score: playerScore, isHuman: true },
            { name: botNames?.[0] ?? 'Bot', score: botScore, isHuman: false },
          ]).map((entry, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2.5"
              style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.05)' : undefined }}>
              <span className="text-xs font-semibold" style={{ color: entry.isHuman ? '#fbbf24' : '#8b949e' }}>
                {entry.isHuman ? '👤 ' : '🤖 '}{entry.name}
              </span>
              <span className="text-sm font-black" style={{ color: '#fbbf24' }}>{entry.score} pts</span>
            </div>
          ))}
        </div>

        <div className="mx-5 mb-4 rounded-xl px-4 py-2.5"
          style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <p className="text-[11px] text-center" style={{ color: 'rgba(239,68,68,0.8)' }}>
            ⚠️ If you tie again in the tiebreaker, you'll be eliminated
          </p>
        </div>

        <div className="px-5 pb-6">
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={() => { resetGame(); playTiebreaker(); }}
            className="w-full py-3.5 rounded-2xl font-bold text-base"
            style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', color: '#0d1117' }}>
            ⚡ Play Tiebreaker Round
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Stage Result Overlay ──────────────────────────────────────────────────────

function StageResultOverlay({ onContinue }: { onContinue: (nextStageNum: number) => void }) {
  const { stageResult, reset } = useSurvivalStore();
  const { reset: resetGame } = useGameStore();
  const navigate = useNavigate();

  if (!stageResult) return null;

  const { playerWon, isDraw, playerScore, botScore, botScores, scoreboard,
    pointsEarned, stageName, stage, botNames, personalities,
    tournamentOver, won, totalPointsEarned,
    nextStage, nextStageName, nextStageDesc, nextBotNames, stageResults } = stageResult;

  const stageInfo = STAGES.find(s => s.stage === stage)!;
  const nextInfo  = nextStage ? STAGES.find(s => s.stage === nextStage) : null;
  const isMultiBot = (botScores?.length ?? 0) > 1;
  const goingToFinalArena = playerWon && nextStage === 5 && !tournamentOver;

  const handleAction = () => {
    if (tournamentOver) { resetGame(); reset(); navigate('/survival'); }
    else if (playerWon) { onContinue(nextStage ?? (stage + 1)); }
    else { resetGame(); reset(); navigate('/survival'); }
  };

  const heroEmoji = tournamentOver ? (won ? '🏆' : '😔') : playerWon ? '⭐' : '💀';
  const heroTitle = tournamentOver
    ? (won ? 'CHAMPION!' : 'Eliminated')
    : playerWon ? `Stage ${stage} Cleared!` : `Stage ${stage} Failed`;
  const heroBg = tournamentOver && won
    ? 'radial-gradient(ellipse at 50% 0%, rgba(251,191,36,0.2) 0%, transparent 70%)'
    : !playerWon || (tournamentOver && !won)
    ? 'radial-gradient(ellipse at 50% 0%, rgba(255,60,60,0.12) 0%, transparent 70%)'
    : `radial-gradient(ellipse at 50% 0%, ${stageInfo.color}18 0%, transparent 70%)`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(16px)' }}>
      <motion.div
        initial={{ scale: 0.7, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 180, damping: 18 }}
        className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: 'linear-gradient(160deg, #0d1117, #111827)', border: tournamentOver && won ? '1px solid rgba(251,191,36,0.4)' : '1px solid rgba(255,255,255,0.08)' }}>

        <div className="pt-8 pb-4 px-6 text-center relative">
          <div className="absolute inset-0 pointer-events-none" style={{ background: heroBg }} />
          <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: 3, duration: 0.5 }} className="text-6xl mb-3 relative z-10">
            {heroEmoji}
          </motion.div>
          <h2 className="text-2xl font-black text-white relative z-10">{heroTitle}</h2>
          <p className="text-sm mt-1 relative z-10 font-semibold" style={{ color: stageInfo.color }}>
            {stageInfo.emojis[0]} {stageName ?? stageInfo.name}
          </p>
          {isMultiBot && (
            <div className="flex justify-center gap-1.5 mt-2 flex-wrap relative z-10">
              {(botNames ?? []).map((n, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: 'rgba(255,255,255,0.07)', color: '#8b949e', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {stageInfo.emojis[i] ?? '🤖'} {n}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="mx-5 mb-3 rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="py-1.5 px-4 text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <p className="text-[10px] uppercase tracking-widest text-dark-muted font-semibold">Final Scoreboard · Lower = Better</p>
          </div>
          {(scoreboard ?? [
            { name: 'You', score: playerScore, isHuman: true },
            { name: botNames?.[0] ?? 'Bot', score: botScore, isHuman: false },
          ]).map((entry, rank) => (
            <div key={rank} className="flex items-center justify-between px-4 py-2.5"
              style={{ borderTop: rank > 0 ? '1px solid rgba(255,255,255,0.05)' : undefined,
                background: rank === 0 ? 'rgba(251,191,36,0.05)' : 'transparent' }}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black" style={{ color: rank === 0 ? '#fbbf24' : rank === 1 ? '#9ca3af' : '#78716c', minWidth: 16 }}>
                  #{rank + 1}
                </span>
                <span className="text-xs font-semibold" style={{ color: entry.isHuman ? (playerWon ? '#00ff88' : '#ff6b6b') : '#8b949e' }}>
                  {entry.isHuman ? '👤 ' : '🤖 '}{entry.name}
                </span>
              </div>
              <span className="text-sm font-black" style={{
                color: entry.isHuman
                  ? (playerWon ? '#00ff88' : '#ff6b6b')
                  : (!entry.isHuman && rank === 0 ? '#fbbf24' : '#8b949e')
              }}>
                {entry.score} pts
              </span>
            </div>
          ))}
        </div>

        {playerWon && pointsEarned > 0 && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}
            className="mx-5 mb-3 rounded-xl py-2.5 text-center" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)' }}>
            <p className="text-[10px] text-neon-green/70 uppercase tracking-widest mb-0.5">Points Credited</p>
            <p className="text-2xl font-black text-neon-green">+{pointsEarned.toLocaleString()} pts</p>
            <p className="text-xs text-neon-green/60">+₹{(pointsEarned / POINTS_PER_RUPEE).toFixed(2)} added to wallet</p>
          </motion.div>
        )}

        {tournamentOver && won && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}
            className="mx-5 mb-3 rounded-2xl py-4 text-center" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.35)' }}>
            <p className="text-[10px] text-yellow-400/70 uppercase tracking-widest mb-1">Total Earned</p>
            <p className="text-4xl font-black text-yellow-400">{(totalPointsEarned ?? 0).toLocaleString()} pts</p>
            <p className="text-xs text-yellow-400/60 mt-0.5">≡ ₹{((totalPointsEarned ?? 0) / POINTS_PER_RUPEE).toFixed(2)} added to wallet</p>
          </motion.div>
        )}

        {/* Boss preview — special section when about to enter Final Arena */}
        {goingToFinalArena && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}
            className="mx-5 mb-3 rounded-xl px-4 py-3 text-center"
            style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <p className="text-sm font-black mb-1" style={{ color: '#ef4444' }}>💀 The Final Arena Awaits</p>
            <p className="text-[10px] text-dark-muted">The Apex Trinity is ready. Three elite AIs. Are you?</p>
          </motion.div>
        )}

        {!tournamentOver && playerWon && nextInfo && !goingToFinalArena && (
          <div className="mx-5 mb-3 rounded-xl py-2 px-4" style={{ background: `${nextInfo.color}10`, border: `1px solid ${nextInfo.color}30` }}>
            <p className="text-[10px] text-dark-muted uppercase tracking-wider mb-1">Up Next</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold" style={{ color: nextInfo.color }}>Stage {nextStage}: {nextStageName ?? nextInfo.name}</p>
                {nextStageDesc && <p className="text-[10px] text-dark-muted mt-0.5">{nextStageDesc}</p>}
              </div>
              <div className="flex gap-0.5">
                {nextInfo.emojis.map((e, i) => <span key={i} className="text-lg">{e}</span>)}
              </div>
            </div>
          </div>
        )}

        <div className="mx-5 mb-4 flex gap-1 justify-center">
          {stageResults.map((r, i) => (
            <div key={i} className="flex-1 h-2 rounded-full max-w-[40px]" style={{ background: r.playerWon ? '#22c55e' : '#ef4444' }} />
          ))}
          {Array.from({ length: 5 - stageResults.length }).map((_, i) => (
            <div key={`e${i}`} className="flex-1 h-2 rounded-full max-w-[40px]" style={{ background: 'rgba(255,255,255,0.1)' }} />
          ))}
        </div>

        <div className="px-5 pb-6">
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={handleAction}
            className="w-full py-3.5 rounded-2xl font-bold text-base"
            style={tournamentOver && won
              ? { background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', color: '#0d1117' }
              : goingToFinalArena
              ? { background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff' }
              : playerWon && !tournamentOver && nextInfo
              ? { background: `linear-gradient(135deg, ${nextInfo.color}, ${nextInfo.color}cc)`, color: '#0d1117' }
              : { background: 'rgba(255,255,255,0.08)', color: '#e6edf3', border: '1px solid rgba(255,255,255,0.1)' }}>
            {tournamentOver && won
              ? '🏆 Claim Victory!'
              : goingToFinalArena
              ? '💀 Enter Final Arena'
              : playerWon && !tournamentOver
              ? `⚔️ Stage ${nextStage}: ${nextStageName ?? nextInfo?.name}`
              : '🏠 Back to Lobby'}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Live Battles Strip ────────────────────────────────────────────────────────

const STAGE_COLORS_MAP = ['#22c55e', '#f59e0b', '#a855f7', '#3b82f6', '#ef4444'];
const TIER_COLOR_MAP: Record<string, string> = {
  beginner: '#22c55e', pro: '#60a5fa', elite: '#fbbf24', boss_arena: '#ef4444',
};
const TIER_ICON_MAP: Record<string, string> = {
  beginner: '🥉', pro: '🥈', elite: '🥇', boss_arena: '💎',
};

function LiveBattlesStrip() {
  const [battles, setBattles] = useState<any[]>([]);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const load = () => {
      survivalApi.active()
        .then(r => { setBattles(r.data.battles); setReady(true); })
        .catch(() => setReady(true));
    };
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);

  if (!ready) return null;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2">
          <motion.div animate={{ opacity: [1, 0.2, 1] }} transition={{ repeat: Infinity, duration: 1.1 }}
            className="w-2 h-2 rounded-full" style={{ background: battles.length > 0 ? '#ef4444' : '#4b5563' }} />
          <p className="text-[10px] uppercase tracking-[0.2em] font-black" style={{ color: '#e6edf3' }}>Live AI Battles</p>
        </div>
        {battles.length > 0 && (
          <span className="text-[9px] font-black px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
            {battles.length} LIVE
          </span>
        )}
      </div>

      {battles.length === 0 ? (
        <div className="px-4 py-4 text-center">
          <p className="text-xs text-dark-muted/50">No live battles right now — be the first to enter!</p>
        </div>
      ) : (
        <div>
          {battles.map((b) => {
            const stageColor = STAGE_COLORS_MAP[b.currentStage - 1] ?? '#8b949e';
            const tierColor  = TIER_COLOR_MAP[b.tier]  ?? '#8b949e';
            const tierIcon   = TIER_ICON_MAP[b.tier]   ?? '🎮';
            const stageInfo  = STAGES[b.currentStage - 1];
            return (
              <div key={String(b.survivalId)}
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                  style={{ background: `${stageColor}15`, border: `1.5px solid ${stageColor}40` }}>
                  {stageInfo?.emojis[0] ?? '⚔️'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-dark-text truncate max-w-[100px]">{b.playerUsername}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                      style={{ background: `${tierColor}18`, color: tierColor, border: `1px solid ${tierColor}30` }}>
                      {tierIcon} {b.tierLabel}
                    </span>
                  </div>
                  <p className="text-[10px] mt-0.5 font-semibold" style={{ color: stageColor }}>
                    Stage {b.currentStage}/5 · {stageInfo?.name ?? 'Battle'}
                  </p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  onClick={() => navigate(`/spectate/${b.roomCode}`)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-black flex items-center gap-1"
                  style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)' }}>
                  👁 Watch
                </motion.button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── History Card ──────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; emoji: string; border: string }> = {
  won:       { label: 'Champion',    color: '#fbbf24', emoji: '🏆', border: 'rgba(251,191,36,0.25)'  },
  lost:      { label: 'Eliminated',  color: '#ff6b6b', emoji: '💀', border: 'rgba(255,107,107,0.2)'  },
  abandoned: { label: 'Abandoned',   color: '#9ca3af', emoji: '↩️', border: 'rgba(156,163,175,0.15)' },
  active:    { label: 'In Progress', color: '#60a5fa', emoji: '⚔️', border: 'rgba(96,165,250,0.2)'  },
};

function HistoryCard({ r, idx }: { r: any; idx: number }) {
  const [expanded, setExpanded] = useState(idx === 0);
  const meta = STATUS_META[r.status] ?? STATUS_META.active;
  const net = r.totalPointsEarned - r.entryPoints;
  const stageResults: any[] = r.stageResults ?? [];

  return (
    <motion.div key={String(r.id)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
      className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(12,14,18,0.9)', border: `1px solid ${meta.border}` }}>

      <button className="w-full p-4 text-left" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base">{meta.emoji}</span>
            <span className="font-bold text-sm" style={{ color: meta.color }}>{meta.label}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>
              {r.tierLabel}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-dark-muted">
              {new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
            </span>
            <span className="text-dark-muted text-xs">{expanded ? '▲' : '▼'}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {STAGES.map(s => {
            const res = stageResults.find((sr: any) => sr.stage === s.stage);
            return (
              <div key={s.stage} className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  background: !res ? 'rgba(255,255,255,0.04)' : res.playerWon ? `${s.color}20` : 'rgba(255,107,107,0.15)',
                  border: `1.5px solid ${!res ? 'rgba(255,255,255,0.08)' : res.playerWon ? s.color : '#ff6b6b'}`,
                  color: !res ? '#4b5563' : res.playerWon ? s.color : '#ff6b6b',
                }}>
                {!res ? s.emojis[0] : res.playerWon ? '✓' : '✗'}
              </div>
            );
          })}
          <div className="ml-auto text-right">
            <span className="text-sm font-bold" style={{ color: net >= 0 ? '#22c55e' : '#ff6b6b' }}>
              {net >= 0 ? '+' : ''}{net.toLocaleString()} pts
            </span>
            <span className="text-[10px] text-dark-muted block">
              ≡ ₹{(Math.abs(net) / 100).toFixed(0)} {net >= 0 ? 'profit' : 'loss'}
            </span>
          </div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="p-4 pt-3 space-y-2">
              {STAGES.map(s => {
                const res = stageResults.find((sr: any) => sr.stage === s.stage);
                if (!res && r.status !== 'active') {
                  if (s.stage > (r.currentStage ?? 1) && r.status !== 'won') return null;
                }
                return (
                  <div key={s.stage} className="flex items-center gap-3 px-3 py-2 rounded-xl"
                    style={{
                      background: !res ? 'rgba(255,255,255,0.02)' : res.playerWon ? `${s.color}08` : 'rgba(255,107,107,0.06)',
                      opacity: !res ? 0.5 : 1,
                    }}>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0"
                      style={{
                        background: !res ? 'rgba(255,255,255,0.04)' : res.playerWon ? `${s.color}20` : 'rgba(255,107,107,0.15)',
                        border: `1px solid ${!res ? 'rgba(255,255,255,0.08)' : res.playerWon ? s.color : '#ff6b6b'}`,
                      }}>
                      {!res ? s.emojis[0] : res.playerWon ? '✓' : '✗'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-dark-text">{s.name}</p>
                      {res && (
                        <p className="text-[10px] text-dark-muted">
                          You {res.playerScore} — Bot {res.botScore}
                        </p>
                      )}
                    </div>
                    {res ? (
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-bold" style={{ color: res.playerWon ? '#22c55e' : '#ff6b6b' }}>
                          {res.playerWon ? `+${res.pointsEarned.toLocaleString()}` : '−0'} pts
                        </p>
                        {res.playerWon && (
                          <p className="text-[9px] text-dark-muted">≡ ₹{(res.pointsEarned / 100).toFixed(0)}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] text-dark-muted/40">Not played</span>
                    )}
                  </div>
                );
              })}

              <div className="mt-3 pt-3 grid grid-cols-3 gap-2 text-center"
                style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <p className="text-[10px] text-dark-muted mb-0.5">Entry Fee</p>
                  <p className="text-xs font-bold text-red-400">−{r.entryPoints.toLocaleString()} pts</p>
                  <p className="text-[9px] text-dark-muted">₹{(r.entryPoints / 100).toFixed(0)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-dark-muted mb-0.5">Earned</p>
                  <p className="text-xs font-bold" style={{ color: '#22c55e' }}>
                    +{r.totalPointsEarned.toLocaleString()} pts
                  </p>
                  <p className="text-[9px] text-dark-muted">₹{(r.totalPointsEarned / 100).toFixed(0)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-dark-muted mb-0.5">Net</p>
                  <p className="text-xs font-bold" style={{ color: net >= 0 ? '#22c55e' : '#ff6b6b' }}>
                    {net >= 0 ? '+' : ''}{net.toLocaleString()} pts
                  </p>
                  <p className="text-[9px] text-dark-muted">
                    {net >= 0 ? '+' : '−'}₹{(Math.abs(net) / 100).toFixed(0)}
                  </p>
                </div>
              </div>

              {r.status === 'abandoned' && stageResults.length === 0 && (
                <p className="text-[10px] text-center" style={{ color: '#22c55e' }}>
                  ✓ Entry fee refunded (no rounds played)
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── History Tab with Career Stats ─────────────────────────────────────────────

function SurvivalHistoryTab() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    survivalApi.history()
      .then(r => setRecords(r.data.records))
      .catch(() => setError('Failed to load history. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="text-center py-12 space-y-2">
      <p className="text-3xl">⚠️</p>
      <p className="text-red-400 text-sm">{error}</p>
    </div>
  );

  if (records.length === 0) return (
    <div className="text-center py-12 space-y-2">
      <p className="text-5xl">⚔️</p>
      <p className="text-dark-muted text-sm">No championship history yet.</p>
      <p className="text-dark-muted text-xs">Enter the AI Survival Championship to see your results!</p>
    </div>
  );

  const wonCount = records.filter(r => r.status === 'won').length;
  const lostCount = records.filter(r => r.status === 'lost').length;
  const abandonedCount = records.filter(r => r.status === 'abandoned').length;

  // Compute replayability stats
  const bossEncounters = records.filter(r =>
    (r.stageResults ?? []).some((sr: any) => sr.stage === 5)
  ).length;

  const bestStageReached = records.reduce((best, r) => {
    const maxStage = (r.stageResults ?? []).reduce((m: number, sr: any) => Math.max(m, sr.stage), 0);
    return Math.max(best, maxStage);
  }, 0);

  return (
    <div className="space-y-3">
      {/* Career overview */}
      <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <p className="text-[10px] text-dark-muted uppercase tracking-[0.2em] mb-3 font-semibold text-center">Career Stats</p>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Champion', value: wonCount,     color: '#fbbf24', emoji: '🏆' },
            { label: 'Eliminated', value: lostCount,  color: '#ff6b6b', emoji: '💀' },
            { label: 'Boss Fights', value: bossEncounters, color: '#ef4444', emoji: '👑' },
            { label: 'Best Stage', value: bestStageReached || '—', color: '#60a5fa', emoji: '⚔️' },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-2 text-center"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-base">{s.emoji}</p>
              <p className="text-base font-black leading-tight" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[9px] text-dark-muted leading-tight mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Run history */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        {[
          { label: 'Champion', value: wonCount,     color: '#fbbf24', emoji: '🏆' },
          { label: 'Eliminated', value: lostCount,  color: '#ff6b6b', emoji: '💀' },
          { label: 'Abandoned', value: abandonedCount, color: '#9ca3af', emoji: '↩️' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-2.5 text-center"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-lg">{s.emoji}</p>
            <p className="text-lg font-black" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[10px] text-dark-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {records.map((r, idx) => <HistoryCard key={String(r.id)} r={r} idx={idx} />)}
    </div>
  );
}

// ── Mode Selection Modal ───────────────────────────────────────────────────────

function ModeSelectModal({ tier, tierLabel, tierColor, onIndividual, onTeam, onClose }: {
  tier: string;
  tierLabel: string;
  tierColor: string;
  onIndividual: () => void;
  onTeam: () => void;
  onClose: () => void;
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}>
      <motion.div initial={{ scale: 0.88, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.88, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="rounded-2xl p-6 w-full max-w-sm space-y-5"
        style={{ background: 'linear-gradient(160deg,#0d1117,#0a0d1f)', border: `1px solid ${tierColor}40` }}
        onClick={e => e.stopPropagation()}>

        <div className="text-center space-y-1">
          <p className="text-[10px] tracking-[0.25em] uppercase font-bold" style={{ color: `${tierColor}80` }}>
            {tierLabel} Tier · Choose Mode
          </p>
          <h2 className="text-xl font-black text-white">How do you want to battle?</h2>
          <p className="text-xs text-dark-muted">Pick Solo for 1v1 or assemble a team to fight together</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={onIndividual}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <span className="text-3xl">🧍</span>
            <span className="text-sm font-black text-white">Solo</span>
            <span className="text-[10px] text-dark-muted text-center leading-tight">1 player vs AI · same as before</span>
          </motion.button>

          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={onTeam}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all"
            style={{ background: `${tierColor}12`, border: `1px solid ${tierColor}45` }}>
            <span className="text-3xl">👥</span>
            <span className="text-sm font-black" style={{ color: tierColor }}>Team</span>
            <span className="text-[10px] text-dark-muted text-center leading-tight">2–4 players · combined score</span>
          </motion.button>
        </div>

        <button onClick={onClose} className="w-full text-xs text-dark-muted py-1 hover:text-dark-text transition-colors">
          Cancel
        </button>
      </motion.div>
    </motion.div>
  );
}

// ── Bot personality options for team builder ──────────────────────────────────

const TEAM_BOT_OPTIONS = [
  { id: 'safe',       name: 'Guardian',   icon: '🛡️', type: 'Cautious Defender',   color: '#22c55e' },
  { id: 'aggressive', name: 'Viper',      icon: '🔥', type: 'Relentless Attacker', color: '#f59e0b' },
  { id: 'bluff',      name: 'Mystic',     icon: '🌀', type: 'Mind Bender',         color: '#a855f7' },
  { id: 'smart',      name: 'Tactician',  icon: '🧠', type: 'Strategic Thinker',   color: '#3b82f6' },
];

// ── Team Flow Modal ────────────────────────────────────────────────────────────

function TeamFlowModal({ tier, tierLabel, tierColor, entryPoints, onClose }: {
  tier: string;
  tierLabel: string;
  tierColor: string;
  entryPoints: number;
  onClose: () => void;
}) {
  const { user } = useAuthStore();
  const { teamState, teamError, clearTeamError } = useSurvivalStore();
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const maxSize = 2; // Team Arena is fixed at 2v2
  const [feeMode, setFeeMode] = useState<'split' | 'host_pays'>('split');
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [starting, setStarting] = useState(false);
  const [pickingSlot, setPickingSlot] = useState<number | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  const isHost = teamState?.hostId === user?.id;
  const myEntryRupees = teamState
    ? (teamState.entryFeeMode === 'split'
        ? Math.ceil(teamState.entryPoints / teamState.members.length) / 100
        : (isHost ? teamState.entryPoints / 100 : 0))
    : 0;

  const splitCost = Math.ceil(entryPoints / maxSize) / 100;

  const handleCreate = () => {
    if (creating) return;
    setCreating(true);
    clearTeamError();
    socketTeam.create(tier, feeMode, maxSize);
    const unsub = on('survival:team_updated', () => { setCreating(false); unsub(); });
    const unsub2 = on('survival:team_error', () => { setCreating(false); unsub2(); });
  };

  const handleJoin = () => {
    if (!joinCode.trim() || joining) return;
    setJoining(true);
    clearTeamError();
    socketTeam.join(joinCode.trim());
    const unsub = on('survival:team_updated', () => { setJoining(false); unsub(); });
    const unsub2 = on('survival:team_error', () => { setJoining(false); unsub2(); });
  };

  const handleStart = () => {
    if (!isHost || starting) return;
    setStarting(true);
    clearTeamError();
    socketTeam.start();
    const unsub = on('survival:team_error', () => { setStarting(false); unsub(); });
  };

  const handleLeave = () => {
    socketTeam.leave();
    onClose();
  };

  const copyCode = () => {
    if (teamState?.teamCode) {
      navigator.clipboard.writeText(teamState.teamCode).catch(() => {});
    }
  };

  // In the lobby state (team created/joined)
  if (teamState && (teamState.status === 'forming' || teamState.status === 'playing')) {
    const memberCount = teamState.members.length;
    const canStart = isHost && memberCount >= 2;

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.85)' }}>
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }} transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          className="rounded-2xl p-6 w-full max-w-sm space-y-5"
          style={{ background: 'linear-gradient(160deg,#0d1117,#0a0d1f)', border: `1px solid ${tierColor}40` }}>

          {/* Header */}
          <div className="text-center space-y-1">
            <p className="text-[10px] tracking-[0.25em] uppercase font-bold" style={{ color: `${tierColor}80` }}>Team Lobby</p>
            <h2 className="text-xl font-black text-white">
              {teamState.tier.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} · Team Battle
            </h2>
          </div>

          {/* Invite code */}
          <div className="rounded-xl p-3 text-center space-y-1"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <p className="text-[10px] text-dark-muted uppercase tracking-widest">Invite Code</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl font-black tracking-[0.2em]" style={{ color: tierColor }}>
                {teamState.teamCode}
              </span>
              <button onClick={copyCode}
                className="text-xs px-2 py-1 rounded-lg transition-all"
                style={{ background: `${tierColor}20`, color: tierColor, border: `1px solid ${tierColor}30` }}>
                Copy
              </button>
            </div>
            <p className="text-[10px] text-dark-muted">Share this with your teammates</p>
          </div>

          {/* Members */}
          <div className="space-y-2">
            <p className="text-[10px] text-dark-muted uppercase tracking-widest font-semibold">
              Members ({memberCount}/{teamState.maxSize})
            </p>
            {Array.from({ length: teamState.maxSize }).map((_, i) => {
              const member = teamState.members[i];
              const isBotMember = member?.isBot;
              const isEmpty = !member;
              const botOpt = isBotMember ? TEAM_BOT_OPTIONS.find(b => b.id === member!.personality) : null;
              const isPicking = pickingSlot === i;

              if (isEmpty && isHost && isPicking) {
                // Personality picker expanded in this slot
                return (
                  <motion.div key={i} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl overflow-hidden"
                    style={{ border: `1px solid ${tierColor}40` }}>
                    <div className="px-3 py-2 flex items-center justify-between"
                      style={{ background: `${tierColor}10` }}>
                      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: tierColor }}>Pick Bot Personality</p>
                      <button onClick={() => setPickingSlot(null)} className="text-dark-muted text-xs hover:text-white">✕</button>
                    </div>
                    <div className="p-2 grid grid-cols-4 gap-1.5">
                      {TEAM_BOT_OPTIONS.map(opt => (
                        <button key={opt.id}
                          onClick={() => { socketTeam.addBot(opt.id); setPickingSlot(null); }}
                          className="flex flex-col items-center gap-1 p-2 rounded-xl transition-all hover:scale-105 active:scale-95"
                          style={{ background: `${opt.color}12`, border: `1px solid ${opt.color}35` }}>
                          <span className="text-xl">{opt.icon}</span>
                          <p className="text-[9px] font-black leading-tight text-center" style={{ color: opt.color }}>{opt.name}</p>
                          <p className="text-[8px] text-dark-muted leading-tight text-center">{opt.type}</p>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                );
              }

              return (
                <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
                  style={{
                    background: member ? (isBotMember ? `${botOpt?.color ?? '#60a5fa'}0d` : 'rgba(255,255,255,0.05)') : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isBotMember ? `${botOpt?.color ?? '#60a5fa'}30` : 'rgba(255,255,255,0.07)'}`,
                  }}>
                  {member && !isBotMember ? (
                    <>
                      <span className="text-lg">{member.userId === teamState.hostId ? '👑' : '👤'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{member.username}</p>
                        <p className="text-[10px] text-dark-muted">{member.userId === teamState.hostId ? 'Host' : 'Member'}</p>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                        style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>
                        Ready
                      </span>
                    </>
                  ) : isBotMember ? (
                    <>
                      <span className="text-xl">{botOpt?.icon ?? '🤖'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate" style={{ color: botOpt?.color ?? '#60a5fa' }}>{member!.username}</p>
                        <p className="text-[10px] text-dark-muted">{botOpt?.type ?? 'AI Bot'}</p>
                      </div>
                      {isHost && (
                        <button onClick={() => socketTeam.removeBot(member!.userId)}
                          className="text-[10px] px-2 py-1 rounded-lg transition-all"
                          style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                          Remove
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="text-lg opacity-30">⏳</span>
                      <p className="flex-1 text-sm text-dark-muted/50 italic">Waiting for player…</p>
                      {isHost && (
                        <button onClick={() => setPickingSlot(i)}
                          className="text-[10px] px-2.5 py-1 rounded-lg font-bold transition-all"
                          style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)' }}>
                          + Bot
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
            {isHost && teamState.members.some(m => m.isBot) && (
              <p className="text-[10px] text-center" style={{ color: 'rgba(96,165,250,0.6)' }}>
                🤖 Bot teammates added — Host pays full entry fee
              </p>
            )}
          </div>

          {/* Fee info */}
          <div className="rounded-xl p-3 space-y-1"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[10px] text-dark-muted uppercase tracking-widest font-semibold">Entry Fee</p>
            <div className="flex items-center justify-between">
              <p className="text-xs text-dark-muted">
                {teamState.entryFeeMode === 'split' ? 'Split equally among humans' : 'Host pays full'}
              </p>
              <p className="text-sm font-black" style={{ color: tierColor }}>
                {myEntryRupees > 0 ? `₹${myEntryRupees.toFixed(0)} for you` : 'Free for you ✓'}
              </p>
            </div>
            {teamState.entryFeeMode === 'split' && (
              <p className="text-[10px]" style={{ color: 'rgba(34,197,94,0.7)' }}>
                Prize split equally among human members on win
              </p>
            )}
            {teamState.entryFeeMode === 'host_pays' && (
              <p className="text-[10px]" style={{ color: 'rgba(251,191,36,0.7)' }}>
                Host pays full entry · All prizes go to host on win
              </p>
            )}
          </div>

          {/* Error */}
          {teamError && (
            <p className="text-xs text-red-400 text-center px-2">{teamError}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={handleLeave}
              className="px-4 py-3 rounded-xl text-sm font-bold text-dark-muted border border-dark-border hover:border-red-400/50 hover:text-red-400 transition-all">
              Leave
            </button>
            {isHost ? (
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={handleStart}
                disabled={!canStart || starting}
                className="flex-1 py-3 rounded-xl font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: canStart ? tierColor : 'rgba(255,255,255,0.08)', color: canStart ? '#0d1117' : '#666' }}>
                {starting ? '⏳ Starting…' : canStart ? `⚔️ Start Battle (${memberCount} players)` : `Waiting (${memberCount}/${teamState.maxSize})`}
              </motion.button>
            ) : (
              <div className="flex-1 py-3 rounded-xl text-sm font-bold text-center text-dark-muted"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                ⏳ Waiting for host to start…
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    );
  }

  // Create / Join form
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}>
      <motion.div initial={{ scale: 0.88, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.88, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="rounded-2xl p-6 w-full max-w-sm space-y-5"
        style={{ background: 'linear-gradient(160deg,#0d1117,#0a0d1f)', border: `1px solid ${tierColor}40` }}
        onClick={e => e.stopPropagation()}>

        <div className="text-center space-y-1">
          <p className="text-[10px] tracking-[0.25em] uppercase font-bold" style={{ color: `${tierColor}80` }}>Team Battle · {tierLabel}</p>
          <h2 className="text-xl font-black text-white">Set Up Your Team</h2>
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          {(['create', 'join'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-2.5 text-sm font-semibold transition-all"
              style={tab === t ? { background: `${tierColor}20`, color: tierColor } : { color: '#8b949e' }}>
              {t === 'create' ? '➕ Create Team' : '🔗 Join Team'}
            </button>
          ))}
        </div>

        {tab === 'create' ? (
          <div className="space-y-4">
            {/* 2v2 format badge */}
            <div className="flex items-center justify-center gap-2 py-2 rounded-xl"
              style={{ background: `${tierColor}10`, border: `1px solid ${tierColor}30` }}>
              <span className="text-base">👥</span>
              <span className="text-sm font-black" style={{ color: tierColor }}>2 vs 2 Format</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: `${tierColor}20`, color: tierColor }}>FIXED</span>
            </div>

            {/* Entry fee mode */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-dark-muted">Entry Fee (Total: ₹{(entryPoints / 100).toFixed(0)})</p>
              <div className="space-y-2">
                <button onClick={() => setFeeMode('split')}
                  className="w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all"
                  style={feeMode === 'split'
                    ? { background: `${tierColor}15`, border: `1.5px solid ${tierColor}50` }
                    : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <span className="text-lg mt-0.5">💸</span>
                  <div>
                    <p className="text-sm font-bold" style={{ color: feeMode === 'split' ? tierColor : '#e2e8f0' }}>Split Entry Fee</p>
                    <p className="text-xs text-dark-muted">Each of 2 members pays <strong className="text-white">₹{splitCost.toFixed(0)}</strong></p>
                  </div>
                  {feeMode === 'split' && <span className="ml-auto text-sm" style={{ color: tierColor }}>✓</span>}
                </button>

                <button onClick={() => setFeeMode('host_pays')}
                  className="w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all"
                  style={feeMode === 'host_pays'
                    ? { background: `${tierColor}15`, border: `1.5px solid ${tierColor}50` }
                    : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <span className="text-lg mt-0.5">👑</span>
                  <div>
                    <p className="text-sm font-bold" style={{ color: feeMode === 'host_pays' ? tierColor : '#e2e8f0' }}>Host Pays Full</p>
                    <p className="text-xs text-dark-muted">You pay <strong className="text-white">₹{(entryPoints / 100).toFixed(0)}</strong> · team plays free</p>
                  </div>
                  {feeMode === 'host_pays' && <span className="ml-auto text-sm" style={{ color: tierColor }}>✓</span>}
                </button>
              </div>
            </div>

            {teamError && <p className="text-xs text-red-400 text-center">{teamError}</p>}

            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={handleCreate} disabled={creating}
              className="w-full py-3.5 rounded-xl font-bold text-sm disabled:opacity-50"
              style={{ background: tierColor, color: '#0d1117' }}>
              {creating ? '⏳ Creating…' : '➕ Create Team'}
            </motion.button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-dark-muted">Enter invite code from your teammate</p>
              <input
                ref={codeRef}
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
                placeholder="ABCD"
                maxLength={6}
                className="w-full px-4 py-3 rounded-xl text-center text-2xl font-black tracking-[0.3em] bg-transparent border outline-none focus:ring-1 transition-all"
                style={{ border: `1.5px solid ${joinCode.length >= 4 ? tierColor : 'rgba(255,255,255,0.15)'}`, color: tierColor }}
              />
            </div>

            {teamError && <p className="text-xs text-red-400 text-center">{teamError}</p>}

            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={handleJoin} disabled={joinCode.trim().length < 4 || joining}
              className="w-full py-3.5 rounded-xl font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: tierColor, color: '#0d1117' }}>
              {joining ? '⏳ Joining…' : '🔗 Join Team'}
            </motion.button>
          </div>
        )}

        <button onClick={onClose} className="w-full text-xs text-dark-muted py-1 hover:text-dark-text transition-colors">
          ← Back
        </button>
      </motion.div>
    </motion.div>
  );
}

// ── Team Stage Result Overlay ──────────────────────────────────────────────────

function TeamStageResultOverlay({ onContinue }: { onContinue: (nextStage: number) => void }) {
  const { user } = useAuthStore();
  const { teamStageResult, teamState, clearTeamStageResult } = useSurvivalStore();
  const [continuing, setContinuing] = useState(false);
  if (!teamStageResult) return null;

  const isHost = teamState?.hostId === user?.id;
  const r = teamStageResult;
  const won = r.teamWon;
  const isOver = !!r.tournamentOver;

  const handleContinue = () => {
    if (!isHost || continuing) return;
    setContinuing(true);
    clearTeamStageResult();
    if (!isOver && r.nextStage) {
      // socketTeam.continue() is deferred — called after the stage intro dismisses
      onContinue(r.nextStage);
    }
  };

  const STAGE_COLORS = ['#22c55e','#f59e0b','#a855f7','#3b82f6','#ef4444'];
  const stageColor = STAGE_COLORS[(r.stage - 1) % STAGE_COLORS.length];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.9)' }}>
      <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.85, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className="rounded-2xl p-6 w-full max-w-sm space-y-5"
        style={{
          background: 'linear-gradient(160deg,#0d1117 0%,#0a0d1f 100%)',
          border: `1px solid ${won ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
        }}>

        {/* Result header */}
        <div className="text-center space-y-2">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1, type: 'spring' }}
            className="text-5xl">{won ? '🏆' : '💀'}</motion.div>
          <p className="text-[10px] tracking-[0.25em] uppercase font-bold" style={{ color: `${stageColor}80` }}>
            Stage {r.stage} · {r.stageName}
          </p>
          <h2 className="text-2xl font-black" style={{ color: won ? '#22c55e' : '#ef4444' }}>
            {won ? 'Team Wins!' : 'Team Eliminated'}
          </h2>
        </div>

        {/* Score comparison */}
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="px-4 py-2 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <p className="text-[10px] text-dark-muted uppercase tracking-widest font-semibold">Combined Score · Lower is Better</p>
          </div>
          <div className="p-4 space-y-3">
            {/* Team score */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)' }}>👥</div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold text-white">Your Team</p>
                  <p className="text-sm font-black" style={{ color: won ? '#22c55e' : '#f59e0b' }}>
                    {r.teamScore} pts
                  </p>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (r.teamScore / Math.max(r.teamScore, r.botTotalScore)) * 100)}%` }}
                    transition={{ delay: 0.3, duration: 0.8 }}
                    className="h-full rounded-full"
                    style={{ background: won ? 'linear-gradient(90deg,#22c55e,#16a34a)' : 'linear-gradient(90deg,#f59e0b,#d97706)' }} />
                </div>
              </div>
            </div>

            {/* vs divider */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
              <span className="text-[10px] text-dark-muted font-bold">VS</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
            </div>

            {/* Bot score */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>🤖</div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold text-white">AI Bots</p>
                  <p className="text-sm font-black" style={{ color: won ? '#ef4444' : '#22c55e' }}>
                    {r.botTotalScore} pts
                  </p>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (r.botTotalScore / Math.max(r.teamScore, r.botTotalScore)) * 100)}%` }}
                    transition={{ delay: 0.4, duration: 0.8 }}
                    className="h-full rounded-full"
                    style={{ background: won ? 'linear-gradient(90deg,#ef4444,#b91c1c)' : 'linear-gradient(90deg,#22c55e,#16a34a)' }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Individual bot breakdown */}
        {r.botScores.length > 1 && (
          <div className="text-center space-y-1">
            <p className="text-[10px] text-dark-muted uppercase tracking-wider">Individual Bot Scores</p>
            <div className="flex justify-center gap-3">
              {r.botScores.map((s: number, i: number) => (
                <div key={i} className="text-center">
                  <p className="text-xs font-bold text-white">{s} pts</p>
                  <p className="text-[9px] text-dark-muted">{r.botNames?.[i] ?? `Bot ${i + 1}`}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Points earned */}
        {won && r.pointsEarned > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="rounded-xl p-3 text-center"
            style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }}>
            {r.entryFeeMode === 'split' ? (
              <>
                <p className="text-xs text-green-400 font-semibold">Each human member earned</p>
                <p className="text-xl font-black text-green-400">+{r.pointsEarned.toLocaleString()} pts</p>
                <p className="text-[10px] text-dark-muted">≡ ₹{(r.pointsEarned / 100).toFixed(0)} credited per member</p>
              </>
            ) : (
              <>
                <p className="text-xs text-yellow-400 font-semibold">Host earned (host paid entry)</p>
                <p className="text-xl font-black text-yellow-400">+{r.pointsEarned.toLocaleString()} pts</p>
                <p className="text-[10px] text-dark-muted">≡ ₹{(r.pointsEarned / 100).toFixed(0)} credited to host wallet</p>
              </>
            )}
          </motion.div>
        )}

        {/* Action buttons */}
        <div className="space-y-2">
          {!isOver && won && r.nextStage && isHost && (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={handleContinue} disabled={continuing}
              className="w-full py-3.5 rounded-xl font-bold text-sm disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff' }}>
              {continuing ? '⏳ Loading…' : `⚔️ Stage ${r.nextStage}: ${r.nextStageName}`}
            </motion.button>
          )}
          {!isOver && won && !isHost && (
            <div className="py-3.5 rounded-xl text-sm font-bold text-center text-dark-muted"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              ⏳ Waiting for host to continue…
            </div>
          )}
          {isOver && (
            <button onClick={clearTeamStageResult}
              className="w-full py-3 rounded-xl font-bold text-sm"
              style={{ background: 'rgba(255,255,255,0.08)', color: '#e2e8f0' }}>
              View Summary
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Quick Join Team Modal ─────────────────────────────────────────────────────

function QuickJoinTeamModal({ onClose }: { onClose: () => void }) {
  const { teamError, clearTeamError } = useSurvivalStore();
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTeamError?.();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleJoin = () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4 || joining) return;
    setJoining(true);
    clearTeamError?.();
    socketTeam.join(trimmed);
    const unsub = on('survival:team_updated', () => { setJoining(false); onClose(); unsub(); unsub2(); });
    const unsub2 = on('survival:team_error', () => { setJoining(false); unsub(); unsub2(); });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}>
      <motion.div initial={{ scale: 0.88, opacity: 0, y: 24 }} animate={{ scale: 1, opacity: 0.99, y: 0 }}
        exit={{ scale: 0.88, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="rounded-2xl p-6 w-full max-w-xs space-y-5"
        style={{ background: 'linear-gradient(160deg,#0d1117,#0a0d1f)', border: '1px solid rgba(168,85,247,0.45)' }}
        onClick={e => e.stopPropagation()}>

        <div className="text-center space-y-1.5">
          <div className="text-4xl mb-1">🔗</div>
          <h2 className="text-xl font-black text-white">Join a Team</h2>
          <p className="text-xs text-dark-muted">Enter the invite code shared by your teammate</p>
        </div>

        <div className="space-y-2">
          <input
            ref={inputRef}
            value={code}
            onChange={e => { setCode(e.target.value.toUpperCase().slice(0, 6)); clearTeamError?.(); }}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            placeholder="ABCD12"
            maxLength={6}
            className="w-full px-4 py-3.5 rounded-xl text-center text-2xl font-black tracking-[0.35em] bg-transparent border outline-none focus:ring-1 transition-all"
            style={{
              border: `1.5px solid ${code.length >= 4 ? '#a855f7' : 'rgba(255,255,255,0.15)'}`,
              color: '#a855f7',
            }}
          />
          {teamError && (
            <p className="text-xs text-red-400 text-center">{teamError}</p>
          )}
        </div>

        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={handleJoin}
          disabled={code.trim().length < 4 || joining}
          className="w-full py-3.5 rounded-xl font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'linear-gradient(135deg,#a855f7,#7c3aed)', color: '#fff' }}>
          {joining ? '⏳ Joining…' : '🔗 Join Team'}
        </motion.button>

        <button onClick={onClose} className="w-full text-xs text-dark-muted py-1 hover:text-dark-text transition-colors">
          Cancel
        </button>
      </motion.div>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function SurvivalTournamentPage() {
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();
  const { subscribe, active, currentStage, stageResults, stageResult, tiebreakerResult,
    totalPointsEarned, clearStageResult,
    teamState, teamStageResult, clearTeamStageResult, teamError } = useSurvivalStore();
  const { subscribeToEvents } = useGameStore();
  const [balance, setBalance] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [tab, setTab] = useState<'play' | 'history'>('play');
  const [activeStatus, setActiveStatus] = useState<any>(null);
  const [statusChecked, setStatusChecked] = useState(false);
  const [enabledTiers, setEnabledTiers] = useState<Record<string, boolean>>({ beginner: true, pro: true, elite: true, boss_arena: true });
  const [survivalCfg, setSurvivalCfg] = useState<Record<string, { entryPoints: number; stageRewards: number[] }>>({});
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [quitting, setQuitting] = useState(false);
  const [showTeamQuitConfirm, setShowTeamQuitConfirm] = useState(false);
  const [teamQuitting, setTeamQuitting] = useState(false);
  const [showStageIntro, setShowStageIntro] = useState(false);
  const [introStageNum, setIntroStageNum] = useState(1);
  const [introIsTeamMode, setIntroIsTeamMode] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [showModeSelect, setShowModeSelect] = useState(false);
  const [showTeamFlow, setShowTeamFlow] = useState(false);
  const [showQuickJoinTeam, setShowQuickJoinTeam] = useState(false);
  const [pendingTier, setPendingTier] = useState<string | null>(null);

  const refreshBalance = useCallback(() => {
    walletApi.get().then(r => setBalance(r.data.balance)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/'); return; }
    const unsub1 = subscribe();
    const unsub2 = subscribeToEvents();
    const unsub3 = on('game:state', () => navigate('/game'));
    const unsub4 = on('survival:status_result', (result: any) => {
      setStatusChecked(true);
      setActiveStatus(result);
    });
    const unsub5 = on('survival:stage_result', () => refreshBalance());
    const unsub8 = on('survival:team_stage_result', () => refreshBalance());
    const unsub9 = on('survival:team_started', (data: any) => {
      setShowTeamFlow(false);
      setIntroIsTeamMode(true);
      setIntroStageNum(data.stage ?? 1);
      setPendingAction(() => () => navigate('/game'));
      setShowStageIntro(true);
    });
    const unsub7 = on('survival:abandoned', () => {
      setActiveStatus(null);
      setQuitting(false);
      setShowQuitConfirm(false);
      refreshBalance();
      setStatusChecked(true);
    });

    loadSurvivalStatus(setActiveStatus, setStatusChecked);
    socketTeam.status(); // check for any active/forming team on mount
    refreshBalance();
    configApi.getPublic().then(r => {
      const st = r.data.featureFlags?.survivalTiers;
      if (st) setEnabledTiers({ beginner: st.beginner ?? true, pro: st.pro ?? true, elite: st.elite ?? true, boss_arena: st.boss_arena ?? true });
      if (r.data.survivalConfig) setSurvivalCfg(r.data.survivalConfig);
    }).catch(() => {});
    const unsub6 = on('admin:config_updated', (cfg: any) => {
      const st = cfg.featureFlags?.survivalTiers;
      if (st) setEnabledTiers({ beginner: st.beginner ?? true, pro: st.pro ?? true, elite: st.elite ?? true, boss_arena: st.boss_arena ?? true });
      if ((cfg as any).survivalConfig) setSurvivalCfg((cfg as any).survivalConfig);
    });
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); unsub6(); unsub7(); unsub8(); unsub9(); };
  }, [isAuthenticated, navigate, subscribe, subscribeToEvents, refreshBalance]);

  // Show stage intro then execute deferred action
  const handleIntroDismiss = useCallback(() => {
    setShowStageIntro(false);
    setPendingAction((current) => {
      current?.();
      return null;
    });
  }, []);

  const handleStart = (tier: string) => {
    if (starting) return;
    // Show mode selection modal first
    setPendingTier(tier);
    setShowModeSelect(true);
  };

  const handleSoloMode = () => {
    if (!pendingTier) return;
    const tier = pendingTier;
    setShowModeSelect(false);
    setPendingTier(null);
    setSelectedTier(tier);
    setIntroIsTeamMode(false);
    setIntroStageNum(1);
    setPendingAction(() => () => {
      setStarting(true);
      socketSurvival.start(tier);
      const unsub = on('survival:error', () => { setStarting(false); setSelectedTier(null); unsub(); });
    });
    setShowStageIntro(true);
  };

  const handleTeamMode = () => {
    setShowModeSelect(false);
    setShowTeamFlow(true);
  };

  const handleResume = () => {
    if (!activeStatus || starting) return;
    // Resume skips the intro — player already knows what stage they're on
    setStarting(true);
    socketSurvival.start(activeStatus.tier);
    const unsub = on('survival:error', () => { setStarting(false); unsub(); });
  };

  const handleQuit = () => {
    if (quitting) return;
    setQuitting(true);
    socketSurvival.abandon();
  };

  const handleTeamQuit = () => {
    if (teamQuitting) return;
    setTeamQuitting(true);
    socketTeam.quit();
    const unsub = on('survival:team_quit_result', () => {
      setTeamQuitting(false);
      setShowTeamQuitConfirm(false);
      unsub();
    });
    const unsub2 = on('survival:team_error', () => {
      setTeamQuitting(false);
      unsub2();
    });
  };

  // Called from StageResultOverlay when the player wins a stage
  const handleResultContinue = useCallback((nextStageNum: number) => {
    useSurvivalStore.setState({ stageResult: null });
    setIntroIsTeamMode(false);
    setIntroStageNum(nextStageNum);
    setPendingAction(() => () => socketSurvival.continue());
    setShowStageIntro(true);
  }, []);

  if (!isAuthenticated) return null;

  const pts = (balance ?? 0) * POINTS_PER_RUPEE;
  const isDangerStage = active && currentStage >= 4;

  // Compute tier details for modals
  const pendingTierDisplay = TIER_DISPLAY.find(t => t.id === (pendingTier ?? teamState?.tier ?? ''));
  const pendingEntryPoints = pendingTierDisplay
    ? (survivalCfg[pendingTierDisplay.id]?.entryPoints ?? pendingTierDisplay.defaultPoints)
    : 0;

  return (
    <Layout>
      {/* Stage intro cinematic — shown before each stage */}
      <AnimatePresence>
        {showStageIntro && (
          <StageIntro
            stage={introStageNum}
            isTeamMode={introIsTeamMode}
            onDismiss={handleIntroDismiss}
          />
        )}
      </AnimatePresence>

      {/* Mode selection modal */}
      <AnimatePresence>
        {showModeSelect && pendingTierDisplay && (
          <ModeSelectModal
            tier={pendingTierDisplay.id}
            tierLabel={pendingTierDisplay.label}
            tierColor={pendingTierDisplay.color}
            onIndividual={handleSoloMode}
            onTeam={handleTeamMode}
            onClose={() => { setShowModeSelect(false); setPendingTier(null); }}
          />
        )}
      </AnimatePresence>

      {/* Team setup / lobby modal */}
      <AnimatePresence>
        {(() => {
          const teamTierDisplay = teamState
            ? TIER_DISPLAY.find(t => t.id === teamState.tier) ?? pendingTierDisplay
            : pendingTierDisplay;
          const teamEntryPts = teamState
            ? (survivalCfg[teamState.tier]?.entryPoints ?? teamTierDisplay?.defaultPoints ?? pendingEntryPoints)
            : pendingEntryPoints;
          return (showTeamFlow || (teamState && teamState.status === 'forming')) && teamTierDisplay ? (
            <TeamFlowModal
              tier={teamTierDisplay.id}
              tierLabel={teamTierDisplay.label}
              tierColor={teamTierDisplay.color}
              entryPoints={teamEntryPts}
              onClose={() => setShowTeamFlow(false)}
            />
          ) : null;
        })()}
      </AnimatePresence>

      {/* Quick join team modal */}
      <AnimatePresence>
        {showQuickJoinTeam && (
          <QuickJoinTeamModal onClose={() => setShowQuickJoinTeam(false)} />
        )}
      </AnimatePresence>

      {/* Tiebreaker overlay */}
      <AnimatePresence>{tiebreakerResult && <TiebreakerOverlay />}</AnimatePresence>

      {/* Individual stage result overlay */}
      <AnimatePresence>
        {stageResult && <StageResultOverlay onContinue={handleResultContinue} />}
      </AnimatePresence>

      {/* Team stage result overlay */}
      <AnimatePresence>
        {teamStageResult && (
          <TeamStageResultOverlay onContinue={(nextStage) => {
            setIntroIsTeamMode(true);
            setIntroStageNum(nextStage);
            setPendingAction(() => () => socketTeam.continue());
            setShowStageIntro(true);
          }} />
        )}
      </AnimatePresence>

      {/* Danger atmosphere — subtle red pulse for stages 4 & 5 */}
      <AnimatePresence>
        {isDangerStage && (
          <motion.div key="danger-atmo"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 pointer-events-none z-0">
            <motion.div
              animate={{ opacity: [0, currentStage === 5 ? 0.18 : 0.1, 0] }}
              transition={{ duration: currentStage === 5 ? 0.85 : 1.4, repeat: Infinity, ease: 'easeInOut' }}
              style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(239,68,68,0.2) 0%, transparent 70%)' }} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5 relative z-10">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-1">
          <p className="text-[10px] tracking-[0.3em] uppercase font-bold mb-2" style={{ color: 'rgba(251,191,36,0.5)' }}>Arena of Sevens</p>
          <h1 className="text-3xl font-black"
            style={{ background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 40%, #ef4444 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            AI Survival Championship
          </h1>
          <p className="text-dark-muted text-sm max-w-md mx-auto">
            {isDangerStage && currentStage === 5
              ? '⚠️ You are in the Final Arena. The Apex Trinity awaits.'
              : isDangerStage
              ? `⚡ Stage ${currentStage} — Expert territory. Stay focused.`
              : 'Face 5 progressive AI opponents. One loss ends it all. Defeat the Boss to become Champion.'}
          </p>
        </motion.div>

        {/* Battle illustration */}
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1, duration: 0.4 }}>
          <BattleIllustration />
        </motion.div>

        {/* Points balance */}
        {balance !== null && !user?.isGuest && <PointsBalance rupees={balance} />}

        {/* Quit confirmation modal */}
        <AnimatePresence>
          {showQuitConfirm && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ background: 'rgba(0,0,0,0.75)' }}
              onClick={() => !quitting && setShowQuitConfirm(false)}>
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                className="rounded-2xl p-6 max-w-sm w-full space-y-4"
                style={{ background: '#0d1117', border: '1px solid rgba(239,68,68,0.4)' }}
                onClick={e => e.stopPropagation()}>
                <div className="text-center">
                  <p className="text-3xl mb-2">⚠️</p>
                  <p className="text-lg font-black text-white mb-1">Quit Championship?</p>
                  {!activeStatus?.hasPlayedRounds
                    ? <p className="text-sm text-green-400">No rounds played yet — your entry fee will be <strong>fully refunded</strong>.</p>
                    : <p className="text-sm text-red-400">You've already played rounds — <strong>no refund</strong> will be given. Points earned so far are kept.</p>
                  }
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowQuitConfirm(false)} disabled={quitting}
                    className="flex-1 py-3 rounded-xl font-bold text-sm text-dark-muted border border-dark-border hover:border-dark-text/30 transition-all disabled:opacity-40">
                    Cancel
                  </button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={handleQuit} disabled={quitting}
                    className="flex-1 py-3 rounded-xl font-bold text-sm disabled:opacity-50"
                    style={{ background: 'rgba(239,68,68,0.85)', color: '#fff' }}>
                    {quitting ? '⏳ Quitting…' : 'Yes, Quit'}
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active tournament resume banner */}
        <AnimatePresence>
          {statusChecked && activeStatus && !active && (
            <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="rounded-2xl p-5" style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.35)' }}>
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🔄</span>
                  <div>
                    <p className="text-sm font-bold text-blue-400">Championship In Progress</p>
                    <p className="text-xs text-dark-muted">Stage {activeStatus.currentStage}/5 · {String(activeStatus.tier ?? '').replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</p>
                  </div>
                </div>
                <button onClick={() => setShowQuitConfirm(true)}
                  className="text-xs text-red-400 hover:text-red-300 border border-red-400/30 hover:border-red-400/60 px-3 py-1.5 rounded-lg transition-all flex-shrink-0">
                  ✕ Quit
                </button>
              </div>
              <ProgressionMap currentStage={activeStatus.currentStage} stageResults={activeStatus.stageResults ?? []} />
              <div className="mt-3 flex gap-2">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={handleResume} disabled={starting}
                  className="flex-1 py-3 rounded-xl font-bold text-sm disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff' }}>
                  {starting ? '⏳ Loading…' : `▶ Continue Stage ${activeStatus.currentStage}`}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Team forming lobby banner */}
        <AnimatePresence>
          {teamState && teamState.status === 'forming' && !showTeamFlow && (
            <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="rounded-2xl p-5 cursor-pointer" onClick={() => setShowTeamFlow(true)}
              style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.35)' }}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">👥</span>
                  <div>
                    <p className="text-sm font-bold" style={{ color: '#a855f7' }}>Team Lobby Open</p>
                    <p className="text-xs text-dark-muted">
                      {teamState.members.length}/{teamState.maxSize} players · Code: <strong style={{ color: '#a855f7' }}>{teamState.teamCode}</strong>
                    </p>
                  </div>
                </div>
                <button className="text-xs px-3 py-1.5 rounded-lg font-bold transition-all"
                  style={{ background: 'rgba(168,85,247,0.2)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.4)' }}>
                  Open →
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Team match in progress — resume banner */}
        <AnimatePresence>
          {teamState && teamState.status === 'playing' && (
            <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="rounded-2xl p-5"
              style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.35)' }}>
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">👥</span>
                  <div>
                    <p className="text-sm font-bold" style={{ color: '#a855f7' }}>Team Match In Progress</p>
                    <p className="text-xs text-dark-muted">
                      Stage {teamState.currentStage}/5 · {teamState.members.filter(m => !m.isBot).length} human{teamState.members.filter(m => !m.isBot).length !== 1 ? 's' : ''} + {teamState.members.filter(m => m.isBot).length} bot{teamState.members.filter(m => m.isBot).length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                {teamState.hostId === user?.id && (
                  <button onClick={() => setShowTeamQuitConfirm(true)}
                    className="text-xs text-red-400 hover:text-red-300 border border-red-400/30 hover:border-red-400/60 px-3 py-1.5 rounded-lg transition-all flex-shrink-0">
                    ✕ Quit
                  </button>
                )}
              </div>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={() => socketTeam.rejoin()}
                className="w-full py-3 rounded-xl font-bold text-sm"
                style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)', color: '#fff' }}>
                ▶ {teamState.currentRoomCode ? 'Rejoin Team Match' : 'Continue Team Match'}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Team quit confirmation dialog */}
        <AnimatePresence>
          {showTeamQuitConfirm && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ background: 'rgba(0,0,0,0.75)' }}
              onClick={() => !teamQuitting && setShowTeamQuitConfirm(false)}>
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                className="rounded-2xl p-6 max-w-sm w-full space-y-4"
                style={{ background: '#0d1117', border: '1px solid rgba(239,68,68,0.4)' }}
                onClick={e => e.stopPropagation()}>
                <div className="text-center">
                  <p className="text-3xl mb-2">⚠️</p>
                  <p className="text-lg font-black text-white mb-1">Quit Team Tournament?</p>
                  {(teamState?.stageResults?.length ?? 0) === 0
                    ? <p className="text-sm text-green-400">No stages completed yet — your entry fee will be <strong>fully refunded</strong>.</p>
                    : <p className="text-sm text-red-400">Stages already played — <strong>no refund</strong> will be given. Points earned so far are kept.</p>
                  }
                  <p className="text-xs text-dark-muted mt-2">This ends the tournament for your entire team.</p>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowTeamQuitConfirm(false)} disabled={teamQuitting}
                    className="flex-1 py-3 rounded-xl font-bold text-sm text-dark-muted border border-dark-border hover:border-dark-text/30 transition-all disabled:opacity-40">
                    Cancel
                  </button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={handleTeamQuit} disabled={teamQuitting}
                    className="flex-1 py-3 rounded-xl font-bold text-sm disabled:opacity-50"
                    style={{ background: 'rgba(239,68,68,0.85)', color: '#fff' }}>
                    {teamQuitting ? '⏳ Quitting…' : 'Yes, Quit'}
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active stage tracker (during tournament) */}
        {active && <ProgressionMap currentStage={currentStage} stageResults={stageResults} />}

        {/* Tabs */}
        <div className="flex rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          {(['play', 'history'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className="flex-1 py-2.5 text-sm font-semibold transition-all"
              style={tab === t ? { background: 'rgba(251,191,36,0.15)', color: '#fbbf24' } : { color: '#8b949e' }}>
              {t === 'play' ? '⚔️ Enter' : '📋 History'}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {tab === 'play' ? (
            <motion.div key="play" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">

              {/* AI Personality Cards */}
              <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-[10px] text-dark-muted uppercase tracking-[0.2em] text-center font-semibold">5 Progressive AI Opponents</p>
                <div className="space-y-2">
                  {AI_PERSONALITIES.map((ai, i) => {
                    const stage = STAGES[i];
                    return (
                      <motion.div key={ai.stage}
                        initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}
                        className="flex items-center gap-3 px-3 py-3 rounded-xl"
                        style={{ background: ai.accent, border: `1px solid ${ai.color}22` }}>

                        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                          style={{ background: `${ai.color}15`, border: `1.5px solid ${ai.color}35`, boxShadow: `0 0 12px ${ai.color}20` }}>
                          {ai.icon}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                            <p className="text-xs font-black" style={{ color: ai.color }}>{ai.name}</p>
                            <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold"
                              style={{ background: `${ai.color}20`, color: ai.color, border: `1px solid ${ai.color}30` }}>
                              {stage.difficulty}
                            </span>
                          </div>
                          <p className="text-[10px] font-semibold" style={{ color: `${ai.color}99` }}>{ai.type}</p>
                          <p className="text-[10px] text-dark-muted/70 mt-0.5 leading-tight">{ai.desc}</p>
                        </div>

                        <div className="text-right flex-shrink-0 ml-1">
                          <p className="text-[8px] text-dark-muted/50 font-medium">STAGE</p>
                          <p className="text-xl font-black leading-none" style={{ color: ai.color }}>{i + 1}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Live battles spectator strip */}
              <LiveBattlesStrip />

              {/* Join a Friend's Team — quick entry point so user doesn't have to pick a tier first */}
              {!user?.isGuest && !teamState && !activeStatus && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                  className="rounded-2xl p-4 flex items-center gap-4"
                  style={{ background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.28)' }}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.35)' }}>
                    🔗
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black" style={{ color: '#a855f7' }}>Join a Friend's Team</p>
                    <p className="text-[11px] text-dark-muted leading-tight">Got an invite code? Join directly — no tier selection needed</p>
                  </div>
                  <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                    onClick={() => setShowQuickJoinTeam(true)}
                    className="flex-shrink-0 px-4 py-2 rounded-xl text-xs font-black"
                    style={{ background: 'linear-gradient(135deg,#a855f7,#7c3aed)', color: '#fff' }}>
                    Join Team
                  </motion.button>
                </motion.div>
              )}

              {/* Tier cards */}
              <div className="grid sm:grid-cols-2 gap-4">
                {TIER_DISPLAY.filter(tier => enabledTiers[tier.id] !== false).map((tier, idx) => {
                  const cfg = survivalCfg[tier.id];
                  const points = cfg?.entryPoints ?? tier.defaultPoints;
                  const rewards: number[] = (cfg?.stageRewards?.length === 5 ? cfg.stageRewards : tier.defaultRewards);
                  const totalReward = rewards.reduce((a, b) => a + b, 0);
                  const canAfford = balance !== null && balance >= points / POINTS_PER_RUPEE;
                  return (
                    <motion.div key={tier.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.07 }}
                      className="rounded-2xl p-5 space-y-3 flex flex-col"
                      style={{ background: `radial-gradient(ellipse at top, ${tier.glow}, rgba(13,17,23,0.95) 70%)`, border: `1px solid ${tier.color}40` }}>
                      <div className="flex items-center justify-between">
                        <span className="font-black text-sm" style={{ color: tier.color }}>{tier.icon} {tier.label}</span>
                        {balance !== null && !canAfford && <span className="text-[10px] text-red-400 font-semibold">Low balance</span>}
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between"><span className="text-dark-muted">Entry</span><span className="font-bold text-white">{points.toLocaleString()} pts</span></div>
                        <div className="h-px" style={{ background: `${tier.color}30` }} />
                        {rewards.map((r, i) => (
                          <div key={i} className="flex justify-between items-center" style={{ opacity: 0.7 + i * 0.06 }}>
                            <span className="text-dark-muted">Stage {i + 1} clear</span>
                            <span style={{ color: tier.color }}>+{r.toLocaleString()} pts</span>
                          </div>
                        ))}
                        <div className="h-px" style={{ background: `${tier.color}30` }} />
                        <div className="flex justify-between items-center font-bold">
                          <span className="text-dark-text">Max Reward</span>
                          <span style={{ color: tier.color }}>+{totalReward.toLocaleString()} pts</span>
                        </div>
                      </div>
                      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                        onClick={() => handleStart(tier.id)}
                        disabled={starting || !canAfford || user?.isGuest || !!activeStatus || (!!teamState && teamState.status === 'forming')}
                        className="w-full py-3 rounded-xl font-bold text-sm mt-auto disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ background: tier.color, color: '#0d1117' }}>
                        {starting && selectedTier === tier.id ? '⏳ Starting…' : activeStatus ? 'Resume Active' : (teamState?.status === 'forming') ? 'Team Lobby Active' : user?.isGuest ? 'Sign in to Play' : `Enter · ${points.toLocaleString()} pts`}
                      </motion.button>
                    </motion.div>
                  );
                })}
              </div>

              {/* Rules */}
              <div className="rounded-2xl p-4 space-y-2" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider">How it works</p>
                <ul className="space-y-1.5 text-xs text-dark-muted">
                  <li>• Entry fee deducted instantly from your main wallet</li>
                  <li>• Fight 5 AI opponents — each progressively more dangerous</li>
                  <li>• Win a stage → points credited immediately to wallet</li>
                  <li>• Lose any stage → eliminated, tournament ends</li>
                  <li>• <strong className="text-yellow-400">Tie</strong> → one tiebreaker round; tie again = eliminated</li>
                  <li>• Clear Stage 4 → face the <strong className="text-red-400">Apex Trinity Boss</strong> in the Final Arena</li>
                  <li>• <strong className="text-yellow-400">1 Rupee = {POINTS_PER_RUPEE} Points</strong> — rewards auto-convert to wallet</li>
                  <li>• 🔄 If you disconnect, resume from this page anytime</li>
                </ul>
                <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(168,85,247,0.2)' }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'rgba(168,85,247,0.7)' }}>👥 Team Mode</p>
                  <ul className="space-y-1 text-xs text-dark-muted">
                    <li>• 2–4 players battle together against AI in the same room</li>
                    <li>• <strong className="text-white">Combined score</strong> — your team's total vs AI total (lower wins)</li>
                    <li>• Host creates team → share invite code → invite friends</li>
                    <li>• Fee options: split equally or host pays everything</li>
                    <li>• Each member earns stage rewards individually on win</li>
                  </ul>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SurvivalHistoryTab />
            </motion.div>
          )}
        </AnimatePresence>

        <button onClick={() => navigate('/lobby')} className="w-full py-2.5 rounded-xl text-sm text-dark-muted hover:text-dark-text transition-colors"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          ← Back to Lobby
        </button>
      </div>
    </Layout>
  );
}
