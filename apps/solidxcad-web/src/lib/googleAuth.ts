let gsiLoadPromise: Promise<void> | null = null;

export function isGoogleIdentityReady(): boolean {
  return typeof window !== 'undefined' && Boolean(window.google?.accounts?.id);
}

/** Load Google Identity Services once; safe across client navigations. */
export function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (isGoogleIdentityReady()) return Promise.resolve();
  if (gsiLoadPromise) return gsiLoadPromise;

  gsiLoadPromise = new Promise((resolve, reject) => {
    const finish = () => {
      if (isGoogleIdentityReady()) resolve();
      else reject(new Error('Google Sign-In failed to initialize'));
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src*="accounts.google.com/gsi/client"]',
    );

    if (existing) {
      if (existing.dataset.loaded === 'true') {
        finish();
        return;
      }
      existing.addEventListener('load', finish, { once: true });
      existing.addEventListener('error', () => reject(new Error('Google Sign-In script error')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      script.dataset.loaded = 'true';
      finish();
    };
    script.onerror = () => reject(new Error('Google Sign-In script error'));
    document.head.appendChild(script);
  });

  return gsiLoadPromise;
}
