/**
 * SERVER-ONLY outbound email (password resets, etc.) via SMTP.
 *
 * Configure via environment variables:
 *   SMTP_HOST   — defaults to Hostinger's mail server (smtp.hostinger.com)
 *   SMTP_PORT   — defaults to 465 (implicit TLS)
 *   SMTP_USER   — the sending mailbox, e.g. info@letsmun.com
 *   SMTP_PASS   — that mailbox's password (NOT your hPanel login)
 *   SMTP_FROM   — optional "Display Name <address>"; defaults to SMTP_USER
 *
 * If SMTP_USER/SMTP_PASS aren't set, sendMail throws a clear error instead of
 * failing silently — callers turn that into a 500 with a message an admin can
 * actually act on.
 */
import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    throw new Error(
      "Email isn't configured: set SMTP_USER and SMTP_PASS (the sending mailbox and its password) in your environment."
    );
  }

  const port = Number(process.env.SMTP_PORT) || 465;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.hostinger.com",
    port,
    secure: port === 465, // 465 = implicit TLS; 587 uses STARTTLS instead
    auth: { user, pass },
  });
  return transporter;
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  await getTransporter().sendMail({ from, ...opts });
}
