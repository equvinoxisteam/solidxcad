'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandLogo } from '@/components/BrandLogo';

function navLinkClass(active: boolean) {
  return `text-sm px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
    active
      ? 'text-brand bg-brand/10 font-medium'
      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
  }`;
}

export function MarketingHeader() {
  const pathname = usePathname();
  const onPricing = pathname === '/pricing';

  return (
    <header className="marketing-header relative z-20 w-full">
      <div className="marketing-header-inner">
        <BrandLogo
          href="/"
          size={32}
        />

        <nav className="flex items-center gap-1 sm:gap-2 shrink-0">
          <Link href="/pricing" className={navLinkClass(onPricing)}>
            Pricing
          </Link>
          <Link href="/login?fresh=1" className={navLinkClass(false)}>
            Sign in
          </Link>
          <Link href="/register" className="auth-btn-primary text-sm py-2 px-4 sm:px-5">
            Sign up
          </Link>
        </nav>
      </div>
    </header>
  );
}
