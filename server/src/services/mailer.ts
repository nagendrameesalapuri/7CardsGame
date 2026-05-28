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
  | { id: 'withdrawal_approved';  amount: number; method: string; eta?: string }
  | { id: 'withdrawal_rejected';  amount: number; reason: string }
  | { id: 'deposit_confirmed';    amount: number }
  | { id: 'deposit_rejected';     amount: number; reason: string }
  | { id: 'welcome';              bonusAmount: number }
  | { id: 'top_player';           rank: string; rewardAmount: number; customMsg?: string };

const BACKEND_URL = process.env.SERVER_URL ?? 'http://localhost:5000';

function buildAdminEmailHtml(username: string, tpl: AdminEmailTemplate, trackingPixel = '', unsubscribeToken = ''): { subject: string; html: string } {
  const unsubLink = unsubscribeToken
    ? `<a href="${BACKEND_URL}/api/email/unsubscribe/${unsubscribeToken}" style="color:#4b5563;text-decoration:underline;">Unsubscribe</a>`
    : '';
  const footer = `
    ${trackingPixel}
    <div style="padding:16px 28px;background:#08061a;text-align:center;">
      <p style="margin:0;font-size:11px;color:#4b5563;">Arena of Sevens · You're receiving this because you have an account with us.${unsubLink ? ` &nbsp;·&nbsp; ${unsubLink}` : ''}</p>
    </div>`;

  if (tpl.id === 'winback') {
    return {
      subject: `⚔️ ${username}, a ₹${tpl.bonusAmount} gift is waiting for you!`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0d0b1e;border-radius:16px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#1e1b4b,#312e81);padding:32px 28px;text-align:center;">
            <div style="font-size:40px;margin-bottom:10px;">🎁</div>
            <h1 style="color:#fff;margin:0;font-size:22px;font-weight:900;">We miss you, ${username}!</h1>
            <p style="color:#a5b4fc;margin:8px 0 0;font-size:14px;">Come back and claim your surprise gift</p>
          </div>
          <div style="padding:28px;background:#0f0d2a;">
            <div style="background:linear-gradient(135deg,rgba(34,197,94,0.15),rgba(16,185,129,0.08));border:1px solid rgba(34,197,94,0.4);border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
              <p style="margin:0 0 6px;font-size:12px;color:#4ade80;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Special Gift For You</p>
              <p style="margin:0 0 8px;font-size:42px;font-weight:900;color:#fff;">₹${tpl.bonusAmount}</p>
              <p style="margin:0;font-size:14px;color:#94a3b8;">Added to your wallet — just log in to claim it</p>
            </div>
            ${tpl.customNote ? `<p style="font-size:14px;color:#94a3b8;text-align:center;margin-bottom:24px;">${tpl.customNote}</p>` : ''}
            <div style="text-align:center;">
              <a href="${APP_URL}/lobby" style="display:inline-block;padding:14px 44px;background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;font-weight:900;font-size:16px;border-radius:12px;text-decoration:none;">⚔️ Claim My ₹${tpl.bonusAmount} Now</a>
            </div>
          </div>
          ${footer}
        </div>`,
    };
  }

  if (tpl.id === 'tournament') {
    const freeEntry = tpl.entryFee === 0;
    return {
      subject: `⚔️ Tournament Alert: ${tpl.name} — ₹${tpl.prizePool} Prize Pool!`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0d0b1e;border-radius:16px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#312e81,#4c1d95);padding:32px 28px;text-align:center;">
            <div style="font-size:40px;margin-bottom:10px;">⚔️</div>
            <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#a5b4fc;text-transform:uppercase;letter-spacing:2px;">Tournament Alert</p>
            <h1 style="color:#fff;margin:0;font-size:24px;font-weight:900;">${tpl.name}</h1>
            <p style="color:#c4b5fd;margin:8px 0 0;font-size:14px;">Hey ${username}, a big one is coming up!</p>
          </div>
          <div style="padding:28px;background:#0f0d2a;">
            <div style="display:flex;gap:12px;margin-bottom:24px;">
              <div style="flex:1;background:#1a1640;border-radius:10px;padding:16px;text-align:center;">
                <p style="margin:0;font-size:24px;font-weight:900;color:#a5b4fc;">₹${tpl.prizePool}</p>
                <p style="margin:4px 0 0;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;">Prize Pool</p>
              </div>
              <div style="flex:1;background:#1a1640;border-radius:10px;padding:16px;text-align:center;">
                <p style="margin:0;font-size:24px;font-weight:900;color:${freeEntry ? '#4ade80' : '#fbbf24'};">${freeEntry ? 'FREE' : '₹' + tpl.entryFee}</p>
                <p style="margin:4px 0 0;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;">Entry Fee</p>
              </div>
              <div style="flex:1;background:#1a1640;border-radius:10px;padding:16px;text-align:center;">
                <p style="margin:0;font-size:18px;font-weight:900;color:#fb923c;">${tpl.startTime}</p>
                <p style="margin:4px 0 0;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;">Starts</p>
              </div>
            </div>
            ${tpl.description ? `<p style="font-size:14px;color:#94a3b8;margin:0 0 24px;line-height:1.6;">${tpl.description}</p>` : ''}
            <div style="text-align:center;">
              <a href="${APP_URL}/tournaments" style="display:inline-block;padding:14px 44px;background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;font-weight:900;font-size:16px;border-radius:12px;text-decoration:none;">Register Now →</a>
            </div>
          </div>
          ${footer}
        </div>`,
    };
  }

  if (tpl.id === 'bonus') {
    return {
      subject: `🎉 ${username}, ₹${tpl.amount} bonus added to your wallet!`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0d0b1e;border-radius:16px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#064e3b,#065f46);padding:32px 28px;text-align:center;">
            <div style="font-size:40px;margin-bottom:10px;">💰</div>
            <h1 style="color:#fff;margin:0;font-size:22px;font-weight:900;">Bonus Credited!</h1>
            <p style="color:#6ee7b7;margin:8px 0 0;font-size:14px;">Hey ${username}, you got a reward</p>
          </div>
          <div style="padding:28px;background:#0f0d2a;">
            <div style="background:linear-gradient(135deg,rgba(34,197,94,0.18),rgba(16,185,129,0.1));border:1px solid rgba(34,197,94,0.5);border-radius:14px;padding:28px;text-align:center;margin-bottom:24px;">
              <p style="margin:0 0 4px;font-size:12px;color:#4ade80;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Amount Credited</p>
              <p style="margin:0 0 8px;font-size:52px;font-weight:900;color:#fff;">₹${tpl.amount}</p>
              <p style="margin:0;font-size:13px;color:#6ee7b7;background:rgba(16,185,129,0.15);display:inline-block;padding:4px 12px;border-radius:20px;">${tpl.occasion}</p>
            </div>
            <p style="font-size:14px;color:#94a3b8;text-align:center;margin:0 0 24px;">The bonus is already in your wallet. Start playing to use it!</p>
            <div style="text-align:center;">
              <a href="${APP_URL}/lobby" style="display:inline-block;padding:14px 44px;background:linear-gradient(135deg,#059669,#10b981);color:#fff;font-weight:900;font-size:16px;border-radius:12px;text-decoration:none;">⚔️ Play Now</a>
            </div>
          </div>
          ${footer}
        </div>`,
    };
  }

  if (tpl.id === 'withdrawal_approved') {
    return {
      subject: `✅ Your ₹${tpl.amount} withdrawal is approved!`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0d0b1e;border-radius:16px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#064e3b,#065f46);padding:32px 28px;text-align:center;">
            <div style="font-size:40px;margin-bottom:10px;">✅</div>
            <h1 style="color:#fff;margin:0;font-size:22px;font-weight:900;">Withdrawal Approved!</h1>
            <p style="color:#6ee7b7;margin:8px 0 0;font-size:14px;">Hey ${username}, great news!</p>
          </div>
          <div style="padding:28px;background:#0f0d2a;">
            <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.4);border-radius:12px;padding:24px;text-align:center;margin-bottom:20px;">
              <p style="margin:0 0 4px;font-size:12px;color:#4ade80;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Amount Approved</p>
              <p style="margin:0 0 8px;font-size:48px;font-weight:900;color:#fff;">₹${tpl.amount}</p>
              <p style="margin:0;font-size:13px;color:#94a3b8;">via <strong style="color:#6ee7b7;">${tpl.method}</strong>${tpl.eta ? ` · Expected in <strong style="color:#6ee7b7;">${tpl.eta}</strong>` : ''}</p>
            </div>
            <p style="font-size:14px;color:#94a3b8;text-align:center;margin:0 0 20px;">Your withdrawal has been processed. You'll receive the amount soon.</p>
            <div style="text-align:center;">
              <a href="${APP_URL}/lobby" style="display:inline-block;padding:12px 36px;background:linear-gradient(135deg,#059669,#10b981);color:#fff;font-weight:900;font-size:15px;border-radius:12px;text-decoration:none;">⚔️ Play Again</a>
            </div>
          </div>
          ${footer}
        </div>`,
    };
  }

  if (tpl.id === 'withdrawal_rejected') {
    return {
      subject: `❌ Update on your ₹${tpl.amount} withdrawal request`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0d0b1e;border-radius:16px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#450a0a,#7f1d1d);padding:32px 28px;text-align:center;">
            <div style="font-size:40px;margin-bottom:10px;">⚠️</div>
            <h1 style="color:#fff;margin:0;font-size:22px;font-weight:900;">Withdrawal Not Processed</h1>
            <p style="color:#fca5a5;margin:8px 0 0;font-size:14px;">Hey ${username}, we need your attention</p>
          </div>
          <div style="padding:28px;background:#0f0d2a;">
            <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:12px;padding:20px;margin-bottom:20px;">
              <p style="margin:0 0 6px;font-size:12px;color:#f87171;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Withdrawal of ₹${tpl.amount}</p>
              <p style="margin:0 0 6px;font-size:14px;color:#fca5a5;font-weight:700;">Reason: ${tpl.reason}</p>
              <p style="margin:0;font-size:13px;color:#94a3b8;">Your ₹${tpl.amount} has been returned to your wallet.</p>
            </div>
            <p style="font-size:14px;color:#94a3b8;text-align:center;margin:0 0 20px;">Please contact support if you have any questions or to resubmit your withdrawal.</p>
            <div style="text-align:center;">
              <a href="${APP_URL}/profile" style="display:inline-block;padding:12px 36px;background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;font-weight:900;font-size:15px;border-radius:12px;text-decoration:none;">Go to My Wallet</a>
            </div>
          </div>
          ${footer}
        </div>`,
    };
  }

  if (tpl.id === 'deposit_confirmed') {
    return {
      subject: `💚 ₹${tpl.amount} deposit confirmed — wallet credited!`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0d0b1e;border-radius:16px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#14532d,#166534);padding:32px 28px;text-align:center;">
            <div style="font-size:40px;margin-bottom:10px;">💚</div>
            <h1 style="color:#fff;margin:0;font-size:22px;font-weight:900;">Deposit Confirmed!</h1>
            <p style="color:#86efac;margin:8px 0 0;font-size:14px;">Hey ${username}, your wallet is topped up</p>
          </div>
          <div style="padding:28px;background:#0f0d2a;">
            <div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.4);border-radius:14px;padding:28px;text-align:center;margin-bottom:24px;">
              <p style="margin:0 0 4px;font-size:12px;color:#4ade80;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Credited to Wallet</p>
              <p style="margin:0;font-size:52px;font-weight:900;color:#fff;">₹${tpl.amount}</p>
            </div>
            <p style="font-size:14px;color:#94a3b8;text-align:center;margin:0 0 20px;">Your balance is ready. Jump in and start playing!</p>
            <div style="text-align:center;">
              <a href="${APP_URL}/lobby" style="display:inline-block;padding:14px 44px;background:linear-gradient(135deg,#059669,#10b981);color:#fff;font-weight:900;font-size:16px;border-radius:12px;text-decoration:none;">⚔️ Play Now</a>
            </div>
          </div>
          ${footer}
        </div>`,
    };
  }

  if (tpl.id === 'deposit_rejected') {
    return {
      subject: `⚠️ Your ₹${tpl.amount} deposit could not be verified`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0d0b1e;border-radius:16px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#431407,#7c2d12);padding:32px 28px;text-align:center;">
            <div style="font-size:40px;margin-bottom:10px;">⚠️</div>
            <h1 style="color:#fff;margin:0;font-size:22px;font-weight:900;">Deposit Not Verified</h1>
            <p style="color:#fdba74;margin:8px 0 0;font-size:14px;">Hey ${username}, action required</p>
          </div>
          <div style="padding:28px;background:#0f0d2a;">
            <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:12px;padding:20px;margin-bottom:20px;">
              <p style="margin:0 0 6px;font-size:12px;color:#f87171;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Deposit of ₹${tpl.amount}</p>
              <p style="margin:0;font-size:14px;color:#fca5a5;">Reason: ${tpl.reason}</p>
            </div>
            <p style="font-size:14px;color:#94a3b8;text-align:center;margin:0 0 20px;">Please resubmit with the correct UTR or contact our support team.</p>
            <div style="text-align:center;">
              <a href="${APP_URL}/profile" style="display:inline-block;padding:12px 36px;background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;font-weight:900;font-size:15px;border-radius:12px;text-decoration:none;">Resubmit Deposit</a>
            </div>
          </div>
          ${footer}
        </div>`,
    };
  }

  if (tpl.id === 'welcome') {
    return {
      subject: `👋 Welcome to Arena of Sevens, ${username}! Here's ₹${tpl.bonusAmount} to start`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0d0b1e;border-radius:16px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#312e81,#4c1d95);padding:36px 28px;text-align:center;">
            <div style="font-size:44px;margin-bottom:10px;">⚔️</div>
            <h1 style="color:#fff;margin:0;font-size:24px;font-weight:900;">Welcome, ${username}!</h1>
            <p style="color:#c4b5fd;margin:8px 0 0;font-size:15px;">Your battle arena awaits</p>
          </div>
          <div style="padding:28px;background:#0f0d2a;">
            <div style="background:linear-gradient(135deg,rgba(245,158,11,0.15),rgba(251,191,36,0.08));border:1px solid rgba(245,158,11,0.4);border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
              <p style="margin:0 0 4px;font-size:12px;color:#fbbf24;font-weight:700;text-transform:uppercase;letter-spacing:1px;">🎁 Starter Gift</p>
              <p style="margin:0 0 6px;font-size:42px;font-weight:900;color:#fff;">₹${tpl.bonusAmount}</p>
              <p style="margin:0;font-size:13px;color:#94a3b8;">Already in your wallet — no code needed</p>
            </div>
            <div style="display:flex;gap:10px;margin-bottom:24px;">
              <div style="flex:1;background:#1a1640;border-radius:10px;padding:14px;text-align:center;">
                <p style="margin:0;font-size:20px;">🃏</p>
                <p style="margin:4px 0 0;font-size:12px;color:#94a3b8;font-weight:600;">7 Cards Show</p>
              </div>
              <div style="flex:1;background:#1a1640;border-radius:10px;padding:14px;text-align:center;">
                <p style="margin:0;font-size:20px;">⚔️</p>
                <p style="margin:4px 0 0;font-size:12px;color:#94a3b8;font-weight:600;">Tournaments</p>
              </div>
              <div style="flex:1;background:#1a1640;border-radius:10px;padding:14px;text-align:center;">
                <p style="margin:0;font-size:20px;">🏆</p>
                <p style="margin:4px 0 0;font-size:12px;color:#94a3b8;font-weight:600;">Leaderboard</p>
              </div>
            </div>
            <div style="text-align:center;">
              <a href="${APP_URL}/lobby" style="display:inline-block;padding:14px 44px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;font-weight:900;font-size:16px;border-radius:12px;text-decoration:none;">⚔️ Start Playing</a>
            </div>
          </div>
          ${footer}
        </div>`,
    };
  }

  if (tpl.id === 'top_player') {
    return {
      subject: `🏆 ${username}, you're one of our top players!`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0d0b1e;border-radius:16px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#78350f,#92400e);padding:32px 28px;text-align:center;">
            <div style="font-size:44px;margin-bottom:10px;">🏆</div>
            <h1 style="color:#fff;margin:0;font-size:24px;font-weight:900;">You're a Legend, ${username}!</h1>
            <p style="color:#fcd34d;margin:8px 0 0;font-size:14px;">${tpl.rank}</p>
          </div>
          <div style="padding:28px;background:#0f0d2a;">
            <div style="background:linear-gradient(135deg,rgba(251,191,36,0.15),rgba(245,158,11,0.08));border:1px solid rgba(251,191,36,0.4);border-radius:12px;padding:24px;text-align:center;margin-bottom:20px;">
              <p style="margin:0 0 4px;font-size:12px;color:#fbbf24;font-weight:700;text-transform:uppercase;letter-spacing:1px;">🎁 VIP Reward</p>
              <p style="margin:0 0 6px;font-size:48px;font-weight:900;color:#fff;">₹${tpl.rewardAmount}</p>
              <p style="margin:0;font-size:13px;color:#94a3b8;">Credited to your wallet as a thank-you from us</p>
            </div>
            ${tpl.customMsg ? `<p style="font-size:15px;color:#cbd5e1;text-align:center;margin:0 0 20px;font-style:italic;">"${tpl.customMsg}"</p>` : ''}
            <div style="text-align:center;">
              <a href="${APP_URL}/lobby" style="display:inline-block;padding:14px 44px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;font-weight:900;font-size:16px;border-radius:12px;text-decoration:none;">⚔️ Keep Winning</a>
            </div>
          </div>
          ${footer}
        </div>`,
    };
  }

  // announcement
  const ctaBlock = (tpl as any).ctaText ? `
    <div style="text-align:center;margin-top:24px;">
      <a href="${(tpl as any).ctaUrl ?? APP_URL}" style="display:inline-block;padding:14px 44px;background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;font-weight:900;font-size:16px;border-radius:12px;text-decoration:none;">${(tpl as any).ctaText}</a>
    </div>` : '';

  return {
    subject: `📣 ${(tpl as any).headline}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0d0b1e;border-radius:16px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#1e293b,#0f172a);padding:32px 28px;text-align:center;border-bottom:2px solid rgba(99,102,241,0.3);">
          <div style="font-size:40px;margin-bottom:10px;">📣</div>
          <h1 style="color:#fff;margin:0;font-size:22px;font-weight:900;">${(tpl as any).headline}</h1>
          <p style="color:#94a3b8;margin:8px 0 0;font-size:13px;">Hey ${username}, here's an update from Arena of Sevens</p>
        </div>
        <div style="padding:28px;background:#0f0d2a;">
          <div style="font-size:15px;color:#cbd5e1;line-height:1.7;">${(tpl as any).body.replace(/\n/g, '<br/>')}</div>
          ${ctaBlock}
        </div>
        ${footer}
      </div>`,
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
