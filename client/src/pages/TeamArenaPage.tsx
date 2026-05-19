import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { useTeamArenaStore } from '../store/teamArenaStore';
import { useGameStore } from '../store/gameStore';
import { socketTeamArena } from '../services/socket';
import { teamArenaApi } from '../services/api';
import { Layout } from '../components/layout/Layout';
import { TeamStageResult } from '../components/team-arena/TeamStageResult';
import { StageIntro } from '../components/team-arena/StageIntro';

const AI_PROFILES = [
  { personality: 'safe',       name: 'Sentinel', icon: '🛡',  playstyle: 'Cautious Defender',       desc: 'Patient and methodical. Minimises risk, holds out for the perfect SHOW.', color: '#22c55e', difficulty: 'Easy' },
  { personality: 'aggressive', name: 'Vanguard', icon: '⚡',  playstyle: 'Relentless Attacker',     desc: 'Maximum pressure. Throws 7s and skips constantly to tire opponents.',    color: '#f59e0b', difficulty: 'Hard' },
  { personality: 'bluff',      name: 'Mirage',   icon: '🎭',  playstyle: 'Mind-Game Specialist',    desc: 'Unpredictable and deceptive. Opponents can never read Mirage\'s hand.',   color: '#a855f7', difficulty: 'Hard' },
  { personality: 'smart',      name: 'Oracle',   icon: '🧠',  playstyle: 'Adaptive Strategist',     desc: 'Reads the board and adapts. Balances attack, defence, and SHOW timing.', color: '#3b82f6', difficulty: 'Expert' },
];

const STAGES = [
  { stage: 1, name: 'Warmup Duel',       subtitle: 'Enter the Arena',           emoji: '🟢', color: '#22c55e', difficulty: 'Easy',   enemies: ['Iron Guard', 'Shadow Strike'] },
  { stage: 2, name: 'Tactical Pressure', subtitle: 'Pressure Begins',           emoji: '🟡', color: '#f59e0b', difficulty: 'Medium', enemies: ['Blaze', 'Tactician'] },
  { stage: 3, name: 'Mind Games',        subtitle: 'Nothing Is What It Seems',  emoji: '🟠', color: '#f97316', difficulty: 'Hard',   enemies: ['Phantom', 'Mirror'] },
  { stage: 4, name: 'Survival Clash',    subtitle: 'Survive the Arena',         emoji: '🔴', color: '#ef4444', difficulty: 'Expert', enemies: ['Apex', 'Crusher'] },
  { stage: 5, name: 'Final Arena',       subtitle: 'Master the SHOW',           emoji: '👑', color: '#ef4444', difficulty: 'Boss',   enemies: ['The Overlord', 'Nemesis'] },
];

const POINTS_PER_RUPEE = 100;

const TEAM_ARENA_TIERS = [
  { id: 'beginner', label: 'Beginner', icon: '🥉', color: '#22c55e', glow: 'rgba(34,197,94,0.15)',  entryPoints: 1000,  stageRewards: [150, 300, 550, 900, 1600]     },
  { id: 'pro',      label: 'Pro',      icon: '🥈', color: '#60a5fa', glow: 'rgba(96,165,250,0.15)', entryPoints: 2000,  stageRewards: [400, 800, 1400, 2400, 5000]   },
  { id: 'elite',    label: 'Elite',    icon: '🥇', color: '#fbbf24', glow: 'rgba(251,191,36,0.15)', entryPoints: 5000,  stageRewards: [1000, 2000, 3500, 6000, 12500] },
  { id: 'legend',   label: 'Legend',   icon: '💎', color: '#ef4444', glow: 'rgba(239,68,68,0.15)',  entryPoints: 10000, stageRewards: [2000, 4000, 7000, 12000, 25000] },
];

// ── Team Arena Banner ──────────────────────────────────────────────────────────

function TeamArenaBanner() {
  return (
    <div className="relative rounded-2xl overflow-hidden w-full"
      style={{ background: 'linear-gradient(160deg,#04060e 0%,#0a0d1f 55%,#060410 100%)', border: '1px solid rgba(129,140,248,0.15)' }}>
      <svg viewBox="0 0 600 210" xmlns="http://www.w3.org/2000/svg" className="w-full" style={{ display: 'block' }}>
        <defs>
          {/* Atmospheric glows */}
          <radialGradient id="ta-lg" cx="22%" cy="50%" r="45%">
            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.22"/>
            <stop offset="100%" stopColor="#818cf8" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="ta-rg" cx="78%" cy="50%" r="45%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.2"/>
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="ta-cg" cx="50%" cy="45%" r="30%">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.3"/>
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="ta-hero" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.4"/>
            <stop offset="100%" stopColor="#818cf8" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="ta-ally" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.35"/>
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="ta-e1" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4"/>
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="ta-e2" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.35"/>
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0"/>
          </radialGradient>
          <linearGradient id="ta-vs" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#818cf8"/>
            <stop offset="50%" stopColor="#ffffff"/>
            <stop offset="100%" stopColor="#ef4444"/>
          </linearGradient>
          <linearGradient id="ta-teamA" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#818cf8"/>
            <stop offset="100%" stopColor="#22c55e"/>
          </linearGradient>
          <linearGradient id="ta-teamB" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ef4444"/>
            <stop offset="100%" stopColor="#f59e0b"/>
          </linearGradient>
          <filter id="ta-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="ta-softglow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="7" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="ta-bloom" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="11" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <style>{`
            @keyframes ta-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
            @keyframes ta-float2{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
            @keyframes ta-pulse{0%,100%{opacity:.5}50%{opacity:1}}
            @keyframes ta-spark{0%,100%{opacity:0;transform:scale(0)}45%,55%{opacity:1;transform:scale(1)}}
            @keyframes ta-bolt{0%,100%{opacity:0.35}50%{opacity:0.8}}
            @keyframes ta-ring{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
            .taf{animation:ta-float 3s ease-in-out infinite}
            .taf2{animation:ta-float2 2.8s ease-in-out infinite .5s}
            .taf3{animation:ta-float2 3.5s ease-in-out infinite 1s}
            .tap{animation:ta-pulse 1.8s ease-in-out infinite}
            .tas1{animation:ta-spark 2s ease-in-out infinite}
            .tas2{animation:ta-spark 2s ease-in-out infinite .35s}
            .tas3{animation:ta-spark 2s ease-in-out infinite .7s}
            .tas4{animation:ta-spark 2s ease-in-out infinite 1.05s}
            .tab{animation:ta-bolt 1.6s ease-in-out infinite}
          `}</style>
        </defs>

        {/* Atmosphere */}
        <rect width="600" height="210" fill="url(#ta-lg)"/>
        <rect width="600" height="210" fill="url(#ta-rg)"/>
        <rect width="600" height="210" fill="url(#ta-cg)"/>

        {/* Grid */}
        <g opacity="0.025" stroke="#fff" strokeWidth="0.5">
          {[0,1,2,3,4,5,6,7,8,9].map(i=><line key={`h${i}`} x1="0" y1={i*24} x2="600" y2={i*24}/>)}
          {[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29].map(i=><line key={`v${i}`} x1={i*21} y1="0" x2={i*21} y2="210"/>)}
        </g>

        {/* Team A label bar (top-left) */}
        <rect x="18" y="14" width="54" height="14" rx="7" fill="rgba(129,140,248,0.18)" stroke="rgba(129,140,248,0.45)" strokeWidth="1"/>
        <text x="45" y="24" textAnchor="middle" fill="#818cf8" fontSize="7.5" fontWeight="800" letterSpacing="1">TEAM A</text>

        {/* Team B label bar (top-right) */}
        <rect x="528" y="14" width="54" height="14" rx="7" fill="rgba(239,68,68,0.18)" stroke="rgba(239,68,68,0.45)" strokeWidth="1"/>
        <text x="555" y="24" textAnchor="middle" fill="#ef4444" fontSize="7.5" fontWeight="800" letterSpacing="1">TEAM B</text>

        {/* ══ HUMAN PLAYER — left side ══ */}
        <g className="taf">
          {/* Outer halo */}
          <circle cx="95" cy="95" r="58" fill="url(#ta-hero)" opacity="0.55"/>
          <circle cx="95" cy="95" r="48" fill="none" stroke="#818cf8" strokeWidth="0.6" strokeDasharray="5 4" opacity="0.28" className="tap"/>
          {/* Shield */}
          <path d="M95 52 L122 66 L122 94 Q122 113 95 124 Q68 113 68 94 L68 66 Z"
            fill="#0d1117" stroke="#818cf8" strokeWidth="2" filter="url(#ta-glow)"/>
          <path d="M95 60 L116 72 L116 94 Q116 108 95 116 Q74 108 74 94 L74 72 Z"
            fill="none" stroke="#818cf8" strokeWidth="0.6" opacity="0.3"/>
          {/* Person icon on shield */}
          <circle cx="95" cy="77" r="8" fill="#818cf8" opacity="0.9"/>
          <path d="M81 102 Q81 89 95 89 Q109 89 109 102" fill="#818cf8" opacity="0.9"/>
          {/* YOU label */}
          <text x="95" y="138" textAnchor="middle" fill="#818cf8" fontSize="9" fontWeight="900" letterSpacing="3.5" opacity="0.9">YOU</text>
          <text x="95" y="148" textAnchor="middle" fill="#818cf8" fontSize="6.5" fontWeight="700" letterSpacing="2" opacity="0.5">PLAYER</text>
        </g>

        {/* Human card fan */}
        <g className="taf">
          <g transform="translate(38,128) rotate(-22,12,16)">
            <rect width="22" height="32" rx="3" fill="#818cf8" stroke="#6366f1" strokeWidth="1"/>
            <text x="11" y="20" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="900">7</text>
          </g>
          <g transform="translate(57,122) rotate(-8,11,16)">
            <rect width="22" height="32" rx="3" fill="#fff" stroke="#e2e8f0" strokeWidth="0.8"/>
            <text x="11" y="20" textAnchor="middle" fill="#dc2626" fontSize="11" fontWeight="900">♥</text>
          </g>
          <g transform="translate(75,122) rotate(7,11,16)">
            <rect width="22" height="32" rx="3" fill="#818cf8" stroke="#6366f1" strokeWidth="1"/>
            <text x="11" y="20" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="900">K</text>
          </g>
          <g transform="translate(93,127) rotate(22,11,16)">
            <rect width="22" height="32" rx="3" fill="#fff" stroke="#e2e8f0" strokeWidth="0.8"/>
            <text x="11" y="20" textAnchor="middle" fill="#1e293b" fontSize="11" fontWeight="900">♠</text>
          </g>
        </g>

        {/* Human sparks */}
        <circle cx="57" cy="62" r="2.5" fill="#818cf8" className="tas1"/>
        <circle cx="42" cy="88" r="2"   fill="#818cf8" className="tas3"/>
        <circle cx="135" cy="60" r="2"  fill="#818cf8" className="tas5"/>
        <circle cx="140" cy="100" r="2.5" fill="#a5b4fc" className="tas2"/>

        {/* ══ AI TEAMMATE — left-center ══ */}
        <g className="taf2">
          {/* Glow */}
          <circle cx="200" cy="90" r="46" fill="url(#ta-ally)" opacity="0.5"/>
          <circle cx="200" cy="90" r="36" fill="none" stroke="#22c55e" strokeWidth="0.6" strokeDasharray="4 4" opacity="0.3" className="tap"/>
          {/* Hexagon body */}
          <polygon points="200,52 228,68 228,100 200,116 172,100 172,68"
            fill="#0d1117" stroke="#22c55e" strokeWidth="2" filter="url(#ta-glow)"/>
          <polygon points="200,60 222,74 222,98 200,112 178,98 178,74"
            fill="none" stroke="#22c55e" strokeWidth="0.6" opacity="0.3"/>
          {/* Bot icon */}
          <rect x="189" y="70" width="22" height="16" rx="4" fill="#22c55e" opacity="0.9"/>
          <circle cx="194" cy="76" r="3" fill="#0d1117"/>
          <circle cx="206" cy="76" r="3" fill="#0d1117"/>
          <rect x="193" y="82" width="14" height="2" rx="1" fill="#0d1117" opacity="0.7"/>
          <line x1="200" y1="86" x2="200" y2="93" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"/>
          <line x1="192" y1="90" x2="200" y2="93" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="208" y1="90" x2="200" y2="93" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round"/>
          {/* AI Ally label */}
          <text x="200" y="130" textAnchor="middle" fill="#22c55e" fontSize="9" fontWeight="900" letterSpacing="2" opacity="0.9">AI ALLY</text>
          <text x="200" y="140" textAnchor="middle" fill="#22c55e" fontSize="6.5" fontWeight="700" letterSpacing="2" opacity="0.5">TEAMMATE</text>
        </g>

        {/* AI teammate sparks */}
        <circle cx="165" cy="65" r="2" fill="#22c55e" className="tas2"/>
        <circle cx="238" cy="70" r="2.5" fill="#22c55e" className="tas4"/>
        <circle cx="240" cy="108" r="2" fill="#34d399" className="tas1"/>

        {/* Team A connector line */}
        <path d="M140 95 Q170 95 172 92" stroke="rgba(129,140,248,0.3)" strokeWidth="1.2" fill="none" strokeDasharray="3 3" className="tab"/>

        {/* Team A bracket */}
        <text x="147" y="172" textAnchor="middle" fill="rgba(129,140,248,0.55)" fontSize="7" fontWeight="700" letterSpacing="1">HUMAN + BOT</text>
        <line x1="50" y1="163" x2="244" y2="163" stroke="rgba(129,140,248,0.2)" strokeWidth="1"/>
        <line x1="50" y1="160" x2="50" y2="166" stroke="rgba(129,140,248,0.35)" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="244" y1="160" x2="244" y2="166" stroke="rgba(129,140,248,0.35)" strokeWidth="1.5" strokeLinecap="round"/>

        {/* ══ CENTER — VS + 2v2 ══ */}
        {/* Orbit rings */}
        <circle cx="300" cy="90" r="44" fill="none" stroke="#7c3aed" strokeWidth="0.5" strokeDasharray="3 5" opacity="0.28" className="tap"/>
        <circle cx="300" cy="90" r="28" fill="none" stroke="#7c3aed" strokeWidth="0.4" opacity="0.18" className="tap"/>

        {/* Crossed swords */}
        <g filter="url(#ta-glow)" opacity="0.85">
          <line x1="278" y1="68" x2="322" y2="108" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="322" y1="68" x2="278" y2="108" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round"/>
          {/* Sword handles */}
          <line x1="270" y1="62" x2="280" y2="72" stroke="#fbbf24" strokeWidth="3.5" strokeLinecap="round"/>
          <line x1="330" y1="62" x2="320" y2="72" stroke="#fbbf24" strokeWidth="3.5" strokeLinecap="round"/>
          <line x1="274" y1="74" x2="284" y2="64" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round"/>
          <line x1="316" y1="64" x2="326" y2="74" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round"/>
          {/* Blade tips */}
          <line x1="274" y1="112" x2="280" y2="106" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
          <line x1="320" y1="106" x2="326" y2="112" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
        </g>

        {/* VS bloom + text */}
        <text x="300" y="132" textAnchor="middle" fill="#7c3aed" fontSize="26" fontWeight="900" fontFamily="Arial Black,Arial" opacity="0.35" filter="url(#ta-bloom)">VS</text>
        <text x="300" y="132" textAnchor="middle" fill="url(#ta-vs)" fontSize="26" fontWeight="900" fontFamily="Arial Black,Arial" letterSpacing="-1">VS</text>

        {/* 2v2 badge */}
        <rect x="272" y="140" width="56" height="14" rx="7" fill="rgba(109,40,217,0.22)" stroke="rgba(109,40,217,0.5)" strokeWidth="1"/>
        <text x="300" y="150" textAnchor="middle" fill="#a78bfa" fontSize="7.5" fontWeight="800" letterSpacing="2">2v2 TEAM</text>

        {/* Energy bolts left→right */}
        <path d="M252 86 L272 98 L260 98 L278 110" stroke="#818cf8" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.5" filter="url(#ta-glow)" className="tab"/>
        <path d="M348 86 L328 98 L340 98 L322 110" stroke="#ef4444" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.5" filter="url(#ta-glow)" className="tab"/>

        {/* Center sparks */}
        <circle cx="260" cy="74" r="2.5" fill="#a855f7" className="tas2"/>
        <circle cx="340" cy="74" r="2.5" fill="#a855f7" className="tas4"/>
        <circle cx="268" cy="116" r="2" fill="#60a5fa" className="tas1"/>
        <circle cx="332" cy="116" r="2" fill="#f59e0b" className="tas3"/>

        {/* ══ ENEMY BOT 1 — right ══ */}
        <g className="taf3">
          {/* Glow */}
          <circle cx="400" cy="88" r="44" fill="url(#ta-e1)" opacity="0.5"/>
          <circle cx="400" cy="88" r="34" fill="none" stroke="#ef4444" strokeWidth="0.6" strokeDasharray="4 4" opacity="0.28" className="tap"/>
          {/* Diamond body */}
          <polygon points="400,50 432,82 400,114 368,82"
            fill="#0d1117" stroke="#ef4444" strokeWidth="2" filter="url(#ta-glow)"/>
          <polygon points="400,58 426,82 400,106 374,82"
            fill="none" stroke="#ef4444" strokeWidth="0.6" opacity="0.28"/>
          {/* Skull icon */}
          <circle cx="400" cy="74" r="10" fill="#ef4444" opacity="0.85"/>
          <circle cx="396" cy="72" r="2.5" fill="#0d1117"/>
          <circle cx="404" cy="72" r="2.5" fill="#0d1117"/>
          <path d="M395 79 Q400 82 405 79" fill="none" stroke="#0d1117" strokeWidth="1.5"/>
          <rect x="395" y="82" width="10" height="4" rx="2" fill="#ef4444" opacity="0.5"/>
          <rect x="396" y="80" width="3" height="5" rx="1" fill="#0d1117"/>
          <rect x="401" y="80" width="3" height="5" rx="1" fill="#0d1117"/>
          {/* Enemy label */}
          <text x="400" y="128" textAnchor="middle" fill="#ef4444" fontSize="9" fontWeight="900" letterSpacing="2" opacity="0.9">ENEMY</text>
          <text x="400" y="138" textAnchor="middle" fill="#ef4444" fontSize="6.5" fontWeight="700" letterSpacing="2.5" opacity="0.5">BOT I</text>
        </g>

        {/* ══ ENEMY BOT 2 — far right ══ */}
        <g className="taf2">
          <circle cx="500" cy="88" r="42" fill="url(#ta-e2)" opacity="0.45"/>
          <circle cx="500" cy="88" r="32" fill="none" stroke="#f59e0b" strokeWidth="0.6" strokeDasharray="4 4" opacity="0.28" className="tap"/>
          {/* Octagon body */}
          <polygon points="500,52 518,60 526,78 526,98 518,116 500,124 482,116 474,98 474,78 482,60"
            fill="#0d1117" stroke="#f59e0b" strokeWidth="2" filter="url(#ta-glow)"/>
          <polygon points="500,60 515,67 521,80 521,96 515,109 500,116 485,109 479,96 479,80 485,67"
            fill="none" stroke="#f59e0b" strokeWidth="0.6" opacity="0.28"/>
          {/* Lightning bolt */}
          <path d="M504 64 L493 88 L501 88 L496 112 L511 84 L503 84 Z" fill="#f59e0b" opacity="0.9" filter="url(#ta-glow)"/>
          {/* Label */}
          <text x="500" y="136" textAnchor="middle" fill="#f59e0b" fontSize="9" fontWeight="900" letterSpacing="2" opacity="0.9">ENEMY</text>
          <text x="500" y="146" textAnchor="middle" fill="#f59e0b" fontSize="6.5" fontWeight="700" letterSpacing="2.5" opacity="0.5">BOT II</text>
        </g>

        {/* Enemy sparks */}
        <circle cx="365" cy="62" r="2.5" fill="#ef4444" className="tas1"/>
        <circle cx="358" cy="96" r="2"   fill="#ef4444" className="tas3"/>
        <circle cx="462" cy="62" r="2"   fill="#f59e0b" className="tas2"/>
        <circle cx="548" cy="72" r="2.5" fill="#f59e0b" className="tas4"/>
        <circle cx="544" cy="104" r="2"  fill="#ef4444" className="tas1"/>

        {/* Enemy connector line */}
        <path d="M444 84 Q472 84 474 82" stroke="rgba(239,68,68,0.3)" strokeWidth="1.2" fill="none" strokeDasharray="3 3" className="tab"/>

        {/* Team B bracket */}
        <text x="453" y="172" textAnchor="middle" fill="rgba(239,68,68,0.55)" fontSize="7" fontWeight="700" letterSpacing="1">BOT + BOT</text>
        <line x1="356" y1="163" x2="550" y2="163" stroke="rgba(239,68,68,0.2)" strokeWidth="1"/>
        <line x1="356" y1="160" x2="356" y2="166" stroke="rgba(239,68,68,0.35)" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="550" y1="160" x2="550" y2="166" stroke="rgba(239,68,68,0.35)" strokeWidth="1.5" strokeLinecap="round"/>

        {/* Bottom tagline */}
        <text x="300" y="196" textAnchor="middle" fill="rgba(255,255,255,0.18)" fontSize="8" fontWeight="700" letterSpacing="4">SURVIVE TOGETHER · 5 STAGES</text>
      </svg>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StageMapRow({ stageResults, currentStage, active }: {
  stageResults: any[]; currentStage: number; active: boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-1.5 flex-wrap">
      {STAGES.map((s, i) => {
        const done = stageResults.find((r) => r.stage === s.stage);
        const isCurrent = active && s.stage === currentStage;
        const won = done?.teamAWon;

        return (
          <React.Fragment key={s.stage}>
            <motion.div
              animate={isCurrent ? { scale: [1, 1.12, 1] } : {}}
              transition={{ repeat: Infinity, duration: 2 }}
              className="flex flex-col items-center gap-1"
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black"
                style={{
                  background: done
                    ? won ? 'linear-gradient(135deg,#34d399,#10b981)' : 'linear-gradient(135deg,#ef4444,#dc2626)'
                    : isCurrent
                      ? `linear-gradient(135deg,${s.color}aa,${s.color}66)`
                      : 'rgba(255,255,255,0.06)',
                  border: isCurrent ? `2px solid ${s.color}` : '1px solid rgba(255,255,255,0.1)',
                  boxShadow: isCurrent ? `0 0 14px ${s.color}88` : 'none',
                  color: done || isCurrent ? '#fff' : 'rgba(148,163,184,0.4)',
                }}
              >
                {done ? (won ? '✓' : '✗') : isCurrent ? s.emoji : s.stage}
              </div>
              <span className="text-xs" style={{ color: isCurrent ? s.color : 'rgba(100,116,139,0.6)', fontSize: 10 }}>
                S{s.stage}
              </span>
            </motion.div>
            {i < 4 && (
              <div
                className="h-px"
                style={{
                  width: 20,
                  background: done ? (won ? '#34d399' : '#ef4444') : 'rgba(255,255,255,0.08)',
                  marginBottom: 14,
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function TeamArenaPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    active, tournamentId, inviteCode, teammateType, teammateName,
    aiPersonality, entryPoints, currentStage, totalStages,
    totalPointsEarned, stageResults, waitingForTeammate, isTeammate,
    stageResult, showStageIntro, introStage,
    subscribe, clearStageResult, continueToNextStage, dismissStageIntro, reset,
  } = useTeamArenaStore();
  const { game, subscribeToEvents } = useGameStore();

  // Setup view state — 'tiers' and 'join_invite' are full pages; selection flow is in modal
  const [view, setView] = useState<'tiers' | 'join_invite'>('tiers');
  const [modalStep, setModalStep] = useState<null | 'teammate_select' | 'ai_select' | 'entry_mode'>(null);
  const [selectedTierId, setSelectedTierId] = useState<string>('beginner');
  const [selectedTeammate, setSelectedTeammate] = useState<'ai' | 'human' | null>(null);
  const [selectedAI, setSelectedAI] = useState<string>('smart');
  const [selectedEntryMode, setSelectedEntryMode] = useState<'host_pays' | 'split'>('split');
  const [inviteInput, setInviteInput] = useState('');
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [statusChecked, setStatusChecked] = useState(false);
  const [starting, setStarting] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [copied, setCopied] = useState(false);

  // Subscribe to both team-arena socket events AND game:state events so we can
  // receive the game state and navigate to /game when it arrives
  useEffect(() => {
    const unsub1 = subscribe();
    const unsub2 = subscribeToEvents();
    return () => { unsub1(); unsub2(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Check wallet balance
  useEffect(() => {
    import('../services/api').then(({ walletApi }) => {
      walletApi.get()
        .then((r) => setWalletBalance(r.data.balance))
        .catch(() => {});
    });
  }, []);

  // Restore any active tournament on mount.
  // The REST call gives us the data immediately; the socket status call
  // fills in isHost and triggers auto-continue via team-arena:status_result.
  useEffect(() => {
    teamArenaApi.status()
      .then((r) => {
        const t = r.data.tournament;
        if (t && (t.status === 'active' || t.status === 'waiting_teammate')) {
          // Restore store state directly from REST response so UI updates immediately
          useTeamArenaStore.setState({
            active: true,
            tournamentId: String(t._id),
            inviteCode: t.inviteCode,
            teammateType: t.teammateType,
            teammateName: t.teammateName,
            aiPersonality: t.teamAiPersonality ?? null,
            entryPoints: t.entryPoints ?? 1000,
            currentStage: t.currentStage ?? 1,
            totalStages: 5,
            totalPointsEarned: t.totalPointsEarned ?? 0,
            stageResults: t.stageResults ?? [],
            waitingForTeammate: t.status === 'waiting_teammate',
            isTeammate: t.hostUserId !== user?.id,
          });
          // Also emit socket status to get server-side isHost and sync currentRoomCode
          socketTeamArena.status();
        }
        setStatusChecked(true);
      })
      .catch(() => setStatusChecked(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigate to game when game state arrives — wait until intro is dismissed
  useEffect(() => {
    if (game && active && !stageResult && !waitingForTeammate && !showStageIntro) {
      navigate('/game');
    }
  }, [game, active, stageResult, waitingForTeammate, showStageIntro, navigate]);

  // Auto-rejoin room when we have an active tournament but no game (e.g. after
  // stage result is cleared or page is refreshed mid-tournament).
  // Also blocked while the stage intro is showing so the game room isn't
  // created before the cinematic finishes.
  useEffect(() => {
    if (active && !game && !stageResult && !waitingForTeammate && statusChecked && !showStageIntro) {
      socketTeamArena.continue();
    }
  }, [active, game, stageResult, waitingForTeammate, statusChecked, showStageIntro]);

  const startWithAI = useCallback(() => {
    if (starting) return;
    setStarting(true);
    socketTeamArena.start({
      teammateType: 'ai',
      aiPersonality: selectedAI,
      entryMode: 'host_pays',
      tier: selectedTierId,
    });
    setTimeout(() => setStarting(false), 4000);
  }, [selectedAI, selectedTierId, starting]);

  const startWithHuman = useCallback(() => {
    if (starting) return;
    setStarting(true);
    socketTeamArena.start({
      teammateType: 'human',
      entryMode: selectedEntryMode,
      tier: selectedTierId,
    });
    setTimeout(() => setStarting(false), 4000);
  }, [selectedEntryMode, selectedTierId, starting]);

  const joinAsTeammate = useCallback(() => {
    if (!inviteInput.trim()) return;
    setJoinError('');
    socketTeamArena.joinAsTeammate(inviteInput.trim().toUpperCase());
  }, [inviteInput]);

  const handleAbandon = useCallback(() => {
    socketTeamArena.abandon();
    reset();
    setView('tiers');
  }, [reset]);

  const handleContinue = useCallback(() => {
    continueToNextStage();
  }, [continueToNextStage]);

  const copyInvite = useCallback(() => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [inviteCode]);

  // ── Tier-based entry fee calculation
  const tierCfg = TEAM_ARENA_TIERS.find(t => t.id === selectedTierId) ?? TEAM_ARENA_TIERS[0];
  const aiEntryPoints = tierCfg.entryPoints * 2;
  const aiEntryRupees = aiEntryPoints / POINTS_PER_RUPEE;
  const humanEntryPoints = tierCfg.entryPoints;
  const hostPays = selectedEntryMode === 'host_pays' ? humanEntryPoints : Math.ceil(humanEntryPoints / 2);
  const hostPaysRupees = hostPays / POINTS_PER_RUPEE;

  // ── STAGE INTRO ─────────────────────────────────────────────────────────────
  if (showStageIntro) {
    return (
      <StageIntro
        stage={introStage}
        mode="teamarena"
        teammateName={teammateName ?? undefined}
        onDismiss={dismissStageIntro}
      />
    );
  }

  // ── STAGE RESULT ────────────────────────────────────────────────────────────
  if (stageResult) {
    return (
      <AnimatePresence mode="wait">
        <TeamStageResult
          key={`result-${stageResult.stage}`}
          result={stageResult}
          stageResults={stageResults}
          onContinue={handleContinue}
          onAbandon={handleAbandon}
        />
      </AnimatePresence>
    );
  }

  // ── WAITING FOR TEAMMATE ────────────────────────────────────────────────────
  if (active && waitingForTeammate && inviteCode) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center p-4"
          style={{ background: 'linear-gradient(160deg,#04060e 0%,#0a0d1f 55%,#060410 100%)' }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full rounded-2xl overflow-hidden p-6 text-center"
            style={{
              maxWidth: 380,
              background: 'rgba(15,18,40,0.95)',
              border: '1px solid rgba(99,102,241,0.3)',
              boxShadow: '0 0 40px rgba(99,102,241,0.15)',
            }}
          >
            <div className="text-5xl mb-4">🤝</div>
            <h2 className="text-xl font-black mb-1" style={{ color: '#e2e8f0' }}>Waiting for Teammate</h2>
            <p className="text-sm mb-6" style={{ color: 'rgba(148,163,184,0.7)' }}>
              Share this invite code with your teammate
            </p>

            <div
              className="rounded-xl p-4 mb-6 cursor-pointer select-all"
              style={{
                background: 'rgba(99,102,241,0.12)',
                border: '2px dashed rgba(99,102,241,0.4)',
              }}
              onClick={copyInvite}
            >
              <p className="text-3xl font-black tracking-widest" style={{ color: '#818cf8', letterSpacing: '0.3em' }}>
                {inviteCode}
              </p>
              <p className="text-xs mt-1" style={{ color: copied ? '#34d399' : 'rgba(148,163,184,0.5)' }}>
                {copied ? '✓ Copied!' : 'Tap to copy'}
              </p>
            </div>

            {/* Entry mode info */}
            <div
              className="rounded-xl p-3 mb-6 text-left"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <p className="text-xs font-bold mb-1" style={{ color: '#a5b4fc' }}>Entry split</p>
              <div className="flex justify-between text-xs" style={{ color: 'rgba(148,163,184,0.7)' }}>
                <span>You paid</span>
                <span className="font-bold" style={{ color: '#e2e8f0' }}>
                  {hostPays} pts (₹{hostPaysRupees.toFixed(2)})
                </span>
              </div>
              {selectedEntryMode === 'split' && (
                <div className="flex justify-between text-xs mt-0.5" style={{ color: 'rgba(148,163,184,0.7)' }}>
                  <span>Teammate pays</span>
                  <span className="font-bold" style={{ color: '#e2e8f0' }}>
                    {Math.floor(humanEntryPoints / 2)} pts
                  </span>
                </div>
              )}
            </div>

            <StageMapRow stageResults={[]} currentStage={1} active={false} />

            <button
              onClick={handleAbandon}
              className="mt-6 w-full py-2.5 rounded-xl text-sm font-bold"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#64748b',
              }}
            >
              Cancel
            </button>
          </motion.div>
        </div>
      </Layout>
    );
  }

  // ── ACTIVE TOURNAMENT (joining game, waiting for game:state) ────────────────
  if (active && !game) {
    const currentStageInfo = STAGES.find((s) => s.stage === currentStage);
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center p-4"
          style={{ background: 'linear-gradient(160deg,#04060e 0%,#0a0d1f 55%,#060410 100%)' }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full rounded-2xl p-6"
            style={{
              maxWidth: 380,
              background: 'rgba(15,18,40,0.95)',
              border: '1px solid rgba(99,102,241,0.3)',
            }}
          >
            <div className="text-center mb-5">
              <span className="text-4xl">{currentStageInfo?.emoji}</span>
              <h2 className="text-lg font-black mt-2" style={{ color: '#e2e8f0' }}>
                Stage {currentStage} — {currentStageInfo?.name}
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(148,163,184,0.6)' }}>
                {currentStageInfo?.subtitle}
              </p>
            </div>

            <StageMapRow stageResults={stageResults} currentStage={currentStage} active />

            <div
              className="mt-4 rounded-xl p-3 flex items-center justify-between"
              style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}
            >
              <span className="text-xs" style={{ color: '#fbbf24' }}>Pts earned so far</span>
              <span className="text-sm font-black" style={{ color: '#fbbf24' }}>{totalPointsEarned}</span>
            </div>

            {/* Joining indicator — auto-continue fires from useEffect */}
            <div className="mt-4 rounded-xl p-3 flex items-center justify-center gap-2"
              style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                className="w-4 h-4 rounded-full border-2"
                style={{ borderColor: 'rgba(99,102,241,0.3)', borderTopColor: '#818cf8' }}
              />
              <span className="text-xs font-bold" style={{ color: '#a5b4fc' }}>Joining game…</span>
            </div>

            <div className="mt-3 flex gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => socketTeamArena.continue()}
                className="flex-1 py-3 rounded-xl font-black text-sm"
                style={{
                  background: 'linear-gradient(135deg,#6366f1,#818cf8)',
                  color: '#fff',
                  boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
                }}
              >
                Retry →
              </motion.button>
              <button
                onClick={handleAbandon}
                className="px-4 py-3 rounded-xl text-sm font-bold"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#64748b',
                }}
              >
                Quit
              </button>
            </div>
          </motion.div>
        </div>
      </Layout>
    );
  }

  // ── SETUP FLOW ─────────────────────────────────────────────────────────────

  return (
    <Layout>
      <div
        className="min-h-screen px-4 py-6"
        style={{ background: 'linear-gradient(160deg,#04060e 0%,#0a0d1f 55%,#060410 100%)' }}
      >
        <div className="max-w-md mx-auto">

          <AnimatePresence mode="wait">

            {/* ── TIER SELECTION ────────────────────────────────────────────── */}
            {view === 'tiers' && (
              <motion.div key="tiers" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
                {/* Header */}
                <div className="text-center mb-5">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span style={{ fontSize: 32 }}>⚔️</span>
                    <div>
                      <h1 className="text-2xl font-black" style={{
                        background: 'linear-gradient(135deg,#818cf8,#a78bfa,#c084fc)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                      }}>TEAM ARENA</h1>
                      <p className="text-xs tracking-widest" style={{ color: 'rgba(148,163,184,0.5)', letterSpacing: '0.2em' }}>SURVIVE TOGETHER</p>
                    </div>
                  </div>
                  <p className="text-sm" style={{ color: 'rgba(148,163,184,0.7)' }}>
                    2v2 tactical survival — 5 stages of escalating AI opponents
                  </p>
                </div>

                {/* Premium banner */}
                <div className="mb-4">
                  <TeamArenaBanner />
                </div>

                {/* Stage path preview */}
                <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(15,18,40,0.8)', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <p className="text-xs font-bold tracking-widest uppercase mb-3 text-center" style={{ color: 'rgba(165,180,252,0.6)' }}>
                    Tournament Path
                  </p>
                  <StageMapRow stageResults={[]} currentStage={1} active={false} />
                  <div className="mt-3 space-y-1.5">
                    {STAGES.map((s) => (
                      <div key={s.stage} className="flex items-center gap-2.5 text-xs">
                        <span style={{ color: s.color, fontSize: 12 }}>{s.emoji}</span>
                        <span className="font-bold" style={{ color: 'rgba(226,232,240,0.7)' }}>{s.name}</span>
                        <span style={{ color: 'rgba(100,116,139,0.6)' }}>·</span>
                        <span style={{ color: 'rgba(100,116,139,0.6)' }}>{s.subtitle}</span>
                        <span className="ml-auto px-1.5 py-0.5 rounded font-bold" style={{ background: `${s.color}18`, color: s.color, fontSize: 10 }}>
                          {s.difficulty}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tier cards */}
                <p className="text-[10px] text-center uppercase tracking-[0.2em] font-bold mb-3" style={{ color: 'rgba(165,180,252,0.5)' }}>
                  Choose Your Entry Tier
                </p>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {TEAM_ARENA_TIERS.map((tier, idx) => {
                    const totalReward = tier.stageRewards.reduce((a, b) => a + b, 0);
                    const canAfford = walletBalance >= tier.entryPoints / POINTS_PER_RUPEE;
                    return (
                      <motion.div
                        key={tier.id}
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.07 }}
                        className="rounded-2xl p-4 flex flex-col"
                        style={{ background: `radial-gradient(ellipse at top, ${tier.glow}, rgba(13,17,23,0.95) 70%)`, border: `1px solid ${tier.color}40` }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-black text-sm" style={{ color: tier.color }}>{tier.icon} {tier.label}</span>
                          {!canAfford && <span className="text-[9px] text-red-400 font-semibold">Low balance</span>}
                        </div>
                        <div className="space-y-1 text-xs mb-3 flex-1">
                          <div className="flex justify-between"><span className="text-dark-muted">Entry</span><span className="font-bold text-white">{tier.entryPoints.toLocaleString()} pts</span></div>
                          <div className="h-px" style={{ background: `${tier.color}30` }} />
                          {tier.stageRewards.map((r, i) => (
                            <div key={i} className="flex justify-between items-center" style={{ opacity: 0.65 + i * 0.07 }}>
                              <span className="text-dark-muted">S{i + 1} clear</span>
                              <span style={{ color: tier.color }}>+{r.toLocaleString()}</span>
                            </div>
                          ))}
                          <div className="h-px" style={{ background: `${tier.color}30` }} />
                          <div className="flex justify-between font-bold">
                            <span className="text-dark-text">Max</span>
                            <span style={{ color: tier.color }}>+{totalReward.toLocaleString()} pts</span>
                          </div>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                          onClick={() => { setSelectedTierId(tier.id); setModalStep('teammate_select'); }}
                          disabled={!canAfford || user?.isGuest}
                          className="w-full py-2.5 rounded-xl font-bold text-xs mt-auto disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{ background: tier.color, color: '#0d1117' }}
                        >
                          {user?.isGuest ? 'Sign in' : !canAfford ? 'Need more pts' : `Select →`}
                        </motion.button>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Join as teammate */}
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={() => setView('join_invite')}
                  className="w-full py-3 rounded-xl text-sm font-bold mb-3"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(148,163,184,0.7)' }}
                >
                  🔗 Join as Teammate (enter invite code)
                </motion.button>

                <button onClick={() => navigate('/lobby')} className="w-full py-2 text-xs" style={{ color: 'rgba(100,116,139,0.5)' }}>
                  ← Back to Lobby
                </button>
              </motion.div>
            )}

            {/* ── JOIN AS TEAMMATE ───────────────────────────────────────────── */}
            {view === 'join_invite' && (
              <motion.div key="join_invite" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
                <button onClick={() => setView('tiers')} className="flex items-center gap-1.5 mb-4 text-sm" style={{ color: 'rgba(148,163,184,0.6)' }}>
                  ← Back
                </button>
                <h2 className="text-xl font-black mb-1" style={{ color: '#e2e8f0' }}>Join as Teammate</h2>
                <p className="text-xs mb-6" style={{ color: 'rgba(148,163,184,0.6)' }}>
                  Enter the 6-letter invite code from your team captain
                </p>

                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="Enter code (e.g. ABC123)"
                    maxLength={6}
                    value={inviteInput}
                    onChange={(e) => { setInviteInput(e.target.value.toUpperCase()); setJoinError(''); }}
                    className="w-full rounded-xl px-4 py-3 text-center text-xl font-black tracking-widest outline-none"
                    style={{
                      background: 'rgba(15,18,40,0.8)',
                      border: joinError ? '2px solid rgba(239,68,68,0.6)' : '2px solid rgba(99,102,241,0.4)',
                      color: '#818cf8',
                      letterSpacing: '0.3em',
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && joinAsTeammate()}
                  />
                  {joinError && (
                    <p className="text-xs mt-1.5 text-center" style={{ color: '#f87171' }}>{joinError}</p>
                  )}
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={joinAsTeammate}
                  disabled={inviteInput.length < 6}
                  className="w-full py-3.5 rounded-xl font-black text-sm"
                  style={{
                    background: inviteInput.length < 6 ? 'rgba(99,102,241,0.25)' : 'linear-gradient(135deg,#6366f1,#818cf8)',
                    color: '#fff',
                    opacity: inviteInput.length < 6 ? 0.5 : 1,
                    boxShadow: inviteInput.length < 6 ? 'none' : '0 4px 20px rgba(99,102,241,0.4)',
                  }}
                >
                  🤝 Join Team
                </motion.button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>

      {/* ── SELECTION MODAL (teammate → ai_select / entry_mode) ──────────── */}
      <AnimatePresence>
        {modalStep !== null && (
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4"
            style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) setModalStep(null); }}
          >
            <motion.div
              initial={{ opacity: 0, y: 52 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 52 }}
              transition={{ type: 'spring', damping: 24, stiffness: 300 }}
              className="w-full rounded-2xl overflow-hidden"
              style={{
                maxWidth: 460,
                background: 'rgba(10,13,31,0.99)',
                border: `1px solid ${tierCfg.color}40`,
                boxShadow: `0 0 50px ${tierCfg.color}22, 0 24px 60px rgba(0,0,0,0.65)`,
              }}
            >
              {/* ── Persistent modal header ── */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <div className="flex items-center gap-2">
                  {modalStep !== 'teammate_select' && (
                    <button
                      onClick={() => setModalStep('teammate_select')}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-xs mr-1"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(148,163,184,0.7)' }}
                    >←</button>
                  )}
                  <span className="font-black text-sm" style={{ color: tierCfg.color }}>{tierCfg.icon} {tierCfg.label} Tier</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                    style={{ background: `${tierCfg.color}18`, color: tierCfg.color, border: `1px solid ${tierCfg.color}30` }}>
                    {tierCfg.entryPoints.toLocaleString()} pts
                  </span>
                </div>
                <button
                  onClick={() => setModalStep(null)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(148,163,184,0.6)' }}
                >✕</button>
              </div>

              {/* ── Step content with slide transitions ── */}
              <AnimatePresence mode="wait">

                {/* Step 1 — choose teammate type */}
                {modalStep === 'teammate_select' && (
                  <motion.div
                    key="step-teammate"
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30 }}
                    transition={{ duration: 0.18 }}
                    className="px-5 pb-5"
                  >
                    <p className="text-xs mb-4" style={{ color: 'rgba(148,163,184,0.55)' }}>Choose how you want to play</p>

                    <motion.button
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      onClick={() => setModalStep('ai_select')}
                      className="w-full rounded-xl overflow-hidden mb-3 text-left"
                      style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(139,92,246,0.15))', border: '1px solid rgba(99,102,241,0.4)' }}
                    >
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-black text-sm" style={{ color: '#a5b4fc' }}>🤖 Play with AI Teammate</p>
                            <p className="text-xs mt-0.5" style={{ color: 'rgba(148,163,184,0.65)' }}>Solo entry, AI partner — starts instantly</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-black" style={{ color: '#818cf8' }}>{aiEntryPoints.toLocaleString()} pts</p>
                            <p className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>₹{aiEntryRupees.toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="flex gap-1.5 mt-2.5 flex-wrap">
                          {AI_PROFILES.map((p) => (
                            <span key={p.personality} className="text-xs px-2 py-0.5 rounded-full font-bold"
                              style={{ background: `${p.color}18`, color: p.color, border: `1px solid ${p.color}40` }}>
                              {p.icon} {p.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      onClick={() => setModalStep('entry_mode')}
                      className="w-full rounded-xl overflow-hidden text-left"
                      style={{ background: 'linear-gradient(135deg,rgba(52,211,153,0.12),rgba(16,185,129,0.08))', border: '1px solid rgba(52,211,153,0.3)' }}
                    >
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-black text-sm" style={{ color: '#6ee7b7' }}>👤 Invite Human Teammate</p>
                            <p className="text-xs mt-0.5" style={{ color: 'rgba(148,163,184,0.65)' }}>Play with a friend — split or host pays</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-black" style={{ color: '#34d399' }}>{humanEntryPoints.toLocaleString()} pts</p>
                            <p className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>₹{(humanEntryPoints / POINTS_PER_RUPEE).toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    </motion.button>
                  </motion.div>
                )}

                {/* Step 2A — AI teammate picker */}
                {modalStep === 'ai_select' && (
                  <motion.div
                    key="step-ai"
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 30 }}
                    transition={{ duration: 0.18 }}
                    className="px-5 pb-5"
                  >
                    <p className="text-xs mb-4" style={{ color: 'rgba(148,163,184,0.55)' }}>
                      Your AI partner plays independently — their score adds to your team total
                    </p>

                    <div className="space-y-2.5 mb-4 max-h-72 overflow-y-auto pr-1">
                      {AI_PROFILES.map((p) => (
                        <motion.button
                          key={p.personality}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setSelectedAI(p.personality)}
                          className="w-full rounded-xl p-3.5 text-left"
                          style={{
                            background: selectedAI === p.personality
                              ? `linear-gradient(135deg,${p.color}20,${p.color}10)`
                              : 'rgba(255,255,255,0.03)',
                            border: selectedAI === p.personality
                              ? `2px solid ${p.color}80`
                              : '1px solid rgba(255,255,255,0.07)',
                            boxShadow: selectedAI === p.personality ? `0 0 18px ${p.color}22` : 'none',
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                              style={{ background: `${p.color}18`, border: `1px solid ${p.color}40` }}
                            >
                              {p.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-black text-sm" style={{ color: selectedAI === p.personality ? p.color : '#e2e8f0' }}>
                                  {p.name}
                                </span>
                                <span className="text-xs px-1.5 py-0.5 rounded font-bold" style={{ background: `${p.color}18`, color: p.color }}>
                                  {p.difficulty}
                                </span>
                                {selectedAI === p.personality && (
                                  <span className="ml-auto text-xs font-bold" style={{ color: p.color }}>✓</span>
                                )}
                              </div>
                              <p className="text-xs mt-0.5" style={{ color: 'rgba(148,163,184,0.6)', lineHeight: 1.4 }}>{p.desc}</p>
                            </div>
                          </div>
                        </motion.button>
                      ))}
                    </div>

                    <div className="rounded-xl px-4 py-3 mb-4 flex justify-between items-center"
                      style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.22)' }}>
                      <span className="text-xs" style={{ color: 'rgba(148,163,184,0.7)' }}>Entry fee</span>
                      <span className="font-black text-sm" style={{ color: '#818cf8' }}>{aiEntryPoints.toLocaleString()} pts</span>
                    </div>
                    {walletBalance < aiEntryRupees && (
                      <p className="text-xs mb-3 text-center" style={{ color: '#f87171' }}>
                        ⚠ Insufficient balance — need ₹{aiEntryRupees.toFixed(2)}
                      </p>
                    )}
                    <motion.button
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      onClick={startWithAI}
                      disabled={starting || walletBalance < aiEntryRupees}
                      className="w-full py-3.5 rounded-xl font-black text-sm"
                      style={{
                        background: starting || walletBalance < aiEntryRupees ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg,#6366f1,#818cf8)',
                        color: '#fff',
                        opacity: starting || walletBalance < aiEntryRupees ? 0.6 : 1,
                        boxShadow: starting || walletBalance < aiEntryRupees ? 'none' : '0 4px 20px rgba(99,102,241,0.4)',
                      }}
                    >
                      {starting ? 'Starting…' : `⚔ Enter Team Arena — ${aiEntryPoints.toLocaleString()} pts`}
                    </motion.button>
                  </motion.div>
                )}

                {/* Step 2B — Human teammate entry mode */}
                {modalStep === 'entry_mode' && (
                  <motion.div
                    key="step-entry"
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 30 }}
                    transition={{ duration: 0.18 }}
                    className="px-5 pb-5"
                  >
                    <p className="text-xs mb-4" style={{ color: 'rgba(148,163,184,0.55)' }}>
                      Choose how to handle the {humanEntryPoints.toLocaleString()} pts entry fee
                    </p>

                    <div className="space-y-2.5 mb-4">
                      {([
                        { mode: 'split' as const, title: '⚖ Split Entry', desc: `You pay ${Math.ceil(humanEntryPoints / 2)} pts · Teammate pays ${Math.floor(humanEntryPoints / 2)} pts`, color: '#34d399' },
                        { mode: 'host_pays' as const, title: '🎁 Host Pays Full', desc: `You pay all ${humanEntryPoints.toLocaleString()} pts · Teammate joins free`, color: '#fbbf24' },
                      ]).map((opt) => (
                        <motion.button
                          key={opt.mode}
                          whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                          onClick={() => setSelectedEntryMode(opt.mode)}
                          className="w-full rounded-xl p-4 text-left"
                          style={{
                            background: selectedEntryMode === opt.mode ? `${opt.color}14` : 'rgba(255,255,255,0.03)',
                            border: selectedEntryMode === opt.mode ? `2px solid ${opt.color}60` : '1px solid rgba(255,255,255,0.07)',
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-black text-sm" style={{ color: selectedEntryMode === opt.mode ? opt.color : '#e2e8f0' }}>{opt.title}</p>
                              <p className="text-xs mt-0.5" style={{ color: 'rgba(148,163,184,0.65)' }}>{opt.desc}</p>
                            </div>
                            {selectedEntryMode === opt.mode && <span className="text-sm font-black ml-3" style={{ color: opt.color }}>✓</span>}
                          </div>
                        </motion.button>
                      ))}
                    </div>

                    <div className="rounded-xl px-4 py-3 mb-4 flex justify-between items-center"
                      style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)' }}>
                      <span className="text-xs" style={{ color: 'rgba(148,163,184,0.7)' }}>You pay now</span>
                      <span className="font-black text-sm" style={{ color: '#34d399' }}>{hostPays.toLocaleString()} pts</span>
                    </div>
                    {walletBalance < hostPaysRupees && (
                      <p className="text-xs mb-3 text-center" style={{ color: '#f87171' }}>
                        ⚠ Insufficient balance — need ₹{hostPaysRupees.toFixed(2)}
                      </p>
                    )}
                    <motion.button
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      onClick={startWithHuman}
                      disabled={starting || walletBalance < hostPaysRupees}
                      className="w-full py-3.5 rounded-xl font-black text-sm"
                      style={{
                        background: starting || walletBalance < hostPaysRupees ? 'rgba(52,211,153,0.2)' : 'linear-gradient(135deg,#10b981,#34d399)',
                        color: '#fff',
                        opacity: starting || walletBalance < hostPaysRupees ? 0.6 : 1,
                        boxShadow: starting || walletBalance < hostPaysRupees ? 'none' : '0 4px 20px rgba(16,185,129,0.35)',
                      }}
                    >
                      {starting ? 'Creating…' : `👥 Create Team — ${hostPays.toLocaleString()} pts`}
                    </motion.button>
                  </motion.div>
                )}

              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
