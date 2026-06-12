import bcrypt from 'bcryptjs';
import { OtpCode } from '../models/OtpCode.js';
import { config } from '../config.js';

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function issueOtp(email, purpose) {
  const normalized = email.toLowerCase().trim();
  const code = generateOtp();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await OtpCode.findOneAndUpdate(
    { email: normalized, purpose },
    { codeHash, expiresAt, attempts: 0 },
    { upsert: true, new: true },
  );

  if (config.nodeEnv === 'development') {
    console.log(`[otp] ${purpose} for ${normalized}: ${code}`);
  }

  return code;
}

export async function verifyOtp(email, purpose, code) {
  const normalized = email.toLowerCase().trim();
  const record = await OtpCode.findOne({ email: normalized, purpose });
  if (!record) return { ok: false, error: 'No verification code found. Request a new one.' };
  if (record.expiresAt < new Date()) {
    await OtpCode.deleteOne({ _id: record._id });
    return { ok: false, error: 'Code expired. Request a new one.' };
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: 'Too many attempts. Request a new code.' };
  }

  const valid = await bcrypt.compare(String(code).trim(), record.codeHash);
  if (!valid) {
    record.attempts += 1;
    await record.save();
    return { ok: false, error: 'Invalid code. Try again.' };
  }

  await OtpCode.deleteOne({ _id: record._id });
  return { ok: true };
}
