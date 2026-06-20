'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { OtpInput } from '@/components/auth/OtpInput';
import { api, setStoredUser, setToken } from '@/lib/api';
import { finishAuth } from '@/lib/auth';

type Step = 'credentials' | 'otp' | 'profile';

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const stepNum = step === 'credentials' ? 1 : step === 'otp' ? 2 : 3;

  async function continueToOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await api.sendOtp({ email, purpose: 'signup' });
      setInfo(res.devOtp ? `Dev code: ${res.devOtp}` : res.message || 'Verification code sent');
      setOtp('');
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send verification code');
    } finally {
      setLoading(false);
    }
  }

  async function resendOtp() {
    setLoading(true);
    setError('');
    try {
      const res = await api.sendOtp({ email, purpose: 'signup' });
      setInfo(res.devOtp ? `Dev code: ${res.devOtp}` : 'New code sent to your email');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend code');
    } finally {
      setLoading(false);
    }
  }

  async function verifyAndContinue(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) {
      setError('Enter the 6-digit code');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await api.verifyOtp({ email, purpose: 'signup', code: otp });
      setInfo('');
      setStep('profile');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  }

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Enter your name');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { token, user } = await api.register({
        name: name.trim(),
        email,
        password,
        otp,
      });
      setToken(token);
      setStoredUser(user);
      await finishAuth(router, user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title={
        step === 'credentials'
          ? 'Create your account'
          : step === 'otp'
            ? 'Verify your email'
            : 'Complete your profile'
      }
      subtitle={
        step === 'credentials'
          ? 'Set your email and password — free credits, no card required'
          : step === 'otp'
            ? `Enter the 6-digit code sent to ${email}`
            : 'One last step before your design studio opens'
      }
      step={stepNum}
      totalSteps={3}
    >
      {error && (
        <div
          role="alert"
          className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 mb-5"
        >
          {error}
        </div>
      )}
      {info && (
        <div className="text-sm text-brand bg-brand/5 border border-brand/20 rounded-lg px-3.5 py-2.5 mb-5">
          {info}
        </div>
      )}

      {step === 'credentials' && (
        <>
          <div className="auth-oauth-wrap mb-5">
            <GoogleSignInButton disabled={loading} onError={setError} />
          </div>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] text-gray-500 uppercase tracking-[0.14em] font-medium">
              or email
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={continueToOtp} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="register-email" className="auth-label">
                Email address
              </label>
              <input
                id="register-email"
                className="auth-input"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="register-password" className="auth-label">
                Password
              </label>
              <input
                id="register-password"
                className="auth-input"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="register-confirm" className="auth-label">
                Confirm password
              </label>
              <input
                id="register-confirm"
                className="auth-input"
                type="password"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <button type="submit" className="auth-btn-primary w-full mt-1" disabled={loading}>
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : (
                'Continue to verification'
              )}
            </button>
          </form>
        </>
      )}

      {step === 'otp' && (
        <form onSubmit={verifyAndContinue} className="space-y-5">
          <OtpInput value={otp} onChange={setOtp} disabled={loading} />
          <button
            type="submit"
            className="auth-btn-primary w-full"
            disabled={loading || otp.length !== 6}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mx-auto" />
            ) : (
              'Verify and continue'
            )}
          </button>
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1"
              onClick={() => {
                setStep('credentials');
                setOtp('');
                setError('');
              }}
            >
              <ArrowLeft className="w-3 h-3" /> Change email
            </button>
            <button
              type="button"
              className="text-xs text-brand hover:underline"
              onClick={resendOtp}
              disabled={loading}
            >
              Resend code
            </button>
          </div>
        </form>
      )}

      {step === 'profile' && (
        <form onSubmit={createAccount} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="register-name" className="auth-label">
              Full name
            </label>
            <input
              id="register-name"
              className="auth-input"
              placeholder="How should we address you?"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              autoFocus
            />
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            Signed in as <span className="text-gray-900 font-medium">{email}</span>. You can update your profile
            later in settings.
          </p>
          <button type="submit" className="auth-btn-primary w-full" disabled={loading}>
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mx-auto" />
            ) : (
              'Open design studio'
            )}
          </button>
        </form>
      )}

      <p className="text-sm text-gray-600 text-center mt-7 pt-6 border-t border-border">
        Have an account?{' '}
        <Link href="/login" className="text-brand hover:text-brand-hover font-medium transition-colors">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
