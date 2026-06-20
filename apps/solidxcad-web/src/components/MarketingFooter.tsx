import Link from 'next/link';

export function MarketingFooter() {
  return (
    <footer className="marketing-footer">
      <div className="marketing-footer-line">
        <div className="marketing-footer-meta">
          <span>© {new Date().getFullYear()} SolidX CAD</span>
          <span className="marketing-footer-dot" aria-hidden>
            ·
          </span>
          <span>Powered by Equvinoxis Technologies</span>
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
