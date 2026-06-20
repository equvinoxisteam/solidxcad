import Image from 'next/image';
import Link from 'next/link';
import { BRAND_LOGO_ALT, BRAND_LOGO_SRC, BRAND_NAME } from '@/lib/brand';

export function BrandLogo({
  href = '/',
  size = 36,
  showName = true,
  className = '',
  nameClassName = '',
}: {
  href?: string;
  size?: number;
  showName?: boolean;
  className?: string;
  nameClassName?: string;
}) {
  const content = (
    <>
      <Image
        src={BRAND_LOGO_SRC}
        alt={BRAND_LOGO_ALT}
        width={size}
        height={size}
        className="brand-logo-mark rounded-lg shrink-0 shadow-sm"
        priority
      />
      {showName && (
        <span className={`brand-logo-name ${nameClassName}`.trim()}>{BRAND_NAME}</span>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`brand-logo flex items-center gap-2.5 min-w-0 ${className}`.trim()}>
        {content}
      </Link>
    );
  }

  return <div className={`brand-logo flex items-center gap-2.5 min-w-0 ${className}`.trim()}>{content}</div>;
}
