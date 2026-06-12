import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { api, setStoredUser, type User } from './api';

export function postAuthPath(user: User): string {
  return user.onboardingCompleted ? '/dashboard' : '/onboarding';
}

export async function finishAuth(router: AppRouterInstance, user?: User) {
  const resolved = user || (await api.me()).user;
  setStoredUser(resolved);
  router.push(postAuthPath(resolved));
}

export const DIRECT_API_URL =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000')
    : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000');
