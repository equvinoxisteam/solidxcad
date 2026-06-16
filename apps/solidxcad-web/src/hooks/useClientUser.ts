'use client';

import { useEffect, useState } from 'react';
import {
  api,
  clearToken,
  getStoredUser,
  getToken,
  setStoredUser,
  type User,
} from '@/lib/api';

/** Load user from localStorage after mount — avoids SSR hydration mismatch. */
export function useClientUser(refreshFromApi = false) {
  const [user, setUser] = useState<User | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const token = getToken();
    if (!token) {
      setUser(null);
      return;
    }

    setUser(getStoredUser());

    if (refreshFromApi) {
      api.me()
        .then(({ user: u }) => {
          setUser(u);
          setStoredUser(u);
        })
        .catch(() => {
          clearToken();
          setUser(null);
        });
    }
  }, [refreshFromApi]);

  return { user, mounted, isAuthenticated: mounted && Boolean(getToken()) };
}
