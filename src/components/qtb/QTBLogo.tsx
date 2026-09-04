"use client";

import { useId } from "react";

export interface QTBLogoProps {
  /** Pixel size of the square mark. */
  size?: number;
  /** Show the "QTB DEV TOOLS" wordmark next to the mark. */
  withWordmark?: boolean;
  /** When set (from site config), renders the custom logo image instead. */
  logoUrl?: string;
  /** Render the mark in white (for dark surfaces). */
  light?: boolean;
  /** Render inside a rounded dark tile (favicon / app-icon look). */
  tile?: boolean;
  className?: string;
}

/**
 * QTB DEV TOOLS official brand mark — an authentic vector trace of the
 * QTB emblem: an octagonal arrangement of squares & diamonds with a bold
 * lightning channel. Pure inline SVG, recolorable via `currentColor`.
 */
export const QTB_MARK_PATH =
  "M150 2 193 46h62v61l43 43-43 44v61h-62l-42 42h-2l-31-32v-2l41-41h2l31 32 2-4v-56h61l-42-43 42-42h-61V47l-43 42-44-42v60l-61 1 42 43-42 43v1h62l63-64v60l-64 65H44v-62L2 151v-2l42-42V46h62l43 3z";

export default function QTBLogo({
  size = 40,
  withWordmark = false,
  logoUrl,
  light = false,
  tile = false,
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
          className="rounded-xl object-contain"
          style={{ width: size, height: size }}
        />
        {withWordmark && <Wordmark />}
      </span>
    );
  }

  const mark = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 300 299"
      role="img"
      aria-label="QTB DEV TOOLS logo"
      className="shrink-0"
      style={tile ? { width: size * 0.58, height: size * 0.58 } : undefined}
    >
      {tile ? (
        <>
          <defs>
            <linearGradient id={`qtb-tile-spark-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="55%" stopColor="#d946ef" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>
          <rect width="300" height="299" rx="72" fill="#0a0a0a" />
          <path fill="#ffffff" transform="translate(62 62) scale(0.5867)" d={QTB_MARK_PATH} />
          <circle cx="258" cy="52" r="17" fill={`url(#qtb-tile-spark-${uid})`} />
        </>
      ) : (
        <path fill={light ? "#ffffff" : "currentColor"} d={QTB_MARK_PATH} />
      )}
    </svg>
  );

  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      {tile ? (
        <span
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-neutral-950"
          style={{ width: size, height: size }}
        >
          {mark}
        </span>
      ) : (
        mark
      )}
      {withWordmark && <Wordmark light={light} />}
    </span>
  );
}

function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <span className="flex flex-col leading-none">
      <span
        className={`text-sm font-extrabold tracking-tight ${
          light ? "text-white" : "text-neutral-900"
        }`}
      >
        QTB <span className={light ? "text-neutral-400" : "text-neutral-400"}>DEV TOOLS</span>
      </span>
      <span className="mt-1 h-0.5 w-10 rounded-full bg-gradient-to-r from-amber-400 via-fuchsia-500 to-emerald-400" />
    </span>
  );
}
