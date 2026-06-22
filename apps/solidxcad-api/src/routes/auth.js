import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';
import { displayCredits, grantCredits, isUnlimitedCredits } from '../services/credits.js';
import { sendWelcomeEmail, sendOtpEmail, isEmailConfigured } from '../services/email.js';
import { issueOtp, verifyOtp } from '../services/otpService.js';
import {
  exchangeGoogleCode,
  getGoogleAuthUrl,
  googleRedirectUri,
  isGoogleAuthEnabled,
  verifyGoogleIdToken,
} from '../services/googleAuth.js';
import { uploadBuffer, publicUrlForKey } from '../services/s3.js';

const router = Router();

function sanitizeUser(user) {
  const onboardingCompleted = user.onboardingCompleted === true
    || (user.onboardingCompleted !== false && user.authProvider === 'local' && user.createdAt
      && !user.googleId && user.isVerified !== false);

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    plan: user.plan,
    credits: displayCredits(user.credits),
    unlimitedCredits: isUnlimitedCredits(),
    isVerified: user.isVerified,
    onboardingCompleted,
    onboarding: user.onboarding || {},
    authProvider: user.authProvider,
    avatarUrl: user.avatarUrl || null,
    phone: user.phone || null,
    createdAt: user.createdAt,
  };
}

function authPayload(user) {
  return { token: signToken(user), user: sanitizeUser(user) };
}

async function createLocalUser({ name, email, passwordHash }) {
  const user = await User.create({
    name: name || email.split('@')[0],
    email: email.toLowerCase(),
    passwordHash,
    authProvider: 'local',
    isVerified: true,
    onboardingCompleted: false,
    credits: isUnlimitedCredits() ? config.credits.displayUnlimited : config.credits.freeSignup,
    plan: isUnlimitedCredits() ? 'pro' : 'free',
    role: email.toLowerCase() === config.adminEmail?.toLowerCase() ? 'admin' : 'user',
  });
  await grantCredits(user._id, 0, 'signup_bonus', { note: 'initial balance set on create' });
  sendWelcomeEmail(user.email, user.name).catch(() => {});
  return user;
}

async function upsertGoogleUser(profile) {
  let user = await User.findOne({
    $or: [{ googleId: profile.googleId }, { email: profile.email }],
  });

  if (user) {
    if (!user.googleId) user.googleId = profile.googleId;
    if (!user.passwordHash) user.authProvider = 'google';
    else if (user.googleId) user.authProvider = user.authProvider || 'google';
    if (!user.name && profile.name) user.name = profile.name;
    if (!user.avatarUrl && profile.picture) user.avatarUrl = profile.picture;
    user.isVerified = true;
    await user.save();
    return user;
  }

  user = await User.create({
    name: profile.name,
    email: profile.email,
    googleId: profile.googleId,
    authProvider: 'google',
    avatarUrl: profile.picture,
    isVerified: true,
    onboardingCompleted: false,
    credits: isUnlimitedCredits() ? config.credits.displayUnlimited : config.credits.freeSignup,
    plan: isUnlimitedCredits() ? 'pro' : 'free',
    role: profile.email === config.adminEmail?.toLowerCase() ? 'admin' : 'user',
  });
  await grantCredits(user._id, 0, 'signup_bonus', { note: 'google signup' });
  sendWelcomeEmail(user.email, user.name).catch(() => {});
  return user;
}

router.get('/config', (_req, res) => {
  const enabled = isGoogleAuthEnabled();
  res.json({
    googleEnabled: enabled,
    googleClientId: enabled ? config.google.clientId : null,
    googleAuthUrl: enabled ? `${config.apiUrl.replace(/\/$/, '')}/api/auth/google` : null,
    googleRedirectUri: enabled ? googleRedirectUri() : null,
  });
});

router.post('/otp/send', async (req, res) => {
  try {
    const { email, purpose } = req.body;
    if (!email || !['signup', 'reset'].includes(purpose)) {
      return res.status(400).json({ error: 'Email and valid purpose required' });
    }

    const normalized = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalized });

    if (purpose === 'signup' && existing?.isVerified && existing.passwordHash) {
      return res.status(409).json({ error: 'Email already registered. Sign in instead.' });
    }
    if (purpose === 'reset' && !existing) {
      return res.status(404).json({ error: 'No account found with this email' });
    }
    if (purpose === 'reset' && existing?.authProvider === 'google' && !existing.passwordHash) {
      return res.status(400).json({ error: 'This account uses Google sign-in. Continue with Google.' });
    }

    if (!isEmailConfigured()) {
      console.error('[auth/otp/send] email not configured — set MAIL_USER/MAIL_PASS or GMAIL_REFRESH_TOKEN + GOOGLE_CLIENT_ID');
      return res.status(503).json({
        error: 'Email verification is temporarily unavailable. Use Google sign-in or contact support.',
        code: 'EMAIL_NOT_CONFIGURED',
      });
    }

    const code = await issueOtp(normalized, purpose);
    let sent = false;
    try {
      sent = await sendOtpEmail(normalized, code, purpose);
    } catch (err) {
      console.error('[auth/otp/send] email delivery error:', err.message);
    }

    if (!sent) {
      if (config.nodeEnv === 'development') {
        return res.json({
          ok: true,
          devOtp: code,
          message: 'Verification code generated (check API console in dev)',
        });
      }
      return res.status(503).json({
        error: 'Could not deliver the verification email. Try Google sign-in or request a new code in a minute.',
        code: 'EMAIL_DELIVERY_FAILED',
      });
    }

    res.json({ ok: true, message: 'Verification code sent' });
  } catch (err) {
    console.error('[auth/otp/send]', err);
    res.status(500).json({ error: 'Could not send verification code' });
  }
});

router.post('/otp/verify', async (req, res) => {
  try {
    const { email, purpose, code } = req.body;
    if (!email || !purpose || !code) {
      return res.status(400).json({ error: 'Email, purpose, and code required' });
    }
    const result = await verifyOtp(email, purpose, code, { consume: false });
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ ok: true, verified: true });
  } catch (err) {
    console.error('[auth/otp/verify]', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, otp } = req.body;
    if (!email || !password || !otp) {
      return res.status(400).json({ error: 'Email, password, and verification code required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const normalized = email.toLowerCase().trim();
    const otpResult = await verifyOtp(normalized, 'signup', otp);
    if (!otpResult.ok) return res.status(400).json({ error: otpResult.error });

    const existing = await User.findOne({ email: normalized });
    if (existing?.isVerified && existing.passwordHash) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    let user;
    if (existing) {
      existing.name = name || existing.name;
      existing.passwordHash = passwordHash;
      existing.authProvider = 'local';
      existing.isVerified = true;
      existing.onboardingCompleted = false;
      await existing.save();
      user = existing;
    } else {
      user = await createLocalUser({ name, email: normalized, passwordHash });
    }

    res.status(201).json(authPayload(user));
  } catch (err) {
    console.error('[auth/register]', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalized = email?.toLowerCase()?.trim();
    const user = await User.findOne({ email: normalized });
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    if (!user.passwordHash) {
      return res.status(400).json({
        error: 'This account uses Google sign-in',
        googleRequired: true,
      });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    res.json(authPayload(user));
  } catch (err) {
    console.error('[auth/login]', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, password } = req.body;
    if (!email || !otp || !password) {
      return res.status(400).json({ error: 'Email, code, and new password required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const normalized = email.toLowerCase().trim();
    const otpResult = await verifyOtp(normalized, 'reset', otp);
    if (!otpResult.ok) return res.status(400).json({ error: otpResult.error });

    const user = await User.findOne({ email: normalized });
    if (!user) return res.status(404).json({ error: 'Account not found' });

    user.passwordHash = await bcrypt.hash(password, 12);
    user.authProvider = user.googleId ? user.authProvider : 'local';
    await user.save();

    res.json(authPayload(user));
  } catch (err) {
    console.error('[auth/reset-password]', err);
    res.status(500).json({ error: 'Password reset failed' });
  }
});

router.get('/google', (_req, res) => {
  const url = getGoogleAuthUrl();
  if (!url) return res.status(503).json({ error: 'Google sign-in is not configured' });
  res.redirect(url);
});

router.post('/google/verify', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: 'Google credential required' });
    }
    const profile = await verifyGoogleIdToken(credential);
    const user = await upsertGoogleUser(profile);
    res.json(authPayload(user));
  } catch (err) {
    console.error('[auth/google/verify]', err);
    res.status(401).json({ error: err.message || 'Google sign-in failed' });
  }
});

router.get('/google/callback', async (req, res) => {
  try {
    const { code, error } = req.query;
    if (error) {
      return res.redirect(`${config.frontendUrl}/login?error=google_denied`);
    }
    if (!code) {
      return res.redirect(`${config.frontendUrl}/login?error=google_failed`);
    }

    const profile = await exchangeGoogleCode(code);
    const user = await upsertGoogleUser(profile);

    const token = signToken(user);
    const next = sanitizeUser(user).onboardingCompleted ? 'dashboard' : 'onboarding';
    res.redirect(`${config.frontendUrl}/auth/callback?token=${encodeURIComponent(token)}&next=${next}`);
  } catch (err) {
    console.error('[auth/google/callback]', err.message);
    const reason = String(err.message || '').includes('redirect_uri')
      ? 'google_redirect'
      : 'google_failed';
    res.redirect(`${config.frontendUrl}/login?error=${reason}`);
  }
});

router.patch('/profile', requireAuth, async (req, res) => {
  try {
    const { name, phone, avatarDataUrl } = req.body;
    if (name !== undefined) {
      if (!name?.trim()) {
        return res.status(400).json({ error: 'Name cannot be empty' });
      }
      req.user.name = name.trim();
    }
    if (phone !== undefined) {
      req.user.phone = phone?.trim() || '';
    }
    if (avatarDataUrl && String(avatarDataUrl).startsWith('data:image/')) {
      const match = String(avatarDataUrl).match(/^data:(image\/[\w+.-]+);base64,(.+)$/);
      if (!match) {
        return res.status(400).json({ error: 'Invalid image data' });
      }
      const contentType = match[1];
      const buffer = Buffer.from(match[2], 'base64');
      if (buffer.length > 2_500_000) {
        return res.status(400).json({ error: 'Image must be under 2.5 MB' });
      }
      const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
      const key = `${config.aws.prefix}/users/${req.user._id}/avatar.${ext}`;
      await uploadBuffer(key, buffer, contentType);
      req.user.avatarUrl = publicUrlForKey(key);
    }
    await req.user.save();
    res.json({ user: sanitizeUser(req.user) });
  } catch (err) {
    console.error('[auth/profile]', err);
    res.status(400).json({ error: err.message || 'Could not update profile' });
  }
});

router.patch('/onboarding', requireAuth, async (req, res) => {
  try {
    const { name, useCase, experience, goal, complete } = req.body;
    const user = req.user;

    if (name?.trim()) user.name = name.trim();
    if (useCase) user.onboarding = { ...user.onboarding, useCase };
    if (experience) user.onboarding = { ...user.onboarding, experience };
    if (goal) user.onboarding = { ...user.onboarding, goal };
    if (complete === true) user.onboardingCompleted = true;

    await user.save();
    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    console.error('[auth/onboarding]', err);
    res.status(500).json({ error: 'Could not save onboarding' });
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

export default router;
