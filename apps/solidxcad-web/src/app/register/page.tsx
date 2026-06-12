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

type Step = 'email' | 'otp' | 'profile';

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const stepNum = step === 'email' ? 1 : step === 'otp' ? 2 : 3;

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');
    try {
      const res = await api.sendOtp({ email, purpose: 'signup' });
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
      const res = await api.sendOtp({ email, purpose: 'signup' });
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
    setStep('profile');
  }

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { token, user } = await api.register({ name, email, password, otp });
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
      title={step === 'email' ? 'Start your CAD quest' : step === 'otp' ? 'Verify email' : 'Create your profile'}
      subtitle={
        step === 'email'
          ? 'Free credits · no card required'
          : step === 'otp'
            ? `Code sent to ${email}`
            : 'Almost there — tell us your name'
      }
      step={stepNum}
      totalSteps={3}
      badge="New player"
    >
      {error && (
        <div className="text-sm text-red-300 bg-red-500/10 border border-red-400/30 rounded-xl p-3 mb-4">{error}</div>
      )}
      {info && (
        <div className="text-sm text-blue-200 bg-brand/10 border border-brand/30 rounded-xl p-3 mb-4">{info}</div>
      )}

      {step === 'email' && (
        <>
          <GoogleSignInButton disabled={loading} onError={setError} />
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[11px] text-gray-500 uppercase tracking-wider">or email</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>
          <form onSubmit={sendOtp} className="space-y-4">
            <input
              className="auth-input"
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <button type="submit" className="auth-btn-primary w-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Send verification code'}
            </button>
          </form>
        </>
      )}

      {step === 'otp' && (
        <form onSubmit={continueAfterOtp} className="space-y-5">
          <OtpInput value={otp} onChange={setOtp} disabled={loading} />
          <button type="submit" className="auth-btn-primary w-full" disabled={loading || otp.length !== 6}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Verify code'}
          </button>
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
              onClick={() => { setStep('email'); setOtp(''); }}
            >
              <ArrowLeft className="w-3 h-3" /> Change email
            </button>
            <button type="button" className="text-xs text-brand hover:underline" onClick={resendOtp} disabled={loading}>
              Resend code
            </button>
          </div>
        </form>
      )}

      {step === 'profile' && (
        <form onSubmit={createAccount} className="space-y-4">
          <input
            className="auth-input"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
          <input
            className="auth-input"
            type="password"
            placeholder="Password (8+ characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
          <button type="submit" className="auth-btn-primary w-full" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Complete signup'}
          </button>
        </form>
      )}

      <p className="text-sm text-gray-400 text-center mt-6">
        Have an account?{' '}
        <Link href="/login" className="text-brand hover:underline font-medium">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
