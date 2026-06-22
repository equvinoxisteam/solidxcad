'use client';

import type { ProjectFile } from '@/lib/api';

export type ViewerReferenceSelection = {
  id: string;
  label: string;
  copyText?: string;
};

export type ViewerSelectionContext = {
  stepFile?: string;
  fileName?: string;
  kind?: string;
  selectedParts?: string[];
  selectedReferenceIds?: string[];
  selectedReferences?: ViewerReferenceSelection[];
};

export function buildSelectionContextText(ctx: ViewerSelectionContext | null | undefined): string {
  if (!ctx?.stepFile && !ctx?.fileName && !ctx?.selectedReferences?.length) return '';
  const parts: string[] = [];
  if (ctx.fileName || ctx.stepFile) {
    parts.push(`Active file: ${ctx.fileName || ctx.stepFile}`);
  }
  if (ctx.kind) parts.push(`Kind: ${ctx.kind}`);
  if (ctx.selectedParts?.length) {
    parts.push(`Selected parts: ${ctx.selectedParts.slice(0, 8).join(', ')}`);
  }
  if (ctx.selectedReferences?.length) {
    const labels = ctx.selectedReferences
      .map((ref) => ref.label || ref.id)
      .filter(Boolean)
      .slice(0, 8);
    if (labels.length) {
      parts.push(`Selected geometry: ${labels.join(', ')}`);
    }
    const tokens = ctx.selectedReferences
      .map((ref) => String(ref.copyText || '').trim())
      .filter(Boolean)
      .slice(0, 4);
    if (tokens.length) {
      parts.push(`CAD refs: ${tokens.join('; ')}`);
    }
  } else if (ctx.selectedReferenceIds?.length) {
    parts.push(`Selected references: ${ctx.selectedReferenceIds.slice(0, 8).join(', ')}`);
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
  const refBase = ref.split('/').pop() || ref;
  const match = files.find((f) => {
    if (name && f.name === name) return true;
    if (refBase && f.name === refBase) return true;
    if (ref && (f.name === ref || ref.endsWith(`/${f.name}`))) return true;
    if (name && ref && f.name.replace(/\.[^.]+$/, '') === name.replace(/\.[^.]+$/, '')) return true;
    return false;
  });
  return match?._id || '';
}
