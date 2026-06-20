import Link from 'next/link';
import { BRAND_COMPANY, BRAND_NAME, BRAND_SOCIAL } from '@/lib/brand';

export function MarketingFooter() {
  return (
    <footer className="marketing-footer">
      <div className="marketing-footer-line">
        <div className="marketing-footer-meta">
          <span>© {new Date().getFullYear()} {BRAND_NAME}</span>
          <span className="marketing-footer-dot" aria-hidden>
            ·
          </span>
          <span>Powered by {BRAND_COMPANY}</span>
        </div>
        <nav className="marketing-footer-links" aria-label="Social">
          <a href={BRAND_SOCIAL.instagram} target="_blank" rel="noopener noreferrer">
            Instagram
          </a>
          <a href={BRAND_SOCIAL.linkedin} target="_blank" rel="noopener noreferrer">
            LinkedIn
          </a>
        </nav>
      </div>
    </footer>
  );
}
