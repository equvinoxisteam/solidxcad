'use client';

import { useEffect, useState } from 'react';
import { api, getStoredUser, setStoredUser, type User } from '@/lib/api';

/** Load user from localStorage after mount — avoids SSR hydration mismatch. */
export function useClientUser(refreshFromApi = false) {
  const [user, setUser] = useState<User | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setUser(getStoredUser());

    if (refreshFromApi && getStoredUser()) {
      api.me()
        .then(({ user: u }) => {
          setUser(u);
          setStoredUser(u);
        })
        .catch(() => {});
    }
  }, [refreshFromApi]);

  return { user, mounted };
}
