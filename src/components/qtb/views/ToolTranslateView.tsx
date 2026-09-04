"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { api, base64ToBlob, downloadBlob, formatBytes } from "@/lib/client-api";
import { useQtbToast } from "@/components/qtb/use-qtb-toast";
import { useAppStore } from "@/store/app-store";
import QTBIcon from "@/components/qtb/QTBIcon";
import QTBButton from "@/components/qtb/QTBButton";
import { GradientChip } from "@/components/qtb/ui-bits";
import ToolIcon from "@/components/qtb/ToolIcon";
import ToolHelpSheet from "@/components/qtb/ToolHelpSheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const MAX_SIZE = 12 * 1024 * 1024;

const LANGUAGES = [
  { value: "en", labelKey: "tr.lang.en" },
  { value: "ar", labelKey: "tr.lang.ar" },
  { value: "fr", labelKey: "tr.lang.fr" },
  { value: "es", labelKey: "tr.lang.es" },
  { value: "de", labelKey: "tr.lang.de" },
  { value: "tr", labelKey: "tr.lang.tr" },
  { value: "zh", labelKey: "tr.lang.zh" },
  { value: "ja", labelKey: "tr.lang.ja" },
  { value: "ru", labelKey: "tr.lang.ru" },
  { value: "pt", labelKey: "tr.lang.pt" },
  { value: "hi", labelKey: "tr.lang.hi" },
  { value: "ur", labelKey: "tr.lang.ur" },
  { value: "id", labelKey: "tr.lang.id" },
];

interface TranslateResult {
  fileName: string;
  mimeType: string;
  dataBase64: string;
  preview: string;
}

export default function ToolTranslateView() {
  const toast = useQtbToast();
  const lang = useAppStore((s) => s.lang);
  const t = useAppStore((s) => s.t);
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [sourceLang, setSourceLang] = useState("auto");
  const [targetLang, setTargetLang] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TranslateResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const acceptFile = (f: File | undefined | null) => {
    if (!f) return;
    const ext = (f.name.split(".").pop() ?? "").toLowerCase();
    if (!["pdf", "docx", "doc", "txt"].includes(ext)) {
      toast.error(new Error(t("tr.badType")), t("tool.unsupported"));
      return;
    }
    if (f.size > MAX_SIZE) {
      toast.error(
        new Error(t("tool.tooLargeMsg", { size: formatBytes(f.size), limit: "12MB" })),
        t("tool.tooLarge")
      );
      return;
    }
    setFile(f);
    setResult(null);
  };

  const handleTranslate = async () => {
    if (!file || loading) return;
    if (!targetLang) {
      toast.error(new Error(t("tr.chooseTarget")), t("tr.missingLang"));
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("sourceLang", sourceLang);
      fd.set("targetLang", targetLang);
      const res = await api<TranslateResult>("/api/tools/translate", {
        method: "POST",
        body: fd,
      });
      setResult({
        fileName: res.fileName || "translated.docx",
        mimeType: res.mimeType || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        dataBase64: res.dataBase64,
        preview: res.preview ?? "",
      });
      toast.success(t("tr.done"), t("tr.doneSub"));
    } catch (err) {
      toast.error(err, t("tr.failed"));
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
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
        <ToolIcon tool="translate" size={58} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900 sm:text-3xl">
            {t("tr.title")}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">{t("tr.sub")}</p>
        </div>
        <ToolHelpSheet tool="tr" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Upload & config */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-neutral-500">
            {t("tr.step1")}
          </h2>
          {!file ? (
            <div
              role="button"
              tabIndex={0}
              aria-label={t("tool.upload")}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                acceptFile(e.dataTransfer.files?.[0]);
              }}
              className={cn(
                "flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-colors outline-none",
                dragOver
                  ? "border-fuchsia-400 bg-fuchsia-50/60"
                  : "border-neutral-300 bg-neutral-50/60 hover:border-fuchsia-300 hover:bg-fuchsia-50/40"
              )}
            >
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                <QTBIcon name="upload-cloud" size={26} />
              </span>
              <p className="text-sm font-bold text-neutral-800">
                {t("tool.dropHere")}
              </p>
              <p className="text-xs text-neutral-500">{t("tr.formats")}</p>
            </div>
          ) : (
            <div className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4">
              <GradientChip icon="file-text" tone="emerald" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-neutral-800">{file.name}</p>
                <p className="text-xs text-neutral-500">{formatBytes(file.size)}</p>
              </div>
              <button
                type="button"
                onClick={reset}
                aria-label={t("tool.removeFile")}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-rose-600 outline-none hover:bg-rose-50"
              >
                <QTBIcon name="x" size={16} />
              </button>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.doc,.txt"
            className="hidden"
            onChange={(e) => acceptFile(e.target.files?.[0])}
          />

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tr-source">{t("tr.source")}</Label>
              <Select value={sourceLang} onValueChange={setSourceLang}>
                <SelectTrigger id="tr-source" className="h-11 w-full rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="auto" className="rounded-lg">
                    {t("tr.autoDetect")}
                  </SelectItem>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.value} value={l.value} className="rounded-lg">
                      {t(l.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tr-target">{t("tr.target")}</Label>
              <Select value={targetLang} onValueChange={setTargetLang}>
                <SelectTrigger id="tr-target" className="h-11 w-full rounded-xl">
                  <SelectValue placeholder={t("tr.selectLang")} />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.value} value={l.value} className="rounded-lg">
                      {t(l.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Result */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-neutral-500">
            {t("tool.result")}
          </h2>
          {loading ? (
            <div className="flex min-h-56 flex-col items-center justify-center gap-4 rounded-2xl border border-neutral-100 bg-neutral-50/60 p-8">
              <div className="qtb-spinner" />
              <p className="text-sm font-semibold text-neutral-600">
                {t("tr.translating")}
              </p>
              <div className="w-2/3 space-y-2">
                <div className="qtb-shimmer h-2 rounded-full" />
                <div className="qtb-shimmer h-2 w-5/6 rounded-full" />
                <div className="qtb-shimmer h-2 w-4/6 rounded-full" />
              </div>
            </div>
          ) : result ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="qtb-scroll max-h-56 overflow-y-auto whitespace-pre-wrap rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4 text-sm leading-relaxed text-neutral-700">
                {result.preview || t("tr.noPreview")}
              </div>
              <QTBButton
                wrapperClassName="w-full sm:w-auto [&>button]:w-full"
                onClick={() =>
                  downloadBlob(
                    base64ToBlob(result.dataBase64, result.mimeType),
                    result.fileName
                  )
                }
              >
                <QTBIcon name="download" size={15} /> {t("tool.download")} .docx
              </QTBButton>
            </motion.div>
          ) : (
            <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-2xl border border-neutral-100 bg-neutral-50/60 p-8 text-center">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
                <QTBIcon name="globe" size={26} />
              </span>
              <p className="text-sm font-semibold text-neutral-700">
                {t("tr.placeholder")}
              </p>
              <p className="max-w-xs text-xs text-neutral-500">
                {t("tr.placeholderSub")}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-7">
        <QTBButton
          size="lg"
          loading={loading}
          disabled={!file || !targetLang}
          onClick={handleTranslate}
          wrapperClassName="w-full sm:w-auto [&>button]:w-full"
        >
          <QTBIcon name="globe" size={17} /> {t("tr.translate")}
        </QTBButton>
      </div>
    </div>
  );
}
