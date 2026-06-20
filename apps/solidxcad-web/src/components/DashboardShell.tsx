'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  LogOut,
  Settings,
} from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { clearToken, type User } from '@/lib/api';
import { useClientUser } from '@/hooks/useClientUser';

const SIDEBAR_KEY = 'solidxcad_sidebar_open';

type DashboardShellProps = {
  children: React.ReactNode;
};

function readSidebarOpen() {
  if (typeof window === 'undefined') return true;
  const v = localStorage.getItem(SIDEBAR_KEY);
  if (v === '0') return false;
  if (v === '1') return true;
  return true;
}

function userInitial(user: User) {
  const source = user.name?.trim() || user.email?.trim() || '?';
  return source.charAt(0).toUpperCase();
}

function navItemClass(active: boolean, expanded: boolean) {
  return `dashboard-sidebar-link${active ? ' is-active' : ''}${expanded ? '' : ' is-collapsed'}`;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();
  const { user, mounted } = useClientUser(true);
  const [expanded, setExpanded] = useState(true);
  const [ready, setReady] = useState(false);

  const onDashboard = pathname === '/dashboard' || pathname.startsWith('/projects/');
  const onSettings = pathname === '/settings';

  useEffect(() => {
    setExpanded(readSidebarOpen());
    setReady(true);
  }, []);

  function toggleSidebar() {
    setExpanded((v) => {
      const next = !v;
      localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0');
      return next;
    });
  }

  function logout() {
    clearToken();
    window.location.href = '/login?fresh=1';
  }

  const shellClass = `dashboard-shell${ready && expanded ? ' sidebar-expanded' : ' sidebar-collapsed'}`;

  return (
    <div className={shellClass}>
      <aside
        className={`dashboard-sidebar${expanded ? ' is-expanded' : ' is-collapsed'}`}
        aria-label="Main navigation"
      >
        <div className="dashboard-sidebar-top">
          <BrandLogo
            href="/dashboard"
            size={32}
            showName={expanded}
            nameClassName="dashboard-sidebar-brand-name"
            className="dashboard-sidebar-brand min-w-0"
          />
          <button
            type="button"
            className="dashboard-sidebar-toggle"
            onClick={toggleSidebar}
            aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
            title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {expanded ? (
              <ChevronLeft className="w-4 h-4" aria-hidden />
            ) : (
              <ChevronRight className="w-4 h-4" aria-hidden />
            )}
          </button>
        </div>

        <nav className="dashboard-sidebar-nav">
          <Link
            href="/dashboard"
            className={navItemClass(onDashboard, expanded)}
            title="Projects"
          >
            <FolderKanban className="w-5 h-5 shrink-0" aria-hidden />
            {expanded && <span>Projects</span>}
          </Link>
          <Link
            href="/settings"
            className={navItemClass(onSettings, expanded)}
            title="Settings"
          >
            <Settings className="w-5 h-5 shrink-0" aria-hidden />
            {expanded && <span>Settings</span>}
          </Link>
        </nav>

        <div className={`dashboard-sidebar-footer${expanded ? '' : ' is-collapsed'}`}>
          {mounted && user && (
            <Link
              href="/settings"
              className="dashboard-sidebar-profile is-collapsed"
              title={user.name || user.email}
              aria-label="Account settings"
            >
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="dashboard-sidebar-avatar"
                />
              ) : (
                <span className="dashboard-sidebar-avatar dashboard-sidebar-avatar-fallback" aria-hidden>
                  {userInitial(user)}
                </span>
              )}
            </Link>
          )}

          <button
            type="button"
            className={`dashboard-sidebar-link dashboard-sidebar-logout${expanded ? '' : ' is-collapsed'}`}
            onClick={logout}
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="w-5 h-5 shrink-0" aria-hidden />
            {expanded && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      <div className="dashboard-main">
        <div className="dashboard-main-inner">{children}</div>
      </div>
    </div>
  );
}
