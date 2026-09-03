"use client";

import { useEffect, useRef, useState } from "react";
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

const DOC_EXTS = ["pdf", "docx", "doc", "txt"];
const IMG_EXTS = ["png", "jpg", "jpeg", "webp"];
const MAX_SIZE = 12 * 1024 * 1024;

const COMBO_CHIPS = [
  "PDF → Word",
  "PDF → Text",
  "Word → PDF",
  "TXT → PDF",
  "Image → Image",
];

function targetsFor(ext: string): string[] {
  if (DOC_EXTS.includes(ext)) return ["docx", "pdf", "txt"];
  if (IMG_EXTS.includes(ext)) return ["png", "jpg", "webp"];
  return ["docx", "pdf", "txt", "png", "jpg", "webp"];
}

const IMG_TARGET_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

/**
 * Image-to-image conversion runs IN THE BROWSER via canvas (createImageBitmap
 * + toBlob). On the Cloudflare deployment the server cannot run native image
 * codecs (10ms CPU budget), so the pixels never leave the device — faster and
 * more private. The job is still recorded server-side for quota + analytics.
 */
async function convertImageInBrowser(f: File, target: string): Promise<Blob> {
  const bitmap = await createImageBitmap(f, { imageOrientation: "from-image" });
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported in this browser");
  if (target !== "png") {
    // JPEG/WebP have no alpha channel: flatten onto white, matching the server behavior
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const mime = IMG_TARGET_MIME[target] ?? "image/png";
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), mime, 0.9)
  );
  if (!blob) throw new Error("Image encoding failed in this browser");
  return blob;
}

export default function ToolConvertView() {
  const toast = useQtbToast();
  const lang = useAppStore((s) => s.lang);
  const t = useAppStore((s) => s.t);
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ fileName: string; blob: Blob } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const ext = (file?.name.split(".").pop() ?? "").toLowerCase();
  const validTargets = targetsFor(ext);

  useEffect(() => {
    if (file && !validTargets.includes(target)) setTarget("");
  }, [file]);

  const acceptFile = (f: File | undefined | null) => {
    if (!f) return;
    if (f.size > MAX_SIZE) {
      toast.error(
        new Error(t("tool.tooLargeMsg", { size: formatBytes(f.size), limit: "12MB" })),
        t("tool.tooLarge")
      );
      return;
    }
    setFile(f);
    setDone(null);
  };

  const handleConvert = async () => {
    if (!file || loading) return;
    if (!target) {
      toast.error(new Error(t("cv.chooseTarget")), t("cv.missingFormat"));
      return;
    }
    setLoading(true);
    try {
      const isImageToImage =
        IMG_EXTS.includes(ext) && ["png", "jpg", "webp"].includes(target);

      if (isImageToImage && typeof createImageBitmap === "function") {
        // Quota precheck — the conversion happens locally, so ask first.
        const q = await api<{ quota: { unlimited: boolean; used: number; limit: number } }>(
          "/api/tools/quota"
        ).catch(() => null);
        if (q && !q.quota.unlimited && q.quota.used >= q.quota.limit) {
          throw new Error(
            `You've used all ${q.quota.limit} free uses for today. Upgrade to Pro for unlimited access.`
          );
        }
        const blob = await convertImageInBrowser(file, target);
        const base = (file.name.replace(/\.[^.]+$/, "") || "image").slice(0, 80);
        setDone({ fileName: `${base}-converted.${target}`, blob });
        toast.success(t("cv.done"), t("tool.ready"));
        // Record the job (quota consumption + analytics) — best effort.
        api("/api/tools/convert-log", {
          method: "POST",
          body: JSON.stringify({
            fileName: file.name,
            sourceFormat: ext,
            targetFormat: target,
          }),
        }).catch(() => undefined);
        return;
      }

      const fd = new FormData();
      fd.set("file", file);
      fd.set("targetFormat", target);
      const res = await api<{ fileName: string; mimeType: string; dataBase64: string }>(
        "/api/tools/convert",
        { method: "POST", body: fd }
      );
      const blob = base64ToBlob(res.dataBase64, res.mimeType || "application/octet-stream");
      setDone({ fileName: res.fileName || `converted.${target}`, blob });
      toast.success(t("cv.done"), t("tool.ready"));
    } catch (err) {
      toast.error(err, t("cv.failed"));
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setTarget("");
    setDone(null);
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
        <GradientChip icon="convert" tone="rose" size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900 sm:text-3xl">
            {t("cv.title")}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">{t("cv.sub")}</p>
        </div>
        <ToolHelpSheet tool="cv" />
      </div>

      {/* Combo hints */}
      <div className="mt-5 flex flex-wrap gap-2">
        {COMBO_CHIPS.map((chip) => (
          <span
            key={chip}
            className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-600"
          >
            {chip}
          </span>
        ))}
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-2">
        {/* Upload */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-neutral-500">
            {t("cv.step1")}
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
                "flex min-h-56 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-colors outline-none",
                dragOver
                  ? "border-fuchsia-400 bg-fuchsia-50/60"
                  : "border-neutral-300 bg-neutral-50/60 hover:border-fuchsia-300 hover:bg-fuchsia-50/40"
              )}
            >
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
                <QTBIcon name="upload-cloud" size={26} />
              </span>
              <p className="text-sm font-bold text-neutral-800">
                {t("tool.dropHere")}
              </p>
              <p className="text-xs text-neutral-500">{t("cv.formats")}</p>
            </div>
          ) : (
            <div className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4">
              <GradientChip
                icon={IMG_EXTS.includes(ext) ? "image" : "file-text"}
                tone={IMG_EXTS.includes(ext) ? "amber" : "rose"}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-neutral-800">{file.name}</p>
                <p className="text-xs text-neutral-500">
                  {formatBytes(file.size)} · {t("cv.sourceFormat")}{" "}
                  <span className="font-bold uppercase text-neutral-700">
                    {ext || "unknown"}
                  </span>
                </p>
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
            accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={(e) => acceptFile(e.target.files?.[0])}
          />

          <div className="mt-5 space-y-2">
            <Label htmlFor="conv-target">{t("tool.targetFormat")}</Label>
            <Select value={target} onValueChange={setTarget} disabled={!file}>
              <SelectTrigger id="conv-target" className="h-11 w-full rounded-xl">
                <SelectValue placeholder={file ? t("cv.chooseOutput") : t("cv.uploadFirst")} />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {validTargets.map((t) => (
                  <SelectItem key={t} value={t} className="rounded-lg uppercase">
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {file && (
              <p className="text-xs text-neutral-400">
                {t("cv.validTargets", {
                  ext: ext || "?",
                  targets: validTargets.join(", "),
                })}
              </p>
            )}
          </div>
        </div>

        {/* Result */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-neutral-500">
            {t("cv.step2")}
          </h2>
          {loading ? (
            <div className="flex min-h-56 flex-col items-center justify-center gap-4 rounded-2xl border border-neutral-100 bg-neutral-50/60 p-8">
              <div className="qtb-spinner" />
              <p className="text-sm font-semibold text-neutral-600">{t("tool.converting")}</p>
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
              className="flex min-h-56 flex-col items-center justify-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-8 text-center"
            >
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                <QTBIcon name="check-circle" size={28} />
              </span>
              <p className="max-w-full truncate text-sm font-bold text-neutral-800">
                {done.fileName}
              </p>
              <QTBButton
                wrapperClassName="w-full sm:w-auto [&>button]:w-full"
                onClick={() => downloadBlob(done.blob, done.fileName)}
              >
                <QTBIcon name="download" size={15} /> {t("tool.download")}
              </QTBButton>
            </motion.div>
          ) : (
            <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-2xl border border-neutral-100 bg-neutral-50/60 p-8 text-center">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
                <QTBIcon name="file-check" size={26} />
              </span>
              <p className="text-sm font-semibold text-neutral-700">{t("cv.nothingYet")}</p>
              <p className="max-w-xs text-xs text-neutral-500">{t("cv.pickFirst")}</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-7">
        <QTBButton
          size="lg"
          loading={loading}
          disabled={!file || !target}
          onClick={handleConvert}
          wrapperClassName="w-full sm:w-auto [&>button]:w-full"
        >
          <QTBIcon name="convert" size={17} /> {t("tool.convert")}
        </QTBButton>
      </div>
    </div>
  );
}
