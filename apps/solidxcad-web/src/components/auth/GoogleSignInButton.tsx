'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api, setStoredUser, setToken } from '@/lib/api';
import { finishAuth } from '@/lib/auth';
import { isGoogleIdentityReady, loadGoogleIdentityScript } from '@/lib/googleAuth';

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
            options: { theme?: string; size?: string; width?: number; text?: string; shape?: string },
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
  const [scriptReady, setScriptReady] = useState(isGoogleIdentityReady());
  const [buttonReady, setButtonReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/config')
      .then((r) => r.json())
      .then((data: GoogleConfig) => setConfig(data))
      .catch(() => setConfig({ googleEnabled: false }));
  }, []);

  const clientId =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || config?.googleClientId || '';

  const handleCredential = useCallback(
    async (response: { credential: string }) => {
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
    },
    [router, onError],
  );

  useEffect(() => {
    if (!clientId || !config?.googleEnabled) return;

    let cancelled = false;

    loadGoogleIdentityScript()
      .then(() => {
        if (!cancelled) setScriptReady(true);
      })
      .catch(() => {
        if (!cancelled) onError?.('Could not load Google Sign-In. Use the link below or email sign-in.');
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, config?.googleEnabled, onError]);

  useEffect(() => {
    if (!scriptReady || !clientId || !btnRef.current || !window.google?.accounts?.id) return;

    const container = btnRef.current;
    let raf = 0;

    const render = () => {
      if (!container || !window.google?.accounts?.id) return;
      container.innerHTML = '';
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredential,
      });
      const width = Math.max(container.offsetWidth || container.parentElement?.offsetWidth || 360, 280);
      window.google.accounts.id.renderButton(container, {
        theme: 'filled_black',
        size: 'large',
        width: Math.min(width, 400),
        text: 'continue_with',
        shape: 'rectangular',
      });
      setButtonReady(true);
    };

    raf = requestAnimationFrame(render);

    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(render);
    });
    observer.observe(container);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [scriptReady, clientId, handleCredential]);

  if (!config) {
    return (
      <div className="h-11 rounded-lg bg-white/[0.04] border border-white/[0.06] animate-pulse" />
    );
  }

  if (!config.googleEnabled || !clientId) {
    return (
      <p className="text-xs text-gray-500 text-center py-2">
        Google sign-in is not configured on this server.
      </p>
    );
  }

  const showFallback = !buttonReady || loading;

  return (
    <div className={disabled || loading ? 'opacity-60 pointer-events-none' : ''}>
      <div className="relative min-h-[44px] w-full">
        <div
          ref={btnRef}
          className={`flex justify-center w-full [&>div]:!w-full ${showFallback ? 'invisible absolute inset-0' : ''}`}
        />
        {showFallback && (
          <div className="w-full">
            {config.googleAuthUrl ? (
              <a
                href={config.googleAuthUrl}
                className="auth-google-fallback"
                aria-label="Continue with Google"
              >
                <GoogleGlyph />
                <span>Continue with Google</span>
              </a>
            ) : (
              <div className="auth-google-fallback cursor-wait">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                <span>Loading Google Sign-In…</span>
              </div>
            )}
          </div>
        )}
      </div>
      {config.googleAuthUrl && buttonReady && (
        <p className="text-[10px] text-gray-500 text-center mt-2">
          Trouble with the button?{' '}
          <a href={config.googleAuthUrl} className="text-brand hover:underline">
            Open Google sign-in
          </a>
        </p>
      )}
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}
