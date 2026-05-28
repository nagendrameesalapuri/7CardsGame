import nodemailer from 'nodemailer';

const ADMIN_EMAIL = 'nagendra.meesala.puri@gmail.com';
const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';
const FROM_NAME = 'Arena of Sevens';

function createTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error('GMAIL_USER / GMAIL_APP_PASSWORD not configured');
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
}

async function sendMail(opts: { to: string; subject: string; html: string }): Promise<void> {
  const user = process.env.GMAIL_USER;
  if (!user) throw new Error('GMAIL_USER not configured');
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"${FROM_NAME}" <${user}>`,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
}

export async function sendDepositRequestEmail(opts: {
  username: string;
  userId: string;
  amount: number;
  utrNumber: string;
  requestedAt: Date;
}): Promise<void> {
  const { username, userId, amount, utrNumber, requestedAt } = opts;

  const dateStr = requestedAt.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: true,
  });

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <div style="background:#0d1117;padding:24px 28px;">
        <h2 style="color:#00ff88;margin:0;font-size:20px;">&#128176; New Deposit Request</h2>
        <p style="color:#8b949e;margin:4px 0 0;font-size:13px;">7 Cards Show — Admin Notification</p>
      </div>
      <div style="padding:24px 28px;background:#ffffff;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr>
            <td style="padding:10px 0;color:#6b7280;width:140px;font-weight:600;">User</td>
            <td style="padding:10px 0;color:#111827;font-weight:700;">${username}</td>
          </tr>
          <tr style="border-top:1px solid #f3f4f6;">
            <td style="padding:10px 0;color:#6b7280;font-weight:600;">User ID</td>
            <td style="padding:10px 0;color:#374151;font-family:monospace;font-size:12px;">${userId}</td>
          </tr>
          <tr style="border-top:1px solid #f3f4f6;">
            <td style="padding:10px 0;color:#6b7280;font-weight:600;">Amount</td>
            <td style="padding:10px 0;color:#059669;font-weight:800;font-size:20px;">&#8377;${amount}</td>
          </tr>
          <tr style="border-top:1px solid #f3f4f6;">
            <td style="padding:10px 0;color:#6b7280;font-weight:600;">UTR Number</td>
            <td style="padding:10px 0;color:#111827;font-family:monospace;font-size:16px;font-weight:700;letter-spacing:1px;">${utrNumber}</td>
          </tr>
          <tr style="border-top:1px solid #f3f4f6;">
            <td style="padding:10px 0;color:#6b7280;font-weight:600;">Date &amp; Time</td>
            <td style="padding:10px 0;color:#374151;">${dateStr} IST</td>
          </tr>
        </table>
        <div style="margin-top:20px;padding:14px 16px;background:#f0fdf4;border-left:4px solid #00cc6a;border-radius:6px;">
          <p style="margin:0;font-size:13px;color:#065f46;">
            <strong>Action required:</strong> Verify UTR in your UPI app, then go to Admin Panel &#8594; Deposits to Approve or Reject.
          </p>
        </div>
      </div>
      <div style="padding:14px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-size:11px;color:#9ca3af;">Automated notification from 7 Cards Show. Do not reply.</p>
      </div>
    </div>
  `;

  await sendMail({
    to:      ADMIN_EMAIL,
    subject: `[7Cards] Deposit ₹${amount} from ${username} — UTR: ${utrNumber}`,
    html,
  });
}

export async function sendReengagementEmail(opts: {
  email: string;
  username: string;
  unsubscribeToken?: string;
  daysSinceLastSeen: number;
  totalWinnings: number;
  gamesWon: number;
  gamesPlayed: number;
  upcomingTournament?: { name: string; prizePool: number; startTime: Date; entryFee: number } | null;
  comebackBonus: number;
}): Promise<void> {
  const { email, username, daysSinceLastSeen, totalWinnings, gamesWon, gamesPlayed, upcomingTournament, comebackBonus } = opts;
  const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;

  const tournamentBlock = upcomingTournament ? `
    <div style="margin:20px 0;padding:16px;background:#1a1040;border:1px solid rgba(99,102,241,0.4);border-radius:10px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#a5b4fc;text-transform:uppercase;letter-spacing:1px;">⚔️ Tournament This Week</p>
      <p style="margin:0 0 4px;font-size:16px;font-weight:800;color:#ffffff;">${upcomingTournament.name}</p>
      <p style="margin:0 0 12px;font-size:13px;color:#94a3b8;">
        Prize Pool: <strong style="color:#a5b4fc;">₹${upcomingTournament.prizePool}</strong> &nbsp;·&nbsp;
        Entry: <strong style="color:#a5b4fc;">${upcomingTournament.entryFee === 0 ? 'FREE' : '₹' + upcomingTournament.entryFee}</strong> &nbsp;·&nbsp;
        Starts: <strong style="color:#a5b4fc;">${upcomingTournament.startTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}</strong>
      </p>
      <a href="${APP_URL}/tournaments" style="display:inline-block;padding:8px 20px;background:#6366f1;color:#fff;font-weight:700;font-size:13px;border-radius:8px;text-decoration:none;">Register Now →</a>
    </div>
  ` : '';

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0d0b1e;border-radius:16px;overflow:hidden;">

      <!-- Header -->
      <div style="background:linear-gradient(135deg,#1e1b4b,#312e81);padding:32px 28px;text-align:center;">
        <div style="font-size:36px;margin-bottom:8px;">⚔️</div>
        <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:900;">We miss you, ${username}!</h1>
        <p style="color:#a5b4fc;margin:6px 0 0;font-size:14px;">It's been ${daysSinceLastSeen} days since your last battle</p>
      </div>

      <!-- Body -->
      <div style="padding:28px;background:#0f0d2a;">

        <!-- Comeback bonus -->
        <div style="background:linear-gradient(135deg,rgba(34,197,94,0.15),rgba(16,185,129,0.08));border:1px solid rgba(34,197,94,0.4);border-radius:12px;padding:20px;margin-bottom:20px;text-align:center;">
          <p style="margin:0 0 4px;font-size:12px;color:#4ade80;font-weight:700;text-transform:uppercase;letter-spacing:1px;">🎁 Welcome Back Gift</p>
          <p style="margin:0 0 8px;font-size:32px;font-weight:900;color:#ffffff;">₹${comebackBonus} Added to Your Wallet</p>
          <p style="margin:0;font-size:13px;color:#94a3b8;">Just log in to claim it automatically — no code needed</p>
        </div>

        <!-- Stats -->
        <div style="display:flex;gap:12px;margin-bottom:20px;">
          <div style="flex:1;background:#1a1640;border-radius:10px;padding:14px;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:900;color:#a5b4fc;">${gamesPlayed}</p>
            <p style="margin:4px 0 0;font-size:11px;color:#64748b;font-weight:600;">Games Played</p>
          </div>
          <div style="flex:1;background:#1a1640;border-radius:10px;padding:14px;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:900;color:#4ade80;">₹${totalWinnings.toFixed(2)}</p>
            <p style="margin:4px 0 0;font-size:11px;color:#64748b;font-weight:600;">Total Winnings</p>
          </div>
          <div style="flex:1;background:#1a1640;border-radius:10px;padding:14px;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:900;color:#fbbf24;">${winRate}%</p>
            <p style="margin:4px 0 0;font-size:11px;color:#64748b;font-weight:600;">Win Rate</p>
          </div>
        </div>

        ${tournamentBlock}

        <!-- CTA -->
        <div style="text-align:center;margin-top:24px;">
          <a href="${APP_URL}/lobby"
            style="display:inline-block;padding:14px 40px;background:linear-gradient(135deg,#6366f1,#a855f7);color:#ffffff;font-weight:900;font-size:16px;border-radius:12px;text-decoration:none;letter-spacing:0.5px;">
            ⚔️ Play Now &amp; Claim ₹${comebackBonus}
          </a>
        </div>

        <p style="margin:20px 0 0;font-size:12px;color:#374151;text-align:center;">
          Your ₹${comebackBonus} bonus will be credited the moment you log in.
        </p>
      </div>

      <!-- Footer -->
      <div style="padding:16px 28px;background:#08061a;text-align:center;">
        <p style="margin:0;font-size:11px;color:#374151;">Arena of Sevens · You're receiving this because you registered an account.${opts.unsubscribeToken ? ` &nbsp;·&nbsp; <a href="${BACKEND_URL}/api/email/unsubscribe/${opts.unsubscribeToken}" style="color:#374151;">Unsubscribe</a>` : ''}</p>
      </div>
    </div>
  `;

  await sendMail({
    to: email,
    subject: `⚔️ ${username}, your ₹${comebackBonus} comeback bonus is waiting!`,
    html,
  });
}

// ── Admin bulk / manual email templates ───────────────────────────────────────

export type AdminEmailTemplate =
  | { id: 'winback';              bonusAmount: number; customNote?: string }
  | { id: 'tournament';           name: string; prizePool: number; entryFee: number; startTime: string; description?: string }
  | { id: 'bonus';                amount: number; occasion: string }
  | { id: 'announcement';         headline: string; body: string; ctaText?: string; ctaUrl?: string }
  | { id: 'withdrawal_approved';  amount: number; method?: string; eta?: string }
  | { id: 'withdrawal_rejected';  amount: number; reason: string }
  | { id: 'deposit_confirmed';    amount: number }
  | { id: 'deposit_rejected';     amount: number; reason: string }
  | { id: 'welcome';              bonusAmount: number }
  | { id: 'top_player';           rank: string; rewardAmount: number; customMsg?: string }
  | { id: 'voucher_submitted';    brand: string; amount: number; voucherCode: string }
  | { id: 'voucher_delivered';    brand: string; amount: number; voucherNumber: string; voucherPin: string; voucherExpiry: string; adminMessage?: string };

const BACKEND_URL = process.env.SERVER_URL ?? 'http://localhost:5000';

const BRAND_CONFIG: Record<string, { color: string; headerBg: string; logo: string }> = {
  amazon:   { color: '#FF9900', headerBg: 'linear-gradient(135deg,#232f3e 0%,#131921 100%)', logo: 'https://logo.clearbit.com/amazon.com' },
  flipkart: { color: '#2874F0', headerBg: 'linear-gradient(135deg,#172337 0%,#0d1526 100%)', logo: 'https://logo.clearbit.com/flipkart.com' },
  myntra:   { color: '#FF3F6C', headerBg: 'linear-gradient(135deg,#2d0a18 0%,#1a0610 100%)', logo: 'https://logo.clearbit.com/myntra.com' },
  ajio:     { color: '#FF4E50', headerBg: 'linear-gradient(135deg,#2d1210 0%,#1a0b0a 100%)', logo: 'https://logo.clearbit.com/ajio.com' },
  swiggy:   { color: '#FC8019', headerBg: 'linear-gradient(135deg,#2d1e0a 0%,#1a1205 100%)', logo: 'https://logo.clearbit.com/swiggy.com' },
  zomato:   { color: '#E23744', headerBg: 'linear-gradient(135deg,#2d0f13 0%,#1a080b 100%)', logo: 'https://logo.clearbit.com/zomato.com' },
};

function getBrand(name: string) {
  return BRAND_CONFIG[name.toLowerCase()] ?? { color: '#6366f1', headerBg: 'linear-gradient(135deg,#1e1b4b,#312e81)', logo: '' };
}

function buildAdminEmailHtml(username: string, tpl: AdminEmailTemplate, trackingPixel = '', unsubscribeToken = ''): { subject: string; html: string } {
  const unsubLink = unsubscribeToken
    ? `<a href="${BACKEND_URL}/api/email/unsubscribe/${unsubscribeToken}" style="color:#4b5563;text-decoration:underline;">Unsubscribe</a>`
    : '';
  const footer = `
    ${trackingPixel}
    <div style="padding:20px 28px;background:#06040f;text-align:center;border-top:1px solid rgba(255,255,255,0.05);">
      <p style="margin:0 0 6px;font-size:13px;font-weight:800;color:#312e81;letter-spacing:2px;text-transform:uppercase;">⚔️ ARENA OF SEVENS</p>
      <p style="margin:0;font-size:11px;color:#374151;">You're receiving this because you have an account with us.${unsubLink ? ` &nbsp;·&nbsp; ${unsubLink}` : ''}</p>
    </div>`;

  // Shared wrapper helper
  const wrap = (headerBg: string, body: string) =>
    `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#09071a;border-radius:20px;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,0.7);">
      <div style="height:3px;background:linear-gradient(90deg,#6366f1,#a855f7,#6366f1);"></div>
      ${headerBg}
      ${body}
      ${footer}
    </div>`;

  if (tpl.id === 'winback') {
    return {
      subject: `⚔️ ${username}, a ₹${tpl.bonusAmount} gift is waiting for you!`,
      html: wrap(
        `<div style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#4c1d95 100%);padding:44px 32px;text-align:center;position:relative;overflow:hidden;">
          <div style="position:absolute;top:-30px;right:-30px;width:180px;height:180px;border-radius:50%;background:rgba(168,85,247,0.15);filter:blur(40px);"></div>
          <div style="position:absolute;bottom:-20px;left:-20px;width:140px;height:140px;border-radius:50%;background:rgba(99,102,241,0.12);filter:blur(30px);"></div>
          <div style="font-size:52px;margin-bottom:14px;">🎁</div>
          <div style="display:inline-block;background:rgba(168,85,247,0.2);border:1px solid rgba(168,85,247,0.4);color:#c4b5fd;font-size:10px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;padding:5px 14px;border-radius:20px;margin-bottom:14px;">Exclusive Offer</div>
          <h1 style="color:#fff;margin:0 0 10px;font-size:28px;font-weight:900;line-height:1.2;">We Miss You, ${username}!</h1>
          <p style="color:#a5b4fc;margin:0;font-size:15px;">A special gift is waiting just for you</p>
        </div>`,
        `<div style="padding:32px;background:#0f0d28;">
          <div style="background:linear-gradient(135deg,rgba(34,197,94,0.15),rgba(16,185,129,0.06));border:1px solid rgba(34,197,94,0.35);border-radius:16px;padding:28px;text-align:center;margin-bottom:24px;position:relative;overflow:hidden;">
            <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,#4ade80,transparent);"></div>
            <p style="margin:0 0 6px;font-size:11px;color:#4ade80;font-weight:700;text-transform:uppercase;letter-spacing:2px;">🎁 Special Gift For You</p>
            <p style="margin:0 0 8px;font-size:58px;font-weight:900;color:#fff;line-height:1;">₹${tpl.bonusAmount}</p>
            <p style="margin:0;font-size:13px;color:#6ee7b7;background:rgba(16,185,129,0.12);display:inline-block;padding:5px 14px;border-radius:20px;">Added to your wallet instantly</p>
          </div>
          ${tpl.customNote ? `<p style="font-size:14px;color:#94a3b8;text-align:center;margin:0 0 24px;line-height:1.6;font-style:italic;">"${tpl.customNote}"</p>` : ''}
          <p style="font-size:13px;color:#64748b;text-align:center;margin:0 0 24px;">Log in to claim your gift. Offer is already waiting in your wallet!</p>
          <div style="text-align:center;">
            <a href="${APP_URL}/lobby" style="display:inline-block;padding:16px 48px;background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;font-weight:900;font-size:16px;border-radius:14px;text-decoration:none;letter-spacing:0.5px;box-shadow:0 8px 24px rgba(99,102,241,0.4);">⚔️ Claim My ₹${tpl.bonusAmount} Now</a>
          </div>
        </div>`
      ),
    };
  }

  if (tpl.id === 'tournament') {
    const freeEntry = tpl.entryFee === 0;
    return {
      subject: `⚔️ Tournament Alert: ${tpl.name} — ₹${tpl.prizePool} Prize Pool!`,
      html: wrap(
        `<div style="background:linear-gradient(135deg,#1e1240 0%,#312e81 50%,#2d1760 100%);padding:44px 32px;text-align:center;position:relative;overflow:hidden;">
          <div style="position:absolute;top:-40px;right:-40px;width:200px;height:200px;border-radius:50%;background:rgba(99,102,241,0.2);filter:blur(50px);"></div>
          <div style="font-size:50px;margin-bottom:12px;">⚔️</div>
          <div style="display:inline-block;background:rgba(99,102,241,0.25);border:1px solid rgba(99,102,241,0.5);color:#a5b4fc;font-size:10px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;padding:5px 14px;border-radius:20px;margin-bottom:14px;">Tournament Alert</div>
          <h1 style="color:#fff;margin:0 0 10px;font-size:26px;font-weight:900;">${tpl.name}</h1>
          <p style="color:#c4b5fd;margin:0;font-size:15px;">Hey ${username}, a big one is coming up!</p>
        </div>`,
        `<div style="padding:32px;background:#0f0d28;">
          <div style="display:flex;gap:12px;margin-bottom:24px;">
            <div style="flex:1;background:linear-gradient(135deg,rgba(99,102,241,0.15),rgba(99,102,241,0.05));border:1px solid rgba(99,102,241,0.3);border-radius:14px;padding:18px;text-align:center;">
              <p style="margin:0 0 4px;font-size:11px;color:#818cf8;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Prize Pool</p>
              <p style="margin:0;font-size:26px;font-weight:900;color:#a5b4fc;">₹${tpl.prizePool}</p>
            </div>
            <div style="flex:1;background:linear-gradient(135deg,${freeEntry ? 'rgba(34,197,94,0.15),rgba(34,197,94,0.05)' : 'rgba(251,191,36,0.15),rgba(251,191,36,0.05)'});border:1px solid ${freeEntry ? 'rgba(34,197,94,0.3)' : 'rgba(251,191,36,0.3)'};border-radius:14px;padding:18px;text-align:center;">
              <p style="margin:0 0 4px;font-size:11px;color:${freeEntry ? '#4ade80' : '#fbbf24'};font-weight:700;text-transform:uppercase;letter-spacing:1px;">Entry Fee</p>
              <p style="margin:0;font-size:26px;font-weight:900;color:${freeEntry ? '#4ade80' : '#fbbf24'};">${freeEntry ? 'FREE' : '₹' + tpl.entryFee}</p>
            </div>
            <div style="flex:1;background:linear-gradient(135deg,rgba(251,146,60,0.15),rgba(251,146,60,0.05));border:1px solid rgba(251,146,60,0.3);border-radius:14px;padding:18px;text-align:center;">
              <p style="margin:0 0 4px;font-size:11px;color:#fb923c;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Starts</p>
              <p style="margin:0;font-size:14px;font-weight:900;color:#fdba74;">${tpl.startTime}</p>
            </div>
          </div>
          ${tpl.description ? `<p style="font-size:14px;color:#94a3b8;margin:0 0 24px;line-height:1.7;background:rgba(255,255,255,0.03);border-radius:10px;padding:14px;">${tpl.description}</p>` : ''}
          <div style="text-align:center;">
            <a href="${APP_URL}/tournaments" style="display:inline-block;padding:16px 48px;background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;font-weight:900;font-size:16px;border-radius:14px;text-decoration:none;box-shadow:0 8px 24px rgba(99,102,241,0.4);">Register Now →</a>
          </div>
        </div>`
      ),
    };
  }

  if (tpl.id === 'bonus') {
    return {
      subject: `🎉 ${username}, ₹${tpl.amount} bonus added to your wallet!`,
      html: wrap(
        `<div style="background:linear-gradient(135deg,#052e16 0%,#064e3b 60%,#065f46 100%);padding:44px 32px;text-align:center;position:relative;overflow:hidden;">
          <div style="position:absolute;top:-30px;right:-30px;width:180px;height:180px;border-radius:50%;background:rgba(16,185,129,0.2);filter:blur(40px);"></div>
          <div style="font-size:52px;margin-bottom:14px;">💰</div>
          <div style="display:inline-block;background:rgba(16,185,129,0.2);border:1px solid rgba(16,185,129,0.4);color:#6ee7b7;font-size:10px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;padding:5px 14px;border-radius:20px;margin-bottom:14px;">Bonus Credited</div>
          <h1 style="color:#fff;margin:0 0 10px;font-size:28px;font-weight:900;">Money in Your Wallet!</h1>
          <p style="color:#6ee7b7;margin:0;font-size:15px;">Hey ${username}, you've earned a reward</p>
        </div>`,
        `<div style="padding:32px;background:#0f0d28;">
          <div style="background:linear-gradient(135deg,rgba(34,197,94,0.15),rgba(16,185,129,0.06));border:1px solid rgba(34,197,94,0.35);border-radius:16px;padding:28px;text-align:center;margin-bottom:24px;position:relative;overflow:hidden;">
            <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,#4ade80,transparent);"></div>
            <p style="margin:0 0 6px;font-size:11px;color:#4ade80;font-weight:700;text-transform:uppercase;letter-spacing:2px;">Amount Credited</p>
            <p style="margin:0 0 12px;font-size:58px;font-weight:900;color:#fff;line-height:1;">₹${tpl.amount}</p>
            <span style="font-size:13px;color:#052e16;background:#4ade80;font-weight:800;padding:5px 16px;border-radius:20px;">${tpl.occasion}</span>
          </div>
          <p style="font-size:13px;color:#64748b;text-align:center;margin:0 0 24px;">The bonus is already in your wallet. Start playing to use it!</p>
          <div style="text-align:center;">
            <a href="${APP_URL}/lobby" style="display:inline-block;padding:16px 48px;background:linear-gradient(135deg,#059669,#10b981);color:#fff;font-weight:900;font-size:16px;border-radius:14px;text-decoration:none;box-shadow:0 8px 24px rgba(16,185,129,0.4);">⚔️ Play Now</a>
          </div>
        </div>`
      ),
    };
  }

  if (tpl.id === 'withdrawal_approved') {
    return {
      subject: `✅ Your ₹${tpl.amount} redemption is approved — voucher incoming!`,
      html: wrap(
        `<div style="background:linear-gradient(135deg,#052e16 0%,#064e3b 60%,#065f46 100%);padding:44px 32px;text-align:center;position:relative;overflow:hidden;">
          <div style="position:absolute;top:-30px;right:-30px;width:180px;height:180px;border-radius:50%;background:rgba(16,185,129,0.2);filter:blur(40px);"></div>
          <div style="font-size:52px;margin-bottom:14px;">✅</div>
          <div style="display:inline-block;background:rgba(16,185,129,0.2);border:1px solid rgba(16,185,129,0.45);color:#6ee7b7;font-size:10px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;padding:5px 14px;border-radius:20px;margin-bottom:14px;">Redemption Approved</div>
          <h1 style="color:#fff;margin:0 0 10px;font-size:28px;font-weight:900;">Great News, ${username}!</h1>
          <p style="color:#6ee7b7;margin:0;font-size:15px;">Your redemption request has been approved</p>
        </div>`,
        `<div style="padding:32px;background:#0f0d28;">
          <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.3);border-radius:16px;padding:24px;text-align:center;margin-bottom:24px;">
            <p style="margin:0 0 6px;font-size:11px;color:#4ade80;font-weight:700;text-transform:uppercase;letter-spacing:2px;">Approved Amount</p>
            <p style="margin:0 0 8px;font-size:58px;font-weight:900;color:#fff;line-height:1;">₹${tpl.amount}</p>
            ${tpl.eta ? `<p style="margin:0;font-size:13px;color:#94a3b8;">Expected in <strong style="color:#6ee7b7;">${tpl.eta}</strong></p>` : ''}
          </div>
          <div style="background:rgba(99,102,241,0.07);border:1px solid rgba(99,102,241,0.22);border-radius:14px;padding:22px;margin-bottom:24px;">
            <p style="margin:0 0 16px;font-size:12px;font-weight:800;color:#a5b4fc;text-transform:uppercase;letter-spacing:1.5px;">📬 What Happens Next</p>
            <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:14px;">
              <div style="flex-shrink:0;min-width:28px;height:28px;border-radius:50%;background:rgba(99,102,241,0.3);color:#a5b4fc;font-size:13px;font-weight:900;text-align:center;line-height:28px;">1</div>
              <p style="margin:0;font-size:13px;color:#cbd5e1;line-height:1.6;">Your request is <strong style="color:#4ade80;">approved</strong> and our team is processing it right now.</p>
            </div>
            <div style="display:flex;align-items:flex-start;gap:14px;">
              <div style="flex-shrink:0;min-width:28px;height:28px;border-radius:50%;background:rgba(99,102,241,0.3);color:#a5b4fc;font-size:13px;font-weight:900;text-align:center;line-height:28px;">2</div>
              <p style="margin:0;font-size:13px;color:#cbd5e1;line-height:1.6;">You'll receive a <strong style="color:#fbbf24;">separate email</strong> with your gift voucher code, PIN &amp; expiry soon.</p>
            </div>
          </div>
          <p style="font-size:12px;color:#4b5563;text-align:center;margin:0 0 24px;">No voucher within 48 hours? Contact our support team.</p>
          <div style="text-align:center;">
            <a href="${APP_URL}/wallet" style="display:inline-block;padding:15px 44px;background:linear-gradient(135deg,#059669,#10b981);color:#fff;font-weight:900;font-size:15px;border-radius:14px;text-decoration:none;box-shadow:0 8px 24px rgba(16,185,129,0.35);">View My Wallet →</a>
          </div>
        </div>`
      ),
    };
  }

  if (tpl.id === 'withdrawal_rejected') {
    return {
      subject: `❌ Update on your ₹${tpl.amount} redemption request`,
      html: wrap(
        `<div style="background:linear-gradient(135deg,#2d0a0a 0%,#450a0a 60%,#7f1d1d 100%);padding:44px 32px;text-align:center;position:relative;overflow:hidden;">
          <div style="position:absolute;top:-30px;right:-30px;width:160px;height:160px;border-radius:50%;background:rgba(239,68,68,0.2);filter:blur(40px);"></div>
          <div style="font-size:52px;margin-bottom:14px;">⚠️</div>
          <div style="display:inline-block;background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.4);color:#fca5a5;font-size:10px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;padding:5px 14px;border-radius:20px;margin-bottom:14px;">Action Required</div>
          <h1 style="color:#fff;margin:0 0 10px;font-size:26px;font-weight:900;">Redemption Not Processed</h1>
          <p style="color:#fca5a5;margin:0;font-size:15px;">Hey ${username}, we need your attention</p>
        </div>`,
        `<div style="padding:32px;background:#0f0d28;">
          <div style="background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.25);border-radius:14px;padding:22px;margin-bottom:22px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
              <span style="font-size:20px;">❌</span>
              <div>
                <p style="margin:0;font-size:12px;color:#f87171;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Redemption of ₹${tpl.amount}</p>
              </div>
            </div>
            <p style="margin:0 0 8px;font-size:14px;color:#fca5a5;font-weight:600;line-height:1.5;">Reason: ${tpl.reason}</p>
            <p style="margin:0;font-size:13px;color:#94a3b8;">Your ₹${tpl.amount} has been returned to your wallet.</p>
          </div>
          <p style="font-size:13px;color:#64748b;text-align:center;margin:0 0 24px;">Please contact our support team if you have any questions or need help resubmitting.</p>
          <div style="text-align:center;">
            <a href="${APP_URL}/wallet" style="display:inline-block;padding:15px 44px;background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;font-weight:900;font-size:15px;border-radius:14px;text-decoration:none;box-shadow:0 8px 24px rgba(99,102,241,0.35);">Go to My Wallet</a>
          </div>
        </div>`
      ),
    };
  }

  if (tpl.id === 'deposit_confirmed') {
    return {
      subject: `💚 ₹${tpl.amount} deposit confirmed — wallet credited!`,
      html: wrap(
        `<div style="background:linear-gradient(135deg,#052e16 0%,#14532d 60%,#166534 100%);padding:44px 32px;text-align:center;position:relative;overflow:hidden;">
          <div style="position:absolute;top:-30px;right:-30px;width:180px;height:180px;border-radius:50%;background:rgba(74,222,128,0.15);filter:blur(40px);"></div>
          <div style="font-size:52px;margin-bottom:14px;">💚</div>
          <div style="display:inline-block;background:rgba(74,222,128,0.2);border:1px solid rgba(74,222,128,0.4);color:#86efac;font-size:10px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;padding:5px 14px;border-radius:20px;margin-bottom:14px;">Deposit Confirmed</div>
          <h1 style="color:#fff;margin:0 0 10px;font-size:28px;font-weight:900;">Wallet Topped Up!</h1>
          <p style="color:#86efac;margin:0;font-size:15px;">Hey ${username}, your balance is ready to play</p>
        </div>`,
        `<div style="padding:32px;background:#0f0d28;">
          <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.3);border-radius:16px;padding:28px;text-align:center;margin-bottom:24px;position:relative;overflow:hidden;">
            <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,#4ade80,transparent);"></div>
            <p style="margin:0 0 6px;font-size:11px;color:#4ade80;font-weight:700;text-transform:uppercase;letter-spacing:2px;">Credited to Wallet</p>
            <p style="margin:0;font-size:58px;font-weight:900;color:#fff;line-height:1;">₹${tpl.amount}</p>
          </div>
          <p style="font-size:13px;color:#64748b;text-align:center;margin:0 0 24px;">Your balance is ready. Jump in and start playing!</p>
          <div style="text-align:center;">
            <a href="${APP_URL}/lobby" style="display:inline-block;padding:16px 48px;background:linear-gradient(135deg,#059669,#10b981);color:#fff;font-weight:900;font-size:16px;border-radius:14px;text-decoration:none;box-shadow:0 8px 24px rgba(16,185,129,0.4);">⚔️ Play Now</a>
          </div>
        </div>`
      ),
    };
  }

  if (tpl.id === 'deposit_rejected') {
    return {
      subject: `⚠️ Your ₹${tpl.amount} deposit could not be verified`,
      html: wrap(
        `<div style="background:linear-gradient(135deg,#2d1007 0%,#431407 60%,#7c2d12 100%);padding:44px 32px;text-align:center;position:relative;overflow:hidden;">
          <div style="position:absolute;top:-30px;right:-30px;width:160px;height:160px;border-radius:50%;background:rgba(249,115,22,0.2);filter:blur(40px);"></div>
          <div style="font-size:52px;margin-bottom:14px;">⚠️</div>
          <div style="display:inline-block;background:rgba(249,115,22,0.2);border:1px solid rgba(249,115,22,0.4);color:#fdba74;font-size:10px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;padding:5px 14px;border-radius:20px;margin-bottom:14px;">Action Required</div>
          <h1 style="color:#fff;margin:0 0 10px;font-size:26px;font-weight:900;">Deposit Not Verified</h1>
          <p style="color:#fdba74;margin:0;font-size:15px;">Hey ${username}, please check the details below</p>
        </div>`,
        `<div style="padding:32px;background:#0f0d28;">
          <div style="background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.25);border-radius:14px;padding:22px;margin-bottom:22px;">
            <p style="margin:0 0 8px;font-size:12px;color:#f87171;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Deposit of ₹${tpl.amount}</p>
            <p style="margin:0;font-size:14px;color:#fca5a5;line-height:1.5;">Reason: <strong>${tpl.reason}</strong></p>
          </div>
          <p style="font-size:13px;color:#64748b;text-align:center;margin:0 0 24px;">Please resubmit with the correct UTR or contact our support team for help.</p>
          <div style="text-align:center;">
            <a href="${APP_URL}/wallet" style="display:inline-block;padding:15px 44px;background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;font-weight:900;font-size:15px;border-radius:14px;text-decoration:none;box-shadow:0 8px 24px rgba(99,102,241,0.35);">Resubmit Deposit</a>
          </div>
        </div>`
      ),
    };
  }

  if (tpl.id === 'welcome') {
    return {
      subject: `👋 Welcome to Arena of Sevens, ${username}! Here's ₹${tpl.bonusAmount} to start`,
      html: wrap(
        `<div style="background:linear-gradient(135deg,#1e1240 0%,#312e81 50%,#4c1d95 100%);padding:44px 32px;text-align:center;position:relative;overflow:hidden;">
          <div style="position:absolute;top:-40px;right:-40px;width:200px;height:200px;border-radius:50%;background:rgba(168,85,247,0.2);filter:blur(50px);"></div>
          <div style="position:absolute;bottom:-30px;left:-30px;width:160px;height:160px;border-radius:50%;background:rgba(99,102,241,0.15);filter:blur(40px);"></div>
          <div style="font-size:52px;margin-bottom:14px;">⚔️</div>
          <div style="display:inline-block;background:rgba(168,85,247,0.2);border:1px solid rgba(168,85,247,0.4);color:#c4b5fd;font-size:10px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;padding:5px 14px;border-radius:20px;margin-bottom:14px;">Welcome Gift</div>
          <h1 style="color:#fff;margin:0 0 10px;font-size:30px;font-weight:900;">Welcome, ${username}!</h1>
          <p style="color:#c4b5fd;margin:0;font-size:15px;">Your battle arena awaits — here's a head start</p>
        </div>`,
        `<div style="padding:32px;background:#0f0d28;">
          <div style="background:linear-gradient(135deg,rgba(245,158,11,0.15),rgba(251,191,36,0.06));border:1px solid rgba(245,158,11,0.35);border-radius:16px;padding:28px;text-align:center;margin-bottom:24px;position:relative;overflow:hidden;">
            <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,#fbbf24,transparent);"></div>
            <p style="margin:0 0 6px;font-size:11px;color:#fbbf24;font-weight:700;text-transform:uppercase;letter-spacing:2px;">🎁 Starter Gift</p>
            <p style="margin:0 0 10px;font-size:58px;font-weight:900;color:#fff;line-height:1;">₹${tpl.bonusAmount}</p>
            <p style="margin:0;font-size:13px;color:#94a3b8;">Already in your wallet — no code needed</p>
          </div>
          <div style="display:flex;gap:10px;margin-bottom:24px;">
            <div style="flex:1;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.2);border-radius:12px;padding:16px;text-align:center;">
              <p style="margin:0 0 6px;font-size:24px;">🃏</p>
              <p style="margin:0;font-size:12px;color:#a5b4fc;font-weight:700;">7 Cards Show</p>
            </div>
            <div style="flex:1;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.2);border-radius:12px;padding:16px;text-align:center;">
              <p style="margin:0 0 6px;font-size:24px;">⚔️</p>
              <p style="margin:0;font-size:12px;color:#a5b4fc;font-weight:700;">Tournaments</p>
            </div>
            <div style="flex:1;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.2);border-radius:12px;padding:16px;text-align:center;">
              <p style="margin:0 0 6px;font-size:24px;">🏆</p>
              <p style="margin:0;font-size:12px;color:#a5b4fc;font-weight:700;">Leaderboard</p>
            </div>
          </div>
          <div style="text-align:center;">
            <a href="${APP_URL}/lobby" style="display:inline-block;padding:16px 48px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;font-weight:900;font-size:16px;border-radius:14px;text-decoration:none;box-shadow:0 8px 24px rgba(245,158,11,0.4);">⚔️ Start Playing</a>
          </div>
        </div>`
      ),
    };
  }

  if (tpl.id === 'top_player') {
    return {
      subject: `🏆 ${username}, you're one of our top players!`,
      html: wrap(
        `<div style="background:linear-gradient(135deg,#3d1c02 0%,#78350f 50%,#92400e 100%);padding:44px 32px;text-align:center;position:relative;overflow:hidden;">
          <div style="position:absolute;top:-30px;right:-30px;width:180px;height:180px;border-radius:50%;background:rgba(251,191,36,0.2);filter:blur(40px);"></div>
          <div style="font-size:52px;margin-bottom:14px;">🏆</div>
          <div style="display:inline-block;background:rgba(251,191,36,0.2);border:1px solid rgba(251,191,36,0.5);color:#fde047;font-size:10px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;padding:5px 14px;border-radius:20px;margin-bottom:14px;">VIP Recognition</div>
          <h1 style="color:#fff;margin:0 0 10px;font-size:28px;font-weight:900;">You're a Legend, ${username}!</h1>
          <p style="color:#fcd34d;margin:0;font-size:15px;">${tpl.rank}</p>
        </div>`,
        `<div style="padding:32px;background:#0f0d28;">
          <div style="background:linear-gradient(135deg,rgba(251,191,36,0.12),rgba(245,158,11,0.05));border:1px solid rgba(251,191,36,0.3);border-radius:16px;padding:28px;text-align:center;margin-bottom:22px;position:relative;overflow:hidden;">
            <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,#fbbf24,transparent);"></div>
            <p style="margin:0 0 6px;font-size:11px;color:#fbbf24;font-weight:700;text-transform:uppercase;letter-spacing:2px;">🎁 VIP Reward</p>
            <p style="margin:0 0 10px;font-size:58px;font-weight:900;color:#fff;line-height:1;">₹${tpl.rewardAmount}</p>
            <p style="margin:0;font-size:13px;color:#94a3b8;">Credited to your wallet as a personal thank-you</p>
          </div>
          ${tpl.customMsg ? `<div style="background:rgba(251,191,36,0.06);border-left:3px solid #fbbf24;border-radius:0 10px 10px 0;padding:14px 16px;margin-bottom:22px;"><p style="margin:0;font-size:14px;color:#fde68a;font-style:italic;">"${tpl.customMsg}"</p></div>` : ''}
          <div style="text-align:center;">
            <a href="${APP_URL}/lobby" style="display:inline-block;padding:16px 48px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;font-weight:900;font-size:16px;border-radius:14px;text-decoration:none;box-shadow:0 8px 24px rgba(245,158,11,0.4);">⚔️ Keep Winning</a>
          </div>
        </div>`
      ),
    };
  }

  if (tpl.id === 'voucher_submitted') {
    const bCfg = getBrand(tpl.brand);
    return {
      subject: `🎟️ ${tpl.brand} voucher received — verifying ₹${tpl.amount}`,
      html: wrap(
        `<div style="background:${bCfg.headerBg};padding:44px 32px;text-align:center;position:relative;overflow:hidden;">
          <div style="position:absolute;top:-30px;right:-30px;width:180px;height:180px;border-radius:50%;background:${bCfg.color}25;filter:blur(40px);"></div>
          ${bCfg.logo ? `<img src="${bCfg.logo}" alt="${tpl.brand}" width="48" height="48" style="border-radius:10px;margin-bottom:14px;display:block;margin-left:auto;margin-right:auto;" onerror="this.style.display='none'"/>` : `<div style="font-size:48px;margin-bottom:14px;">🎟️</div>`}
          <div style="display:inline-block;background:${bCfg.color}30;border:1px solid ${bCfg.color}60;color:${bCfg.color};font-size:10px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;padding:5px 14px;border-radius:20px;margin-bottom:14px;">${tpl.brand} · Voucher</div>
          <h1 style="color:#fff;margin:0 0 10px;font-size:26px;font-weight:900;">Voucher Received!</h1>
          <p style="color:rgba(255,255,255,0.65);margin:0;font-size:15px;">Hey ${username}, we've got your submission</p>
        </div>`,
        `<div style="padding:32px;background:#0f0d28;">
          <div style="background:${bCfg.color}0f;border:1px solid ${bCfg.color}35;border-radius:16px;padding:24px;margin-bottom:22px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:8px 0;font-size:12px;color:#64748b;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.05);">Brand</td><td style="padding:8px 0;font-size:14px;color:#fff;font-weight:800;text-align:right;border-bottom:1px solid rgba(255,255,255,0.05);">${tpl.brand}</td></tr>
              <tr><td style="padding:8px 0;font-size:12px;color:#64748b;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.05);">Amount</td><td style="padding:8px 0;font-size:22px;color:${bCfg.color};font-weight:900;text-align:right;border-bottom:1px solid rgba(255,255,255,0.05);">₹${tpl.amount}</td></tr>
              <tr><td style="padding:8px 0;font-size:12px;color:#64748b;font-weight:600;">Voucher Code</td><td style="padding:8px 0;font-size:13px;color:#e2e8f0;font-family:monospace;font-weight:700;text-align:right;letter-spacing:1px;">${tpl.voucherCode}</td></tr>
            </table>
          </div>
          <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:12px;padding:16px;margin-bottom:22px;display:flex;align-items:flex-start;gap:12px;">
            <span style="font-size:20px;flex-shrink:0;">⏳</span>
            <div>
              <p style="margin:0 0 4px;font-size:13px;color:#fbbf24;font-weight:700;">Verification in Progress</p>
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">Our team will review and credit your wallet within 24 hours if the voucher is valid.</p>
            </div>
          </div>
          <div style="text-align:center;">
            <a href="${APP_URL}/wallet" style="display:inline-block;padding:15px 44px;background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;font-weight:900;font-size:15px;border-radius:14px;text-decoration:none;box-shadow:0 8px 24px rgba(99,102,241,0.35);">View My Wallet</a>
          </div>
        </div>`
      ),
    };
  }

  if (tpl.id === 'voucher_delivered') {
    const bCfg = getBrand(tpl.brand);
    return {
      subject: `🎁 Your ${tpl.brand} voucher (₹${tpl.amount}) is ready!`,
      html: wrap(
        `<div style="background:${bCfg.headerBg};padding:44px 32px;text-align:center;position:relative;overflow:hidden;">
          <div style="position:absolute;top:-40px;right:-40px;width:200px;height:200px;border-radius:50%;background:${bCfg.color}20;filter:blur(50px);"></div>
          <div style="position:absolute;bottom:-20px;left:-20px;width:140px;height:140px;border-radius:50%;background:${bCfg.color}15;filter:blur(35px);"></div>
          ${bCfg.logo ? `<img src="${bCfg.logo}" alt="${tpl.brand}" width="56" height="56" style="border-radius:12px;margin-bottom:16px;display:block;margin-left:auto;margin-right:auto;box-shadow:0 4px 16px rgba(0,0,0,0.4);" onerror="this.style.display='none'"/>` : `<div style="font-size:52px;margin-bottom:16px;">🎁</div>`}
          <div style="display:inline-block;background:${bCfg.color}30;border:1px solid ${bCfg.color}60;color:${bCfg.color};font-size:10px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;padding:5px 14px;border-radius:20px;margin-bottom:14px;">🎁 ${tpl.brand} Gift Voucher</div>
          <h1 style="color:#fff;margin:0 0 10px;font-size:28px;font-weight:900;">Your Reward is Here!</h1>
          <p style="color:rgba(255,255,255,0.65);margin:0;font-size:15px;">Hey ${username}, your ${tpl.brand} gift voucher is ready to use</p>
        </div>`,
        `<div style="padding:32px;background:#0f0d28;">
          <div style="background:${bCfg.color}12;border:2px solid ${bCfg.color}45;border-radius:18px;padding:28px;margin-bottom:22px;position:relative;overflow:hidden;">
            <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,${bCfg.color},transparent);"></div>
            <p style="margin:0 0 16px;font-size:11px;color:${bCfg.color};font-weight:800;text-transform:uppercase;letter-spacing:2px;">Voucher Code</p>
            <div style="background:#06040f;border-radius:12px;padding:18px 20px;margin-bottom:18px;border:1px solid ${bCfg.color}25;text-align:center;">
              <p style="margin:0;font-size:28px;font-weight:900;color:#fff;font-family:'Courier New',monospace;letter-spacing:5px;word-break:break-all;">${tpl.voucherNumber}</p>
            </div>
            <div style="display:flex;gap:12px;">
              <div style="flex:1;background:#06040f;border-radius:12px;padding:14px 16px;text-align:center;border:1px solid ${bCfg.color}20;">
                <p style="margin:0 0 5px;font-size:10px;color:${bCfg.color};font-weight:700;text-transform:uppercase;letter-spacing:1px;">PIN</p>
                <p style="margin:0;font-size:20px;font-weight:900;color:#fff;font-family:'Courier New',monospace;">${tpl.voucherPin}</p>
              </div>
              <div style="flex:1;background:#06040f;border-radius:12px;padding:14px 16px;text-align:center;border:1px solid ${bCfg.color}20;">
                <p style="margin:0 0 5px;font-size:10px;color:${bCfg.color};font-weight:700;text-transform:uppercase;letter-spacing:1px;">Valid Until</p>
                <p style="margin:0;font-size:16px;font-weight:800;color:#fbbf24;">${tpl.voucherExpiry}</p>
              </div>
            </div>
          </div>
          ${tpl.adminMessage ? `<div style="background:rgba(99,102,241,0.07);border-left:3px solid #6366f1;border-radius:0 12px 12px 0;padding:14px 16px;margin-bottom:22px;"><p style="margin:0;font-size:13px;color:#a5b4fc;font-style:italic;">💬 ${tpl.adminMessage}</p></div>` : ''}
          <p style="font-size:13px;color:#4b5563;text-align:center;margin:0 0 24px;line-height:1.6;">Use the code above on the <strong style="color:${bCfg.color};">${tpl.brand}</strong> platform. Keep it safe — this voucher is exclusively yours!</p>
          <div style="text-align:center;">
            <a href="${APP_URL}/lobby" style="display:inline-block;padding:16px 48px;background:${bCfg.color};color:#fff;font-weight:900;font-size:16px;border-radius:14px;text-decoration:none;box-shadow:0 8px 24px ${bCfg.color}50;letter-spacing:0.5px;">⚔️ Keep Playing &amp; Winning</a>
          </div>
        </div>`
      ),
    };
  }

  // announcement
  const ctaBlock = (tpl as any).ctaText ? `
    <div style="text-align:center;margin-top:24px;">
      <a href="${(tpl as any).ctaUrl ?? APP_URL}" style="display:inline-block;padding:16px 48px;background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;font-weight:900;font-size:16px;border-radius:14px;text-decoration:none;box-shadow:0 8px 24px rgba(99,102,241,0.4);">${(tpl as any).ctaText}</a>
    </div>` : '';

  return {
    subject: `📣 ${(tpl as any).headline}`,
    html: wrap(
      `<div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:44px 32px;text-align:center;position:relative;overflow:hidden;border-bottom:2px solid rgba(99,102,241,0.3);">
        <div style="font-size:48px;margin-bottom:14px;">📣</div>
        <div style="display:inline-block;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.35);color:#a5b4fc;font-size:10px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;padding:5px 14px;border-radius:20px;margin-bottom:14px;">Arena of Sevens</div>
        <h1 style="color:#fff;margin:0 0 10px;font-size:26px;font-weight:900;">${(tpl as any).headline}</h1>
        <p style="color:#94a3b8;margin:0;font-size:14px;">Hey ${username}, here's an update from us</p>
      </div>`,
      `<div style="padding:32px;background:#0f0d28;">
        <div style="font-size:15px;color:#cbd5e1;line-height:1.8;">${(tpl as any).body.replace(/\n/g, '<br/>')}</div>
        ${ctaBlock}
      </div>`
    ),
  };
}

export async function sendAdminEmail(opts: {
  to: string;
  username: string;
  template: AdminEmailTemplate;
  trackingId?: string;
  unsubscribeToken?: string;
}): Promise<void> {
  const pixel = opts.trackingId
    ? `<img src="${BACKEND_URL}/api/admin/email/track/${opts.trackingId}" width="1" height="1" style="display:none" alt=""/>`
    : '';
  const { subject, html } = buildAdminEmailHtml(opts.username, opts.template, pixel, opts.unsubscribeToken ?? '');
  await sendMail({ to: opts.to, subject, html });
}
