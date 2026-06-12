import bcrypt from 'bcryptjs';
import { connectDb } from '../db.js';
import { config } from '../config.js';
import { isUnlimitedCredits } from '../services/credits.js';
import { User } from '../models/User.js';

async function main() {
  if (!config.adminEmail || !config.adminPassword) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env');
    process.exit(1);
  }

  await connectDb();

  const passwordHash = await bcrypt.hash(config.adminPassword, 12);
  const user = await User.findOneAndUpdate(
    { email: config.adminEmail.toLowerCase() },
    {
      name: 'Admin',
      email: config.adminEmail.toLowerCase(),
      passwordHash,
      role: 'admin',
      plan: 'pro',
      credits: isUnlimitedCredits() ? config.credits.displayUnlimited : Math.max(config.credits.freeSignup, 1000),
      isVerified: true,
      onboardingCompleted: true,
      authProvider: 'local',
    },
    { upsert: true, new: true },
  );

  console.log(`Admin ready: ${user.email} (${user.role}), credits: ${user.credits}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
