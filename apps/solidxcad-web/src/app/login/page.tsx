'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { api, ApiError, clearToken, setStoredUser, setToken } from '@/lib/api';
import { finishAuth } from '@/lib/auth';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [googleHint, setGoogleHint] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fresh = searchParams.get('fresh') === '1';
    if (fresh) {
      clearToken();
      return;
    }

    const err = searchParams.get('error');
    if (err === 'google_denied') setError('Google sign-in was cancelled');
    else if (err === 'google_redirect') {
      setError('Google redirect is misconfigured. Check GOOGLE_CLIENT_ID and callback URL in Google Cloud.');
    } else if (err === 'google_failed') {
      setError('Google sign-in failed. Try again or use email sign-in.');
    }
  }, [searchParams]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setGoogleHint(false);
    try {
      const { token, user } = await api.login({ email, password });
      setToken(token);
      setStoredUser(user);
      await finishAuth(router, user);
    } catch (err) {
      if (err instanceof ApiError && err.googleRequired) {
        setGoogleHint(true);
        setError('This account uses Google sign-in. Continue with Google below.');
      } else {
        setError(err instanceof Error ? err.message : 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your cloud CAD workbench">
      {error && (
        <div
          role="alert"
          className={`text-sm rounded-lg px-3.5 py-2.5 mb-5 border ${
            googleHint
              ? 'text-amber-100 bg-amber-500/10 border-amber-400/25'
              : 'text-red-200 bg-red-500/10 border-red-400/25'
          }`}
        >
          {error}
        </div>
      )}

      <div className={`auth-oauth-wrap ${googleHint ? 'ring-1 ring-amber-400/30 rounded-xl' : ''}`}>
        <GoogleSignInButton disabled={loading} onError={setError} />
      </div>

      <div className="flex items-center gap-3 my-6">
        <div className="flex-1 h-px bg-white/[0.08]" />
        <span className="text-[10px] text-gray-500 uppercase tracking-[0.14em] font-medium">or email</span>
        <div className="flex-1 h-px bg-white/[0.08]" />
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="login-email" className="auth-label">
            Email address
          </label>
          <input
            id="login-email"
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
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="login-password" className="auth-label">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-[11px] text-brand-muted hover:text-white transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="login-password"
            className="auth-input"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        <button type="submit" className="auth-btn-primary w-full mt-2" disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Sign in'}
        </button>
      </form>

      <p className="text-sm text-gray-500 text-center mt-7 pt-6 border-t border-white/[0.06]">
        New here?{' '}
        <Link href="/register" className="text-white hover:text-brand-muted font-medium transition-colors">
          Create free account
        </Link>
      </p>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="auth-scene min-h-screen flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-brand" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
