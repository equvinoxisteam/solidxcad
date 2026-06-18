import Image from 'next/image';
import Link from 'next/link';

export function BrandLogo({
  href = '/',
  size = 36,
  showName = true,
  className = '',
  nameClassName = 'font-semibold text-gray-900 tracking-tight',
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
        src="/logo.png"
        alt="SolidX CAD"
        width={size}
        height={size}
        className="rounded-lg shrink-0 shadow-sm"
        priority
      />
      {showName && <span className={nameClassName}>SolidX CAD</span>}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`flex items-center gap-2.5 ${className}`}>
        {content}
      </Link>
    );
  }

  return <div className={`flex items-center gap-2.5 ${className}`}>{content}</div>;
}
