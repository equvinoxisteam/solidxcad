'use client';

import { AgentBackgroundBanner } from '@/components/AgentBackgroundBanner';

export function AppChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AgentBackgroundBanner />
      {children}
    </>
  );
}
