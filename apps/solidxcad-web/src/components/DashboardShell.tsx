'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FolderKanban, LogOut, Settings } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { clearToken, type User } from '@/lib/api';
import { useClientUser } from '@/hooks/useClientUser';

type DashboardShellProps = {
  children: React.ReactNode;
};

function planLabel(user: User) {
  return user.plan === 'pro' ? 'Pro plan' : 'Free plan';
}

function navItemClass(active: boolean) {
  return `dashboard-sidebar-link${active ? ' is-active' : ''}`;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();
  const { user, mounted } = useClientUser(true);
  const onDashboard = pathname === '/dashboard' || pathname.startsWith('/projects/');
  const onSettings = pathname === '/settings';

  function logout() {
    clearToken();
    window.location.href = '/login?fresh=1';
  }

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar" aria-label="Main navigation">
        <div className="dashboard-sidebar-top">
          <BrandLogo href="/dashboard" size={32} nameClassName="dashboard-sidebar-brand-name" />
        </div>

        <nav className="dashboard-sidebar-nav">
          <Link href="/dashboard" className={navItemClass(onDashboard)} title="Projects">
            <FolderKanban className="w-5 h-5 shrink-0" aria-hidden />
            <span>Projects</span>
          </Link>
          <Link href="/settings" className={navItemClass(onSettings)} title="Settings">
            <Settings className="w-5 h-5 shrink-0" aria-hidden />
            <span>Settings</span>
          </Link>
        </nav>

        <div className="dashboard-sidebar-footer">
          {mounted && user && (
            <div className="dashboard-sidebar-plan" title="Current plan">
              <span className="dashboard-sidebar-plan-dot" aria-hidden />
              <span>{planLabel(user)}</span>
            </div>
          )}
          <button
            type="button"
            className="dashboard-sidebar-link dashboard-sidebar-logout"
            onClick={logout}
            title="Sign out"
          >
            <LogOut className="w-5 h-5 shrink-0" aria-hidden />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <div className="dashboard-main">
        <div className="dashboard-main-inner">{children}</div>
      </div>
    </div>
  );
}
