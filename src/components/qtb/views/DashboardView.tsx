"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { ar as arLocale } from "date-fns/locale";
import { api } from "@/lib/client-api";
import {
  useAppStore,
  trialDaysLeft,
  type ToolJob,
  type View,
} from "@/store/app-store";
import QTBIcon, { type QTBIconName } from "@/components/qtb/QTBIcon";
import QTBButton from "@/components/qtb/QTBButton";
import { GradientChip, StatusPill, EmptyState } from "@/components/qtb/ui-bits";
import ToolIcon, { type ToolKey } from "@/components/qtb/ToolIcon";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Mirrors GET /api/tools/quota → { quota } */
interface QuotaInfo {
  unlimited: boolean;
  used: number;
  limit: number;
  resetsAt: string;
}

/** Circular progress ring showing today's free-tier usage. */
function QuotaRing({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min(used / Math.max(limit, 1), 1);
  const R = 15;
  const C = 2 * Math.PI * R;
  const exhausted = used >= limit;
  return (
    <span className="relative inline-flex h-11 w-11 items-center justify-center">
      <svg viewBox="0 0 36 36" className="h-11 w-11 -rotate-90">
        <circle cx="18" cy="18" r={R} fill="none" stroke="#e5e5e5" strokeWidth="3.5" />
        <circle
          cx="18"
          cy="18"
          r={R}
          fill="none"
          stroke={exhausted ? "#f43f5e" : pct > 0.6 ? "#f59e0b" : "#10b981"}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - pct)}
          style={{ transition: "stroke-dashoffset 600ms ease, stroke 300ms ease" }}
        />
      </svg>
      <span
        className={`absolute text-[10px] font-extrabold ${
          exhausted ? "text-rose-600" : "text-neutral-800"
        }`}
      >
        {used}/{limit}
      </span>
    </span>
  );
}

const TOOL_CARDS: {
  view: View;
  icon: QTBIconName;
  tone: "amber" | "rose" | "emerald" | "violet" | "sky";
  ring: string;
  titleKey: string;
  copyKey: string;
}[] = [
  {
    view: "tool-bg",
    icon: "remove-bg",
    tone: "amber",
    ring: "from-amber-400 to-orange-400",
    titleKey: "bg.title",
    copyKey: "bg.sub",
  },
  {
    view: "tool-convert",
    icon: "convert",
    tone: "rose",
    ring: "from-rose-400 to-fuchsia-400",
    titleKey: "cv.title",
    copyKey: "cv.sub",
  },
  {
    view: "tool-translate",
    icon: "translate",
    tone: "emerald",
    ring: "from-emerald-400 to-teal-400",
    titleKey: "tr.title",
    copyKey: "tr.sub",
  },
  {
    view: "tool-audio",
    icon: "mic",
    tone: "sky",
    ring: "from-sky-400 to-cyan-400",
    titleKey: "au.title",
    copyKey: "au.sub",
  },
  {
    view: "tool-pdf",
    icon: "pdf",
    tone: "violet",
    ring: "from-violet-400 to-fuchsia-400",
    titleKey: "pdf.title",
    copyKey: "pdf.sub",
  },
];

function viewToToolKey(view: View): ToolKey {
  if (view === "tool-bg") return "bg";
  if (view === "tool-convert") return "convert";
  if (view === "tool-translate") return "translate";
  if (view === "tool-audio") return "audio";
  return "pdf";
}

/** Map a ToolJob.toolType string back to its dashboard card view. */
function jobToolView(toolType: string): View | null {
  const t = toolType.toLowerCase();
  if (t.includes("bg") || t.includes("background") || t.includes("remove")) return "tool-bg";
  if (t.includes("audio") || t.includes("speech") || t.includes("transcri")) return "tool-audio";
  if (t.includes("transl")) return "tool-translate";
  if (t.includes("convert")) return "tool-convert";
  if (t.includes("pdf")) return "tool-pdf";
  return null;
}

/** Chip tone per tool view — mirrors each dashboard card's color identity. */
const TONE_BY_VIEW: Record<string, "amber" | "rose" | "emerald" | "sky" | "violet"> = {
  "tool-bg": "amber",
  "tool-convert": "rose",
  "tool-translate": "emerald",
  "tool-audio": "sky",
  "tool-pdf": "violet",
};

function jobIcon(toolType: string): QTBIconName {
  const t = toolType.toLowerCase();
  if (t.includes("bg") || t.includes("background") || t.includes("remove")) return "remove-bg";
  if (t.includes("audio") || t.includes("speech") || t.includes("transcri")) return "mic";
  if (t.includes("pdf")) return "pdf";
  if (t.includes("convert")) return "convert";
  if (t.includes("transl")) return "translate";
  return "sparkles";
}

/** Human-readable (localized) tool name for a job's toolType. */
function jobToolLabel(
  toolType: string,
  t: (key: string, vars?: Record<string, string | number>) => string
): string {
  const s = toolType.toLowerCase();
  if (s.includes("bg") || s.includes("background") || s.includes("remove")) return t("bg.title");
  if (s.includes("convert")) return t("cv.title");
  if (s.includes("transl")) return t("tr.title");
  if (s.includes("audio") || s.includes("speech") || s.includes("transcri")) return t("au.title");
  if (s.includes("pdf")) return t("pdf.title");
  return toolType.replace(/[-_]/g, " ") || t("dash.statusUnknown");
}

function StatusBadge({ status }: { status: string }) {
  const t = useAppStore((s) => s.t);
  const s = status.toLowerCase();
  const ok = s === "completed" || s === "done" || s === "success";
  const failed = s === "failed" || s === "error";
  const pending = s === "processing" || s === "pending" || s === "running";
  const label = ok
    ? t("dash.statusCompleted")
    : failed
      ? t("dash.statusFailed")
      : pending
        ? t("dash.statusProcessing")
        : s === "unknown"
          ? t("dash.statusUnknown")
          : status;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold",
        ok && "border-emerald-200 bg-emerald-50 text-emerald-700",
        failed && "border-rose-200 bg-rose-50 text-rose-700",
        pending && "border-amber-200 bg-amber-50 text-amber-700",
        !ok && !failed && !pending && "border-neutral-200 bg-neutral-50 text-neutral-600"
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          ok && "bg-emerald-500",
          failed && "bg-rose-500",
          pending && "bg-amber-500",
          !ok && !failed && !pending && "bg-neutral-400"
        )}
      />
      {label}
    </span>
  );
}

export default function DashboardView() {
  const user = useAppStore((s) => s.user);
  const setView = useAppStore((s) => s.setView);
  const lang = useAppStore((s) => s.lang);
  const t = useAppStore((s) => s.t);
  const [jobs, setJobs] = useState<ToolJob[] | null>(null);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);

  useEffect(() => {
    let active = true;
    api<{ jobs?: unknown[] }>("/api/tools/jobs")
      .then((res) => {
        if (!active) return;
        const list = (res.jobs ?? [])
          .filter((j): j is Record<string, unknown> => typeof j === "object" && j !== null)
          .map<ToolJob>((j) => ({
            id: String(j.id ?? ""),
            toolType: String(j.toolType ?? ""),
            fileName: String(j.fileName ?? j.filename ?? "Untitled"),
            status: String(j.status ?? "unknown"),
            createdAt: String(j.createdAt ?? new Date().toISOString()),
          }));
        setJobs(list);
      })
      .catch(() => {
        if (active) setJobs([]);
      });
    api<{ quota?: QuotaInfo }>("/api/tools/quota")
      .then((res) => {
        if (active) setQuota(res.quota ?? null);
      })
      .catch(() => {
        /* widget stays hidden */
      });
    return () => {
      active = false;
    };
  }, []);

  const daysLeft = trialDaysLeft(user);
  const trialExpired = daysLeft !== null && daysLeft < 0;
  const firstName = (user?.name ?? "there").split(" ")[0];

  // Time-of-day greeting (visitor's local clock) with a matching emoji.
  const hour = new Date().getHours();
  const greetKey =
    hour < 12 ? "dash.greeting.morning" : hour < 17 ? "dash.greeting.afternoon" : "dash.greeting.evening";
  const greetIcon = hour < 12 ? "☀️" : hour < 17 ? "🌤️" : "🌙";

  // Per-tool usage counts from the already-fetched recent jobs (no extra API).
  const usageByView = useMemo(() => {
    const m = new Map<View, number>();
    for (const j of jobs ?? []) {
      const v = jobToolView(j.toolType);
      if (v) m.set(v, (m.get(v) ?? 0) + 1);
    }
    return m;
  }, [jobs]);

  return (
    <div className="py-8 sm:py-10">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-fuchsia-600">
            {t("dash.eyebrow")}
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-900 sm:text-3xl">
            {lang === "ar"
              ? `${t(greetKey)}، ${firstName}`
              : `${t(greetKey)}, ${firstName}`} {greetIcon}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">{t("dash.welcomeSub")}</p>
        </div>
        {user && <StatusPill status={user.subscriptionStatus} className="shrink-0 self-start" />}
      </div>

      {/* Trial status */}
      {user?.subscriptionStatus === "none" && (
        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {quota && !quota.unlimited ? (
              <QuotaRing used={quota.used} limit={quota.limit} />
            ) : (
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                <QTBIcon name="crown" size={20} />
              </span>
            )}
            <div>
              <p className="flex items-center gap-2.5 text-sm font-semibold text-neutral-700">
                {t("dash.onFreePlan")}
                {quota && !quota.unlimited && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-bold",
                      quota.used >= quota.limit
                        ? "bg-rose-100 text-rose-700"
                        : quota.used >= quota.limit - 2
                          ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-100 text-emerald-700"
                    )}
                  >
                    {quota.used >= quota.limit
                      ? t("dash.quotaDone")
                      : `${quota.limit - quota.used} ${t("dash.quotaLeft", { limit: quota.limit })}`}
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-neutral-500">
                {quota && !quota.unlimited && quota.used >= quota.limit
                  ? t("dash.quotaResetHint")
                  : t("dash.unlockHint")}
              </p>
            </div>
          </div>
          <QTBButton size="sm" variant="outline" onClick={() => setView("subscription")} className="shrink-0">
            {t("dash.seePlans")}
          </QTBButton>
        </div>
      )}
      {user?.subscriptionStatus === "trial" && daysLeft !== null && daysLeft >= 0 && (
        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2.5 text-sm font-semibold text-amber-800">
            <QTBIcon name="clock" size={18} />
            {daysLeft === 0
              ? t("dash.trialEndsToday")
              : t("dash.trialLeft", { days: daysLeft })}
            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
              <QTBIcon name="bolt" size={11} /> {t("dash.unlimited")}
            </span>
          </p>
          <QTBButton size="sm" onClick={() => setView("subscription")} className="shrink-0">
            {t("dash.upgrade")}
          </QTBButton>
        </div>
      )}
      {(trialExpired || user?.subscriptionStatus === "expired") && (
        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2.5 text-sm font-semibold text-rose-800">
            <QTBIcon name="alert" size={18} />
            {t("dash.expired")}
          </p>
          <QTBButton size="sm" onClick={() => setView("subscription")} className="shrink-0">
            {t("dash.upgradeNow")}
          </QTBButton>
        </div>
      )}

      {/* Tools */}
      <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {TOOL_CARDS.map((tool, i) => (
          <motion.div
            key={tool.view}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.07 }}
            whileHover={{ y: -5 }}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition-all hover:border-neutral-300 hover:shadow-xl hover:shadow-fuchsia-100/50"
          >
            <span
              className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${tool.ring} opacity-75 transition-opacity group-hover:opacity-100`}
            />
            {(usageByView.get(tool.view) ?? 0) > 0 && (
              <span
                title={t("dash.runs", { n: usageByView.get(tool.view) ?? 0 })}
                className="absolute end-4 top-4 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-bold tabular-nums text-neutral-500 ring-1 ring-neutral-200 transition-colors group-hover:bg-fuchsia-50 group-hover:text-fuchsia-600 group-hover:ring-fuchsia-200"
              >
                ×{usageByView.get(tool.view)}
              </span>
            )}
            <ToolIcon
              tool={viewToToolKey(tool.view)}
              size={52}
              className="transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110"
            />
            <h3 className="mt-4 flex items-center gap-2 text-lg font-bold text-neutral-900">
              {t(tool.titleKey)}
              {tool.view === "tool-audio" && (
                <span className="rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-sm">
                  {t("dash.new")}
                </span>
              )}
            </h3>
            <p className="mt-1 text-sm text-neutral-500">{t(tool.copyKey)}</p>
            <div className="mt-5 flex items-center gap-2">
              <QTBButton size="sm" onClick={() => setView(tool.view)}>
                {t("dash.openTool")} <QTBIcon name="bolt" size={14} />
              </QTBButton>
              <QTBIcon
                name="arrow-left"
                size={15}
                className="-scale-x-100 text-neutral-300 transition-all duration-300 group-hover:translate-x-1 group-hover:text-fuchsia-500 rtl:scale-x-100"
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Recent activity */}
      <div className="mt-10 rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold text-neutral-900">
            <QTBIcon name="clock" size={17} className="text-fuchsia-500" />
            {t("dash.recent")}
          </h2>
          {jobs && jobs.length > 0 && (
            <span className="text-xs font-semibold text-neutral-400">
              {t("dash.lastJobs", { n: Math.min(jobs.length, 20) })}
            </span>
          )}
        </div>

        {jobs === null ? (
          <div className="space-y-3">
            {Array(4)
              .fill(0)
              .map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
          </div>
        ) : jobs.length === 0 ? (
          <EmptyState
            title={t("dash.recentEmpty")}
            description={t("dash.recentEmptySub")}
          />
        ) : (
          <ul className="qtb-scroll max-h-72 space-y-2 overflow-y-auto pr-1">
            {jobs.map((job) => {
              const target = jobToolView(job.toolType);
              const tone = (target && TONE_BY_VIEW[target]) || "neutral";
              const hint = target
                ? `${t("dash.reopenJob")} — ${jobToolLabel(job.toolType, t)}`
                : job.fileName;
              return (
                <li key={job.id || `${job.fileName}-${job.createdAt}`}>
                  <button
                    type="button"
                    onClick={() => target && setView(target)}
                    disabled={!target}
                    aria-label={hint}
                    title={hint}
                    className={cn(
                      "group/row flex w-full items-center gap-3 rounded-xl border p-3 text-start outline-none transition-all duration-200",
                      "focus-visible:ring-2 focus-visible:ring-fuchsia-400 focus-visible:ring-offset-1",
                      target
                        ? "border-neutral-100 bg-neutral-50/60 hover:-translate-y-px hover:border-neutral-200 hover:bg-white hover:shadow-sm active:scale-[0.995]"
                        : "cursor-default border-neutral-100 bg-neutral-50/60"
                    )}
                  >
                    <GradientChip icon={jobIcon(job.toolType)} tone={tone} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-neutral-800">
                        {job.fileName}
                      </p>
                      <p className="text-xs text-neutral-400">
                        {jobToolLabel(job.toolType, t)} ·{" "}
                        {formatDistanceToNow(new Date(job.createdAt), {
                          addSuffix: true,
                          locale: lang === "ar" ? arLocale : undefined,
                        })}
                      </p>
                    </div>
                    <StatusBadge status={job.status} />
                    {target && (
                      <QTBIcon
                        name="arrow-left"
                        size={14}
                        className="-scale-x-100 shrink-0 text-neutral-300 opacity-0 transition-all duration-200 group-hover/row:translate-x-0.5 group-hover/row:text-fuchsia-500 group-hover/row:opacity-100 rtl:scale-x-100 rtl:group-hover/row:-translate-x-0.5"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
