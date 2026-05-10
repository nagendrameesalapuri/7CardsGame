import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'screenshots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  defaultViewport: { width: 1440, height: 900 },
});

const page = await browser.newPage();
const wait = ms => new Promise(r => setTimeout(r, ms));

// ── 1. Home page — dark ───────────────────────────────────────────────────────
await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 15000 });
await wait(1000);
await page.screenshot({ path: path.join(OUT, '01-home-dark.png'), fullPage: true });
console.log('✓ 01-home-dark.png');

// ── 2. Guest mode (click "Play as Guest" button by text) ─────────────────────
const guestBtn = await page.evaluateHandle(() => {
  return [...document.querySelectorAll('button')].find(b => b.textContent.includes('Guest'));
});
if (guestBtn) {
  const el = guestBtn.asElement();
  if (el) { await el.click(); await wait(700); }
}
await page.screenshot({ path: path.join(OUT, '02-guest-input.png'), fullPage: true });
console.log('✓ 02-guest-input.png');

// ── 3. Type a name ────────────────────────────────────────────────────────────
const nameInput = await page.$('input[placeholder="Your display name"]');
if (nameInput) {
  await nameInput.type('NagPlayer7');
  await wait(400);
}
await page.screenshot({ path: path.join(OUT, '03-guest-name-typed.png'), fullPage: true });
console.log('✓ 03-guest-name-typed.png');

// ── 4. Light theme ────────────────────────────────────────────────────────────
await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 15000 });
await wait(500);
// Toggle theme via button click
await page.evaluate(() => {
  document.documentElement.classList.remove('dark');
  localStorage.setItem('theme', 'light');
});
await wait(400);
await page.screenshot({ path: path.join(OUT, '04-home-light.png'), fullPage: true });
console.log('✓ 04-home-light.png');

// ── 5. Leaderboard ────────────────────────────────────────────────────────────
await page.evaluate(() => {
  document.documentElement.classList.add('dark');
  localStorage.setItem('theme', 'dark');
});
await page.goto('http://localhost:3000/leaderboard', { waitUntil: 'networkidle2', timeout: 15000 });
await wait(1000);
await page.screenshot({ path: path.join(OUT, '05-leaderboard.png'), fullPage: true });
console.log('✓ 05-leaderboard.png');

// ── 6. Mobile home ────────────────────────────────────────────────────────────
await page.setViewport({ width: 390, height: 844 });
await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 15000 });
await wait(800);
await page.screenshot({ path: path.join(OUT, '06-mobile-home.png'), fullPage: true });
console.log('✓ 06-mobile-home.png');

// ── 7. Card component demo ────────────────────────────────────────────────────
// Inject a card demo overlay into the page
await page.setViewport({ width: 1440, height: 900 });
await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 15000 });
await wait(500);
await page.evaluate(() => {
  const suits = ['♥','♦','♣','♠'];
  const cards = [
    {r:'A',s:'♥',c:'#ef4444'},{r:'K',s:'♠',c:'#1e293b'},{r:'Q',s:'♦',c:'#ef4444'},
    {r:'J',s:'♣',c:'#1e293b'},{r:'7',s:'♥',c:'#ef4444'},{r:'5★',s:'',c:'#854d0e',joker:true},
    {r:'10',s:'♠',c:'#1e293b'},
  ];
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(10,20,15,0.97);z-index:9999;
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;
    font-family:'Exo 2',sans-serif;
  `;
  overlay.innerHTML = `
    <h2 style="color:#00ff88;font-size:28px;font-weight:800;letter-spacing:2px;margin:0">🃏 Card Hand Preview</h2>
    <div style="display:flex;gap:8px;align-items:flex-end">
      ${cards.map((c,i) => `
        <div style="
          width:72px;height:104px;background:#f5f0e8;border-radius:10px;
          border:2px solid ${c.joker ? '#ffd700' : '#c8b89a'};
          box-shadow:${c.joker ? '0 0 16px #ffd700,0 4px 16px rgba(0,0,0,0.5)' : '0 4px 16px rgba(0,0,0,0.4)'};
          display:flex;flex-direction:column;justify-content:space-between;padding:4px 6px;
          position:relative;transform:translateY(${i%2===0?'-8px':'0px'}) rotate(${(i-3)*2}deg);
          ${i===3?'transform:translateY(-20px) rotate(-4deg);border-color:#00ff88;box-shadow:0 0 16px #00ff88,0 4px 16px rgba(0,0,0,0.5);':''}
          transition:all 0.2s;
        ">
          <div style="color:${c.c};font-weight:800;font-size:14px;line-height:1">${c.r}</div>
          <div style="color:${c.c};font-size:24px;text-align:center;line-height:1">${c.s}</div>
          <div style="color:${c.c};font-weight:800;font-size:14px;line-height:1;transform:rotate(180deg)">${c.r}</div>
          ${c.joker ? '<div style="position:absolute;bottom:2px;left:0;right:0;text-align:center;font-size:8px;font-weight:800;color:#854d0e;background:#fef08a;border-radius:2px;margin:0 4px">JOKER 0pts</div>' : ''}
        </div>
      `).join('')}
    </div>
    <div style="display:flex;gap:16px;margin-top:8px">
      <div style="padding:8px 20px;background:#00ff88;color:#0d1117;border-radius:12px;font-weight:700;font-size:14px">✓ Discard Card</div>
      <div style="padding:8px 20px;background:rgba(255,255,255,0.1);color:#e6edf3;border-radius:12px;font-weight:700;font-size:14px;border:1px solid rgba(255,255,255,0.2)">Hand: 38 pts</div>
      <div style="padding:8px 20px;background:rgba(255,215,0,0.2);color:#ffd700;border-radius:12px;font-weight:700;font-size:14px;border:1px solid rgba(255,215,0,0.4)">⭐ JOKER = 0 pts</div>
    </div>
    <p style="color:#8b949e;font-size:13px">Joker card glows gold · Selected card raises green</p>
  `;
  document.body.appendChild(overlay);
});
await wait(500);
await page.screenshot({ path: path.join(OUT, '07-card-hand-preview.png'), fullPage: false });
console.log('✓ 07-card-hand-preview.png');

// ── 8. Game Board mockup ──────────────────────────────────────────────────────
await page.evaluate(() => {
  document.body.innerHTML = `
  <div style="font-family:'Exo 2',sans-serif;width:1440px;min-height:900px;background:linear-gradient(135deg,#0f3d25,#1a5c38,#0f3d25);display:flex;flex-direction:column;position:relative;overflow:hidden;">
    <!-- Felt pattern overlay -->
    <div style="position:absolute;inset:0;background-image:repeating-linear-gradient(45deg,rgba(255,255,255,0.015) 0px,rgba(255,255,255,0.015) 2px,transparent 2px,transparent 12px);"></div>

    <!-- Top bar -->
    <div style="background:rgba(0,0,0,0.5);padding:10px 24px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.1);position:relative;z-index:2;">
      <div style="display:flex;align-items:center;gap:16px;">
        <span style="color:#8b949e;font-size:13px;cursor:pointer">← Leave</span>
        <span style="color:#8b949e;font-size:13px">Round <b style="color:#e6edf3">2</b></span>
        <span style="color:#8b949e;font-size:13px">Limit: <b style="color:#e6edf3">100pts</b></span>
      </div>
      <!-- Turn timer -->
      <div style="display:flex;align-items:center;gap:10px;padding:8px 16px;background:rgba(0,255,136,0.1);border:1px solid rgba(0,255,136,0.4);border-radius:12px;box-shadow:0 0 12px rgba(0,255,136,0.2);">
        <div style="position:relative;width:44px;height:44px;">
          <svg width="44" height="44" style="transform:rotate(-90deg)">
            <circle cx="22" cy="22" r="17" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="4"/>
            <circle cx="22" cy="22" r="17" fill="none" stroke="#00ff88" stroke-width="4" stroke-dasharray="107" stroke-dashoffset="27" stroke-linecap="round"/>
          </svg>
          <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#00ff88;font-weight:800;font-size:13px;">22</div>
        </div>
        <div><div style="color:#00ff88;font-weight:700;font-size:13px;">🎯 Your Turn!</div><div style="color:#8b949e;font-size:11px;">Draw a card to start</div></div>
      </div>
      <div style="padding:6px 14px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#8b949e;font-size:12px;cursor:pointer;">💬 Chat</div>
    </div>

    <!-- Game area -->
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;padding:20px;gap:16px;position:relative;z-index:1;">

      <!-- Top opponent -->
      <div style="display:flex;gap:24px;">
        <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
          <div style="padding:8px 16px;background:rgba(22,27,34,0.7);border:1px solid rgba(48,54,61,0.8);border-radius:12px;display:flex;flex-direction:column;align-items:center;gap:4px;">
            <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#3b82f6);display:flex;align-items:center;justify-content:center;font-size:18px;">🦁</div>
            <span style="color:#e6edf3;font-size:12px;font-weight:600;">Priya</span>
            <span style="color:#8b949e;font-size:11px;">7 cards · <b style="color:#e6edf3;">23pts</b></span>
          </div>
          <div style="display:flex;gap:-12px;">
            ${[0,1,2,3,4,5,6].map(i=>`<div style="width:38px;height:54px;background:linear-gradient(135deg,#1e3a8a,#1e40af);border-radius:6px;border:2px solid #3b5de3;margin-left:${i>0?'-16px':'0'};z-index:${i}"></div>`).join('')}
          </div>
        </div>
      </div>

      <!-- Middle row -->
      <div style="flex:1;width:100%;display:flex;align-items:center;justify-content:space-between;max-width:1100px;">

        <!-- Left player -->
        <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
          <div style="padding:8px 16px;background:rgba(22,27,34,0.7);border:1px solid rgba(0,255,136,0.4);border-radius:12px;box-shadow:0 0 12px rgba(0,255,136,0.15);display:flex;flex-direction:column;align-items:center;gap:4px;">
            <div style="color:#00ff88;font-size:11px;font-weight:700;">🎯 TURN</div>
            <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#3b82f6);display:flex;align-items:center;justify-content:center;font-size:16px;">🐯</div>
            <span style="color:#e6edf3;font-size:12px;font-weight:600;">Raju</span>
            <span style="color:#8b949e;font-size:11px;">6 cards · <b style="color:#00ff88;">8pts</b></span>
          </div>
        </div>

        <!-- Center: Deck + Discard + Joker -->
        <div style="display:flex;flex-direction:column;align-items:center;gap:16px;">
          <!-- Joker indicator -->
          <div style="padding:8px 20px;background:rgba(255,215,0,0.1);border:1px solid rgba(255,215,0,0.4);border-radius:12px;display:flex;align-items:center;gap:8px;">
            <span style="color:#ffd700;font-weight:700;font-size:14px;">★ JOKER:</span>
            <span style="color:#fde68a;font-weight:800;font-size:20px;">5s</span>
            <span style="color:#8b949e;font-size:12px;">(all 5s = 0 pts)</span>
          </div>
          <!-- Deck & Discard -->
          <div style="display:flex;align-items:center;gap:32px;">
            <!-- Deck -->
            <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
              <span style="color:#8b949e;font-size:11px;text-transform:uppercase;letter-spacing:2px;">Deck</span>
              <div style="position:relative;width:72px;height:104px;background:linear-gradient(135deg,#1e3a8a,#1e40af);border-radius:10px;border:2px solid #00bfff;box-shadow:0 0 16px rgba(0,191,255,0.4),0 4px 16px rgba(0,0,0,0.4);cursor:pointer;display:flex;align-items:center;justify-content:center;">
                <span style="color:rgba(59,130,246,0.4);font-size:28px;">🂠</span>
                <div style="position:absolute;top:-8px;right:-8px;background:#00bfff;color:#0d1117;border-radius:50%;width:22px;height:22px;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;">34</div>
              </div>
              <span style="color:#8b949e;font-size:11px;">34 cards</span>
            </div>
            <!-- Arrow -->
            <span style="color:#8b949e;font-size:24px;">⇄</span>
            <!-- Discard pile -->
            <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
              <span style="color:#8b949e;font-size:11px;text-transform:uppercase;letter-spacing:2px;">Discard</span>
              <div style="width:72px;height:104px;background:#f5f0e8;border-radius:10px;border:2px solid #c8b89a;box-shadow:0 4px 16px rgba(0,0,0,0.4);display:flex;flex-direction:column;justify-content:space-between;padding:5px 7px;">
                <div style="color:#ef4444;font-weight:800;font-size:14px;">K</div>
                <div style="color:#ef4444;font-size:26px;text-align:center;">♥</div>
                <div style="color:#ef4444;font-weight:800;font-size:14px;transform:rotate(180deg);">K</div>
              </div>
              <span style="color:#8b949e;font-size:11px;">K of hearts</span>
            </div>
          </div>
          <p style="color:#00ff88;font-size:13px;font-weight:600;">Click deck or discard to draw</p>
        </div>

        <!-- Right player -->
        <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
          <div style="padding:8px 16px;background:rgba(22,27,34,0.7);border:1px solid rgba(48,54,61,0.8);border-radius:12px;display:flex;flex-direction:column;align-items:center;gap:4px;">
            <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#3b82f6);display:flex;align-items:center;justify-content:center;font-size:16px;">🤖</div>
            <span style="color:#e6edf3;font-size:12px;font-weight:600;">Bot 1</span>
            <div style="background:rgba(0,191,255,0.2);color:#00bfff;border:1px solid rgba(0,191,255,0.3);border-radius:4px;padding:1px 6px;font-size:9px;font-weight:700;">AI BOT</div>
            <span style="color:#8b949e;font-size:11px;">7 cards · <b style="color:#e6edf3;">41pts</b></span>
          </div>
        </div>
      </div>

      <!-- My hand area -->
      <div style="width:100%;max-width:1100px;background:rgba(0,0,0,0.35);backdrop-filter:blur(8px);border-radius:20px;padding:20px;border:1px solid rgba(255,255,255,0.08);">
        <!-- Hand total badge -->
        <div style="display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:16px;">
          <div style="padding:6px 18px;background:rgba(0,255,136,0.15);border:1px solid rgba(0,255,136,0.4);border-radius:100px;color:#00ff88;font-weight:700;font-size:13px;display:flex;gap:8px;">
            <span>Your Hand:</span><span style="font-size:16px;">3 pts</span><span style="font-size:11px;opacity:0.8;">✓ Can SHOW!</span>
          </div>
          <!-- SHOW button -->
          <div style="padding:10px 28px;background:linear-gradient(135deg,#f59e0b,#f97316);border-radius:16px;color:#0d1117;font-weight:800;font-size:18px;border:2px solid #fcd34d;box-shadow:0 0 20px rgba(255,215,0,0.5);cursor:pointer;">🎯 SHOW!</div>
        </div>
        <!-- Cards -->
        <div style="display:flex;justify-content:center;align-items:flex-end;gap:0;position:relative;height:120px;">
          ${[
            {r:'A',s:'♠',c:'#1e293b',sel:false,joker:false,rot:-8,y:0},
            {r:'2',s:'♣',c:'#1e293b',sel:false,joker:false,rot:-5,y:0},
            {r:'5',s:'♥',c:'#ef4444',sel:false,joker:true,rot:-2,y:0},
            {r:'A',s:'♦',c:'#ef4444',sel:true,joker:false,rot:0,y:-20},
            {r:'5',s:'♠',c:'#1e293b',sel:false,joker:true,rot:2,y:0},
            {r:'J',s:'♣',c:'#1e293b',sel:false,joker:false,rot:5,y:0},
            {r:'Q',s:'♦',c:'#ef4444',sel:false,joker:false,rot:8,y:0},
          ].map((c,i)=>`
            <div style="
              position:absolute;
              left:${420+i*78}px;
              bottom:0;
              width:72px;height:104px;
              background:${c.joker?'#f5f0e8':'#f5f0e8'};
              border-radius:10px;
              border:2px solid ${c.sel?'#00ff88':c.joker?'#ffd700':'#c8b89a'};
              box-shadow:${c.sel?'0 0 20px rgba(0,255,136,0.6),0 8px 24px rgba(0,0,0,0.5)':c.joker?'0 0 14px rgba(255,215,0,0.5),0 4px 16px rgba(0,0,0,0.4)':'0 4px 16px rgba(0,0,0,0.4)'};
              transform:translateY(${c.sel?-20+c.y:c.y}px) rotate(${c.rot}deg);
              z-index:${i+1};
              display:flex;flex-direction:column;justify-content:space-between;
              padding:5px 7px;
              cursor:pointer;
              ${c.joker?'background:linear-gradient(to bottom right,#f5f0e8,#fefce8);':''}
            ">
              <div style="color:${c.c};font-weight:800;font-size:14px;line-height:1">${c.r}</div>
              <div style="color:${c.c};font-size:${c.joker?'18':'22'}px;text-align:center;line-height:1">${c.joker?'★':c.s}</div>
              <div style="color:${c.c};font-weight:800;font-size:14px;line-height:1;transform:rotate(180deg)">${c.r}</div>
              ${c.joker?'<div style="position:absolute;bottom:1px;left:0;right:0;text-align:center;font-size:8px;font-weight:800;color:#92400e;background:#fef08a;border-radius:0 0 8px 8px;padding:1px">JOKER 0pts</div>':''}
            </div>
          `).join('')}
        </div>
        <!-- Discard button -->
        <div style="display:flex;justify-content:center;margin-top:12px;">
          <div style="padding:10px 32px;background:#00ff88;color:#0d1117;border-radius:14px;font-weight:800;font-size:15px;box-shadow:0 0 16px rgba(0,255,136,0.4);cursor:pointer;">Discard Card</div>
        </div>
      </div>
    </div>

    <!-- Players score strip -->
    <div style="background:rgba(0,0,0,0.4);padding:8px 24px;border-top:1px solid rgba(255,255,255,0.08);display:flex;justify-content:center;gap:24px;position:relative;z-index:2;">
      ${[
        {n:'You',pts:3,color:'#00ff88'},{n:'Priya',pts:23,color:'#e6edf3'},{n:'Raju',pts:8,color:'#e6edf3'},{n:'Bot 1',pts:41,color:'#e6edf3'}
      ].map(p=>`<div style="display:flex;align-items:center;gap:6px;font-size:12px;"><span style="color:#8b949e">${p.n}</span><span style="color:${p.color};font-weight:700">${p.pts}pts</span></div>`).join('<span style="color:#30363d">|</span>')}
    </div>
  </div>`;
  document.documentElement.style.margin='0';
  document.documentElement.style.padding='0';
  document.body.style.margin='0';
  document.body.style.padding='0';
  document.body.style.overflow='hidden';
});
await wait(600);
await page.screenshot({ path: path.join(OUT, '08-game-board.png'), fullPage: false });
console.log('✓ 08-game-board.png');

// ── 9. Score board mockup ─────────────────────────────────────────────────────
await page.setViewport({ width: 1440, height: 900 });
await page.evaluate(() => {
  document.body.innerHTML = `
  <div style="font-family:'Exo 2',sans-serif;background:rgba(0,0,0,0.9);width:100vw;height:100vh;display:flex;align-items:center;justify-content:center;">
    <div style="background:#161b22;border:1px solid #30363d;border-radius:24px;width:480px;overflow:hidden;box-shadow:0 25px 80px rgba(0,0,0,0.8);">
      <div style="background:linear-gradient(135deg,#3b0764,#1e3a8a);padding:24px;text-align:center;">
        <div style="font-size:56px;margin-bottom:8px;">🏆</div>
        <h2 style="color:white;font-size:24px;margin:0;font-weight:800;">Raju wins the round!</h2>
        <p style="color:#93c5fd;margin:4px 0 0;font-size:13px;">SHOW player had the lowest hand!</p>
      </div>
      <div style="padding:16px;display:flex;flex-direction:column;gap:10px;">
        ${[
          {rank:1,name:'Raju',pts:0,total:8,hand:['A♠','2♣','J★'],badge:'WIN',badgeBg:'#00ff88',badgeColor:'#0d1117',show:true,rowBg:'rgba(0,255,136,0.08)',rowBorder:'rgba(0,255,136,0.3)'},
          {rank:2,name:'You',pts:3,total:6,hand:['A♦','5★','A♠'],badge:'SHOW',badgeBg:'#f59e0b',badgeColor:'#0d1117',show:false,rowBg:'rgba(245,158,11,0.08)',rowBorder:'rgba(245,158,11,0.3)'},
          {rank:3,name:'Priya',pts:23,total:46,hand:['K♥','Q♦','10♠'],badge:'',badgeBg:'',badgeColor:'',show:false,rowBg:'rgba(22,27,34,1)',rowBorder:'rgba(48,54,61,0.8)'},
          {rank:4,name:'Bot 1',pts:41,total:82,hand:['9♠','8♣','K♦'],badge:'',badgeBg:'',badgeColor:'',show:false,rowBg:'rgba(22,27,34,1)',rowBorder:'rgba(48,54,61,0.8)'},
        ].map(p=>`
          <div style="display:flex;align-items:center;gap:12px;padding:12px;background:${p.rowBg};border:1px solid ${p.rowBorder};border-radius:14px;">
            <div style="width:28px;height:28px;background:#21262d;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#8b949e;">${p.rank}</div>
            <div style="flex:1;">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                <span style="font-weight:700;color:#e6edf3;font-size:14px;">${p.name}</span>
                ${p.badge?`<span style="font-size:10px;padding:2px 8px;background:${p.badgeBg};color:${p.badgeColor};border-radius:100px;font-weight:800;">${p.badge}</span>`:''}
              </div>
              <div style="display:flex;gap:4px;">
                ${p.hand.map(c=>`<div style="background:#f5f0e8;border:1px solid #c8b89a;border-radius:5px;padding:2px 6px;font-size:11px;font-weight:700;color:${c.includes('♥')||c.includes('♦')?'#ef4444':'#1e293b'}">${c}</div>`).join('')}
              </div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:20px;font-weight:800;color:${p.pts===0?'#00ff88':'#ff3b5c'};">${p.pts===0?'+0':'+'+p.pts}</div>
              <div style="font-size:11px;color:#8b949e;">Total: <b style="color:${p.total>=80?'#ff3b5c':'#e6edf3'}">${p.total}</b></div>
            </div>
          </div>
        `).join('')}
      </div>
      <div style="padding:16px;border-top:1px solid #30363d;">
        <p style="text-align:center;color:#8b949e;font-size:12px;margin:0 0 12px;">Match limit: <b style="color:#e6edf3;">100 points</b> · Round 2 of many</p>
        <div style="width:100%;padding:14px;background:#00ff88;color:#0d1117;border-radius:14px;font-weight:800;font-size:15px;text-align:center;cursor:pointer;">Continue →</div>
      </div>
    </div>
  </div>`;
  document.body.style.margin='0';
  document.documentElement.style.background='#0d1117';
});
await wait(600);
await page.screenshot({ path: path.join(OUT, '09-scoreboard.png'), fullPage: false });
console.log('✓ 09-scoreboard.png');

// ── 10. Winner celebration ────────────────────────────────────────────────────
await page.evaluate(() => {
  document.body.innerHTML = `
  <div style="font-family:'Exo 2',sans-serif;background:rgba(0,0,0,0.95);width:100vw;height:100vh;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;">
    ${[...Array(30)].map((_,i)=>`
      <div style="position:absolute;top:-10%;left:${Math.random()*100}%;width:${8+Math.random()*12}px;height:${8+Math.random()*12}px;background:${['#00ff88','#ffd700','#00bfff','#ff3b5c','#bf00ff'][i%5]};border-radius:${Math.random()>0.5?'50%':'0'};animation:fall ${1.5+Math.random()*2}s linear ${Math.random()*2}s infinite;"></div>
    `).join('')}
    <style>@keyframes fall{0%{transform:translateY(0) rotate(0)}100%{transform:translateY(110vh) rotate(720deg)}}</style>
    <div style="background:#161b22;border:1px solid #30363d;border-radius:28px;width:420px;text-align:center;overflow:hidden;box-shadow:0 30px 100px rgba(0,0,0,0.9);">
      <div style="background:linear-gradient(180deg,rgba(255,215,0,0.2),transparent);padding:32px 24px 16px;">
        <div style="font-size:80px;margin-bottom:12px;">🏆</div>
        <h1 style="color:white;font-size:36px;font-weight:900;margin:0;">You Won!</h1>
        <p style="color:#8b949e;margin:6px 0 0;">Congratulations! 🎉</p>
      </div>
      <div style="padding:16px;display:flex;flex-direction:column;gap:8px;">
        <h3 style="color:#8b949e;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0 0 4px;">Final Scores</h3>
        ${[
          {n:'You 👑',pts:8,winner:true},{n:'Priya',pts:46},{n:'Raju',pts:55},{n:'Bot 1',pts:82}
        ].map((p,i)=>`
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px;background:#0d1117;border-radius:12px;">
            <div style="display:flex;align-items:center;gap:8px;"><span style="color:#8b949e">#${i+1}</span><span style="color:${p.winner?'#00ff88':'#e6edf3'};font-weight:700">${p.n}</span></div>
            <span style="color:${p.winner?'#00ff88':'#8b949e'};font-weight:700">${p.pts} pts</span>
          </div>
        `).join('')}
      </div>
      <div style="padding:16px;padding-top:0;">
        <div style="padding:14px;background:#00ff88;color:#0d1117;border-radius:14px;font-weight:800;font-size:15px;cursor:pointer;">Back to Lobby</div>
      </div>
    </div>
  </div>`;
  document.body.style.margin='0';
});
await wait(600);
await page.screenshot({ path: path.join(OUT, '10-winner.png'), fullPage: false });
console.log('✓ 10-winner.png');

await browser.close();
console.log('\n✅ All screenshots saved to /screenshots/');
