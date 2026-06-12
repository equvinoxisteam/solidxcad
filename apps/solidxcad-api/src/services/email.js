import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import { config } from '../config.js';

async function getGmailApiClient() {
  if (!config.gmail.clientId || !config.gmail.refreshToken) return null;

  const oauth2 = new google.auth.OAuth2(
    config.gmail.clientId,
    config.gmail.clientSecret,
    config.gmail.redirectUri,
  );
  oauth2.setCredentials({ refresh_token: config.gmail.refreshToken });
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
  const gmail = await getGmailApiClient();
  if (!gmail || !config.gmail.user) return false;

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encodeMessage(to, subject, html, config.gmail.user) },
  });
  return true;
}

async function sendViaSmtp(to, subject, html) {
  if (!config.mail.user || !config.mail.pass) return false;

  const transporter = nodemailer.createTransport({
    service: config.mail.provider === 'gmail' ? 'gmail' : undefined,
    host: config.mail.provider === 'gmail' ? undefined : 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: config.mail.user,
      pass: config.mail.pass.replace(/\s+/g, ''),
    },
  });

  await transporter.sendMail({
    from: config.mail.from || config.mail.user,
    to,
    subject,
    html,
  });
  return true;
}

async function sendHtmlEmail(to, subject, html) {
  try {
    if (await sendViaGmailApi(to, subject, html)) return true;
  } catch (err) {
    console.warn('[email] Gmail API failed:', err.message);
  }

  try {
    if (await sendViaSmtp(to, subject, html)) return true;
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
