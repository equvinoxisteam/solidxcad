'use client';

import type { ReactNode } from 'react';
import { Box, Layers, Sparkles } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';

type AuthShellProps = {
  children: ReactNode;
  title: string;
  subtitle?: string;
  step?: number;
  totalSteps?: number;
};

const FEATURES = [
  { icon: Sparkles, text: 'Describe parts in plain language — AI builds STEP, STL, and GLB' },
  { icon: Layers, text: 'Assemblies, URDF robots, and catalog fasteners in one workspace' },
  { icon: Box, text: 'Integrated CAD workbench and mesh preview' },
];

export function AuthShell({
  children,
  title,
  subtitle,
  step = 0,
  totalSteps = 0,
}: AuthShellProps) {
  const progress = totalSteps > 0 ? Math.round((step / totalSteps) * 100) : 0;

  return (
    <div className="auth-scene min-h-screen flex flex-col lg:flex-row relative overflow-hidden">
      <div className="auth-bg auth-bg-form" aria-hidden />
      <div className="auth-grid auth-grid-form" aria-hidden />

      <aside className="hidden lg:flex lg:w-[min(420px,40%)] xl:w-[44%] shrink-0 flex-col justify-between border-r border-white/[0.06] bg-[#050f1c]/90 px-10 xl:px-12 py-10 relative z-10">
        <div className="auth-panel-glow pointer-events-none" aria-hidden />
        <div>
          <BrandLogo href="/" size={44} />
          <div className="mt-12 max-w-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-muted mb-3">
              Design studio
            </p>
            <h2 className="text-[1.65rem] font-semibold text-white leading-snug tracking-tight">
              Natural language turned into production-ready CAD
            </h2>
            <p className="text-sm text-gray-400 mt-3 leading-relaxed">
              Sign in to create projects, generate models, and export manufacturing files from one workspace.
            </p>
          </div>
          <ul className="mt-10 space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-3 text-sm text-gray-400 leading-snug">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
                  <Icon className="h-3.5 w-3.5 text-brand-muted" aria-hidden />
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[11px] text-gray-600">SolidX CAD · equvinoxis</p>
      </aside>

      <div className="relative z-10 flex flex-1 flex-col min-h-screen">
        <header className="px-5 sm:px-8 py-5 lg:hidden">
          <BrandLogo href="/" size={36} />
        </header>

        <main className="flex-1 flex items-center justify-center px-5 sm:px-8 pb-6">
          <div className="w-full max-w-[400px]">
            {totalSteps > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between text-[11px] text-gray-500 mb-2">
                  <span>Step {step} of {totalSteps}</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1 rounded-full bg-white/[0.08] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="auth-panel rounded-2xl border border-white/[0.08] bg-[#0a1628]/95 backdrop-blur-xl p-7 sm:p-8">
              <div className="mb-7">
                <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">{title}</h1>
                {subtitle && (
                  <p className="text-sm text-gray-400 mt-1.5 leading-relaxed">{subtitle}</p>
                )}
              </div>
              {children}
            </div>
          </div>
        </main>

        <footer className="text-center text-[11px] text-gray-600 pb-6 px-4">
          SolidX CAD · Natural language turned into CAD
        </footer>
      </div>
    </div>
  );
}
