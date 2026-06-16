'use client';

import { useEffect, useState } from 'react';

type GoogleConfig = {
  googleEnabled?: boolean;
  googleClientId?: string | null;
};

const ENV_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const GOOGLE_AUTH_PATH = '/api/auth/google';

async function fetchGoogleConfig(): Promise<GoogleConfig> {
  const res = await fetch('/api/auth/config', { cache: 'no-store' });
  if (!res.ok) throw new Error('Google config unavailable');
  return res.json();
}

function isGoogleAvailable(config: GoogleConfig | null) {
  return Boolean(config?.googleEnabled || config?.googleClientId || ENV_CLIENT_ID);
}

export function GoogleSignInButton({
  disabled,
}: {
  disabled?: boolean;
  onError?: (message: string) => void;
}) {
  const [available, setAvailable] = useState<boolean>(() => Boolean(ENV_CLIENT_ID));
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const data = await fetchGoogleConfig();
          if (!cancelled) {
            setAvailable(isGoogleAvailable(data));
            setChecked(true);
          }
          return;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
        }
      }

      if (!cancelled) {
        setAvailable(Boolean(ENV_CLIENT_ID));
        setChecked(true);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (checked && !available) {
    return null;
  }

  return (
    <a
      href={GOOGLE_AUTH_PATH}
      className={`auth-google-fallback ${disabled ? 'pointer-events-none opacity-60' : ''}`}
      aria-label="Continue with Google"
    >
      <GoogleGlyph />
      <span>Continue with Google</span>
    </a>
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
