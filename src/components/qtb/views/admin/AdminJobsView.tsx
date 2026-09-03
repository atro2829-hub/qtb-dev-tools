"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/client-api";
import { useQtbToast } from "@/components/qtb/use-qtb-toast";
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

const TOOL_FILTERS: { value: string; label: string; icon: QTBIconName }[] = [
  { value: "all", label: "All", icon: "activity" },
  { value: "bg-remove", label: "Background", icon: "remove-bg" },
  { value: "convert", label: "Converter", icon: "convert" },
  { value: "translate", label: "Translator", icon: "translate" },
  { value: "pdf-merge", label: "PDF Merge", icon: "pdf" },
  { value: "pdf-split", label: "PDF Split", icon: "pdf" },
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

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function AdminJobsView() {
  const toast = useQtbToast();
  const [jobs, setJobs] = useState<AdminJob[] | null>(null);
  const [tool, setTool] = useState("all");
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (toolFilter: string) => {
      setLoading(true);
      try {
        const res = await api<{ jobs: AdminJob[] }>(
          `/api/admin/jobs?limit=120&tool=${encodeURIComponent(toolFilter)}`
        );
        setJobs(res.jobs ?? []);
      } catch (err) {
        toast.error(err, "Failed to load tool activity");
        setJobs([]);
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    void load(tool);
  }, [tool]);

  return (
    <div className="pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <GradientChip icon="activity" tone="violet" size="lg" />
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-neutral-900 sm:text-2xl">
              Tool Activity
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Every job run across the platform — newest first.
            </p>
          </div>
        </div>
        <QTBButton variant="outline" size="sm" onClick={() => void load(tool)} disabled={loading}>
          <QTBIcon name="convert" size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </QTBButton>
        <QTBButton
          variant="outline"
          size="sm"
          onClick={() => {
            const toolQs = tool !== "all" ? `&tool=${encodeURIComponent(tool)}` : "";
            window.location.href = `/api/admin/jobs?format=csv${toolQs}`;
          }}
        >
          <QTBIcon name="download" size={14} /> Export CSV
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
            <QTBIcon name={f.icon} size={14} /> {f.label}
          </button>
        ))}
      </div>

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
            <p className="text-sm font-bold text-neutral-800">No jobs for this filter</p>
            <p className="max-w-xs text-xs text-neutral-500">
              Try another tool filter — activity appears here the moment members use a tool.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-2xl border border-neutral-200 bg-white md:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                    <th className="px-4 py-3">Tool</th>
                    <th className="px-4 py-3">Member</th>
                    <th className="px-4 py-3">File</th>
                    <th className="px-4 py-3">Detail</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">When</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job, i) => (
                    <motion.tr
                      key={job.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.015, 0.3) }}
                      className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50/60"
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
                        <JobStatusBadge status={job.status} />
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap text-neutral-500">
                        {relativeTime(job.createdAt)}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="rounded-2xl border border-neutral-200 bg-white p-4"
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
                  </div>
                  <div className="mt-3 space-y-1 border-t border-neutral-100 pt-3 text-xs text-neutral-600">
                    <p className="truncate">
                      <span className="font-semibold text-neutral-500">File:</span> {job.fileName || "—"}
                    </p>
                    {job.detail && (
                      <p className="truncate">
                        <span className="font-semibold text-neutral-500">Detail:</span> {job.detail}
                      </p>
                    )}
                    <p className="text-neutral-400">{relativeTime(job.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-4 text-center text-xs text-neutral-400">
              Showing {jobs.length} most recent job{jobs.length === 1 ? "" : "s"}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function JobStatusBadge({ status }: { status: string }) {
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
      {completed ? "Completed" : "Failed"}
    </span>
  );
}
