import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { useSurvivalStore } from '../store/survivalStore';
import { useGameStore } from '../store/gameStore';
import { socketSurvival, on } from '../services/socket';
import { survivalApi, walletApi, configApi } from '../services/api';

function loadSurvivalStatus(setActiveStatus: (v: any) => void, setStatusChecked: (v: boolean) => void) {
  survivalApi.status()
    .then(r => { setActiveStatus(r.data.survival); setStatusChecked(true); })
    .catch(() => setStatusChecked(true));
}
import { Layout } from '../components/layout/Layout';

// ── Constants ─────────────────────────────────────────────────────────────────

const POINTS_PER_RUPEE = 100;

const STAGES = [
  { stage: 1, name: 'Safe Bot',          botCount: 1, emojis: ['🛡️'], color: '#22c55e', desc: 'Defensive & cautious',                    difficulty: 'Easy'   },
  { stage: 2, name: 'Aggressive Bot',    botCount: 1, emojis: ['⚡'], color: '#f59e0b', desc: 'Fast attacks & pressure',                 difficulty: 'Medium' },
  { stage: 3, name: 'Bluff Bot',         botCount: 1, emojis: ['🎭'], color: '#a855f7', desc: 'Deceptive & unpredictable',               difficulty: 'Hard'   },
  { stage: 4, name: 'Dual AI Challenge', botCount: 2, emojis: ['🧠','⚔️'], color: '#3b82f6', desc: 'Beat Smart + Aggressive AI',        difficulty: 'Expert' },
  { stage: 5, name: 'Final Boss Arena',  botCount: 3, emojis: ['💀','🧠','⚔️'], color: '#ef4444', desc: 'Survive Boss + Smart + Aggressive AI', difficulty: 'Boss' },
];

const TIER_DISPLAY = [
  { id: 'beginner',   label: 'Beginner',   icon: '🥉', color: '#22c55e', glow: 'rgba(34,197,94,0.15)',  defaultPoints: 1000,  defaultRewards: [200, 400, 700, 1200, 2500]   },
  { id: 'pro',        label: 'Pro',        icon: '🥈', color: '#60a5fa', glow: 'rgba(96,165,250,0.15)', defaultPoints: 2000,  defaultRewards: [400, 800, 1400, 2400, 5000]  },
  { id: 'elite',      label: 'Elite',      icon: '🥇', color: '#fbbf24', glow: 'rgba(251,191,36,0.15)', defaultPoints: 5000,  defaultRewards: [1000, 2000, 3500, 6000, 12500] },
  { id: 'boss_arena', label: 'Boss Arena', icon: '💎', color: '#ef4444', glow: 'rgba(239,68,68,0.15)',  defaultPoints: 10000, defaultRewards: [2000, 4000, 7000, 12000, 25000] },
];

// ── Battle Illustration ───────────────────────────────────────────────────────

function BattleIllustration() {
  return (
    <div className="relative rounded-2xl overflow-hidden w-full"
      style={{ background: 'linear-gradient(135deg,#06080f 0%,#0d1022 50%,#090610 100%)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <svg viewBox="0 0 600 210" xmlns="http://www.w3.org/2000/svg" className="w-full" style={{ display: 'block' }}>
        <defs>
          <radialGradient id="sv-hg" cx="28%" cy="55%" r="38%">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.22"/>
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="sv-rg" cx="72%" cy="55%" r="38%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.22"/>
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="sv-cg" cx="50%" cy="50%" r="30%">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.38"/>
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0"/>
          </radialGradient>
          <linearGradient id="sv-vs" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fbbf24"/>
            <stop offset="50%" stopColor="#ffffff"/>
            <stop offset="100%" stopColor="#ef4444"/>
          </linearGradient>
          <filter id="sv-glow">
            <feGaussianBlur stdDeviation="3.5" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="sv-bloom">
            <feGaussianBlur stdDeviation="7" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <style>{`
            @keyframes sv-pulse{0%,100%{opacity:.65}50%{opacity:1}}
            @keyframes sv-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
            @keyframes sv-float2{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
            @keyframes sv-blink{0%,88%,100%{opacity:1}93%{opacity:.1}}
            @keyframes sv-spark{0%,100%{opacity:0;transform:scale(0)}40%,60%{opacity:1;transform:scale(1)}}
            .svp{animation:sv-pulse 2s ease-in-out infinite}
            .svf{animation:sv-float 3s ease-in-out infinite}
            .svf2{animation:sv-float2 2.6s ease-in-out infinite .6s}
            .svf3{animation:sv-float2 3.4s ease-in-out infinite 1.1s}
            .svbl{animation:sv-blink 4s ease-in-out infinite}
            .svs1{animation:sv-spark 2s ease-in-out infinite}
            .svs2{animation:sv-spark 2s ease-in-out infinite .4s}
            .svs3{animation:sv-spark 2s ease-in-out infinite .8s}
            .svs4{animation:sv-spark 2s ease-in-out infinite 1.2s}
            .svs5{animation:sv-spark 2s ease-in-out infinite 1.6s}
          `}</style>
        </defs>

        {/* Background glows */}
        <rect width="600" height="210" fill="url(#sv-hg)"/>
        <rect width="600" height="210" fill="url(#sv-rg)"/>
        <rect width="600" height="210" fill="url(#sv-cg)"/>

        {/* Subtle grid */}
        <g opacity="0.035" stroke="#fff" strokeWidth="0.5">
          {[0,1,2,3,4,5,6,7,8,9,10].map(i=><line key={`h${i}`} x1="0" y1={i*21} x2="600" y2={i*21}/>)}
          {[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29].map(i=><line key={`v${i}`} x1={i*21} y1="0" x2={i*21} y2="210"/>)}
        </g>

        {/* ── HUMAN (LEFT) ── */}
        <g className="svf">
          {/* aura ring */}
          <circle cx="148" cy="92" r="68" fill="none" stroke="#fbbf24" strokeWidth="0.6" opacity="0.18"/>
          {/* head */}
          <circle cx="148" cy="60" r="26" fill="#13111e" stroke="#fbbf24" strokeWidth="2.2" filter="url(#sv-glow)"/>
          {/* hair */}
          <path d="M122 53 Q148 38 174 53" fill="#fbbf24" opacity="0.55"/>
          {/* eyes */}
          <ellipse cx="140" cy="58" rx="4.5" ry="5" fill="#fbbf24"/>
          <ellipse cx="156" cy="58" rx="4.5" ry="5" fill="#fbbf24"/>
          <circle cx="140" cy="58" r="2" fill="#09090f"/>
          <circle cx="156" cy="58" r="2" fill="#09090f"/>
          <circle cx="141" cy="57" r="1" fill="#fff" opacity="0.6"/>
          <circle cx="157" cy="57" r="1" fill="#fff" opacity="0.6"/>
          {/* smile */}
          <path d="M140 70 Q148 77 156 70" stroke="#fbbf24" strokeWidth="2" fill="none" strokeLinecap="round"/>
          {/* body */}
          <rect x="131" y="90" width="34" height="40" rx="7" fill="#13111e" stroke="#fbbf24" strokeWidth="1.8"/>
          <line x1="148" y1="90" x2="148" y2="130" stroke="#fbbf24" strokeWidth="0.5" opacity="0.3"/>
          {/* collar */}
          <path d="M138 90 L148 102 L158 90" stroke="#fbbf24" strokeWidth="1" fill="none" opacity="0.4"/>
          {/* left arm */}
          <path d="M131 102 Q112 97 96 112" stroke="#fbbf24" strokeWidth="5.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          {/* right arm → cards */}
          <path d="M165 102 Q184 97 198 112" stroke="#fbbf24" strokeWidth="5.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          {/* HUMAN label */}
          <text x="148" y="147" textAnchor="middle" fill="#fbbf24" fontSize="8.5" fontWeight="900" letterSpacing="3" opacity="0.75">HUMAN</text>
        </g>

        {/* Human cards fan */}
        <g className="svf">
          <g transform="translate(76,86) rotate(-22,13,18)">
            <rect width="28" height="40" rx="3.5" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1"/>
            <text x="14" y="26" textAnchor="middle" fill="#09090f" fontSize="14" fontWeight="900">7</text>
          </g>
          <g transform="translate(98,80) rotate(-8,13,18)">
            <rect width="28" height="40" rx="3.5" fill="#fff" stroke="#e5e7eb" strokeWidth="0.8"/>
            <text x="14" y="26" textAnchor="middle" fill="#dc2626" fontSize="14" fontWeight="900">♥</text>
          </g>
          <g transform="translate(118,78) rotate(5,13,18)">
            <rect width="28" height="40" rx="3.5" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1"/>
            <text x="14" y="26" textAnchor="middle" fill="#09090f" fontSize="14" fontWeight="900">K</text>
          </g>
          <g transform="translate(137,82) rotate(18,13,18)">
            <rect width="28" height="40" rx="3.5" fill="#fff" stroke="#e5e7eb" strokeWidth="0.8"/>
            <text x="14" y="26" textAnchor="middle" fill="#1f2937" fontSize="14" fontWeight="900">♠</text>
          </g>
        </g>

        {/* ── ROBOT AI (RIGHT) ── */}
        <g className="svf2">
          {/* aura ring */}
          <circle cx="452" cy="92" r="68" fill="none" stroke="#ef4444" strokeWidth="0.6" opacity="0.18"/>
          {/* main antenna */}
          <line x1="452" y1="30" x2="452" y2="44" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"/>
          <circle cx="452" cy="26" r="5" fill="#ef4444" className="svp" filter="url(#sv-glow)"/>
          {/* side antennae */}
          <line x1="434" y1="38" x2="425" y2="29" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="470" y1="38" x2="479" y2="29" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="425" cy="29" r="3" fill="#ef4444" opacity="0.7" className="svp"/>
          <circle cx="479" cy="29" r="3" fill="#ef4444" opacity="0.7" className="svp"/>
          {/* robot head */}
          <rect x="422" y="44" width="60" height="50" rx="9" fill="#13060f" stroke="#ef4444" strokeWidth="2.5" filter="url(#sv-glow)"/>
          <rect x="427" y="49" width="50" height="40" rx="6" fill="none" stroke="#ef4444" strokeWidth="0.5" opacity="0.25"/>
          {/* eye sockets */}
          <rect x="430" y="53" width="16" height="12" rx="3" fill="#09090f" stroke="#ef4444" strokeWidth="1" opacity="0.8"/>
          <rect x="454" y="53" width="16" height="12" rx="3" fill="#09090f" stroke="#ef4444" strokeWidth="1" opacity="0.8"/>
          {/* glowing pupils */}
          <rect x="432" y="55" width="12" height="8" rx="2" fill="#ef4444" className="svbl"/>
          <rect x="456" y="55" width="12" height="8" rx="2" fill="#ef4444" className="svbl"/>
          {/* eye bloom */}
          <rect x="432" y="55" width="12" height="8" rx="2" fill="#ff1111" opacity="0.5" filter="url(#sv-bloom)"/>
          <rect x="456" y="55" width="12" height="8" rx="2" fill="#ff1111" opacity="0.5" filter="url(#sv-bloom)"/>
          {/* specular */}
          <rect x="436" y="56" width="4" height="3" rx="1" fill="#fff" opacity="0.9"/>
          <rect x="460" y="56" width="4" height="3" rx="1" fill="#fff" opacity="0.9"/>
          {/* LED mouth */}
          {[0,1,2,3,4,5,6,7,8].map(i=>(
            <rect key={i} x={430+i*4.5} y="74" width="3.2" height="6" rx="1" fill="#00ff88" opacity={i%3===1?0.9:0.35} className="svp"/>
          ))}
          {/* robot body */}
          <rect x="418" y="97" width="68" height="42" rx="9" fill="#13060f" stroke="#ef4444" strokeWidth="2"/>
          {/* circuit lines */}
          <line x1="428" y1="107" x2="476" y2="107" stroke="#ef4444" strokeWidth="0.8" opacity="0.5"/>
          <line x1="428" y1="115" x2="476" y2="115" stroke="#3b82f6" strokeWidth="0.8" opacity="0.5"/>
          <line x1="428" y1="123" x2="476" y2="123" stroke="#22c55e" strokeWidth="0.8" opacity="0.4"/>
          <circle cx="476" cy="107" r="3" fill="#ef4444" className="svs1"/>
          <circle cx="428" cy="115" r="3" fill="#3b82f6" className="svs3"/>
          <circle cx="476" cy="123" r="3" fill="#22c55e" className="svs5"/>
          <rect x="440" y="110" width="24" height="12" rx="3" fill="#1a0a10" stroke="#ef4444" strokeWidth="0.5" opacity="0.5"/>
          {/* arms */}
          <path d="M418 109 Q398 103 382 116" stroke="#ef4444" strokeWidth="5.5" fill="none" strokeLinecap="round"/>
          <path d="M486 109 Q506 103 520 116" stroke="#ef4444" strokeWidth="5.5" fill="none" strokeLinecap="round"/>
          {/* AI BOT label */}
          <text x="452" y="154" textAnchor="middle" fill="#ef4444" fontSize="8.5" fontWeight="900" letterSpacing="5" opacity="0.75">AI BOT</text>
        </g>

        {/* Bot cards fan (dark neon) */}
        <g className="svf2">
          <g transform="translate(336,86) rotate(-19,13,18)">
            <rect width="28" height="40" rx="3.5" fill="#13060f" stroke="#ef4444" strokeWidth="1.5"/>
            <text x="14" y="26" textAnchor="middle" fill="#ef4444" fontSize="14" fontWeight="900">A</text>
          </g>
          <g transform="translate(356,80) rotate(-6,13,18)">
            <rect width="28" height="40" rx="3.5" fill="#060c1a" stroke="#3b82f6" strokeWidth="1.5"/>
            <text x="14" y="26" textAnchor="middle" fill="#60a5fa" fontSize="14" fontWeight="900">♠</text>
          </g>
          <g transform="translate(374,78) rotate(7,13,18)">
            <rect width="28" height="40" rx="3.5" fill="#13060f" stroke="#ef4444" strokeWidth="1.5"/>
            <text x="14" y="26" textAnchor="middle" fill="#ef4444" fontSize="14" fontWeight="900">K</text>
          </g>
          <g transform="translate(392,84) rotate(20,13,18)">
            <rect width="28" height="40" rx="3.5" fill="#110614" stroke="#a855f7" strokeWidth="1.5"/>
            <text x="14" y="26" textAnchor="middle" fill="#c084fc" fontSize="14" fontWeight="900">Q</text>
          </g>
        </g>

        {/* ── CENTER CLASH ── */}
        {/* Outer orbit rings */}
        <circle cx="300" cy="95" r="48" fill="none" stroke="#7c3aed" strokeWidth="0.6" opacity="0.25" className="svp"/>
        <circle cx="300" cy="95" r="32" fill="none" stroke="#a855f7" strokeWidth="0.7" opacity="0.3" className="svp"/>

        {/* Energy arcs from sides */}
        <path d="M225 82 L255 100 L240 100 L268 118" stroke="#fbbf24" strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.65" filter="url(#sv-glow)"/>
        <path d="M375 82 L345 100 L360 100 L332 118" stroke="#ef4444" strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.65" filter="url(#sv-glow)"/>

        {/* VS glow shadow */}
        <text x="300" y="90" textAnchor="middle" fill="#7c3aed" fontSize="40" fontWeight="900" fontFamily="Arial Black,Arial" opacity="0.35" filter="url(#sv-bloom)">VS</text>
        {/* VS main text */}
        <text x="300" y="90" textAnchor="middle" fill="url(#sv-vs)" fontSize="40" fontWeight="900" fontFamily="Arial Black,Arial" letterSpacing="-2">VS</text>
        {/* BATTLE sub-label */}
        <text x="300" y="106" textAnchor="middle" fill="#a855f7" fontSize="7.5" fontWeight="800" letterSpacing="5.5" opacity="0.8">BATTLE</text>

        {/* Flying clash cards */}
        <g className="svf3" transform="translate(265,48) rotate(-38,9,13)">
          <rect width="20" height="28" rx="2.5" fill="#fbbf24" stroke="#f59e0b" strokeWidth="0.8" opacity="0.75"/>
          <text x="10" y="18" textAnchor="middle" fill="#09090f" fontSize="11" fontWeight="900">7</text>
        </g>
        <g className="svf" transform="translate(312,44) rotate(24,9,13)">
          <rect width="20" height="28" rx="2.5" fill="#13060f" stroke="#ef4444" strokeWidth="1.2" opacity="0.7"/>
          <text x="10" y="18" textAnchor="middle" fill="#ef4444" fontSize="11" fontWeight="900">A</text>
        </g>
        <g className="svf2" transform="translate(252,132) rotate(58,8,11)">
          <rect width="18" height="25" rx="2" fill="#fff" opacity="0.6"/>
          <text x="9" y="16" textAnchor="middle" fill="#dc2626" fontSize="10" fontWeight="900">♥</text>
        </g>
        <g className="svf3" transform="translate(325,132) rotate(-42,8,11)">
          <rect width="18" height="25" rx="2" fill="#060c1a" stroke="#60a5fa" strokeWidth="1" opacity="0.65"/>
          <text x="9" y="16" textAnchor="middle" fill="#60a5fa" fontSize="10" fontWeight="900">♠</text>
        </g>

        {/* Spark particles */}
        <circle cx="242" cy="88" r="3.5" fill="#fbbf24" className="svs1"/>
        <circle cx="262" cy="72" r="2.5" fill="#fbbf24" className="svs2"/>
        <circle cx="358" cy="88" r="3.5" fill="#ef4444" className="svs3"/>
        <circle cx="338" cy="72" r="2.5" fill="#ef4444" className="svs4"/>
        <circle cx="300" cy="46" r="3" fill="#a855f7" className="svs5"/>
        <circle cx="283" cy="118" r="2.5" fill="#60a5fa" className="svs2"/>
        <circle cx="317" cy="118" r="2.5" fill="#22c55e" className="svs4"/>
        <circle cx="248" cy="110" r="2" fill="#fbbf24" className="svs3"/>
        <circle cx="352" cy="110" r="2" fill="#ef4444" className="svs1"/>
        <circle cx="274" cy="56" r="2" fill="#fff" className="svs4"/>
        <circle cx="326" cy="56" r="2" fill="#fff" className="svs2"/>
        <circle cx="289" cy="138" r="1.5" fill="#fbbf24" className="svs5"/>
        <circle cx="311" cy="138" r="1.5" fill="#ef4444" className="svs1"/>

        {/* Bottom tagline */}
        <text x="300" y="188" textAnchor="middle" fill="rgba(255,255,255,0.22)" fontSize="7" letterSpacing="4" fontWeight="700">
          5 STAGES · ONE SHOT · BECOME CHAMPION
        </text>

        {/* Stage indicators */}
        {[1,2,3,4,5].map((n,i)=>(
          <g key={n} transform={`translate(${221+i*40},200)`}>
            <circle r="8" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
            <text textAnchor="middle" y="4" fill="rgba(255,255,255,0.22)" fontSize="7" fontWeight="800">{n}</text>
          </g>
        ))}
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

function StageTracker({ currentStage, stageResults }: { currentStage: number; stageResults: any[] }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <p className="text-[10px] text-dark-muted uppercase tracking-widest mb-3 text-center">Championship Path</p>
      <div className="flex items-center justify-between">
        {STAGES.map((s, idx) => {
          const result = stageResults.find(r => r.stage === s.stage);
          const isActive = s.stage === currentStage;
          const isCleared = result?.playerWon;
          const isFailed = result && !result.playerWon;
          const isLocked = s.stage > currentStage && !result;

          return (
            <React.Fragment key={s.stage}>
              <div className="flex flex-col items-center gap-1">
                <motion.div
                  animate={isActive ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-lg relative"
                  style={{
                    background: isCleared ? `${s.color}22` : isFailed ? 'rgba(255,107,107,0.15)' : isActive ? `${s.color}18` : 'rgba(255,255,255,0.05)',
                    border: `2px solid ${isCleared ? s.color : isFailed ? '#ff6b6b' : isActive ? s.color : 'rgba(255,255,255,0.1)'}`,
                    opacity: isLocked ? 0.4 : 1,
                  }}
                >
                  {isCleared ? '✓' : isFailed ? '✗' : s.emojis[0]}
                  {isActive && (
                    <motion.div
                      animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      className="absolute inset-0 rounded-full"
                      style={{ border: `2px solid ${s.color}`, pointerEvents: 'none' }}
                    />
                  )}
                </motion.div>
                <p className="text-[9px] text-dark-muted text-center w-12 leading-tight">{s.name.split(' ')[0]}</p>
              </div>
              {idx < STAGES.length - 1 && (
                <div className="flex-1 h-0.5 mx-1" style={{ background: isCleared ? `linear-gradient(90deg, ${s.color}, ${STAGES[idx + 1].color})` : 'rgba(255,255,255,0.08)' }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

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

        {/* Hero */}
        <div className="pt-8 pb-4 px-6 text-center relative"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(251,191,36,0.15) 0%, transparent 70%)' }}>
          <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: 4, duration: 0.45 }} className="text-5xl mb-3">
            ⚡
          </motion.div>
          <h2 className="text-2xl font-black text-white">It's a Tie!</h2>
          <p className="text-sm mt-1 font-semibold" style={{ color: stageInfo.color }}>
            {stageInfo.emojis[0]} Stage {stage}: {stageName}
          </p>
          <p className="text-xs mt-2" style={{ color: 'rgba(148,163,184,0.7)' }}>
            One tiebreaker round — lowest score wins
          </p>
        </div>

        {/* Score display */}
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

        {/* Warning */}
        <div className="mx-5 mb-4 rounded-xl px-4 py-2.5"
          style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <p className="text-[11px] text-center" style={{ color: 'rgba(239,68,68,0.8)' }}>
            ⚠️ If you tie again in the tiebreaker, you'll be eliminated
          </p>
        </div>

        {/* CTA */}
        <div className="px-5 pb-6">
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
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

function StageResultOverlay() {
  const { stageResult, clearStageResult, continueToNextStage, reset } = useSurvivalStore();
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

  const handleAction = () => {
    if (tournamentOver) { resetGame(); reset(); navigate('/survival'); }
    else if (playerWon) { continueToNextStage(); }
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

  const stageEmojis = stageInfo.emojis.join(' ');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(16px)' }}>
      <motion.div
        initial={{ scale: 0.7, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 180, damping: 18 }}
        className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: 'linear-gradient(160deg, #0d1117, #111827)', border: tournamentOver && won ? '1px solid rgba(251,191,36,0.4)' : '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Hero */}
        <div className="pt-8 pb-4 px-6 text-center relative">
          <div className="absolute inset-0 pointer-events-none" style={{ background: heroBg }} />
          <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: 3, duration: 0.5 }} className="text-6xl mb-3 relative z-10">
            {heroEmoji}
          </motion.div>
          <h2 className="text-2xl font-black text-white relative z-10">{heroTitle}</h2>
          <p className="text-sm mt-1 relative z-10 font-semibold" style={{ color: stageInfo.color }}>
            {stageEmojis} {stageName ?? stageInfo.name}
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

        {/* Scoreboard — ranked by score (lower = better) */}
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

        {/* Points earned */}
        {playerWon && pointsEarned > 0 && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}
            className="mx-5 mb-3 rounded-xl py-2.5 text-center" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)' }}>
            <p className="text-[10px] text-neon-green/70 uppercase tracking-widest mb-0.5">Points Credited</p>
            <p className="text-2xl font-black text-neon-green">+{pointsEarned.toLocaleString()} pts</p>
            <p className="text-xs text-neon-green/60">+₹{(pointsEarned / POINTS_PER_RUPEE).toFixed(2)} added to wallet</p>
          </motion.div>
        )}

        {/* Champion total */}
        {tournamentOver && won && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}
            className="mx-5 mb-3 rounded-2xl py-4 text-center" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.35)' }}>
            <p className="text-[10px] text-yellow-400/70 uppercase tracking-widest mb-1">Total Earned</p>
            <p className="text-4xl font-black text-yellow-400">{(totalPointsEarned ?? 0).toLocaleString()} pts</p>
            <p className="text-xs text-yellow-400/60 mt-0.5">≡ ₹{((totalPointsEarned ?? 0) / POINTS_PER_RUPEE).toFixed(2)} added to wallet</p>
          </motion.div>
        )}

        {/* Next stage preview */}
        {!tournamentOver && playerWon && nextInfo && (
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

        {/* Stage progress pills */}
        <div className="mx-5 mb-4 flex gap-1 justify-center">
          {stageResults.map((r, i) => (
            <div key={i} className="flex-1 h-2 rounded-full max-w-[40px]" style={{ background: r.playerWon ? '#22c55e' : '#ef4444' }} />
          ))}
          {Array.from({ length: 5 - stageResults.length }).map((_, i) => (
            <div key={`e${i}`} className="flex-1 h-2 rounded-full max-w-[40px]" style={{ background: 'rgba(255,255,255,0.1)' }} />
          ))}
        </div>

        {/* CTA */}
        <div className="px-5 pb-6">
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={handleAction}
            className="w-full py-3.5 rounded-2xl font-bold text-base"
            style={tournamentOver && won
              ? { background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', color: '#0d1117' }
              : playerWon && !tournamentOver && nextInfo
              ? { background: `linear-gradient(135deg, ${nextInfo.color}, ${nextInfo.color}cc)`, color: '#0d1117' }
              : { background: 'rgba(255,255,255,0.08)', color: '#e6edf3', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            {tournamentOver && won
              ? '🏆 Claim Victory!'
              : playerWon && !tournamentOver
              ? `⚔️ Stage ${nextStage}: ${nextStageName ?? nextInfo?.name}`
              : '🏠 Back to Lobby'}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

const STATUS_META: Record<string, { label: string; color: string; emoji: string; border: string }> = {
  won:       { label: 'Champion',   color: '#fbbf24', emoji: '🏆', border: 'rgba(251,191,36,0.25)'  },
  lost:      { label: 'Eliminated', color: '#ff6b6b', emoji: '💀', border: 'rgba(255,107,107,0.2)' },
  abandoned: { label: 'Abandoned',  color: '#9ca3af', emoji: '↩️', border: 'rgba(156,163,175,0.15)' },
  active:    { label: 'In Progress',color: '#60a5fa', emoji: '⚔️', border: 'rgba(96,165,250,0.2)'  },
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

      {/* Header */}
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

        {/* Stage pill strip */}
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

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="p-4 pt-3 space-y-2">

              {/* Per-stage rows */}
              {STAGES.map(s => {
                const res = stageResults.find((sr: any) => sr.stage === s.stage);
                const isRefunded = r.status === 'abandoned' && stageResults.length === 0;
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

              {/* Summary footer */}
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

  const won = records.filter(r => r.status === 'won').length;
  const lost = records.filter(r => r.status === 'lost').length;
  const abandoned = records.filter(r => r.status === 'abandoned').length;

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: 'Champion', value: won, color: '#fbbf24', emoji: '🏆' },
          { label: 'Eliminated', value: lost, color: '#ff6b6b', emoji: '💀' },
          { label: 'Abandoned', value: abandoned, color: '#9ca3af', emoji: '↩️' },
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

// ── Main Page ─────────────────────────────────────────────────────────────────

export function SurvivalTournamentPage() {
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();
  const { subscribe, active, currentStage, stageResults, stageResult, tiebreakerResult, totalPointsEarned } = useSurvivalStore();
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
    // Refresh balance when stage reward is credited
    const unsub5 = on('survival:stage_result', () => refreshBalance());
    const unsub7 = on('survival:abandoned', () => {
      setActiveStatus(null);
      setQuitting(false);
      setShowQuitConfirm(false);
      refreshBalance();
      setStatusChecked(true);
    });

    // Use HTTP for initial status load — no socket timing issues on refresh
    loadSurvivalStatus(setActiveStatus, setStatusChecked);
    refreshBalance();
    configApi.getPublic().then(r => {
      const st = r.data.featureFlags?.survivalTiers;
      if (st) setEnabledTiers({ beginner: st.beginner ?? true, pro: st.pro ?? true, elite: st.elite ?? true, boss_arena: st.boss_arena ?? true });
      if (r.data.survivalConfig) setSurvivalCfg(r.data.survivalConfig);
    }).catch(() => {});
    // Live config updates
    const unsub6 = on('admin:config_updated', (cfg: any) => {
      const st = cfg.featureFlags?.survivalTiers;
      if (st) setEnabledTiers({ beginner: st.beginner ?? true, pro: st.pro ?? true, elite: st.elite ?? true, boss_arena: st.boss_arena ?? true });
      if ((cfg as any).survivalConfig) setSurvivalCfg((cfg as any).survivalConfig);
    });
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); unsub6(); unsub7(); };
  }, [isAuthenticated, navigate, subscribe, subscribeToEvents, refreshBalance]);

  const handleStart = (tier: string) => {
    if (starting) return;
    setStarting(true);
    setSelectedTier(tier);
    socketSurvival.start(tier);
    const unsub = on('survival:error', () => { setStarting(false); setSelectedTier(null); unsub(); });
  };

  const handleResume = () => {
    if (!activeStatus || starting) return;
    setStarting(true);
    socketSurvival.start(activeStatus.tier);
    const unsub = on('survival:error', () => { setStarting(false); unsub(); });
  };

  const handleQuit = () => {
    if (quitting) return;
    setQuitting(true);
    socketSurvival.abandon();
  };

  if (!isAuthenticated) return null;

  const pts = (balance ?? 0) * POINTS_PER_RUPEE;

  return (
    <Layout>
      {/* Tiebreaker overlay (shown when match is tied) */}
      <AnimatePresence>{tiebreakerResult && <TiebreakerOverlay />}</AnimatePresence>

      {/* Stage result overlay (shown after each match) */}
      <AnimatePresence>{stageResult && <StageResultOverlay />}</AnimatePresence>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-1">
          <h1 className="text-3xl font-black" style={{ background: 'linear-gradient(135deg, #fbbf24, #ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            AI Survival Championship
          </h1>
          <p className="text-dark-muted text-sm max-w-md mx-auto">
            Face 5 progressive AI opponents. One loss ends it all. Defeat the Boss AI to become Champion.
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
              <StageTracker currentStage={activeStatus.currentStage} stageResults={activeStatus.stageResults ?? []} />
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

        {/* Active stage tracker (during tournament) */}
        {active && <StageTracker currentStage={currentStage} stageResults={stageResults} />}

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

              {/* Stage showcase */}
              <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-[10px] text-dark-muted uppercase tracking-widest text-center font-semibold">5 Progressive AI Stages</p>
                <div className="space-y-2">
                  {STAGES.map((s, i) => (
                    <motion.div key={s.stage} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl"
                      style={{ background: `${s.color}08`, border: `1px solid ${s.color}20` }}>
                      <span className="text-xl w-8 text-center">{s.emojis[0]}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-dark-text">Stage {s.stage}: {s.name}</p>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: `${s.color}20`, color: s.color }}>{s.difficulty}</span>
                        </div>
                        <p className="text-[10px] text-dark-muted">{s.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

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
                        <div className="flex justify-between"><span className="text-dark-muted">= Real Money</span><span className="font-bold text-white">₹{(points / POINTS_PER_RUPEE).toFixed(0)}</span></div>
                        <div className="h-px" style={{ background: `${tier.color}30` }} />
                        {rewards.map((r, i) => (
                          <div key={i} className="flex justify-between items-center" style={{ opacity: 0.7 + i * 0.06 }}>
                            <span className="text-dark-muted">Stage {i + 1} clear</span>
                            <div className="text-right">
                              <span style={{ color: tier.color }}>+{r.toLocaleString()} pts</span>
                              <span className="text-dark-muted/60 text-[10px] ml-1.5">≡ ₹{r / POINTS_PER_RUPEE}</span>
                            </div>
                          </div>
                        ))}
                        <div className="h-px" style={{ background: `${tier.color}30` }} />
                        <div className="flex justify-between items-center font-bold">
                          <span className="text-dark-text">Max Reward</span>
                          <div className="text-right">
                            <span style={{ color: tier.color }}>+{totalReward.toLocaleString()} pts</span>
                            <span className="text-dark-muted/60 text-[10px] ml-1.5">≡ ₹{totalReward / POINTS_PER_RUPEE}</span>
                          </div>
                        </div>
                      </div>
                      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                        onClick={() => handleStart(tier.id)}
                        disabled={starting || !canAfford || user?.isGuest || !!activeStatus}
                        className="w-full py-3 rounded-xl font-bold text-sm mt-auto disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ background: tier.color, color: '#0d1117' }}>
                        {starting && selectedTier === tier.id ? '⏳ Starting…' : activeStatus ? 'Resume Active' : user?.isGuest ? 'Sign in to Play' : `Enter · ${points.toLocaleString()} pts`}
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
                  <li>• Fight 5 AI opponents, each progressively harder</li>
                  <li>• Win a stage → points credited immediately to wallet</li>
                  <li>• Lose any stage → eliminated, tournament ends</li>
                  <li>• <strong className="text-yellow-400">Tie</strong> → one tiebreaker round added; tie again = eliminated</li>
                  <li>• Defeat Boss AI → become Champion, earn maximum reward</li>
                  <li>• <strong className="text-yellow-400">1 Rupee = {POINTS_PER_RUPEE} Points</strong> — rewards auto-convert to wallet</li>
                  <li>• 🔄 If you disconnect, resume from this page anytime</li>
                </ul>
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
