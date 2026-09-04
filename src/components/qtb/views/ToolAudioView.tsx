"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/client-api";
import { useQtbToast } from "@/components/qtb/use-qtb-toast";
import { useAppStore } from "@/store/app-store";
import QTBIcon from "@/components/qtb/QTBIcon";
import QTBButton from "@/components/qtb/QTBButton";
import { GradientChip } from "@/components/qtb/ui-bits";
import ToolIcon from "@/components/qtb/ToolIcon";
import ToolHelpSheet from "@/components/qtb/ToolHelpSheet";
import {
  downloadBlob,
  sanitizeFileBase,
  smartDocToPdf,
  smartDocToPlainText,
  type SmartAudioDoc,
} from "@/lib/client-audio-pdf";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const MAX_BYTES = 14 * 1024 * 1024; // 14 MB

const AUDIO_ACCEPT = ".mp3,.wav,.m4a,.aac,.ogg,.oga,.opus,.webm,.flac,.mp4,.3gp,.amr,audio/*";

const STYLES = ["smart", "minutes", "lecture", "interview", "brief", "verbatim"] as const;
type StyleKey = (typeof STYLES)[number];

const LANGS = ["auto", "ar", "en"] as const;

type Phase = "idle" | "transcribe" | "organize" | "pdf" | "done";

interface AudioResult {
  doc: SmartAudioDoc;
  transcript: string;
  engine?: { organize?: string; transcribe?: string };
  pdfBlob?: Blob;
}

function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "--:--";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function readAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const el = new Audio();
      const done = (v: number) => {
        URL.revokeObjectURL(url);
        resolve(v);
      };
      el.preload = "metadata";
      el.onloadedmetadata = () => {
        if (Number.isFinite(el.duration) && el.duration > 0) done(el.duration);
        else {
          // WebM recordings often report Infinity — seek far ahead to force it.
          el.currentTime = 1e7;
          el.ontimeupdate = () => {
            el.ontimeupdate = null;
            done(Number.isFinite(el.duration) ? el.duration : 0);
          };
          setTimeout(() => done(0), 2500);
        }
      };
      el.onerror = () => done(0);
      el.src = url;
    } catch {
      resolve(0);
    }
  });
}

export default function ToolAudioView() {
  const toast = useQtbToast();
  const lang = useAppStore((s) => s.lang);
  const t = useAppStore((s) => s.t);

  const inputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"upload" | "record">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  // recorder state
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // live waveform (decorative — every failure is silently ignored)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // options
  const [style, setStyle] = useState<StyleKey>("smart");
  const [targetLang, setTargetLang] = useState<string>("auto");

  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<AudioResult | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [building, setBuilding] = useState(false);

  const busy = phase === "transcribe" || phase === "organize";

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  /** Wire the mic stream into an AnalyserNode for the live waveform. */
  const attachWaveform = (stream: MediaStream) => {
    try {
      const Ctx: typeof AudioContext | undefined =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.55;
      ctx.createMediaStreamSource(stream).connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
    } catch {
      /* waveform is decorative */
    }
  };

  const detachWaveform = () => {
    analyserRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  };

  const resetAll = () => {
    stopRecorder(true);
    setFile(null);
    setDuration(0);
    setResult(null);
    setShowTranscript(false);
    setPhase("idle");
    if (inputRef.current) inputRef.current.value = "";
  };

  const acceptFile = async (f: File | undefined | null) => {
    if (!f) return;
    const okName = AUDIO_ACCEPT.split(",").some((ext) => f.name.toLowerCase().endsWith(ext.trim()));
    if (!/^audio\//i.test(f.type) && !/^video\/(webm|mp4)$/i.test(f.type) && !okName) {
      toast.error(new Error(t("au.wrongTypeMsg")), t("au.wrongType"));
      return;
    }
    if (f.size > MAX_BYTES) {
      toast.error(new Error(t("au.tooLargeMsg")), t("au.tooLarge"));
      return;
    }
    setFile(f);
    setResult(null);
    setPhase("idle");
    setDuration(await readAudioDuration(f));
  };

  /* ---------------------------- Recorder ---------------------------- */

  const startRecorder = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      attachWaveform(stream);
      const chunks: Blob[] = [];
      chunksRef.current = chunks;
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorderRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      rec.onstop = () => {
        detachWaveform();
        const ext = mime.includes("mp4") ? "m4a" : "webm";
        const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
        const blob = new Blob(chunks, { type: mime || "audio/webm" });
        const f = new File([blob], `recording-${stamp}.${ext}`, { type: mime || "audio/webm" });
        void acceptFile(f);
        streamRef.current?.getTracks().forEach((tr) => tr.stop());
        streamRef.current = null;
      };
      rec.start();
      setRecording(true);
      setRecSecs(0);
      setFile(null);
      setResult(null);
      timerRef.current = setInterval(() => setRecSecs((s) => s + 1), 1000);
    } catch {
      toast.error(new Error(t("au.micDeniedMsg")), t("au.micDenied"));
    }
  };

  const stopRecorder = (silent = false) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    detachWaveform();
    setRecording(false);
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
      if (!silent) setMode("upload");
    } else {
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
  };

  /* ------------------------------ Run ------------------------------ */

  const run = async () => {
    if (busy || !file) return;
    setResult(null);
    setShowTranscript(false);
    setPhase("transcribe");
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("style", style);
      fd.set("targetLang", targetLang);
      fd.set("duration", formatDuration(duration));
      setPhase("organize");
      const res = await api<{
        doc: SmartAudioDoc;
        transcript: string;
        engine?: { organize?: string; transcribe?: string };
        durationLabel?: string;
      }>("/api/tools/audio-pdf", { method: "POST", body: fd });
      setResult({ doc: res.doc, transcript: res.transcript, engine: res.engine });
      setPhase("done");
      toast.success(t("au.doneToast"), t("au.doneToastSub"));
    } catch (err) {
      setPhase("idle");
      toast.error(err, t("au.failed"));
    }
  };

  const buildPdf = async () => {
    if (!result || building) return;
    setBuilding(true);
    setPhase("pdf");
    try {
      const meta = {
        sourceFile: file?.name ?? "",
        styleLabel: t(`au.style.${style}`),
        processedAt: new Date().toLocaleString(lang === "ar" ? "ar" : "en-GB", {
          dateStyle: "medium",
          timeStyle: "short",
        }),
        durationLabel: duration ? formatDuration(duration) : undefined,
        logoUrl: useAppStore.getState().config?.logoUrl || undefined,
      };
      const blob = await smartDocToPdf(result.doc, meta);
      const base = sanitizeFileBase(result.doc.title || file?.name || "audio-report");
      downloadBlob(blob, `${base}.pdf`);
      setResult((r) => (r ? { ...r, pdfBlob: blob } : r));
      setPhase("done");
      toast.success(t("au.pdfReady"), t("au.pdfReadySub"));
    } catch (err) {
      setPhase("done");
      toast.error(err, t("au.pdfFailed"));
    } finally {
      setBuilding(false);
    }
  };

  const copyText = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(smartDocToPlainText(result.doc, { sourceFile: file?.name ?? "", styleLabel: "", processedAt: "" }));
      toast.success(t("au.copied"), t("au.copiedSub"));
    } catch {
      toast.error(new Error("Clipboard unavailable"), t("au.copyFailed"));
    }
  };

  /**
   * Share the result through the native share sheet when possible (mobile:
   * shares the generated PDF file), else share title+summary text, else fall
   * back to copying the plain text. User-cancel is silently ignored.
   */
  const shareResult = async () => {
    if (!result) return;
    const nav = navigator as Navigator & {
      canShare?: (data?: ShareData) => boolean;
    };
    try {
      const base = sanitizeFileBase(result.doc.title || file?.name || "audio-report");
      if (result.pdfBlob && typeof nav.canShare === "function" && typeof nav.share === "function") {
        const f = new File([result.pdfBlob], `${base}.pdf`, { type: "application/pdf" });
        if (nav.canShare({ files: [f] })) {
          await nav.share({ files: [f], title: result.doc.title, text: result.doc.summary || undefined });
          return;
        }
      }
      if (typeof nav.share === "function") {
        await nav.share({ title: result.doc.title, text: result.doc.summary || result.doc.title });
        return;
      }
      await navigator.clipboard.writeText(smartDocToPlainText(result.doc, { sourceFile: file?.name ?? "", styleLabel: "", processedAt: "" }));
      toast.success(t("au.copied"), t("au.copiedSub"));
    } catch (err) {
      // AbortError = user closed the share sheet — not an error.
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast.error(err, t("au.copyFailed"));
    }
  };

  /* ------------------------------ UI ------------------------------ */

  const doc = result?.doc;

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
        <ToolIcon tool="audio" size={58} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900 sm:text-3xl">
            {t("au.title")}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">{t("au.sub")}</p>
        </div>
        <ToolHelpSheet tool="au" />
      </div>

      {/* Mode tabs */}
      <div className="mt-6 inline-flex h-11 items-center gap-1 rounded-xl bg-neutral-100 p-1">
        {(["upload", "record"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              if (recording && m === "upload") return;
              setMode(m);
            }}
            className={cn(
              "inline-flex min-h-9 items-center gap-2 rounded-lg px-4 text-sm font-bold transition-all outline-none",
              mode === m ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-800"
            )}
          >
            <QTBIcon name={m === "upload" ? "upload-cloud" : "mic"} size={15} />
            {m === "upload" ? t("au.tabUpload") : t("au.tabRecord")}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        {/* ---------------------- INPUT ---------------------- */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-neutral-500">
            {t("au.step1")}
          </h2>

          {mode === "upload" ? (
            !file ? (
              <div
                role="button"
                tabIndex={0}
                aria-label={t("au.dropAudio")}
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
                  void acceptFile(e.dataTransfer.files?.[0]);
                }}
                className={cn(
                  "flex min-h-52 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-colors outline-none",
                  dragOver
                    ? "border-sky-400 bg-sky-50/60"
                    : "border-neutral-300 bg-neutral-50/60 hover:border-sky-300 hover:bg-sky-50/40"
                )}
              >
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-600">
                  <QTBIcon name="upload-cloud" size={26} />
                </span>
                <p className="text-sm font-bold text-neutral-800">{t("au.dropAudio")}</p>
                <p className="text-xs text-neutral-500">{t("au.formats")}</p>
              </div>
            ) : (
              <div className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4">
                <GradientChip icon="mic" tone="fuchsia" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-neutral-800">{file.name}</p>
                  <p className="text-xs text-neutral-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                    {duration > 0 && <> · {formatDuration(duration)}</>}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setDuration(0);
                    setResult(null);
                    if (inputRef.current) inputRef.current.value = "";
                  }}
                  aria-label={t("tool.removeFile")}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-rose-600 outline-none hover:bg-rose-50"
                >
                  <QTBIcon name="x" size={16} />
                </button>
              </div>
            )
          ) : (
            <div className="flex min-h-52 flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed border-sky-200 bg-sky-50/40 p-8">
              {recording ? (
                <>
                  <div className="w-full max-w-sm" aria-hidden="true">
                    <LiveWaveform analyserRef={analyserRef} active={recording} />
                  </div>
                  <div className="flex items-center gap-2" role="status">
                    <span className="relative inline-flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
                    </span>
                    <p className="font-mono text-2xl font-extrabold tabular-nums text-sky-700">
                      {formatDuration(recSecs)}
                    </p>
                  </div>
                  <QTBButton variant="outline" onClick={() => stopRecorder()}>
                    <span className="inline-block h-3 w-3 rounded-[3px] bg-rose-500" />
                    {t("au.recordStop")}
                  </QTBButton>
                </>
              ) : (
                <>
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-600">
                    <QTBIcon name="mic" size={26} />
                  </span>
                  <p className="text-sm font-bold text-neutral-800">{t("au.recordTitle")}</p>
                  <p className="max-w-xs text-center text-xs text-neutral-500">{t("au.recordHint")}</p>
                  <QTBButton onClick={startRecorder}>
                    <QTBIcon name="mic" size={15} /> {t("au.recordStart")}
                  </QTBButton>
                </>
              )}
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept={AUDIO_ACCEPT}
            className="hidden"
            onChange={(e) => {
              void acceptFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />

          {/* Options */}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                {t("au.pickStyle")}
              </label>
              <Select value={style} onValueChange={(v) => setStyle(v as StyleKey)}>
                <SelectTrigger className="h-11 rounded-xl" aria-label={t("au.pickStyle")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STYLES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`au.style.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                {t("au.pickLang")}
              </label>
              <Select value={targetLang} onValueChange={setTargetLang}>
                <SelectTrigger className="h-11 rounded-xl" aria-label={t("au.pickLang")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {t(`au.lang.${l}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-neutral-400">
            <QTBIcon name="sparkles" size={13} className="mt-0.5 shrink-0 text-sky-500" />
            {t("au.smartNote")}
          </p>
        </div>

        {/* ---------------------- RESULT ---------------------- */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-neutral-500">
            {t("au.step2")}
          </h2>

          {busy || phase === "pdf" ? (
            <div className="flex min-h-52 flex-col items-center justify-center gap-5 rounded-2xl border border-neutral-100 bg-neutral-50/60 p-8">
              <div className="qtb-spinner" />
              <div className="w-full max-w-xs space-y-2.5">
                {(["transcribe", "organize", "pdf"] as const).map((step, i) => {
                  const order: Phase[] = ["transcribe", "organize", "pdf"];
                  const current = order.indexOf(phase);
                  const active = phase === step;
                  const doneStep = current > i;
                  return (
                    <div
                      key={step}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors",
                        active
                          ? "border-sky-300 bg-sky-50 text-sky-700"
                          : doneStep
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-neutral-200 bg-white text-neutral-400"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold",
                          active ? "bg-sky-500 text-white" : doneStep ? "bg-emerald-500 text-white" : "bg-neutral-200 text-neutral-500"
                        )}
                      >
                        {doneStep && !active ? "✓" : i + 1}
                      </span>
                      {t(`au.step.${step}`)}
                      {active && (
                        <motion.span
                          className="ms-auto h-1.5 w-1.5 rounded-full bg-sky-500"
                          animate={{ opacity: [0.2, 1, 0.2] }}
                          transition={{ repeat: Infinity, duration: 1 }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-neutral-400">{t("au.patience")}</p>
            </div>
          ) : doc ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
                <p className="text-base font-extrabold text-neutral-900">{doc.title}</p>
                {doc.subtitle && <p className="mt-0.5 text-xs text-neutral-500">{doc.subtitle}</p>}
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-bold">
                  <span className="rounded-full bg-white px-2.5 py-1 text-neutral-600 ring-1 ring-neutral-200">
                    {doc.wordCount.toLocaleString("en-US")} {t("au.words")}
                  </span>
                  {result?.engine?.transcribe && (
                    <span className="qtb-ltr rounded-full bg-white px-2.5 py-1 text-neutral-400 ring-1 ring-neutral-200">
                      {result.engine.transcribe.split(":")[0]} + {result.engine.organize?.split(":")[0] ?? ""}
                    </span>
                  )}
                </div>
              </div>

              <div className="qtb-scroll max-h-80 space-y-4 overflow-y-auto rounded-2xl border border-neutral-100 bg-neutral-50/40 p-4">
                {doc.summary && (
                  <div>
                    <p className="mb-1 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-sky-700">
                      <QTBIcon name="file-text" size={13} /> {t("au.summaryLabel")}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">{doc.summary}</p>
                  </div>
                )}
                {doc.keyPoints.length > 0 && (
                  <div>
                    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-sky-700">
                      <QTBIcon name="list-check" size={13} /> {t("au.keyPointsLabel")}
                    </p>
                    <ul className="space-y-1">
                      {doc.keyPoints.map((kp, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-neutral-700">
                          <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />
                          {kp}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {doc.sections.map((s, i) => (
                  <div key={i}>
                    {s.heading && (
                      <p className="mb-1 flex items-center gap-2 text-sm font-extrabold text-neutral-900">
                        <span className="inline-block h-4 w-1 rounded-full bg-gradient-to-b from-sky-500 to-cyan-400" />
                        {s.heading}
                      </p>
                    )}
                    {s.paragraphs.map((p, j) => (
                      <p key={j} className="mb-1.5 text-sm leading-relaxed text-neutral-700">
                        {p}
                      </p>
                    ))}
                    {s.bullets.length > 0 && (
                      <ul className="space-y-1">
                        {s.bullets.map((b, j) => (
                          <li key={j} className="flex items-start gap-2 text-sm text-neutral-700">
                            <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                            {b}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
                {doc.conclusion && (
                  <div className="rounded-xl bg-white p-3 ring-1 ring-neutral-200">
                    <p className="mb-1 text-xs font-extrabold uppercase tracking-wider text-neutral-500">
                      {t("au.conclusionLabel")}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">{doc.conclusion}</p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2.5">
                <QTBButton loading={building} onClick={buildPdf}>
                  <QTBIcon name="download" size={15} /> {t("au.downloadPdf")}
                </QTBButton>
                <QTBButton variant="outline" onClick={shareResult}>
                  <QTBIcon name="send" size={15} /> {t("au.share")}
                </QTBButton>
                <QTBButton
                  variant="outline"
                  onClick={() => {
                    if (!result) return;
                    const base = sanitizeFileBase(doc.title || file?.name || "audio-report");
                    const txt = smartDocToPlainText(doc, { sourceFile: file?.name ?? "", styleLabel: "", processedAt: "" });
                    downloadBlob(new Blob([txt], { type: "text/plain;charset=utf-8" }), `${base}.txt`);
                  }}
                >
                  <QTBIcon name="file-text" size={15} /> TXT
                </QTBButton>
                <QTBButton variant="outline" onClick={copyText}>
                  <QTBIcon name="copy" size={15} /> {t("au.copyText")}
                </QTBButton>
              </div>

              <button
                type="button"
                onClick={() => setShowTranscript((v) => !v)}
                className="inline-flex min-h-9 items-center gap-1.5 text-xs font-bold text-neutral-400 outline-none transition-colors hover:text-neutral-700"
              >
                <QTBIcon name={showTranscript ? "eye-off" : "eye"} size={13} />
                {showTranscript ? t("au.hideTranscript") : t("au.showTranscript")}
              </button>
              {showTranscript && result?.transcript && (
                <div className="qtb-scroll max-h-44 overflow-y-auto whitespace-pre-wrap rounded-xl bg-neutral-900 p-3.5 text-xs leading-relaxed text-neutral-100" dir="auto">
                  {result.transcript}
                </div>
              )}
            </motion.div>
          ) : (
            <div className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-2xl border border-neutral-100 bg-neutral-50/60 p-8 text-center">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
                <QTBIcon name="mic" size={26} />
              </span>
              <p className="text-sm font-semibold text-neutral-700">{t("au.resultEmpty")}</p>
              <p className="max-w-xs text-xs text-neutral-500">{t("au.resultEmptySub")}</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-7">
        <QTBButton
          size="lg"
          loading={busy}
          disabled={mode === "upload" ? !file || busy : recording || !file}
          onClick={run}
          wrapperClassName="w-full sm:w-auto [&>button]:w-full"
        >
          <QTBIcon name="sparkles" size={17} /> {t("au.run")}
        </QTBButton>
      </div>
    </div>
  );
}

/**
 * Real-time mic waveform — mirrored bar history rendered on canvas from an
 * AnalyserNode (RMS → rolling history). Purely decorative: when no analyser
 * is attached it draws a gentle idle shimmer so the panel never looks dead.
 */
function LiveWaveform({
  analyserRef,
  active,
}: {
  analyserRef: React.RefObject<AnalyserNode | null>;
  active: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const BARS = 44;
    const history: number[] = new Array(BARS).fill(0);
    const buf = new Uint8Array(analyserRef.current?.fftSize ?? 1024);
    let raf = 0;
    let idlePhase = 0;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const analyser = analyserRef.current;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      if (canvas.width !== Math.round(w * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      let level = 0;
      if (analyser) {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        level = Math.min(1, Math.sqrt(sum / buf.length) * 3.4);
      } else {
        idlePhase += 0.05;
        level = 0.12 + 0.08 * Math.sin(idlePhase);
      }
      history.push(level);
      history.shift();

      const gap = 3;
      const bw = Math.max(3, (w - gap * (BARS - 1)) / BARS);
      for (let i = 0; i < BARS; i++) {
        // center-weighted ease so the edges calm down and the middle talks
        const eased = Math.pow(history[i], 0.8);
        const bh = Math.max(4, eased * (h - 10));
        const x = i * (bw + gap);
        const y = (h - bh) / 2;
        const grad = ctx.createLinearGradient(0, y, 0, y + bh);
        grad.addColorStop(0, "#22d3ee");
        grad.addColorStop(1, "#0284c7");
        ctx.fillStyle = grad;
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(x, y, bw, bh, Math.min(bw / 2, 3));
        } else {
          ctx.rect(x, y, bw, bh);
        }
        ctx.fill();
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [analyserRef, active]);

  return <canvas ref={canvasRef} className="h-16 w-full" aria-hidden="true" />;
}
