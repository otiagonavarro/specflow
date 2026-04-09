import { useState } from 'react';

export function initialsFromDisplayName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0][0] || '';
    const b = parts[parts.length - 1][0] || '';
    return (a + b).toUpperCase() || '?';
  }
  if (parts.length === 1) {
    const p = parts[0];
    if (p.length >= 2) return p.slice(0, 2).toUpperCase();
    return (p[0] || '?').toUpperCase();
  }
  return '?';
}

interface AvatarImageProps {
  src: string | null | undefined;
  name: string;
  size?: number;
  className?: string;
  roundedClassName?: string;
  ariaLabel?: string;
}

export function AvatarImage({
  src,
  name,
  size = 32,
  className = '',
  roundedClassName = 'rounded-full',
  ariaLabel,
}: AvatarImageProps) {
  const [broken, setBroken] = useState(false);
  const initials = initialsFromDisplayName(name || '?');
  const showImg = Boolean(src) && !broken;

  if (!showImg) {
    return (
      <div
        role="img"
        aria-label={ariaLabel ?? name}
        className={`${roundedClassName} bg-surface-highest flex items-center justify-center text-zinc-400 font-bold shrink-0 border border-outline-variant/20 ${className}`}
        style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.36)) }}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={src!}
      alt={ariaLabel ?? name}
      width={size}
      height={size}
      className={`${roundedClassName} object-cover grayscale shrink-0 border border-outline-variant/20 ${className}`}
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  );
}
