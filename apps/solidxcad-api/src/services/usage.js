import { User } from '../models/User.js';
import { config } from '../config.js';
import { isUnlimitedCredits } from './credits.js';

/** Upgrade every account for unlimited API usage (no credit deductions). */
export async function syncAllUsersUnlimited() {
  if (!isUnlimitedCredits()) return { updated: 0 };

  const result = await User.updateMany(
    {},
    {
      $set: {
        plan: 'pro',
        credits: config.credits.displayUnlimited,
      },
    },
  );

  return { updated: result.modifiedCount };
}

export function usageCost(amount) {
  return isUnlimitedCredits() ? 0 : amount;
}
