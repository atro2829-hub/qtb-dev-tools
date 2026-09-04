"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ar as arLocale } from "date-fns/locale";
import { api } from "@/lib/client-api";
import { useAppStore, type ToolJob, type View } from "@/store/app-store";
import QTBIcon, { type QTBIconName } from "@/components/qtb/QTBIcon";
import QTBButton from "@/components/qtb/QTBButton";
import { GradientChip } from "@/components/qtb/ui-bits";
import { cn } from "@/lib/utils";

type ChipTone = "amber" | "rose" | "emerald" | "sky" | "violet" | "neutral";

/** Map a ToolJob.toolType string back to its tool view (mirrors DashboardView). */
function jobView(toolType: string): View | null {
  const s = toolType.toLowerCase();
  if (s.includes("bg") || s.includes("background") || s.includes("remove")) return "tool-bg";
  if (s.includes("audio") || s.includes("speech") || s.includes("transcri")) return "tool-audio";
  if (s.includes("transl")) return "tool-translate";
  if (s.includes("convert")) return "tool-convert";
  if (s.includes("pdf")) return "tool-pdf";
  return null;
}

const ICON_BY_VIEW: Record<string, QTBIconName> = {
  "tool-bg": "remove-bg",
  "tool-convert": "convert",
  "tool-translate": "translate",
  "tool-audio": "mic",
  "tool-pdf": "pdf",
};

const TONE_BY_VIEW: Record<string, ChipTone> = {
  "tool-bg": "amber",
  "tool-convert": "rose",
  "tool-translate": "emerald",
  "tool-audio": "sky",
  "tool-pdf": "violet",
};

function statusMeta(status: string): { ok: boolean; failed: boolean; pending: boolean } {
  const s = status.toLowerCase();
  return {
    ok: s === "completed" || s === "done" || s === "success",
    failed: s === "failed" || s === "error",
    pending: s === "processing" || s === "pending" || s === "running",
  };
}

/**
 * "Your recent runs with this tool" — compact history strip rendered at the
 * bottom of every tool view. Reuses the existing /api/tools/jobs endpoint
 * (no new API), renders only when this tool has runs, and links to the
 * dashboard's Recent Activity for the full list.
 */
export default function ToolRecentRuns({ view }: { view: View }) {
  const lang = useAppStore((s) => s.lang);
  const t = useAppStore((s) => s.t);
  const setView = useAppStore((s) => s.setView);
  const [jobs, setJobs] = useState<ToolJob[] | null>(null);

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
        if (active) setJobs(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const runs = useMemo(
    () =>
      (jobs ?? [])
        .filter((j) => jobView(j.toolType) === view)
        .slice(0, 4),
    [jobs, view]
  );

  // Success-rate stats across ALL of this tool's runs on the loaded page.
  const stats = useMemo(() => {
    const mine = (jobs ?? []).filter((j) => jobView(j.toolType) === view);
    const ok = mine.filter((j) => statusMeta(j.status).ok).length;
    return { n: mine.length, pct: mine.length ? Math.round((ok / mine.length) * 100) : 0 };
  }, [jobs, view]);

  // Hidden entirely until data proves there is history (keeps first-run clean).
  if (jobs === null || runs.length === 0) return null;

  return (
    <section
      aria-label={t("runs.title")}
      className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5"
    >
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-neutral-900">
            <QTBIcon name="history" size={15} className="text-fuchsia-500" />
            {t("runs.title")}
          </h2>
          <span
            title={t("runs.recentHint")}
            className={cn(
              "hidden rounded-full px-2.5 py-1 text-[10px] font-bold tabular-nums ring-1 sm:inline-flex",
              stats.pct >= 90
                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                : stats.pct >= 70
                  ? "bg-amber-50 text-amber-700 ring-amber-200"
                  : "bg-rose-50 text-rose-700 ring-rose-200"
            )}
          >
            {t(stats.n === 1 ? "runs.stats" : "runs.statsPlural", { n: stats.n, pct: stats.pct })}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setView("dashboard")}
          className="group/link inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs font-bold text-neutral-400 outline-none transition-colors hover:text-fuchsia-600 focus-visible:ring-2 focus-visible:ring-fuchsia-400"
        >
          {t("runs.viewAll")}
          <QTBIcon
            name="arrow-left"
            size={13}
            className="-scale-x-100 transition-transform duration-200 group-hover/link:translate-x-0.5 rtl:scale-x-100 rtl:group-hover/link:-translate-x-0.5"
          />
        </button>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {runs.map((job) => {
          const st = statusMeta(job.status);
          const tone = TONE_BY_VIEW[view] ?? "neutral";
          const icon = ICON_BY_VIEW[view] ?? "sparkles";
          return (
            <li
              key={job.id || `${job.fileName}-${job.createdAt}`}
              className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-neutral-50/60 p-2.5 transition-colors hover:border-neutral-200 hover:bg-white"
              title={job.fileName}
            >
              <GradientChip icon={icon} tone={tone} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-neutral-800">
                  {job.fileName}
                </p>
                <p className="text-[11px] text-neutral-400">
                  {formatDistanceToNow(new Date(job.createdAt), {
                    addSuffix: true,
                    locale: lang === "ar" ? arLocale : undefined,
                  })}
                </p>
              </div>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold",
                  st.ok && "border-emerald-200 bg-emerald-50 text-emerald-700",
                  st.failed && "border-rose-200 bg-rose-50 text-rose-700",
                  st.pending && "border-amber-200 bg-amber-50 text-amber-700",
                  !st.ok && !st.failed && !st.pending &&
                    "border-neutral-200 bg-neutral-50 text-neutral-500"
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    st.ok && "bg-emerald-500",
                    st.failed && "bg-rose-500",
                    st.pending && "bg-amber-500",
                    !st.ok && !st.failed && !st.pending && "bg-neutral-400"
                  )}
                />
                {st.ok
                  ? t("dash.statusCompleted")
                  : st.failed
                    ? t("dash.statusFailed")
                    : st.pending
                      ? t("dash.statusProcessing")
                      : t("dash.statusUnknown")}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-neutral-400">
        <QTBIcon name="info" size={12} />
        {t("runs.recentHint")}
      </p>
    </section>
  );
}
