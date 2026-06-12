'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { api, getToken, setStoredUser, setToken } from '@/lib/api';
import { finishAuth } from '@/lib/auth';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getToken()) {
      api.me()
        .then(({ user }) => finishAuth(router, user))
        .catch(() => {});
    }
    const err = searchParams.get('error');
    if (err === 'google_denied') setError('Google sign-in was cancelled');
    else if (err === 'google_redirect') {
      setError(
        'Google redirect URI mismatch. In Google Cloud Console add: http://localhost:4000/api/auth/google/callback',
      );
    } else if (err === 'google_failed') {
      setError('Google sign-in failed. Check GOOGLE_CLIENT_ID in API .env or use email sign-in.');
    }
  }, [router, searchParams]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { token, user } = await api.login({ email, password });
      setToken(token);
      setStoredUser(user);
      await finishAuth(router, user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your design studio" badge="Quest: Enter Studio">
      {error && (
        <div className="text-sm text-red-300 bg-red-500/10 border border-red-400/30 rounded-xl p-3 mb-4">
          {error}
        </div>
      )}

      <GoogleSignInButton disabled={loading} onError={setError} />

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-[11px] text-gray-500 uppercase tracking-wider">or email</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      <form onSubmit={submit} className="space-y-4">
        <input
          className="auth-input"
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <input
          className="auth-input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-xs text-brand hover:underline">
            Forgot password?
          </Link>
        </div>
        <button type="submit" className="auth-btn-primary w-full" disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Sign in'}
        </button>
      </form>

      <p className="text-sm text-gray-400 text-center mt-6">
        New here?{' '}
        <Link href="/register" className="text-brand hover:underline font-medium">
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
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
