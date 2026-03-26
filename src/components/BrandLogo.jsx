import React from 'react';

export function BrandMark({ className = 'h-12 w-12', alt = 'Vidya Share logo', imgClassName = '' }) {
  return (
    <span className={`brand-mark inline-flex shrink-0 overflow-hidden rounded-[1.15rem] ${className}`}>
      <img
        src="/icon.svg"
        alt={alt}
        className={`h-full w-full object-cover ${imgClassName}`}
        decoding="async"
        fetchPriority="high"
      />
    </span>
  );
}

export default function BrandLogo({
  className = '',
  markClassName = 'h-12 w-12',
  title = 'Vidya Share',
  subtitle = '',
  titleClassName = 'font-display text-[1.9rem] font-semibold leading-none tracking-[0.04em] text-white',
  subtitleClassName = 'text-[10px] uppercase tracking-[0.24em] text-cyan-50/62',
}) {
  return (
    <div className={`flex min-w-0 items-center gap-3 ${className}`}>
      <BrandMark className={markClassName} />
      <div className="min-w-0">
        <p className={titleClassName}>{title}</p>
        {subtitle ? <p className={subtitleClassName}>{subtitle}</p> : null}
      </div>
    </div>
  );
}
