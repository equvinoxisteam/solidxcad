import Link from 'next/link';
import { BRAND_COMPANY, BRAND_NAME } from '@/lib/brand';

type MarketingFooterProps = {
  variant?: 'light' | 'dark';
};

export function MarketingFooter({ variant = 'light' }: MarketingFooterProps) {
  const dark = variant === 'dark';

  return (
    <footer className={dark ? 'marketing-footer-dark' : 'marketing-footer'}>
      <div className={dark ? 'marketing-footer-line-dark' : 'marketing-footer-line'}>
        <div className="marketing-footer-meta">
          <span>© {new Date().getFullYear()} {BRAND_NAME}</span>
          <span className="marketing-footer-dot" aria-hidden>
            ·
          </span>
          <span>Powered by {BRAND_COMPANY}</span>
        </div>
        <nav className="marketing-footer-links" aria-label="Footer">
          <Link href="/pricing">Pricing</Link>
          <Link href="/login?fresh=1">Sign in</Link>
          <Link href="/register">Start free</Link>
        </nav>
      </div>
    </footer>
  );
}
