"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { fetchRunProgress } from "@/lib/client-api";
import { formatBytes } from "@/lib/client-api";
import { useAppStore } from "@/store/app-store";
import QTBIcon from "@/components/qtb/QTBIcon";
import { cn } from "@/lib/utils";

export type MeterPhase = "idle" | "upload" | "process";

interface RunMeterProps {
  phase: MeterPhase;
  /** Real bytes-on-the-wire percentage (0-100) during upload. */
  uploadPct?: number;
  uploadedBytes?: number;
  totalBytes?: number;
  /** Client-generated run key — enables real server-side progress polling. */
  runKey?: string | null;
  className?: string;
}

const POLL_MS = 800;
/** Cap the animated bar below 100 until the run truly completes. */
const SOFT_CAP = 97;

const STAGE_ICONS: Record<string, React.ComponentProps<typeof QTBIcon>["name"]> = {
  queued: "activity",
  preparing: "activity",
  transcribing: "mic",
  translating: "globe",
  converting: "convert",
  processing: "sparkles",
  organizing: "file-text",
  building: "file-check",
  saving: "upload-cloud",
};

/**
 * Live run meter: a real 1→100 counter.
 * - upload phase  → actual bytes on the wire (XHR upload progress)
 * - process phase → polls the server's milestone progress (progress + stage)
 * Both phases animate a gradient bar and a tabular-num counter; the process
 * phase tweens smoothly between real milestones instead of snapping.
 */
export default function RunMeter({
  phase,
  uploadPct = 0,
  uploadedBytes = 0,
  totalBytes = 0,
  runKey,
  className,
}: RunMeterProps) {
  const t = useAppStore((s) => s.t);
  const [serverPct, setServerPct] = useState(5);
  const [serverStage, setServerStage] = useState("queued");
  const [terminal, setTerminal] = useState<null | "completed" | "failed">(null);
  const [displayPct, setDisplayPct] = useState(0);
  const tweenRef = useRef<number | null>(null);

  /* ---- poll real server progress during the process phase ---- */
  useEffect(() => {
    if (phase !== "process" || !runKey) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const p = await fetchRunProgress(runKey);
        if (!alive) return;
        if (p.status === "completed") {
          setServerPct(100);
          setServerStage("done");
          setTerminal("completed");
          return; // stop polling
        }
        if (p.status === "failed") {
          setServerPct((prev) => Math.max(prev, SOFT_CAP));
          setServerStage("failed");
          setTerminal("failed");
          return; // stop polling
        }
        if (typeof p.progress === "number") setServerPct((prev) => Math.max(prev, Math.min(SOFT_CAP, p.progress)));
        if (p.stage) setServerStage(p.stage);
      } catch {
        /* transient network hiccup — keep polling */
      }
      if (alive) timer = setTimeout(tick, POLL_MS);
    };
    tick();

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [phase, runKey]);

  /* ---- ease the displayed counter toward its target ---- */
  useEffect(() => {
    const target = phase === "upload" ? Math.max(1, uploadPct) : phase === "process" ? Math.max(serverPct, 8) : 0;
    let cancelled = false;
    const step = () => {
      if (cancelled) return;
      setDisplayPct((prev) => {
        const diff = target - prev;
        if (Math.abs(diff) < 0.4) return target;
        return prev + diff * 0.14;
      });
      tweenRef.current = window.setTimeout(step, 50);
    };
    step();
    return () => {
      cancelled = true;
      if (tweenRef.current) clearTimeout(tweenRef.current);
    };
  }, [phase, uploadPct, serverPct]);

  if (phase === "idle") return null;

  const shown = Math.round(displayPct);
  const isUpload = phase === "upload";
  const stageKey = `meter.stage.${serverStage}`;
  const stageLabel = t(stageKey);
  const stageIcon = STAGE_ICONS[serverStage] ?? "activity";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
        role="status"
        aria-live="polite"
        aria-label={isUpload ? t("meter.uploading") : stageLabel}
        className={cn(
          "relative overflow-hidden rounded-2xl border p-4",
          terminal === "failed"
            ? "border-rose-200/70 bg-rose-50/60 dark:border-rose-500/30 dark:bg-rose-950/20"
            : "border-emerald-200/70 bg-emerald-50/50 dark:border-emerald-500/25 dark:bg-emerald-950/15",
          className
        )}
      >
        {/* shimmer wash */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40 [background:radial-gradient(120%_80%_at_15%_0%,rgba(16,185,129,0.12),transparent_55%),radial-gradient(120%_80%_at_85%_100%,rgba(56,189,248,0.14),transparent_55%)]"
        />

        <div className="relative flex items-center gap-3">
          <span
            className={cn(
              "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm",
              terminal === "failed"
                ? "from-rose-500 to-orange-400"
                : isUpload
                  ? "from-sky-500 to-cyan-400"
                  : "from-emerald-500 to-teal-400"
            )}
          >
            <QTBIcon
              name={terminal === "failed" ? "eye-off" : isUpload ? "upload-cloud" : stageIcon}
              className="h-4.5 w-4.5"
            />
            {!terminal && (
              <span
                aria-hidden
                className="absolute inset-0 animate-ping rounded-xl bg-white/25"
                style={{ animationDuration: "1.8s" }}
              />
            )}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-sm font-semibold text-foreground">
                {terminal === "failed" ? t("meter.stage.failed") : isUpload ? t("meter.uploading") : stageLabel}
              </p>
              <p
                className="shrink-0 bg-gradient-to-r from-emerald-600 to-sky-600 bg-clip-text text-lg font-bold tabular-nums text-transparent dark:from-emerald-400 dark:to-sky-400"
                aria-label={`${shown}%`}
              >
                {shown}
                <span className="text-xs font-semibold">%</span>
              </p>
            </div>

            {/* bar */}
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
              <div
                className={cn(
                  "h-full rounded-full bg-gradient-to-r transition-[width] duration-200 ease-out",
                  terminal === "failed"
                    ? "from-rose-500 to-orange-400"
                    : isUpload
                      ? "from-sky-500 via-cyan-400 to-emerald-400"
                      : "from-emerald-500 via-teal-400 to-sky-400"
                )}
                style={{ width: `${Math.min(100, Math.max(2, shown))}%` }}
              />
            </div>

            <p className="mt-1.5 truncate text-[11px] font-medium text-muted-foreground">
              {isUpload
                ? totalBytes > 0
                  ? t("meter.uploadBytes")
                      .replace("{uploaded}", formatBytes(uploadedBytes))
                      .replace("{total}", formatBytes(totalBytes))
                  : t("meter.uploading")
                : terminal === "failed"
                  ? t("meter.failedHint")
                  : t("meter.realHint")}
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/** Small cloud-permalink chip shown after a result has been archived. */
export function CloudLinkChip({ url, onCopied }: { url: string | null; onCopied?: () => void }) {
  const t = useAppStore((s) => s.t);

  if (!url) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      onCopied?.();
    } catch {
      window.open(url, "_blank", "noopener");
    }
  };

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 18 }}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50/70 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/25 dark:text-emerald-300"
    >
      <QTBIcon name="upload-cloud" className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{t("meter.cloudSaved")}</span>
      <button
        type="button"
        onClick={copy}
        title={t("meter.copyLink")}
        aria-label={t("meter.copyLink")}
        className="ms-0.5 inline-flex items-center gap-1 rounded-full bg-emerald-600/10 px-2 py-0.5 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-600/20 dark:text-emerald-300"
      >
        <QTBIcon name="copy-check" className="h-3 w-3" />
        {t("meter.copyLink")}
      </button>
    </motion.span>
  );
}
