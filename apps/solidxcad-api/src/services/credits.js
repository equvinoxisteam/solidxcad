import { User } from '../models/User.js';
import { CreditTransaction } from '../models/CreditTransaction.js';
import { config } from '../config.js';

export const CREDIT_COSTS = {
  chat: 1,
  cad_generate: 10,
  slice: 15,
  export: 2,
  parts_search: 1,
  parts_download: 2,
};

export function isUnlimitedCredits() {
  return config.credits.unlimited;
}

export function displayCredits(balance) {
  if (isUnlimitedCredits()) return config.credits.displayUnlimited;
  return balance ?? 0;
}

export async function getBalance(userId) {
  if (isUnlimitedCredits()) return config.credits.displayUnlimited;
  const user = await User.findById(userId).select('credits');
  return user?.credits ?? 0;
}

export async function chargeCredits(userId, amount, reason, meta = {}) {
  if (amount <= 0) throw new Error('Credit charge must be positive');

  if (isUnlimitedCredits()) {
    return config.credits.displayUnlimited;
  }

  const user = await User.findOneAndUpdate(
    { _id: userId, credits: { $gte: amount } },
    { $inc: { credits: -amount } },
    { new: true },
  );

  if (!user) {
    const current = await getBalance(userId);
    const err = new Error('Insufficient credits');
    err.code = 'INSUFFICIENT_CREDITS';
    err.balance = current;
    err.required = amount;
    throw err;
  }

  await CreditTransaction.create({
    userId,
    delta: -amount,
    balanceAfter: user.credits,
    reason,
    jobId: meta.jobId,
    meta,
  });

  return user.credits;
}

export async function grantCredits(userId, amount, reason, meta = {}) {
  if (isUnlimitedCredits()) {
    return config.credits.displayUnlimited;
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $inc: { credits: amount } },
    { new: true },
  );

  await CreditTransaction.create({
    userId,
    delta: amount,
    balanceAfter: user.credits,
    reason,
    meta,
  });

  return user.credits;
}
