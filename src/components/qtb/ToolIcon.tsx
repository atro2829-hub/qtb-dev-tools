"use client";

import { useId } from "react";

export type ToolKey = "bg" | "convert" | "translate" | "pdf";

export interface ToolIconProps {
  tool: ToolKey;
  size?: number;
  className?: string;
}

const PALETTES: Record<ToolKey, [string, string]> = {
  bg: ["#f59e0b", "#f97316"],
  convert: ["#f43f5e", "#d946ef"],
  translate: ["#10b981", "#14b8a6"],
  pdf: ["#8b5cf6", "#d946ef"],
};

/**
 * QTB original duotone hero icons for the four tools.
 * Rich 48x48 artwork: soft tinted backdrop, crisp ink glyph, and a
 * brand-gradient accent unique to each tool.
 */
export default function ToolIcon({ tool, size = 56, className }: ToolIconProps) {
  const uid = useId().replace(/[:]/g, "");
  const [c1, c2] = PALETTES[tool];
  const gradId = `qtb-tool-grad-${tool}-${uid}`;
  const softId = `qtb-tool-soft-${tool}-${uid}`;

  const gradientDefs = (
    <defs>
      <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={c1} />
        <stop offset="100%" stopColor={c2} />
      </linearGradient>
      <linearGradient id={softId} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={c1} stopOpacity="0.16" />
        <stop offset="100%" stopColor={c2} stopOpacity="0.10" />
      </linearGradient>
    </defs>
  );

  const ink = "#18181b";

  if (tool === "bg") {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
        {gradientDefs}
        <rect x="4" y="7" width="34" height="34" rx="8" fill={`url(#${softId})`} stroke={ink} strokeWidth="2.6" />
        <circle cx="14.5" cy="17.5" r="3.2" stroke={ink} strokeWidth="2.4" />
        <path d="m7 34 9.4-10.6a2.8 2.8 0 0 1 4.2 0l6.8 7.7" stroke={ink} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m23 27.5 3.1-3.4a2.8 2.8 0 0 1 4.1 0l1.9 2.1" stroke={ink} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M38 2.5 40.2 8.3 46 10.5 40.2 12.7 38 18.5 35.8 12.7 30 10.5 35.8 8.3z" fill={`url(#${gradId})`} />
        <path d="M45.2 22.5v.01" stroke={`url(#${gradId})`} strokeWidth="3.6" strokeLinecap="round" />
        <path d="M27.5 3.2v.01" stroke={`url(#${gradId})`} strokeWidth="3.2" strokeLinecap="round" />
      </svg>
    );
  }

  if (tool === "convert") {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
        {gradientDefs}
        <path
          d="M27.5 5H12a5 5 0 0 0-5 5v21a5 5 0 0 0 5 5h13a5 5 0 0 0 5-5v-9"
          stroke={ink}
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <path d="M27.5 5 35 12.5" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
        <path d="M27.5 5v7.5H35" stroke={ink} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13.5 20.5h10" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
        <path d="m20.5 16.5 4 4-4 4" stroke={ink} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M30 32.5h-10" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
        <path d="m23.5 28.5-4 4 4 4" stroke={ink} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="38.5" cy="36.5" r="7.5" fill={`url(#${softId})`} stroke={`url(#${gradId})`} strokeWidth="2.4" />
        <path d="m35.6 36.6 2 2 3.6-4" stroke={`url(#${gradId})`} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (tool === "translate") {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
        {gradientDefs}
        <circle cx="24" cy="24" r="19" fill={`url(#${softId})`} />
        {/* Latin cluster */}
        <path d="M5.5 10.5h15" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
        <path d="M12.8 6.5v4" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
        <path d="M8 20.5c3.3 5.2 8 8.7 13.5 10.2" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
        <path d="m17.5 8.5c-2.1 7.2-7 12.9-13.5 16" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
        {/* Arabic ʿayn */}
        <path d="M38.6 26.2a6.2 6.2 0 1 0 .2 7.6" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
        <path d="M38.8 26.2c.9 5.6-.4 10.3-3.7 13.5-2.1 2.1-5 3.4-8.5 3.8" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
        {/* exchange arrow */}
        <path d="m27 12.5 4.5-4.5 4.5 4.5" stroke={`url(#${gradId})`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M31.5 8.5V21" stroke={`url(#${gradId})`} strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }

  // pdf
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      {gradientDefs}
      <path
        d="M27.5 5H12a5 5 0 0 0-5 5v28a5 5 0 0 0 5 5h13a5 5 0 0 0 5-5V13.5z"
        stroke={ink}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M27.5 5v8.5H35" stroke={ink} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 26.5h13" stroke={ink} strokeWidth="2.4" strokeLinecap="round" strokeDasharray="2.6 3.4" />
      <path d="M19.5 23.5v-5.2" stroke={`url(#${gradId})`} strokeWidth="3" strokeLinecap="round" />
      <path d="m16.4 21.3 3.1-3.1 3.1 3.1" stroke={`url(#${gradId})`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19.5 29.5v5.2" stroke={`url(#${gradId})`} strokeWidth="3" strokeLinecap="round" />
      <path d="m16.4 31.7 3.1 3.1 3.1-3.1" stroke={`url(#${gradId})`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="38" cy="12" r="6.5" fill={`url(#${gradId})`} />
      <path d="m35.3 12.1 1.9 1.9 3.4-3.8" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
