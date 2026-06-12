'use client';

import type { ReactNode } from 'react';
import { BrandLogo } from '@/components/BrandLogo';

type AuthShellProps = {
  children: ReactNode;
  title: string;
  subtitle?: string;
  step?: number;
  totalSteps?: number;
  badge?: string;
};

export function AuthShell({
  children,
  title,
  subtitle,
  step = 0,
  totalSteps = 0,
  badge,
}: AuthShellProps) {
  const progress = totalSteps > 0 ? Math.round((step / totalSteps) * 100) : 0;

  return (
    <div className="auth-scene min-h-screen flex flex-col relative overflow-hidden">
      <div className="auth-bg" aria-hidden />
      <div className="auth-grid" aria-hidden />
      <div className="auth-orb auth-orb-a" aria-hidden />
      <div className="auth-orb auth-orb-b" aria-hidden />
      <div className="auth-orb auth-orb-c" aria-hidden />

      <header className="relative z-10 px-6 py-5 flex items-center justify-between">
        <BrandLogo href="/" size={40} />
        {badge && (
          <span className="text-[11px] font-medium px-3 py-1 rounded-full bg-brand/20 text-blue-200 border border-brand/30">
            {badge}
          </span>
        )}
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {totalSteps > 0 && (
            <div className="mb-5">
              <div className="flex items-center justify-between text-[11px] text-blue-200/80 mb-2">
                <span>Level {step} of {totalSteps}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand to-brand-light transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="auth-card rounded-2xl border border-white/10 bg-[#0a1628]/90 backdrop-blur-xl shadow-2xl p-8">
            <h1 className="text-2xl font-bold text-white mb-1">{title}</h1>
            {subtitle && <p className="text-sm text-gray-400 mb-6">{subtitle}</p>}
            {!subtitle && <div className="mb-6" />}
            {children}
          </div>
        </div>
      </main>

      <footer className="relative z-10 text-center text-[11px] text-gray-500 pb-6">
        SolidX CAD · Natural language turned into CAD
      </footer>
    </div>
  );
}
