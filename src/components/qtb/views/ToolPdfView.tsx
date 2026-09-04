"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  api,
  base64ToBlob,
  downloadBlob,
  formatBytes,
} from "@/lib/client-api";
import { useQtbToast } from "@/components/qtb/use-qtb-toast";
import { useAppStore } from "@/store/app-store";
import QTBIcon from "@/components/qtb/QTBIcon";
import QTBButton from "@/components/qtb/QTBButton";
import { GradientChip } from "@/components/qtb/ui-bits";
import ToolIcon from "@/components/qtb/ToolIcon";
import ToolHelpSheet from "@/components/qtb/ToolHelpSheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ToolRecentRuns from "@/components/qtb/ToolRecentRuns";
import { cn } from "@/lib/utils";

const MAX_TOTAL = 30 * 1024 * 1024; // 30 MB combined for merge
const MAX_SINGLE = 20 * 1024 * 1024; // 20 MB for split
const MAX_FILES = 10;

interface MergeFile {
  id: string;
  file: File;
}

interface PdfResult {
  fileName: string;
  blob: Blob;
  detail: string;
}

export default function ToolPdfView() {
  const toast = useQtbToast();
  const lang = useAppStore((s) => s.lang);
  const t = useAppStore((s) => s.t);
  const mergeInputRef = useRef<HTMLInputElement>(null);
  const splitInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"merge" | "split">("merge");

  // merge state
  const [files, setFiles] = useState<MergeFile[]>([]);
  const [dragOverMerge, setDragOverMerge] = useState(false);

  // split state
  const [splitFile, setSplitFile] = useState<File | null>(null);
  const [pages, setPages] = useState("");
  const [dragOverSplit, setDragOverSplit] = useState(false);

  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<PdfResult | null>(null);

  const totalSize = files.reduce((s, f) => s + f.file.size, 0);

  const addMergeFiles = (incoming: FileList | File[] | null | undefined) => {
    if (!incoming) return;
    const added = Array.from(incoming).filter((f) =>
      f.name.toLowerCase().endsWith(".pdf")
    );
    if (added.length === 0) {
      toast.error(new Error(t("pdf.onlyPdfs")), t("pdf.wrongType"));
      return;
    }
    setFiles((prev) => {
      const next = [...prev, ...added.map((f, i) => ({ id: `${Date.now()}-${i}-${f.name}`, file: f }))];
      if (next.length > MAX_FILES) {
        toast.error(new Error(t("pdf.tooMany", { n: MAX_FILES })), t("pdf.tooManyTitle"));
        return prev;
      }
      const size = next.reduce((s, f) => s + f.file.size, 0);
      if (size > MAX_TOTAL) {
        toast.error(new Error(t("pdf.tooBig")), t("tool.tooLarge"));
        return prev;
      }
      return next;
    });
    setDone(null);
  };

  const move = (index: number, dir: -1 | 1) => {
    setFiles((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const acceptSplitFile = (f: File | undefined | null) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      toast.error(new Error(t("pdf.onlyPdfs")), t("pdf.wrongType"));
      return;
    }
    if (f.size > MAX_SINGLE) {
      toast.error(
        new Error(t("tool.tooLargeMsg", { size: formatBytes(f.size), limit: "20MB" })),
        t("tool.tooLarge")
      );
      return;
    }
    setSplitFile(f);
    setDone(null);
  };

  const run = async () => {
    if (loading) return;
    setDone(null);
    setLoading(true);
    try {
      if (mode === "merge") {
        if (files.length < 2) {
          toast.error(new Error(t("pdf.needTwo")), t("pdf.needMore"));
          setLoading(false);
          return;
        }
        const fd = new FormData();
        files.forEach((f) => fd.append("files", f.file));
        const res = await api<{ fileName: string; dataBase64: string; pageCount: number }>(
          "/api/tools/pdf-merge",
          { method: "POST", body: fd }
        );
        setDone({
          fileName: res.fileName,
          blob: base64ToBlob(res.dataBase64, "application/pdf"),
          detail: t("pdf.mergedDetail", { count: files.length, pages: res.pageCount }),
        });
        toast.success(t("pdf.mergeDone"), t("pdf.mergeDoneSub", { n: files.length }));
      } else {
        if (!splitFile) {
          toast.error(new Error(t("pdf.uploadFirst")), t("pdf.noFile"));
          setLoading(false);
          return;
        }
        if (!pages.trim()) {
          toast.error(new Error(t("pdf.pagesRequired")), t("pdf.pagesRequiredTitle"));
          setLoading(false);
          return;
        }
        const fd = new FormData();
        fd.set("file", splitFile);
        fd.set("pages", pages);
        const res = await api<{ fileName: string; dataBase64: string; pageCount: number }>(
          "/api/tools/pdf-split",
          { method: "POST", body: fd }
        );
        setDone({
          fileName: res.fileName,
          blob: base64ToBlob(res.dataBase64, "application/pdf"),
          detail: t("pdf.extractedDetail", { pages: res.pageCount }),
        });
        toast.success(t("pdf.splitDone"), t("pdf.splitDoneSub", { n: res.pageCount }));
      }
    } catch (err) {
      toast.error(err, mode === "merge" ? t("pdf.mergeFailed") : t("pdf.splitFailed"));
    } finally {
      setLoading(false);
    }
  };

  const resetAll = () => {
    setFiles([]);
    setSplitFile(null);
    setPages("");
    setDone(null);
    if (mode === "merge") {
      if (mergeInputRef.current) mergeInputRef.current.value = "";
    } else if (splitInputRef.current) {
      splitInputRef.current.value = "";
    }
  };

  const dropzone = (over: boolean) =>
    cn(
      "flex min-h-52 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-colors outline-none",
      over
        ? "border-violet-400 bg-violet-50/60"
        : "border-neutral-300 bg-neutral-50/60 hover:border-violet-300 hover:bg-violet-50/40"
    );

  const canRun = mode === "merge" ? files.length >= 2 && !loading : !!splitFile && pages.trim().length > 0 && !loading;

  return (
    <div className="py-8 sm:py-10">
      <button
        type="button"
        onClick={resetAll}
        className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-neutral-500 outline-none transition-colors hover:text-neutral-900"
      >
        <QTBIcon name="arrow-left" size={16} className={lang === "ar" ? "qtb-flip" : ""} /> {t("tool.back")}
      </button>

      <div className="flex flex-wrap items-start gap-4">
        <ToolIcon tool="pdf" size={58} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900 sm:text-3xl">
            {t("pdf.title")}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">{t("pdf.sub")}</p>
        </div>
        <ToolHelpSheet tool="pdf" />
      </div>

      <Tabs value={mode} onValueChange={(v) => { setMode(v as "merge" | "split"); setDone(null); }} className="mt-6">
        <TabsList className="h-11 rounded-xl bg-neutral-100 p-1">
          <TabsTrigger value="merge" className="min-h-9 rounded-lg px-4 font-bold data-[state=active]:bg-white data-[state=active]:text-neutral-900">
            <QTBIcon name="copy-check" size={15} /> {t("pdf.merge")}
          </TabsTrigger>
          <TabsTrigger value="split" className="min-h-9 rounded-lg px-4 font-bold data-[state=active]:bg-white data-[state=active]:text-neutral-900">
            <QTBIcon name="list-check" size={15} /> {t("pdf.split")}
          </TabsTrigger>
        </TabsList>

        {/* ------------------------------ MERGE ------------------------------ */}
        <TabsContent value="merge" className="mt-5">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-neutral-500">
                {t("pdf.stepMerge")}
              </h2>
              {files.length === 0 ? (
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={t("pdf.addFiles")}
                  onClick={() => mergeInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") mergeInputRef.current?.click();
                  }}
                  onDragOver={(e) => { e.preventDefault(); setDragOverMerge(true); }}
                  onDragLeave={() => setDragOverMerge(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverMerge(false);
                    addMergeFiles(e.dataTransfer.files);
                  }}
                  className={dropzone(dragOverMerge)}
                >
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
                    <QTBIcon name="upload-cloud" size={26} />
                  </span>
                  <p className="text-sm font-bold text-neutral-800">{t("pdf.dropMerge")}</p>
                  <p className="text-xs text-neutral-500">{t("pdf.formats")}</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {files.map((f, idx) => (
                    <motion.div
                      key={f.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50/60 p-3"
                    >
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-xs font-extrabold text-white">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-neutral-800">{f.file.name}</p>
                        <p className="text-xs text-neutral-500">{formatBytes(f.file.size)}</p>
                      </div>
                      <button
                        type="button"
                        aria-label={t("pdf.moveUp", { name: f.file.name })}
                        onClick={() => move(idx, -1)}
                        disabled={idx === 0}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 outline-none hover:bg-neutral-200/70 disabled:opacity-30"
                      >
                        <QTBIcon name="chevron-down" size={15} className="rotate-180" />
                      </button>
                      <button
                        type="button"
                        aria-label={t("pdf.moveDown", { name: f.file.name })}
                        onClick={() => move(idx, 1)}
                        disabled={idx === files.length - 1}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 outline-none hover:bg-neutral-200/70 disabled:opacity-30"
                      >
                        <QTBIcon name="chevron-down" size={15} />
                      </button>
                      <button
                        type="button"
                        aria-label={t("pdf.removeFile", { name: f.file.name })}
                        onClick={() => { setFiles((prev) => prev.filter((x) => x.id !== f.id)); setDone(null); }}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-rose-600 outline-none hover:bg-rose-50"
                      >
                        <QTBIcon name="x" size={15} />
                      </button>
                    </motion.div>
                  ))}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => mergeInputRef.current?.click()}
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-bold text-violet-700 outline-none hover:text-violet-900"
                    >
                      <QTBIcon name="upload-cloud" size={15} /> {t("pdf.addMore")}
                    </button>
                    <p className="text-xs font-semibold text-neutral-500">
                      {files.length === 1
                        ? t("pdf.oneFile", { size: formatBytes(totalSize) })
                        : t("pdf.fileCount", { count: files.length, size: formatBytes(totalSize) })}
                    </p>
                  </div>
                </div>
              )}
              <input
                ref={mergeInputRef}
                type="file"
                accept=".pdf"
                multiple
                className="hidden"
                onChange={(e) => {
                  addMergeFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>

            <ResultPanel done={done} loading={loading} modeLabel={t("pdf.nothingMerged")} modeHint={t("pdf.mergeHint")} />
          </div>
        </TabsContent>

        {/* ------------------------------ SPLIT ------------------------------ */}
        <TabsContent value="split" className="mt-5">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-neutral-500">
                {t("pdf.stepSplit")}
              </h2>
              {!splitFile ? (
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={t("tool.upload")}
                  onClick={() => splitInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") splitInputRef.current?.click();
                  }}
                  onDragOver={(e) => { e.preventDefault(); setDragOverSplit(true); }}
                  onDragLeave={() => setDragOverSplit(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverSplit(false);
                    acceptSplitFile(e.dataTransfer.files?.[0]);
                  }}
                  className={dropzone(dragOverSplit)}
                >
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-fuchsia-100 text-fuchsia-600">
                    <QTBIcon name="upload-cloud" size={26} />
                  </span>
                  <p className="text-sm font-bold text-neutral-800">{t("tool.dropHere")}</p>
                  <p className="text-xs text-neutral-500">{t("pdf.singleHint")}</p>
                </div>
              ) : (
                <div className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4">
                  <GradientChip icon="pdf" tone="violet" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-neutral-800">{splitFile.name}</p>
                    <p className="text-xs text-neutral-500">{formatBytes(splitFile.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSplitFile(null); setDone(null); if (splitInputRef.current) splitInputRef.current.value = ""; }}
                    aria-label={t("tool.removeFile")}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-rose-600 outline-none hover:bg-rose-50"
                  >
                    <QTBIcon name="x" size={16} />
                  </button>
                </div>
              )}
              <input
                ref={splitInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => acceptSplitFile(e.target.files?.[0])}
              />

              <div className="mt-5 space-y-2">
                <Label htmlFor="pdf-pages">{t("pdf.pickPages")}</Label>
                <Input
                  id="pdf-pages"
                  value={pages}
                  onChange={(e) => setPages(e.target.value)}
                  placeholder="e.g. 1-3, 5, 8"
                  disabled={!splitFile}
                  className="h-11 rounded-xl"
                />
                <p className="text-xs text-neutral-400">
                  {t("pdf.pagesHelpPre")}{" "}
                  <span className="font-mono font-semibold">1-3, 5</span>{" "}
                  {t("pdf.pagesHelpPost")}
                </p>
              </div>
            </div>

            <ResultPanel done={done} loading={loading} modeLabel={t("pdf.nothingExtracted")} modeHint={t("pdf.splitHint")} />
          </div>
        </TabsContent>
      </Tabs>

      <div className="mt-7">
        <QTBButton
          size="lg"
          loading={loading}
          disabled={!canRun}
          onClick={run}
          wrapperClassName="w-full sm:w-auto [&>button]:w-full"
        >
          <QTBIcon name="pdf" size={17} /> {mode === "merge" ? t("pdf.mergeNow") : t("pdf.extract")}
        </QTBButton>
      </div>

      <ToolRecentRuns view="tool-pdf" />
    </div>
  );
}

function ResultPanel({
  done,
  loading,
  modeLabel,
  modeHint,
}: {
  done: PdfResult | null;
  loading: boolean;
  modeLabel: string;
  modeHint: string;
}) {
  const t = useAppStore((s) => s.t);
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-neutral-500">
        {t("cv.step2")}
      </h2>
      {loading ? (
        <div className="flex min-h-52 flex-col items-center justify-center gap-4 rounded-2xl border border-neutral-100 bg-neutral-50/60 p-8">
          <div className="qtb-spinner" />
          <p className="text-sm font-semibold text-neutral-600">{t("pdf.working")}</p>
          <div className="w-full max-w-xs overflow-hidden rounded-full bg-neutral-200">
            <motion.div
              className="h-2 rounded-full bg-gradient-to-r from-amber-400 via-fuchsia-500 to-emerald-400"
              initial={{ width: "8%" }}
              animate={{ width: ["8%", "70%", "92%"] }}
              transition={{ duration: 2.2, ease: "easeInOut", repeat: Infinity }}
            />
          </div>
        </div>
      ) : done ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex min-h-52 flex-col items-center justify-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-8 text-center"
        >
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
            <QTBIcon name="check-circle" size={28} />
          </span>
          <p className="max-w-full truncate text-sm font-bold text-neutral-800">{done.fileName}</p>
          <p className="text-xs font-semibold text-emerald-700">{done.detail}</p>
          <QTBButton
            wrapperClassName="w-full sm:w-auto [&>button]:w-full"
            onClick={() => downloadBlob(done.blob, done.fileName)}
          >
            <QTBIcon name="download" size={15} /> {t("tool.download")} PDF
          </QTBButton>
        </motion.div>
      ) : (
        <div className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-2xl border border-neutral-100 bg-neutral-50/60 p-8 text-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
            <QTBIcon name="pdf" size={26} />
          </span>
          <p className="text-sm font-semibold text-neutral-700">{modeLabel}</p>
          <p className="max-w-xs text-xs text-neutral-500">{modeHint}</p>
        </div>
      )}
    </div>
  );
}
