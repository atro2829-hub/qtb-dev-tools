"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { api, formatBytes, downloadDataUrl } from "@/lib/client-api";
import { useAppStore } from "@/store/app-store";
import { useQtbToast } from "@/components/qtb/use-qtb-toast";
import QTBIcon from "@/components/qtb/QTBIcon";
import QTBButton from "@/components/qtb/QTBButton";
import { GradientChip } from "@/components/qtb/ui-bits";
import ToolIcon from "@/components/qtb/ToolIcon";
import ToolHelpSheet from "@/components/qtb/ToolHelpSheet";
import ToolRecentRuns from "@/components/qtb/ToolRecentRuns";
import { cn } from "@/lib/utils";

const MAX_SIZE = 12 * 1024 * 1024; // 12MB

export default function ToolBgRemoveView() {
  const toast = useQtbToast();
  const lang = useAppStore((s) => s.lang);
  const t = useAppStore((s) => s.t);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  const acceptFile = (f: File | undefined | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error(new Error(t("bg.badType")), t("tool.unsupported"));
      return;
    }
    if (f.size > MAX_SIZE) {
      toast.error(
        new Error(t("tool.tooLargeMsg", { size: formatBytes(f.size), limit: "12MB" })),
        t("tool.tooLarge")
      );
      return;
    }
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = URL.createObjectURL(f);
    setFile(f);
    setPreview(previewRef.current);
    setResult(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    acceptFile(e.dataTransfer.files?.[0]);
  };

  // Double-submit guard immune to state batching.
  const runningRef = useRef(false);

  const handleRemove = async () => {
    if (!file || loading || runningRef.current) return;
    runningRef.current = true;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("image", file);
      const res = await api<{ image: string }>("/api/tools/bg-remove", {
        method: "POST",
        body: fd,
      });
      if (!res.image) throw new Error(t("bg.aiFail"));
      setResult(res.image);
      toast.success(t("bg.resultTitle"), t("bg.resultSub"));
    } catch (err) {
      toast.error(err, t("bg.failed"));
    } finally {
      runningRef.current = false;
      setLoading(false);
    }
  };

  const reset = () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setFile(null);
    setPreview(null);
    setResult(null);
  };

  return (
    <div className="py-8 sm:py-10">
      <button
        type="button"
        onClick={reset}
        className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-neutral-500 outline-none transition-colors hover:text-neutral-900"
      >
        <QTBIcon name="arrow-left" size={16} className={lang === "ar" ? "qtb-flip" : ""} /> {t("tool.back")}
      </button>

      <div className="flex flex-wrap items-start gap-4">
        <ToolIcon tool="bg" size={58} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900 sm:text-3xl">
            {t("bg.title")}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">{t("bg.sub")}</p>
        </div>
        <ToolHelpSheet tool="bg" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Upload / original */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-neutral-500">
            {t("bg.step1")}
          </h2>
          {!preview ? (
            <div
              role="button"
              tabIndex={0}
              aria-label={t("bg.pickImage")}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={cn(
                "flex min-h-64 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-colors outline-none",
                dragOver
                  ? "border-fuchsia-400 bg-fuchsia-50/60"
                  : "border-neutral-300 bg-neutral-50/60 hover:border-fuchsia-300 hover:bg-fuchsia-50/40"
              )}
            >
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                <QTBIcon name="upload-cloud" size={26} />
              </span>
              <p className="text-sm font-bold text-neutral-800">
                {t("tool.dropHere")}
              </p>
              <p className="text-xs text-neutral-500">
                {t("tool.orBrowse")} — {t("bg.formats")}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-2xl border border-neutral-200">
                <img
                  src={preview}
                  alt={t("bg.altOriginal")}
                  className="max-h-80 w-full object-contain"
                />
                {loading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/80 backdrop-blur-sm">
                    <div className="qtb-shimmer h-2 w-3/4 rounded-full" />
                    <p className="animate-pulse text-sm font-semibold text-neutral-700">
                      {t("bg.isolating")}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-xs text-neutral-500">
                  {file?.name} · {file ? formatBytes(file.size) : ""}
                </p>
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-xs font-bold text-rose-600 outline-none hover:bg-rose-50"
                >
                  <QTBIcon name="x" size={14} /> {t("tool.remove")}
                </button>
              </div>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => acceptFile(e.target.files?.[0])}
          />
        </div>

        {/* Result */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-neutral-500">
            {t("tool.result")}
          </h2>
          {result ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <div className="qtb-checker overflow-hidden rounded-2xl border border-neutral-200">
                <img
                  src={result}
                  alt={t("bg.altResult")}
                  className="max-h-80 w-full object-contain"
                />
              </div>
              <div className="flex flex-col gap-2.5 sm:flex-row">
                <QTBButton
                  className="flex-1"
                  wrapperClassName="w-full [&>button]:w-full"
                  onClick={() => downloadDataUrl(result, "qtb-nobg.png")}
                >
                  <QTBIcon name="download" size={15} /> {t("bg.downloadPng")}
                </QTBButton>
                <QTBButton variant="outline" className="flex-1" onClick={reset}>
                  {t("bg.another")}
                </QTBButton>
              </div>
            </motion.div>
          ) : loading ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-4 rounded-2xl border border-neutral-100 bg-neutral-50/60">
              <div className="qtb-spinner" />
              <p className="text-sm font-semibold text-neutral-600">
                {t("bg.removing")}
              </p>
              <div className="w-2/3 space-y-2">
                <div className="qtb-shimmer h-2 rounded-full" />
                <div className="qtb-shimmer h-2 w-5/6 rounded-full" />
              </div>
            </div>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-neutral-100 bg-neutral-50/60 p-8 text-center">
              <div className="qtb-checker h-24 w-24 rounded-2xl border border-neutral-200" />
              <p className="text-sm font-semibold text-neutral-700">
                {t("bg.resultPlaceholder")}
              </p>
              <p className="max-w-xs text-xs text-neutral-500">
                {t("bg.checkerHint")}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-7">
        <QTBButton
          size="lg"
          loading={loading}
          disabled={!file}
          onClick={handleRemove}
          wrapperClassName="w-full sm:w-auto [&>button]:w-full"
        >
          <QTBIcon name="sparkles" size={17} /> {t("bg.removeBg")}
        </QTBButton>
      </div>

      <ToolRecentRuns view="tool-bg" />
    </div>
  );
}
