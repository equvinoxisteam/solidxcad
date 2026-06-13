'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';
import { OtpInput } from '@/components/auth/OtpInput';
import { api, setStoredUser, setToken } from '@/lib/api';
import { finishAuth } from '@/lib/auth';

type Step = 'email' | 'otp' | 'password';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const stepNum = step === 'email' ? 1 : step === 'otp' ? 2 : 3;

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.sendOtp({ email, purpose: 'reset' });
      setInfo(res.devOtp ? `Dev code: ${res.devOtp}` : res.message);
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send code');
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
      setError(err instanceof Error ? err.message : 'Could not resend code');
    } finally {
      setLoading(false);
    }
  }

  function continueAfterOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) {
      setError('Enter the 6-digit code');
      return;
    }
    setError('');
    setStep('password');
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { token, user } = await api.resetPassword({ email, otp, password });
      setToken(token);
      setStoredUser(user);
      await finishAuth(router, user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Reset password"
      subtitle={step === 'email' ? "We'll email you a verification code" : `Code sent to ${email}`}
      step={stepNum}
      totalSteps={3}
    >
      {error && (
        <div className="text-sm text-red-300 bg-red-500/10 border border-red-400/30 rounded-xl p-3 mb-4">{error}</div>
      )}
      {info && step !== 'password' && (
        <div className="text-sm text-blue-200 bg-brand/10 border border-brand/30 rounded-xl p-3 mb-4">{info}</div>
      )}

      {step === 'email' && (
        <form onSubmit={sendCode} className="space-y-4">
          <input
            className="auth-input"
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button type="submit" className="auth-btn-primary w-full" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Send reset code'}
          </button>
        </form>
      )}

      {step === 'otp' && (
        <form onSubmit={continueAfterOtp} className="space-y-5">
          <OtpInput value={otp} onChange={setOtp} disabled={loading} />
          <button type="submit" className="auth-btn-primary w-full" disabled={loading || otp.length !== 6}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Verify code'}
          </button>
          <button type="button" className="text-xs text-brand hover:underline" onClick={resendOtp} disabled={loading}>
            Resend code
          </button>
        </form>
      )}

      {step === 'password' && (
        <form onSubmit={reset} className="space-y-4">
          <input
            className="auth-input"
            type="password"
            placeholder="New password (8+ characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
          <button type="submit" className="auth-btn-primary w-full" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Set new password'}
          </button>
        </form>
      )}

      <Link href="/login" className="text-xs text-gray-400 hover:text-white flex items-center gap-1 mt-6">
        <ArrowLeft className="w-3 h-3" /> Back to sign in
      </Link>
    </AuthShell>
  );
}
