import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { config } from '../config.js';

export function googleRedirectUri() {
  return `${config.apiUrl.replace(/\/$/, '')}/api/auth/google/callback`;
}

function oauthClient() {
  if (!config.google.clientId || !config.google.clientSecret) return null;
  return new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    googleRedirectUri(),
  );
}

export function isGoogleAuthEnabled() {
  return Boolean(config.google.clientId);
}

export function getGoogleAuthUrl() {
  const client = oauthClient();
  if (!client) return null;
  return client.generateAuthUrl({
    access_type: 'online',
    scope: [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    prompt: 'select_account',
    include_granted_scopes: true,
  });
}

export async function exchangeGoogleCode(code) {
  const client = oauthClient();
  if (!client) throw new Error('Google sign-in is not configured');

  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const { data } = await oauth2.userinfo.get();

  if (!data?.email) throw new Error('Google account has no email');

  return {
    googleId: String(data.id),
    email: data.email.toLowerCase(),
    name: data.name || data.given_name || data.email.split('@')[0],
    picture: data.picture,
  };
}

export async function verifyGoogleIdToken(idToken) {
  if (!config.google.clientId) throw new Error('Google sign-in is not configured');

  const client = new OAuth2Client(config.google.clientId);
  const ticket = await client.verifyIdToken({
    idToken,
    audience: config.google.clientId,
  });
  const payload = ticket.getPayload();
  if (!payload?.email) throw new Error('Google account has no email');

  return {
    googleId: String(payload.sub),
    email: payload.email.toLowerCase(),
    name: payload.name || payload.given_name || payload.email.split('@')[0],
    picture: payload.picture,
  };
}
