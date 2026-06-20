'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, Box, Layers, Sparkles } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';

type AuthShellProps = {
  children: ReactNode;
  title: string;
  subtitle?: string;
  step?: number;
  totalSteps?: number;
};

const FEATURES = [
  { icon: Sparkles, text: 'Text-to-STEP: parametric B-rep models from engineering descriptions' },
  { icon: Layers, text: 'Assemblies with catalog fasteners, URDF robots, and multi-body structure' },
  { icon: Box, text: 'In-browser CAD workbench: orbit, measure, section, and export' },
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

      <aside className="auth-aside hidden lg:flex shrink-0 flex-col justify-between relative z-10">
        <div>
          <BrandLogo href="/" size={40} />
          <div className="mt-8 max-w-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand mb-3">
              Cloud CAD workbench
            </p>
            <h2 className="text-2xl font-semibold text-gray-900 leading-snug tracking-tight">
              From prompt to STEP in one engineering workspace
            </h2>
            <p className="text-sm text-gray-600 mt-3 leading-relaxed">
              Sign in to generate parametric geometry, inspect assemblies in 3D, and export STL, G-code, and URDF.
            </p>
          </div>
          <ul className="mt-8 space-y-3.5">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-3 text-sm text-gray-600 leading-snug">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-brand/5">
                  <Icon className="h-3.5 w-3.5 text-brand" aria-hidden />
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[11px] text-gray-500">Powered by Equvinoxis Technologies</p>
      </aside>

      <div className="relative z-10 flex flex-1 flex-col min-h-screen min-w-0">
        <header className="auth-mobile-header lg:hidden">
          <BrandLogo href="/" size={36} />
          <Link href="/" className="auth-back-link">
            <ArrowLeft className="w-4 h-4" aria-hidden />
            Home
          </Link>
        </header>

        <main className="flex-1 flex items-center justify-center px-4 sm:px-6 pb-6">
          <div className="w-full max-w-[420px]">
            <Link href="/" className="auth-back-link hidden lg:inline-flex mb-5">
              <ArrowLeft className="w-4 h-4" aria-hidden />
              Back to home
            </Link>

            {totalSteps > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between text-[11px] text-gray-500 mb-2">
                  <span>Step {step} of {totalSteps}</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="auth-panel rounded-2xl border border-border bg-white p-6 sm:p-8">
              <div className="mb-6">
                <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-tight">{title}</h1>
                {subtitle && (
                  <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">{subtitle}</p>
                )}
              </div>
              {children}
            </div>
          </div>
        </main>

        <footer className="auth-page-footer">
          <span>SolidX CAD · Prompt to STEP in the browser</span>
          <span className="auth-page-footer-dot" aria-hidden>
            ·
          </span>
          <span>Powered by Equvinoxis Technologies</span>
        </footer>
      </div>
    </div>
  );
}
