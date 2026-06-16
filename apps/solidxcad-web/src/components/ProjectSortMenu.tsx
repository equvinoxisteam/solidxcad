'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUpDown, Check, ChevronDown } from 'lucide-react';

export type ProjectSortKey =
  | 'updated-desc'
  | 'updated-asc'
  | 'created-desc'
  | 'created-asc'
  | 'name-asc'
  | 'name-desc';

export const PROJECT_SORT_OPTIONS: { value: ProjectSortKey; label: string }[] = [
  { value: 'updated-desc', label: 'Newest updated' },
  { value: 'updated-asc', label: 'Oldest updated' },
  { value: 'created-desc', label: 'Newest created' },
  { value: 'created-asc', label: 'Oldest created' },
  { value: 'name-asc', label: 'Name A–Z' },
  { value: 'name-desc', label: 'Name Z–A' },
];

type Props = {
  value: ProjectSortKey;
  onChange: (value: ProjectSortKey) => void;
};

export function ProjectSortMenu({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = PROJECT_SORT_OPTIONS.find((o) => o.value === value)
    ?? PROJECT_SORT_OPTIONS[0];

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="dashboard-sort-menu relative shrink-0">
      <button
        type="button"
        className="dashboard-sort-trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Sort projects: ${selected.label}`}
      >
        <ArrowUpDown className="w-4 h-4 text-gray-500 shrink-0" aria-hidden />
        <span className="dashboard-sort-label">Sort</span>
        <span className="dashboard-sort-value">{selected.label}</span>
        <ChevronDown
          className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open && (
        <ul className="dashboard-sort-panel" role="listbox" aria-label="Sort projects">
          {PROJECT_SORT_OPTIONS.map((option) => {
            const active = option.value === value;
            return (
              <li key={option.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`dashboard-sort-option${active ? ' is-active' : ''}`}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <span className="truncate">{option.label}</span>
                  {active && <Check className="w-4 h-4 shrink-0 text-brand-muted" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
