import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import { config } from '../config.js';

const SEND_TIMEOUT_MS = 15_000;

function withTimeout(promise, ms = SEND_TIMEOUT_MS, label = 'email') {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    Promise.resolve(promise)
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function resolvedGmailConfig() {
  return {
    clientId: config.gmail.clientId || config.google.clientId || '',
    clientSecret: config.gmail.clientSecret || config.google.clientSecret || '',
    refreshToken: config.gmail.refreshToken || '',
    user: config.gmail.user || config.mail.user || '',
    redirectUri: config.gmail.redirectUri || `${config.apiUrl.replace(/\/$/, '')}/api/auth/google/callback`,
  };
}

export function isEmailConfigured() {
  const gmail = resolvedGmailConfig();
  const hasGmailApi = Boolean(gmail.clientId && gmail.clientSecret && gmail.refreshToken && gmail.user);
  const hasSmtp = Boolean(config.mail.user && config.mail.pass);
  return hasGmailApi || hasSmtp;
}

async function getGmailApiClient() {
  const gmail = resolvedGmailConfig();
  if (!gmail.clientId || !gmail.clientSecret || !gmail.refreshToken) return null;

  const oauth2 = new google.auth.OAuth2(
    gmail.clientId,
    gmail.clientSecret,
    gmail.redirectUri,
  );
  oauth2.setCredentials({ refresh_token: gmail.refreshToken });
  return google.gmail({ version: 'v1', auth: oauth2 });
}

function encodeMessage(to, subject, html, from) {
  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    html,
  ].join('\n');
  return Buffer.from(message).toString('base64url');
}

async function sendViaGmailApi(to, subject, html) {
  const gmailCfg = resolvedGmailConfig();
  const gmail = await getGmailApiClient();
  if (!gmail || !gmailCfg.user) return false;

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encodeMessage(to, subject, html, gmailCfg.user) },
  });
  return true;
}

function createSmtpTransporter() {
  if (!config.mail.user || !config.mail.pass) return null;

  const auth = {
    user: config.mail.user,
    pass: config.mail.pass.replace(/\s+/g, ''),
  };

  // Port 587 (STARTTLS) is more reliable from cloud hosts than 465.
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth,
    connectionTimeout: SEND_TIMEOUT_MS,
    greetingTimeout: SEND_TIMEOUT_MS,
    socketTimeout: SEND_TIMEOUT_MS,
  });
}

async function sendViaSmtp(to, subject, html) {
  const transporter = createSmtpTransporter();
  if (!transporter) return false;

  await transporter.sendMail({
    from: config.mail.from || config.mail.user,
    to,
    subject,
    html,
  });
  return true;
}

async function sendHtmlEmail(to, subject, html) {
  if (resolvedGmailConfig().refreshToken) {
    try {
      if (await withTimeout(sendViaGmailApi(to, subject, html), SEND_TIMEOUT_MS, 'Gmail API')) {
        return true;
      }
    } catch (err) {
      console.warn('[email] Gmail API failed:', err.message);
    }
  }

  try {
    if (await withTimeout(sendViaSmtp(to, subject, html), SEND_TIMEOUT_MS, 'SMTP')) {
      return true;
    }
  } catch (err) {
    console.warn('[email] SMTP failed:', err.message);
  }

  return false;
}

function otpEmailHtml(code, purpose) {
  const title = purpose === 'reset' ? 'Reset your password' : 'Verify your email';
  const body = purpose === 'reset'
    ? 'Use this code to reset your SolidX CAD password:'
    : 'Use this code to finish creating your SolidX CAD account:';
  return `
    <div style="font-family:Inter,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#103A8E;margin:0 0 12px">${config.appName}</h2>
      <p style="color:#333">${title}</p>
      <p style="color:#555">${body}</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:8px;color:#111;margin:24px 0">${code}</p>
      <p style="color:#888;font-size:13px">Expires in 10 minutes. If you didn't request this, ignore this email.</p>
    </div>
  `;
}

export async function sendOtpEmail(to, code, purpose) {
  const subject = purpose === 'reset'
    ? `${config.appName} — password reset code`
    : `${config.appName} — verify your email`;
  return sendHtmlEmail(to, subject, otpEmailHtml(code, purpose));
}

export async function sendWelcomeEmail(to, name) {
  const html = `
    <div style="font-family:Inter,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#103A8E">Welcome to ${config.appName}</h2>
      <p>Hi ${name || 'there'},</p>
      <p>Your account is ready with <strong>${config.credits.freeSignup} free credits</strong>.</p>
      <p><a href="${config.frontendUrl}/dashboard" style="color:#103A8E">Open Dashboard</a></p>
    </div>
  `;
  await sendHtmlEmail(to, `Welcome to ${config.appName}`, html);
}
