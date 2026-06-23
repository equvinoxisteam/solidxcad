'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { subscribeAgentRun, type AgentRunSnapshot } from '@/lib/agentRunner';

export function AgentBackgroundBanner() {
  const [run, setRun] = useState<AgentRunSnapshot | null>(null);

  useEffect(() => subscribeAgentRun(setRun), []);

  if (!run?.streaming) return null;

  return (
    <div className="agent-background-banner" role="status">
      <Loader2 className="w-4 h-4 animate-spin shrink-0 text-brand" aria-hidden />
      <p className="agent-background-banner-text">
        Agent building in background
        {run.workingStatus ? ` — ${run.workingStatus}` : '…'}
      </p>
      <Link href={`/projects/${run.projectId}`} className="agent-background-banner-link">
        Open project
      </Link>
    </div>
  );
}
