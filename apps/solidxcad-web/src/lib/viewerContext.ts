'use client';

import type { ProjectFile } from '@/lib/api';

export type ViewerSelectionContext = {
  stepFile?: string;
  fileName?: string;
  kind?: string;
  selectedParts?: string[];
};

export function buildSelectionContextText(ctx: ViewerSelectionContext | null | undefined): string {
  if (!ctx?.stepFile && !ctx?.fileName) return '';
  const parts: string[] = [];
  if (ctx.fileName || ctx.stepFile) {
    parts.push(`Active file: ${ctx.fileName || ctx.stepFile}`);
  }
  if (ctx.kind) parts.push(`Kind: ${ctx.kind}`);
  if (ctx.selectedParts?.length) {
    parts.push(`Selected parts/faces: ${ctx.selectedParts.slice(0, 8).join(', ')}`);
  }
  return parts.join('\n');
}

export function resolveViewerFileId(
  files: ProjectFile[],
  ctx: ViewerSelectionContext | null | undefined,
): string {
  if (!ctx) return '';
  const name = String(ctx.fileName || '').trim();
  const ref = String(ctx.stepFile || '').trim();
  const match = files.find((f) => {
    if (name && f.name === name) return true;
    if (ref && (f.name === ref || ref.endsWith(`/${f.name}`))) return true;
    return false;
  });
  return match?._id || '';
}
