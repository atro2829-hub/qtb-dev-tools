"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import QTBIcon, { type QTBIconName } from "@/components/qtb/QTBIcon";
import type { SubscriptionStatus } from "@/store/app-store";

/** Colorful rounded icon chip used across cards & lists. */
export function GradientChip({
  icon,
  tone = "amber",
  size = "md",
  className,
}: {
  icon: QTBIconName;
  tone?: "amber" | "rose" | "emerald" | "fuchsia" | "violet" | "neutral";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const tones: Record<string, string> = {
    amber: "bg-amber-100 text-amber-600",
    rose: "bg-rose-100 text-rose-600",
    emerald: "bg-emerald-100 text-emerald-600",
    fuchsia: "bg-fuchsia-100 text-fuchsia-600",
    violet: "bg-violet-100 text-violet-600",
    neutral: "bg-neutral-100 text-neutral-600",
  };
  const sizes = {
    sm: "h-8 w-8 [&_svg]:size-4",
    md: "h-11 w-11 [&_svg]:size-5",
    lg: "h-14 w-14 [&_svg]:size-7",
  };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl",
        tones[tone],
        sizes[size],
        className
      )}
    >
      <QTBIcon name={icon} />
    </span>
  );
}

const STATUS_STYLES: Record<SubscriptionStatus, { label: string; className: string }> = {
  active: {
    label: "Pro Member",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200 [&>span]:bg-emerald-500",
  },
  trial: {
    label: "Free Trial",
    className: "bg-amber-50 text-amber-700 border-amber-200 [&>span]:bg-amber-500",
  },
  expired: {
    label: "Expired",
    className: "bg-rose-50 text-rose-700 border-rose-200 [&>span]:bg-rose-500",
  },
  none: {
    label: "Free Plan",
    className:
      "bg-neutral-100 text-neutral-600 border-neutral-200 [&>span]:bg-neutral-400",
  },
};

/** Subscription status pill with colored dot. */
export function StatusPill({
  status,
  className,
}: {
  status: SubscriptionStatus;
  className?: string;
}) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
        style.className,
        className
      )}
    >
      <span className="size-1.5 rounded-full" />
      {style.label}
    </span>
  );
}

/** Friendly empty state with inline SVG art. */
export function EmptyState({
  icon = "sparkles",
  title,
  description,
  action,
}: {
  icon?: QTBIconName;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <svg width="120" height="72" viewBox="0 0 120 72" fill="none" aria-hidden="true">
        <circle
          cx="60"
          cy="36"
          r="26"
          stroke="#e4e4e7"
          strokeWidth="2.5"
          strokeDasharray="6 7"
          strokeLinecap="round"
        />
        <circle cx="60" cy="36" r="15" fill="#fafafa" stroke="#d4d4d8" strokeWidth="2" />
        <path
          d="M60 28.5l2.1 5 5 2.1-5 2.1-2.1 5-2.1-5-5-2.1 5-2.1z"
          fill="url(#qtb-empty-grad)"
        />
        <defs>
          <linearGradient id="qtb-empty-grad" x1="52" y1="28" x2="68" y2="44">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="55%" stopColor="#d946ef" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
      </svg>
      <div>
        <p className="text-sm font-bold text-neutral-800">{title}</p>
        {description && (
          <p className="mt-1 max-w-xs text-xs text-neutral-500">{description}</p>
        )}
      </div>
      {action}
      <span className="sr-only">
        <QTBIcon name={icon} />
      </span>
    </div>
  );
}

/** Eyebrow + heading pair. */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center")}>
      {eyebrow && (
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-fuchsia-600">
          {eyebrow}
        </p>
      )}
      <h2 className="text-2xl font-extrabold tracking-tight text-neutral-900 sm:text-3xl">
        {title}
      </h2>
      {description && (
        <p className="mt-2 text-sm leading-relaxed text-neutral-500 sm:text-base">
          {description}
        </p>
      )}
    </div>
  );
}
