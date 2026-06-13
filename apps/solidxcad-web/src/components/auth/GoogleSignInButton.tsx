'use client';

import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, setStoredUser, setToken } from '@/lib/api';
import { finishAuth } from '@/lib/auth';

type GoogleConfig = {
  googleEnabled?: boolean;
  googleClientId?: string | null;
  googleAuthUrl?: string | null;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: { theme?: string; size?: string; width?: number; text?: string },
          ) => void;
        };
      };
    };
  }
}

export function GoogleSignInButton({
  disabled,
  onError,
}: {
  disabled?: boolean;
  onError?: (message: string) => void;
}) {
  const router = useRouter();
  const btnRef = useRef<HTMLDivElement>(null);
  const [config, setConfig] = useState<GoogleConfig | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/config')
      .then((r) => r.json())
      .then((data: GoogleConfig) => setConfig(data))
      .catch(() => setConfig({ googleEnabled: false }));
  }, []);

  const clientId =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || config?.googleClientId || '';

  const handleCredential = useCallback(async (response: { credential: string }) => {
    setLoading(true);
    try {
      const { token, user } = await api.googleVerify(response.credential);
      setToken(token);
      setStoredUser(user);
      await finishAuth(router, user);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed';
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  }, [router, onError]);

  useEffect(() => {
    if (!scriptReady || !clientId || !btnRef.current || !window.google?.accounts?.id) return;

    btnRef.current.innerHTML = '';
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredential,
    });
    window.google.accounts.id.renderButton(btnRef.current, {
      theme: 'filled_black',
      size: 'large',
      width: Math.min(btnRef.current.offsetWidth || 380, 400),
      text: 'continue_with',
    });
  }, [scriptReady, clientId, handleCredential]);

  if (!config) {
    return (
      <div className="h-11 rounded-lg bg-white/[0.04] border border-white/[0.06] animate-pulse" />
    );
  }

  if (!config.googleEnabled || !clientId) {
    return (
      <p className="text-xs text-gray-500 text-center py-2">
        Google sign-in: add <code className="text-gray-400">GOOGLE_CLIENT_ID</code> to API .env
      </p>
    );
  }

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
      <div className={disabled || loading ? 'opacity-50 pointer-events-none' : ''}>
        <div ref={btnRef} className="flex justify-center min-h-[44px] w-full [&>div]:!w-full" />
      </div>
      {config.googleAuthUrl && (
        <p className="text-[10px] text-gray-500 text-center mt-2">
          Trouble with the button?{' '}
          <a href={config.googleAuthUrl} className="text-brand hover:underline">
            Open Google sign-in
          </a>
        </p>
      )}
    </>
  );
}
