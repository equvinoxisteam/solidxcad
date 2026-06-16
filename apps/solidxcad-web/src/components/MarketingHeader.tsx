'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandLogo } from '@/components/BrandLogo';

function navLinkClass(active: boolean) {
  return `text-sm px-3 py-2 rounded-lg transition-colors ${
    active
      ? 'text-white bg-white/[0.06]'
      : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
  }`;
}

export function MarketingHeader() {
  const pathname = usePathname();
  const onPricing = pathname === '/pricing';

  return (
    <header className="relative z-20 flex items-center justify-between px-5 sm:px-8 lg:px-10 py-5">
      <BrandLogo href="/" size={36} nameClassName="font-semibold text-white tracking-tight" />

      <nav className="flex items-center gap-1 sm:gap-2">
        <Link href="/pricing" className={navLinkClass(onPricing)}>
          Pricing
        </Link>
        <Link href="/login?fresh=1" className={navLinkClass(false)}>
          Sign in
        </Link>
        <Link href="/register" className="auth-btn-primary text-sm py-2 px-4 sm:px-5 ml-1">
          Sign up
        </Link>
      </nav>
    </header>
  );
}
