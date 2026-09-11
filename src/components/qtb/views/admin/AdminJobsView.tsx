"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { ar as arLocale } from "date-fns/locale";
import { api } from "@/lib/client-api";
import { useQtbToast } from "@/components/qtb/use-qtb-toast";
import { useAppStore } from "@/store/app-store";
import QTBIcon, { type QTBIconName } from "@/components/qtb/QTBIcon";
import QTBButton from "@/components/qtb/QTBButton";
import { GradientChip } from "@/components/qtb/ui-bits";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface AdminJob {
  id: string;
  toolType: string;
  fileName: string;
  sourceFormat: string;
  targetFormat: string;
  status: string;
  detail: string;
  createdAt: string;
  user: { email: string; name: string | null } | null;
}

const TOOL_FILTERS: { value: string; labelKey: string; icon: QTBIconName }[] = [
  { value: "all", labelKey: "aj.toolAll", icon: "activity" },
  { value: "bg-remove", labelKey: "aj.toolBg", icon: "remove-bg" },
  { value: "convert", labelKey: "aj.toolConvert", icon: "convert" },
  { value: "translate", labelKey: "aj.toolTranslate", icon: "translate" },
  { value: "audio-pdf", labelKey: "aj.toolAudio", icon: "mic" },
  { value: "pdf-merge", labelKey: "aj.toolMerge", icon: "pdf" },
  { value: "pdf-split", labelKey: "aj.toolSplit", icon: "pdf" },
];

function toolIcon(toolType: string): QTBIconName {
  const t = toolType.toLowerCase();
  if (t.includes("bg") || t.includes("background")) return "remove-bg";
  if (t.includes("merge")) return "pdf";
  if (t.includes("split")) return "pdf";
  if (t.includes("convert")) return "convert";
  if (t.includes("transl")) return "translate";
  return "sparkles";
}

function toolTone(toolType: string): "amber" | "rose" | "emerald" | "violet" {
  const t = toolType.toLowerCase();
  if (t.includes("bg") || t.includes("background")) return "amber";
  if (t.includes("pdf")) return "violet";
  if (t.includes("transl")) return "emerald";
  return "rose";
}

/** Bucket a raw toolType string into one of the admin filter keys. */
function jobBucket(toolType: string): string {
  const t = toolType.toLowerCase();
  if (t.includes("bg") || t.includes("background")) return "bg-remove";
  if (t.includes("merge")) return "pdf-merge";
  if (t.includes("split")) return "pdf-split";
  if (t.includes("transl")) return "translate";
  if (t.includes("audio") || t.includes("speech") || t.includes("transcri")) return "audio-pdf";
  if (t.includes("convert")) return "convert";
  return "other";
}

/** Distribution bar fills — mirror each tool's dashboard color identity. */
const BUCKET_FILLS: Record<string, string> = {
  "bg-remove": "bg-gradient-to-r from-amber-400 to-orange-400",
  convert: "bg-gradient-to-r from-rose-400 to-fuchsia-400",
  translate: "bg-gradient-to-r from-emerald-400 to-teal-400",
  "audio-pdf": "bg-gradient-to-r from-sky-400 to-cyan-400",
  "pdf-merge": "bg-gradient-to-r from-violet-400 to-fuchsia-400",
  "pdf-split": "bg-gradient-to-r from-violet-500 to-purple-500",
  other: "bg-neutral-300",
};

const BUCKET_LABEL_KEYS: Record<string, string> = {
  "bg-remove": "aj.toolBg",
  convert: "aj.toolConvert",
  translate: "aj.toolTranslate",
  "audio-pdf": "aj.toolAudio",
  "pdf-merge": "aj.toolMerge",
  "pdf-split": "aj.toolSplit",
  other: "aj.toolOther",
};

const BUCKET_ICONS: Record<string, QTBIconName> = {
  "bg-remove": "remove-bg",
  convert: "convert",
  translate: "translate",
  "audio-pdf": "mic",
  "pdf-merge": "pdf",
  "pdf-split": "pdf",
  other: "sparkles",
};

export default function AdminJobsView() {
  const toast = useQtbToast();
  const t = useAppStore((s) => s.t);
  const lang = useAppStore((s) => s.lang);
  const [jobs, setJobs] = useState<AdminJob[] | null>(null);
  const [tool, setTool] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "failed">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const bucketLabel = (key: string) => t(BUCKET_LABEL_KEYS[key] ?? "aj.toolOther");

  const load = useCallback(
    async (toolFilter: string) => {
      setLoading(true);
      try {
        const res = await api<{ jobs: AdminJob[] }>(
          `/api/admin/jobs?limit=120&tool=${encodeURIComponent(toolFilter)}`
        );
        setJobs(res.jobs ?? []);
      } catch (err) {
        toast.error(err, t("aj.loadFailed"));
        setJobs([]);
      } finally {
        setLoading(false);
      }
    },
    [toast, t]
  );

  useEffect(() => {
    void load(tool);
  }, [tool]);

  // Reset the drill-down when the underlying data changes shape.
  useEffect(() => {
    setExpandedId(null);
  }, [tool, statusFilter]);

  // Usage distribution + success stats computed from the loaded page of jobs.
  const dist = useMemo(() => {
    const buckets = new Map<string, number>();
    let failed = 0;
    for (const j of jobs ?? []) {
      const k = jobBucket(j.toolType);
      buckets.set(k, (buckets.get(k) ?? 0) + 1);
      if (j.status.toLowerCase() === "failed") failed++;
    }
    const total = jobs?.length ?? 0;
    const segments = [...buckets.entries()]
      .map(([key, count]) => ({ key, count, pct: total ? (count / total) * 100 : 0 }))
      .sort((a, b) => b.count - a.count);
    return { buckets, segments, failed, total, okPct: total ? Math.round(((total - failed) / total) * 100) : 0 };
  }, [jobs]);

  // Status drill-down (client-side over the loaded page — instant, no extra API).
  const filteredJobs = useMemo<AdminJob[]>(() => {
    if (jobs === null || statusFilter === "all") return jobs ?? [];
    return jobs.filter((j) =>
      statusFilter === "failed"
        ? j.status.toLowerCase() === "failed"
        : j.status.toLowerCase() !== "failed"
    );
  }, [jobs, statusFilter]);

  const copyError = (text: string) => {
    navigator.clipboard
      ?.writeText(text)
      .then(() => toast.success(t("aj.errorCopied"), t("aj.errorCopiedSub")))
      .catch(() => toast.info(t("aj.copyFailed"), t("aj.copyFailedSub")));
  };

  const relative = (iso: string) => {
    try {
      return formatDistanceToNow(new Date(iso), {
        addSuffix: true,
        locale: lang === "ar" ? arLocale : undefined,
      });
    } catch {
      return new Date(iso).toLocaleDateString();
    }
  };

  return (
    <div className="pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <GradientChip icon="activity" tone="violet" size="lg" />
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-neutral-900 sm:text-2xl">
              {t("aj.title")}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">{t("aj.subtitle")}</p>
          </div>
        </div>
        <QTBButton variant="outline" size="sm" onClick={() => void load(tool)} disabled={loading}>
          <QTBIcon name="convert" size={14} className={loading ? "animate-spin" : ""} /> {t("aj.refresh")}
        </QTBButton>
        <QTBButton
          variant="outline"
          size="sm"
          onClick={() => {
            const toolQs = tool !== "all" ? `&tool=${encodeURIComponent(tool)}` : "";
            const statusQs = statusFilter !== "all" ? `&status=${statusFilter}` : "";
            window.location.href = `/api/admin/jobs?format=csv${toolQs}${statusQs}`;
          }}
        >
          <QTBIcon name="download" size={14} /> {t("aj.exportCsv")}
        </QTBButton>
      </div>

      {/* Tool filter pills */}
      <div className="qtb-scroll mt-6 flex gap-2 overflow-x-auto pb-1">
        {TOOL_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setTool(f.value)}
            className={cn(
              "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-bold outline-none transition-colors",
              tool === f.value
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-neutral-900"
            )}
          >
            <QTBIcon name={f.icon} size={14} /> {t(f.labelKey)}
          </button>
        ))}
      </div>

      {/* Status drill-down chips */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
          {t("aj.status")}
        </span>
        {([
          { key: "all", label: t("aj.filterAll"), count: dist.total, cls: "border-neutral-900 bg-neutral-900 text-white" },
          {
            key: "completed",
            label: t("aj.filterCompleted"),
            count: dist.total - dist.failed,
            cls: "border-emerald-600 bg-emerald-600 text-white",
          },
          {
            key: "failed",
            label: t("aj.filterFailed"),
            count: dist.failed,
            cls: "border-rose-600 bg-rose-600 text-white",
          },
        ] as const).map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setStatusFilter(s.key)}
            aria-pressed={statusFilter === s.key}
            className={cn(
              "inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-fuchsia-400",
              statusFilter === s.key
                ? s.cls
                : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-neutral-900"
            )}
          >
            {s.key === "completed" && <QTBIcon name="check" size={11} />}
            {s.key === "failed" && <QTBIcon name="alert" size={11} />}
            {s.label}
            <span
              className={cn(
                "rounded-full px-1.5 text-[10px] tabular-nums",
                statusFilter === s.key ? "bg-white/20" : "bg-neutral-100 text-neutral-500"
              )}
            >
              {s.count}
            </span>
          </button>
        ))}
        {statusFilter === "failed" && dist.failed > 0 && (
          <span className="ms-1 hidden items-center gap-1.5 text-[11px] font-semibold text-rose-500 sm:inline-flex">
            <QTBIcon name="info" size={12} /> {t("aj.failedInspectHint")}
          </span>
        )}
      </div>

      {/* Usage distribution (aggregate view only) */}
      {tool === "all" && jobs !== null && !loading && jobs.length > 0 && (
        <div className="mt-5 rounded-2xl border border-neutral-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-bold text-neutral-900">
              <QTBIcon name="list-check" size={15} className="text-violet-500" />
              {t("aj.distribution")}
            </h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-neutral-500">
              <span className="inline-flex items-center gap-1.5">
                <QTBIcon name="activity" size={12} className="text-violet-500" />
                {t("aj.jobsLoaded", { n: dist.total })}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5",
                  dist.okPct >= 90 ? "text-emerald-600" : dist.okPct >= 70 ? "text-amber-600" : "text-rose-600"
                )}
              >
                <QTBIcon name="check" size={12} /> {t("aj.succeededPct", { pct: dist.okPct })}
              </span>
              {dist.failed > 0 && (
                <span className="inline-flex items-center gap-1.5 text-rose-600">
                  <QTBIcon name="alert" size={12} /> {t("aj.failedCount", { n: dist.failed })}
                </span>
              )}
            </div>
          </div>
          <div
            role="img"
            aria-label={dist.segments.map((s) => `${bucketLabel(s.key)} ${s.count}`).join(", ")}
            className="mt-3 flex h-3 w-full gap-px overflow-hidden rounded-full bg-neutral-100"
          >
            {dist.segments.map((s) => (
              <span
                key={s.key}
                title={`${bucketLabel(s.key)} — ${s.count} (${Math.round(s.pct)}%)`}
                style={{ width: `${s.pct}%` }}
                className={cn("h-full min-w-[3px] transition-all duration-500", BUCKET_FILLS[s.key])}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {dist.segments.map((s) => (
              <span
                key={s.key}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-neutral-600"
              >
                <span className={cn("h-2 w-2 rounded-full", BUCKET_FILLS[s.key])} />
                <QTBIcon name={BUCKET_ICONS[s.key]} size={11} className="text-neutral-400" />
                {bucketLabel(s.key)}
                <span className="tabular-nums text-neutral-400">×{s.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* List */}
      <div className="mt-5">
        {jobs === null || loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/60 p-12 text-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
              <QTBIcon name="activity" size={26} />
            </span>
            <p className="text-sm font-bold text-neutral-800">{t("aj.emptyAll")}</p>
            <p className="max-w-xs text-xs text-neutral-500">{t("aj.emptyAllSub")}</p>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/60 p-12 text-center">
            <span
              className={cn(
                "inline-flex h-14 w-14 items-center justify-center rounded-2xl",
                statusFilter === "failed" ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
              )}
            >
              <QTBIcon name={statusFilter === "failed" ? "check" : "alert"} size={26} />
            </span>
            <p className="text-sm font-bold text-neutral-800">
              {statusFilter === "failed" ? t("aj.emptyFailed") : t("aj.emptyCompleted")}
            </p>
            <p className="max-w-xs text-xs text-neutral-500">
              {statusFilter === "failed" ? t("aj.emptyFailedSub") : t("aj.emptyCompletedSub")}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-2xl border border-neutral-200 bg-white md:block">
              <table className="w-full text-start text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                    <th className="px-4 py-3 text-start">{t("aj.thTool")}</th>
                    <th className="px-4 py-3 text-start">{t("aj.thMember")}</th>
                    <th className="px-4 py-3 text-start">{t("aj.thFile")}</th>
                    <th className="px-4 py-3 text-start">{t("aj.thDetail")}</th>
                    <th className="px-4 py-3 text-start">{t("aj.thStatus")}</th>
                    <th className="px-4 py-3 text-start">{t("aj.thWhen")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs.map((job, i) => {
                    const failed = job.status.toLowerCase() === "failed";
                    const expanded = expandedId === job.id;
                    return (
                      <Fragment key={job.id}>
                        <motion.tr
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: Math.min(i * 0.015, 0.3) }}
                          onClick={failed ? () => setExpandedId(expanded ? null : job.id) : undefined}
                          aria-expanded={failed ? expanded : undefined}
                          className={cn(
                            "border-b border-neutral-50 last:border-0 hover:bg-neutral-50/60",
                            failed &&
                              "cursor-pointer shadow-[inset_3px_0_0_0_#f43f5e] rtl:shadow-[inset_-3px_0_0_0_#f43f5e] hover:bg-rose-50/40",
                            expanded && "bg-rose-50/40"
                          )}
                        >
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-2 font-bold capitalize text-neutral-800">
                              <GradientChip icon={toolIcon(job.toolType)} tone={toolTone(job.toolType)} />
                              {job.toolType.replace("-", " ")}
                            </span>
                          </td>
                          <td className="max-w-44 px-4 py-3">
                            <p className="truncate text-xs font-semibold text-neutral-800">
                              {job.user?.name || "—"}
                            </p>
                            <p className="truncate text-[11px] text-neutral-500">{job.user?.email}</p>
                          </td>
                          <td className="max-w-40 px-4 py-3">
                            <p className="truncate text-xs text-neutral-700">{job.fileName || "—"}</p>
                          </td>
                          <td className="max-w-44 px-4 py-3">
                            <p className="truncate text-xs text-neutral-500">{job.detail || "—"}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5">
                              <JobStatusBadge status={job.status} />
                              {failed && (
                                <QTBIcon
                                  name="chevron-down"
                                  size={13}
                                  className={cn(
                                    "text-rose-400 transition-transform duration-200 rtl:-scale-x-100",
                                    expanded ? "rotate-90 rtl:-rotate-90" : "rotate-0"
                                  )}
                                />
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap text-neutral-500">
                            {relative(job.createdAt)}
                          </td>
                        </motion.tr>
                        {expanded && (
                          <motion.tr
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="bg-rose-50/50"
                          >
                            <td colSpan={6} className="border-b border-rose-100 px-4 pb-4 pt-1">
                              <div className="rounded-xl border border-rose-200 bg-white p-3.5">
                                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                  <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-rose-600">
                                    <QTBIcon name="alert" size={12} /> {t("aj.errorDetail")}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (job.detail) copyError(job.detail);
                                    }}
                                    disabled={!job.detail}
                                    className="inline-flex min-h-7 items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 text-[11px] font-bold text-neutral-600 outline-none transition-colors hover:border-neutral-300 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    <QTBIcon name="copy" size={12} /> {t("aj.copyError")}
                                  </button>
                                </div>
                                <pre
                                  dir="auto"
                                  className="qtb-scroll max-h-40 overflow-y-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words text-neutral-700"
                                >
                                  {job.detail || t("aj.noErrorDetail")}
                                </pre>
                              </div>
                            </td>
                          </motion.tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {filteredJobs.map((job) => {
                const failed = job.status.toLowerCase() === "failed";
                const expanded = expandedId === job.id;
                return (
                  <div
                    key={job.id}
                    role={failed ? "button" : undefined}
                    tabIndex={failed ? 0 : undefined}
                    aria-expanded={failed ? expanded : undefined}
                    onClick={failed ? () => setExpandedId(expanded ? null : job.id) : undefined}
                    onKeyDown={
                      failed
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setExpandedId(expanded ? null : job.id);
                            }
                          }
                        : undefined
                    }
                    className={cn(
                      "rounded-2xl border border-neutral-200 bg-white p-4",
                      failed && "cursor-pointer border-s-4 border-s-rose-500 outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <GradientChip icon={toolIcon(job.toolType)} tone={toolTone(job.toolType)} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold capitalize text-neutral-800">
                          {job.toolType.replace("-", " ")}
                        </p>
                        <p className="truncate text-xs text-neutral-500">{job.user?.email}</p>
                      </div>
                      <JobStatusBadge status={job.status} />
                      {failed && (
                        <QTBIcon
                          name="chevron-down"
                          size={14}
                          className={cn(
                            "shrink-0 text-rose-400 transition-transform duration-200 rtl:-scale-x-100",
                            expanded ? "rotate-180" : "rotate-0"
                          )}
                        />
                      )}
                    </div>
                    <div className="mt-3 space-y-1 border-t border-neutral-100 pt-3 text-xs text-neutral-600">
                      <p className="truncate">
                        <span className="font-semibold text-neutral-500">{t("aj.fileLabel")}</span> {job.fileName || "—"}
                      </p>
                      {job.detail && !expanded && (
                        <p className="truncate">
                          <span className="font-semibold text-neutral-500">{t("aj.detailLabel")}</span> {job.detail}
                        </p>
                      )}
                      <p className="text-neutral-400">{relative(job.createdAt)}</p>
                    </div>
                    {failed && expanded && (
                      <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50/60 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-rose-600">
                            <QTBIcon name="alert" size={12} /> {t("aj.errorDetail")}
                          </p>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (job.detail) copyError(job.detail);
                            }}
                            disabled={!job.detail}
                            className="inline-flex min-h-7 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 text-[11px] font-bold text-neutral-600 outline-none transition-colors hover:border-neutral-300 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <QTBIcon name="copy" size={12} /> {t("aj.copy")}
                          </button>
                        </div>
                        <pre
                          dir="auto"
                          className="qtb-scroll max-h-40 overflow-y-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words text-neutral-700"
                        >
                          {job.detail || t("aj.noErrorDetail")}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="mt-4 text-center text-xs text-neutral-400">
              {t("aj.showing", { x: filteredJobs.length, y: jobs.length })}
              {statusFilter === "failed" && ` · ${t("aj.onlyFailed")}`}
              {statusFilter === "completed" && ` · ${t("aj.onlyCompleted")}`}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function JobStatusBadge({ status }: { status: string }) {
  const t = useAppStore((s) => s.t);
  const completed = status.toLowerCase() !== "failed";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold",
        completed
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-rose-200 bg-rose-50 text-rose-700"
      )}
    >
      <span className={cn("size-1.5 rounded-full", completed ? "bg-emerald-500" : "bg-rose-500")} />
      {completed ? t("aj.badgeCompleted") : t("aj.badgeFailed")}
    </span>
  );
}
