import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String },
    googleId: { type: String, sparse: true, unique: true },
    authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    plan: { type: String, enum: ['free', 'pro'], default: 'free' },
    credits: { type: Number, default: 0 },
    razorpayCustomerId: String,
    isVerified: { type: Boolean, default: false },
    onboardingCompleted: { type: Boolean, default: false },
    onboarding: {
      useCase: { type: String, trim: true },
      experience: { type: String, trim: true },
      goal: { type: String, trim: true },
    },
    avatarUrl: String,
    phone: { type: String, trim: true },
  },
  { timestamps: true },
);

export const User = mongoose.model('User', userSchema);
