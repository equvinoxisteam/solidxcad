'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandLogo } from '@/components/BrandLogo';

type MarketingHeaderProps = {
  variant?: 'light' | 'dark';
};

function navLinkClass(active: boolean, dark: boolean) {
  if (dark) {
    return `text-sm px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
      active ? 'text-white bg-white/10 font-medium' : 'text-gray-400 hover:text-white'
    }`;
  }
  return `text-sm px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
    active ? 'text-brand bg-brand/10 font-medium' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
  }`;
}

export function MarketingHeader({ variant = 'light' }: MarketingHeaderProps) {
  const pathname = usePathname();
  const onPricing = pathname === '/pricing';
  const dark = variant === 'dark';

  return (
    <header className={dark ? 'marketing-header-dark' : 'marketing-header'}>
      <div className={dark ? 'marketing-header-inner-dark' : 'marketing-header-inner'}>
        <BrandLogo href="/" size={32} nameClassName={dark ? 'brand-logo-name-dark' : ''} />

        <nav className="flex items-center gap-1 sm:gap-2 shrink-0">
          <Link href="/pricing" className={navLinkClass(onPricing, dark)}>
            Pricing
          </Link>
          <Link href="/login?fresh=1" className={navLinkClass(false, dark)}>
            Sign in
          </Link>
          <Link href="/register" className="auth-btn-primary text-sm py-2 px-4 sm:px-5">
            Start free
          </Link>
        </nav>
      </div>
    </header>
  );
}
