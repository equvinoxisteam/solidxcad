'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, Settings, Zap } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { clearToken, formatCredits } from '@/lib/api';
import { useClientUser } from '@/hooks/useClientUser';

function iconBtnClass(active = false) {
  return `flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors border ${
    active
      ? 'bg-brand/15 border-brand/40 text-white'
      : 'border-white/10 text-gray-300 hover:text-white hover:bg-white/5 hover:border-white/20'
  }`;
}

type NavbarProps = {
  /** Marketing pages hide credits, settings, and sign out. */
  variant?: 'marketing' | 'app';
};

export function Navbar({ variant = 'app' }: NavbarProps) {
  const pathname = usePathname();
  const { user, mounted, isAuthenticated } = useClientUser(variant === 'app');
  const onSettings = pathname === '/settings';
  const isMarketing = variant === 'marketing';

  function logout() {
    clearToken();
    window.location.href = '/';
  }

  return (
    <header className="h-14 border-b border-white/5 bg-[#071428]/80 backdrop-blur-md flex items-center justify-between px-4 sm:px-6 shrink-0">
      <BrandLogo
        href={!isMarketing && isAuthenticated ? '/dashboard' : '/'}
        size={34}
        nameClassName="font-semibold text-white hidden sm:inline"
      />

      <div className="flex items-center gap-2 sm:gap-3 min-h-[36px]">
        {!isMarketing && mounted && user && (
          <div className="flex items-center gap-2 text-xs sm:text-sm bg-brand/10 border border-brand/25 rounded-xl px-3 py-1.5">
            <Zap className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-blue-100 whitespace-nowrap">
              {formatCredits(user)} credits
            </span>
            {user.plan === 'pro' && (
              <span className="text-[10px] font-semibold uppercase bg-brand text-white px-1.5 py-0.5 rounded-md">
                Pro
              </span>
            )}
          </div>
        )}

        {mounted && isMarketing && (
          <>
            <Link
              href="/pricing"
              className="text-sm text-gray-400 hover:text-white px-2 hidden sm:inline"
            >
              Pricing
            </Link>
            {!isAuthenticated && (
              <>
                <Link href="/login" className="text-sm text-gray-400 hover:text-white px-2">
                  Sign in
                </Link>
                <Link href="/register" className="auth-btn-primary text-sm py-2 px-4">
                  Start free
                </Link>
              </>
            )}
          </>
        )}

        {!isMarketing && mounted && user && (
          <>
            <Link href="/settings" className={iconBtnClass(onSettings)} title="Settings">
              <Settings className="w-4 h-4 shrink-0" />
              <span className="hidden md:inline">Settings</span>
            </Link>
            <button
              type="button"
              onClick={logout}
              className={iconBtnClass()}
              title="Sign out"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className="hidden md:inline">Sign out</span>
            </button>
          </>
        )}

        {!isMarketing && mounted && !user && (
          <>
            <Link href="/login" className="text-sm text-gray-400 hover:text-white px-2">
              Sign in
            </Link>
            <Link href="/register" className="auth-btn-primary text-sm py-2 px-4">
              Start free
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
