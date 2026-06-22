'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';
import { OtpInput } from '@/components/auth/OtpInput';
import { api, setStoredUser, setToken } from '@/lib/api';
import { finishAuth } from '@/lib/auth';
import { sanitizeUserError } from '@/lib/userFacingErrors';

type Step = 'email' | 'otp' | 'password';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const stepNum = step === 'email' ? 1 : step === 'otp' ? 2 : 3;

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');
    try {
      const res = await api.sendOtp({ email, purpose: 'reset' });
      setInfo(res.devOtp ? `Dev code: ${res.devOtp}` : res.message || 'Reset code sent');
      setOtp('');
      setStep('otp');
    } catch (err) {
      setError(sanitizeUserError(err instanceof Error ? err.message : '', 'auth'));
    } finally {
      setLoading(false);
    }
  }

  async function resendOtp() {
    setLoading(true);
    setError('');
    try {
      const res = await api.sendOtp({ email, purpose: 'reset' });
      setInfo(res.devOtp ? `Dev code: ${res.devOtp}` : 'New code sent');
    } catch (err) {
      setError(sanitizeUserError(err instanceof Error ? err.message : '', 'auth'));
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
      await api.verifyOtp({ email, purpose: 'reset', code: otp });
      setInfo('');
      setStep('password');
    } catch (err) {
      setError(sanitizeUserError(err instanceof Error ? err.message : '', 'auth'));
    } finally {
      setLoading(false);
    }
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    setError('');

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
      const { token, user } = await api.resetPassword({ email, otp, password });
      setToken(token);
      setStoredUser(user);
      await finishAuth(router, user);
    } catch (err) {
      setError(sanitizeUserError(err instanceof Error ? err.message : '', 'auth'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title={
        step === 'email'
          ? 'Reset your password'
          : step === 'otp'
            ? 'Verify your email'
            : 'Set a new password'
      }
      subtitle={
        step === 'email'
          ? "We'll send a verification code to your email"
          : step === 'otp'
            ? `Enter the code sent to ${email}`
            : 'Choose a strong password for your account'
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

      {step === 'email' && (
        <form onSubmit={sendCode} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="reset-email" className="auth-label">
              Email address
            </label>
            <input
              id="reset-email"
              className="auth-input"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <button type="submit" className="auth-btn-primary w-full" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Send reset code'}
          </button>
        </form>
      )}

      {step === 'otp' && (
        <form onSubmit={verifyAndContinue} className="space-y-5">
          <OtpInput value={otp} onChange={setOtp} disabled={loading} />
          <button
            type="submit"
            className="auth-btn-primary w-full"
            disabled={loading || otp.length !== 6}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Verify code'}
          </button>
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              className="auth-back-link"
              onClick={() => {
                setStep('email');
                setOtp('');
                setError('');
              }}
            >
              <ArrowLeft className="w-4 h-4" aria-hidden />
              Change email
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

      {step === 'password' && (
        <form onSubmit={reset} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="new-password" className="auth-label">
              New password
            </label>
            <input
              id="new-password"
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
            <label htmlFor="confirm-new-password" className="auth-label">
              Confirm new password
            </label>
            <input
              id="confirm-new-password"
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
          <button type="submit" className="auth-btn-primary w-full" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Update password & sign in'}
          </button>
        </form>
      )}

      <Link href="/login" className="auth-back-link mt-7 pt-6 border-t border-border">
        <ArrowLeft className="w-4 h-4" aria-hidden />
        Back to sign in
      </Link>
    </AuthShell>
  );
}
