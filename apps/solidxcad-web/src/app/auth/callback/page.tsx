'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { api, setToken } from '@/lib/api';
import { finishAuth, postAuthPath } from '@/lib/auth';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const next = searchParams.get('next');
    if (!token) {
      router.replace('/login?error=google_failed');
      return;
    }
    setToken(token);
    api.me()
      .then(({ user }) => {
        if (next === 'dashboard' || next === 'onboarding') {
          router.replace(postAuthPath(user));
          return;
        }
        finishAuth(router, user);
      })
      .catch(() => router.replace('/login?error=google_failed'));
  }, [router, searchParams]);

  return (
    <div className="auth-scene min-h-screen flex flex-col items-center justify-center gap-4">
      <Loader2 className="w-10 h-10 animate-spin text-brand" />
      <p className="text-gray-400 text-sm">Signing you in…</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="auth-scene min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}
