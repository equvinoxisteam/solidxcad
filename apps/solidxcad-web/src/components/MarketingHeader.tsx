'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandLogo } from '@/components/BrandLogo';

function navLinkClass(active: boolean) {
  return `text-xs sm:text-sm px-2 sm:px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
    active
      ? 'text-white bg-white/[0.06]'
      : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
  }`;
}

export function MarketingHeader() {
  const pathname = usePathname();
  const onPricing = pathname === '/pricing';

  return (
    <header className="relative z-20 w-full max-w-6xl mx-auto flex items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
      <BrandLogo
        href="/"
        size={32}
        nameClassName="font-semibold text-white tracking-tight text-sm sm:text-base hidden min-[420px]:inline"
        className="shrink-0"
      />

      <nav className="flex items-center justify-end gap-0.5 sm:gap-1 min-w-0">
        <Link href="/pricing" className={navLinkClass(onPricing)}>
          Pricing
        </Link>
        <Link href="/login?fresh=1" className={navLinkClass(false)}>
          Sign in
        </Link>
        <Link
          href="/register"
          className="auth-btn-primary text-xs sm:text-sm py-2 px-3 sm:px-5 ml-0.5 sm:ml-1 whitespace-nowrap"
        >
          Sign up
        </Link>
      </nav>
    </header>
  );
}
