"use client";

import type { ReactElement } from "react";

/**
 * QTB DEV TOOLS — dynamic stroke icon set.
 * All glyphs are original 24x24 stroke paths (currentColor, width 2, round caps).
 */
const REGISTRY = {
  tools: (
    <>
      <path d="M20.4 6.9a4.9 4.9 0 0 1-6.4 6.3L7 20.2a2 2 0 0 1-2.9-2.9l7-7a4.9 4.9 0 0 1 6.3-6.4L14.2 7l.6 2.9 2.9.6z" />
    </>
  ),
  "remove-bg": (
    <>
      {/* photo frame with an open top-right corner */}
      <path d="M20.5 12.5V18a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 18V6A2.5 2.5 0 0 1 6 3.5h5.5" />
      <circle cx="8.2" cy="8.4" r="1.5" />
      <path d="m3.9 16.8 4.4-4.9a1.5 1.5 0 0 1 2.2 0l3.5 3.9" />
      <path d="m12.6 14.1 1.4-1.5a1.5 1.5 0 0 1 2.2 0l1 .9" />
      {/* AI erase sparkle */}
      <path
        d="M17.6 1.9l1.1 2.9 2.9 1.1-2.9 1.1-1.1 2.9-1.1-2.9-2.9-1.1 2.9-1.1z"
        fill="currentColor"
        stroke="none"
      />
      <path d="M22.1 10.7v.01" strokeWidth="2.4" />
      <path d="M12.6 1.9v.01" strokeWidth="2.4" />
    </>
  ),
  convert: (
    <>
      {/* document with folded corner */}
      <path d="M13.5 2.5H7A2.5 2.5 0 0 0 4.5 5v14A2.5 2.5 0 0 0 7 21.5h10a2.5 2.5 0 0 0 2.5-2.5V8.5z" />
      <path d="M13.5 2.5v6h6" />
      {/* format exchange arrows inside the doc */}
      <path d="M8 12.8h6.5" />
      <path d="m12.3 10.6 2.2 2.2-2.2 2.2" />
      <path d="M16 17.2H9.5" />
      <path d="m11.7 15 2.2 2.2-2.2 2.2" />
    </>
  ),
  translate: (
    <>
      {/* Latin panel: translator strokes */}
      <path d="M2.5 4h8.5" />
      <path d="M6.5 2v2" />
      <path d="M3.6 8.6c1.8 3.1 4.4 5.4 7.5 6.7" />
      <path d="m10.5 4.3c-1.2 4.4-4.2 7.9-8 9.8" />
      {/* Arabic ʿayn (ع) stylized */}
      <path d="M20.9 11.3a3.4 3.4 0 1 0 .1 4.2" />
      <path d="M21 11.3c.5 3.1-.2 5.7-2 7.5-1.2 1.2-2.8 1.9-4.8 2.1" />
      {/* exchange tick between scripts */}
      <path d="m13.2 8.3 2.2-2.2 2.2 2.2" />
    </>
  ),
  shield: (
    <>
      <path d="M12 2 4.5 5v6c0 4.8 3.2 8.6 7.5 10.5C16.3 19.6 19.5 15.8 19.5 11V5z" />
    </>
  ),
  "shield-check": (
    <>
      <path d="M12 2 4.5 5v6c0 4.8 3.2 8.6 7.5 10.5C16.3 19.6 19.5 15.8 19.5 11V5z" />
      <path d="m8.8 11.6 2.3 2.3 4.2-4.7" />
    </>
  ),
  bolt: (
    <>
      <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H13z" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3.5 13.8 8l4.5 1.8-4.5 1.8L12 16l-1.8-4.4L5.7 9.8l4.5-1.8z" />
      <path d="m19 14.5.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" />
      <path d="m5 16.5.7 1.6 1.6.7-1.6.7L5 21l-.7-1.5-1.6-.7 1.6-.7z" />
    </>
  ),
  mic: (
    <>
      {/* studio microphone */}
      <rect x="9" y="2.5" width="6" height="11.5" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
      <path d="M12 18v3.5" />
      <path d="M8.5 21.5h7" />
    </>
  ),
  "upload-cloud": (
    <>
      <path d="M16.5 15.5 12 11l-4.5 4.5" />
      <path d="M12 11v10" />
      <path d="M20.4 18.4A5 5 0 0 0 18 8.9h-1.3A8 8 0 1 0 4.5 15.9" />
    </>
  ),
  "check-circle": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.4 12.3 2.4 2.4 4.8-5.2" />
    </>
  ),
  bank: (
    <>
      <path d="m3 9 9-5.5L21 9" />
      <path d="M5 9.5V18M9.7 9.5V18M14.3 9.5V18M19 9.5V18" />
      <path d="M3.5 18h17" />
      <path d="M2.5 21h19" />
    </>
  ),
  bell: (
    <>
      <path d="M18 9.5a6 6 0 1 0-12 0c0 5.5-2.5 6.5-2.5 6.5h17S18 15 18 9.5" />
      <path d="M10.3 20a2 2 0 0 0 3.4 0" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  settings: (
    <>
      <circle cx="15" cy="6" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="18" r="2" />
      <path d="M3 6h10M17 6h4M3 12h4M11 12h10M3 18h12M19 18h2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" />
      <path d="M17.5 14.4a6.5 6.5 0 0 1 4 5.6" />
    </>
  ),
  megaphone: (
    <>
      <path d="M11 5 6.5 9H3v6h3.5L11 19z" />
      <path d="M15 9a4.2 4.2 0 0 1 0 6" />
      <path d="M18 6.5a8 8 0 0 1 0 11" />
    </>
  ),
  wallet: (
    <>
      <path d="M20 7.5V6a2 2 0 0 0-2-2H5.5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2H18a2 2 0 0 0 2-2v-1.5" />
      <path d="M16.5 10.5h5v4h-5a2 2 0 0 1 0-4z" />
      <path d="M3.5 7.5H18" />
    </>
  ),
  "badge-check": (
    <>
      <circle cx="12" cy="9" r="5.5" />
      <path d="m8.8 13.6-1.8 7 5-2.6 5 2.6-1.8-7" />
      <path d="m9.9 9 1.6 1.6 2.9-3" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5v-3a4 4 0 0 1 8 0v3" />
      <circle cx="12" cy="15.5" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
    </>
  ),
  "file-text": (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h6" />
    </>
  ),
  "file-check": (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="m9.5 15.2 1.8 1.8 3.5-3.9" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="9" cy="9" r="2" />
      <path d="m20.6 15.3-4-4a1.4 1.4 0 0 0-2 0L6.2 19.7" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 21h16" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="m6.5 7 .9 14h9.2l.9-14" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  edit: (
    <>
      <path d="M17 3.5 20.5 7 8.5 19H5v-3.5z" />
      <path d="m14.5 6 3.5 3.5" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  "eye-off": (
    <>
      <path d="m3 3 18 18" />
      <path d="M10.5 5.3A10 10 0 0 1 12 5c6.5 0 10 7 10 7a16.6 16.6 0 0 1-3.2 4M6.1 6.2C3.3 8 2 12 2 12s3.5 7 10 7c1.4 0 2.7-.3 3.8-.8" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),
  x: (
    <>
      <path d="m6 6 12 12M18 6 6 18" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.8-4.8" />
    </>
  ),
  "log-out": (
    <>
      <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3 2.5 20h19z" />
      <path d="M12 9.5V14" />
      <path d="M12 17.1v.2" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 7.7v.2" />
    </>
  ),
  gift: (
    <>
      <path d="M20 12v9H4v-9" />
      <path d="M2 7h20v5H2z" />
      <path d="M12 21V7" />
      <path d="M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  mail: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15.5" r="4.5" />
      <path d="m11.2 12.3 9.3-9.3" />
      <path d="M17 6.5 20 9.5M14 9.5l2 2" />
    </>
  ),
  crown: (
    <>
      <path d="m3 7 4.5 4L12 4l4.5 7L21 7l-1.5 12h-15z" />
      <path d="M6 22h12" />
    </>
  ),
  refresh: (
    <>
      <path d="M20.5 12A8.5 8.5 0 1 1 12 3.5c2.6 0 4.9 1.2 6.5 3" />
      <path d="M21 3v5.5h-5.5" />
    </>
  ),
  send: (
    <>
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4z" />
    </>
  ),
  "layout-dashboard": (
    <>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="11" width="7" height="10" rx="1.5" />
      <rect x="3" y="14" width="8" height="7" rx="1.5" />
    </>
  ),
  "list-check": (
    <>
      <path d="M10 6h11M10 12h11M10 18h11" />
      <path d="m3 6 1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2" />
    </>
  ),
  check: (
    <>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </>
  ),
  "chevron-down": (
    <>
      <path d="m6 9 6 6 6-6" />
    </>
  ),
  "arrow-left": (
    <>
      <path d="M19 12H5" />
      <path d="m11 18-6-6 6-6" />
    </>
  ),
  menu: (
    <>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </>
  ),
  pdf: (
    <>
      {/* document with folded corner */}
      <path d="M13.5 2.5H7A2.5 2.5 0 0 0 4.5 5v14A2.5 2.5 0 0 0 7 21.5h10a2.5 2.5 0 0 0 2.5-2.5V8.5z" />
      <path d="M13.5 2.5v6h6" />
      {/* dashed split line */}
      <path d="M7.8 12.5h8.4" strokeDasharray="1.6 2.4" />
      {/* split / merge arrows */}
      <path d="M12 10.2V7.6" />
      <path d="m10.3 9.1 1.7-1.7 1.7 1.7" />
      <path d="M12 14.8v2.6" />
      <path d="m10.3 15.9 1.7 1.7 1.7-1.7" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M9.3 9.2a2.8 2.8 0 0 1 5.5.7c0 1.8-2.7 2.3-2.7 3.9" />
      <path d="M12 17.2h.01" />
    </>
  ),
  smartphone: (
    <>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
      <path d="M10.5 18.5h3" />
    </>
  ),
  activity: (
    <>
      <path d="M22 12h-4l-3 8-6-16-3 8H2" />
    </>
  ),
  "copy-check": (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      <path d="m12.5 15.5 2 2 3.5-4" />
    </>
  ),
} as const satisfies Record<string, ReactElement>;

export type QTBIconName = keyof typeof REGISTRY;

export const qtbIconNames = Object.keys(REGISTRY) as QTBIconName[];

export interface QTBIconProps {
  name: QTBIconName;
  className?: string;
  size?: number;
  strokeWidth?: number;
}

/** Renders one of the QTB brand icons from the registry. */
export default function QTBIcon({ name, className, size = 24, strokeWidth = 2 }: QTBIconProps) {
  const glyph = (REGISTRY as Record<QTBIconName, ReactElement>)[name] ?? REGISTRY.sparkles;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {glyph}
    </svg>
  );
}
