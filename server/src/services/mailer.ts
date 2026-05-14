import nodemailer from 'nodemailer';

const ADMIN_EMAIL = 'nagendra.meesala.puri@gmail.com';

function getTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) throw new Error('SMTP_USER / SMTP_PASS not configured');
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
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
        <h2 style="color:#00ff88;margin:0;font-size:20px;">💰 New Deposit Request</h2>
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
            <td style="padding:10px 0;color:#059669;font-weight:800;font-size:18px;">₹${amount}</td>
          </tr>
          <tr style="border-top:1px solid #f3f4f6;">
            <td style="padding:10px 0;color:#6b7280;font-weight:600;">UTR Number</td>
            <td style="padding:10px 0;color:#111827;font-family:monospace;font-size:15px;font-weight:700;letter-spacing:1px;">${utrNumber}</td>
          </tr>
          <tr style="border-top:1px solid #f3f4f6;">
            <td style="padding:10px 0;color:#6b7280;font-weight:600;">Date &amp; Time</td>
            <td style="padding:10px 0;color:#374151;">${dateStr} IST</td>
          </tr>
        </table>

        <div style="margin-top:20px;padding:14px 16px;background:#f0fdf4;border-left:4px solid #00ff88;border-radius:6px;">
          <p style="margin:0;font-size:13px;color:#065f46;">
            <strong>Action required:</strong> Verify the UTR number in your UPI app, then approve or reject this request in the Admin Panel → 📥 Deposits.
          </p>
        </div>
      </div>
      <div style="padding:14px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-size:11px;color:#9ca3af;">This is an automated notification from 7 Cards Show. Do not reply to this email.</p>
      </div>
    </div>
  `;

  const transporter = getTransporter();
  await transporter.sendMail({
    from:    `"7 Cards Show" <${process.env.SMTP_USER}>`,
    to:      ADMIN_EMAIL,
    subject: `[7Cards] Deposit Request — ₹${amount} from ${username} (UTR: ${utrNumber})`,
    html,
  });
}
