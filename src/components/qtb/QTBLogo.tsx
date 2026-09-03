"use client";

import { useId } from "react";

export interface QTBLogoProps {
  /** Pixel size of the square tile. */
  size?: number;
  /** Show the "QTB DEV TOOLS" wordmark next to the tile. */
  withWordmark?: boolean;
  /** When set (from site config), renders the custom logo image instead. */
  logoUrl?: string;
  className?: string;
}

/**
 * QTB DEV TOOLS brand mark: black rounded tile, white "Q" glyph,
 * tiny amber→fuchsia→emerald gradient spark. Pure inline SVG.
 */
export default function QTBLogo({
  size = 40,
  withWordmark = false,
  logoUrl,
  className,
}: QTBLogoProps) {
  const uid = useId().replace(/[:]/g, "");

  if (logoUrl) {
    return (
      <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
        <img
          src={logoUrl}
          alt="QTB DEV TOOLS logo"
          width={size}
          height={size}
          className="rounded-xl object-cover"
          style={{ width: size, height: size }}
        />
        {withWordmark && <Wordmark />}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        role="img"
        aria-label="QTB DEV TOOLS logo"
        className="shrink-0"
      >
        <defs>
          <linearGradient id={`qtb-spark-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="55%" stopColor="#d946ef" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
        <rect width="48" height="48" rx="12" fill="#0a0a0a" />
        <circle cx="22" cy="23.5" r="9" fill="none" stroke="#ffffff" strokeWidth="4.5" />
        <path
          d="M28.6 30.1 35 36.5"
          fill="none"
          stroke="#ffffff"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <path
          d="M38.5 6.5l1.7 4 4 1.7-4 1.7-1.7 4-1.7-4-4-1.7 4-1.7z"
          fill={`url(#qtb-spark-${uid})`}
        />
      </svg>
      {withWordmark && <Wordmark />}
    </span>
  );
}

function Wordmark() {
  return (
    <span className="flex flex-col leading-none">
      <span className="text-sm font-extrabold tracking-tight text-neutral-900">
        QTB <span className="text-neutral-400">DEV TOOLS</span>
      </span>
      <span className="mt-1 h-0.5 w-10 rounded-full bg-gradient-to-r from-amber-400 via-fuchsia-500 to-emerald-400" />
    </span>
  );
}
