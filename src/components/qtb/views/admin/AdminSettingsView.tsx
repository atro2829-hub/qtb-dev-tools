"use client";

import { useEffect, useRef, useState } from "react";
import { api, apiJson } from "@/lib/client-api";
import { useQtbToast } from "@/components/qtb/use-qtb-toast";
import QTBIcon from "@/components/qtb/QTBIcon";
import QTBButton from "@/components/qtb/QTBButton";
import QTBLogo from "@/components/qtb/QTBLogo";
import { GradientChip } from "@/components/qtb/ui-bits";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface FullConfig {
  organization: string;
  devName: string;
  devEmail: string;
  supportEmail: string;
  logoUrl: string;
  geminiApiKey: string;
  agentApiKey: string;
  admobAppId: string;
  admobBannerId: string;
  adsenseClientId: string;
  adsenseSlotId: string;
  announcement: string;
  freeTrialEnabled: boolean;
  freeTrialDays: number;
}

interface GeminiVerifyResult {
  ok: boolean;
  message: string;
  model: string | null;
  latencyMs: number;
}

const FALLBACK: FullConfig = {
  organization: "",
  devName: "",
  devEmail: "",
  supportEmail: "",
  logoUrl: "",
  geminiApiKey: "",
  agentApiKey: "",
  admobAppId: "",
  admobBannerId: "",
  adsenseClientId: "",
  adsenseSlotId: "",
  announcement: "",
  freeTrialEnabled: true,
  freeTrialDays: 365,
};

function normalizeConfig(raw: unknown): FullConfig {
  if (typeof raw !== "object" || raw === null) return { ...FALLBACK };
  const c = raw as Record<string, unknown>;
  const str = (k: string) => (typeof c[k] === "string" ? (c[k] as string) : "");
  const bool = (k: string, d: boolean) => (typeof c[k] === "boolean" ? (c[k] as boolean) : d);
  const num = (k: string, d: number) =>
    typeof c[k] === "number" && Number.isFinite(c[k]) ? (c[k] as number) : d;
  return {
    organization: str("organization"),
    devName: str("devName"),
    devEmail: str("devEmail"),
    supportEmail: str("supportEmail"),
    logoUrl: str("logoUrl"),
    geminiApiKey: str("geminiApiKey"),
    agentApiKey: str("agentApiKey"),
    admobAppId: str("admobAppId"),
    admobBannerId: str("admobBannerId"),
    adsenseClientId: str("adsenseClientId"),
    adsenseSlotId: str("adsenseSlotId"),
    announcement: str("announcement"),
    freeTrialEnabled: bool("freeTrialEnabled", true),
    freeTrialDays: num("freeTrialDays", 365),
  };
}

/* ------------------------------------------------------------------ */
/* Reusable bits                                                       */
/* ------------------------------------------------------------------ */

/** Read an image file and downscale it to a compact inline PNG data URL. */
async function fileToLogoDataUrl(file: File, max = 256): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file (PNG, SVG, WebP…)");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Image is too large (max 8MB)");
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read that image"));
      el.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported in this browser");
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function SecretInput({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "••••••••••••"}
          autoComplete="off"
          className="pr-11 font-mono text-sm"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide value" : "Show value"}
          className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
        >
          <QTBIcon name={show ? "eye-off" : "eye"} size={16} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* View                                                                */
/* ------------------------------------------------------------------ */

export default function AdminSettingsView() {
  const toast = useQtbToast();
  const [config, setConfig] = useState<FullConfig | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [verifyingGemini, setVerifyingGemini] = useState(false);
  const [geminiVerify, setGeminiVerify] = useState<GeminiVerifyResult | null>(null);
  const logoFileRef = useRef<HTMLInputElement | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    let active = true;
    api<{ config?: unknown }>("/api/admin/config")
      .then((res) => {
        if (active) setConfig(normalizeConfig(res.config));
      })
      .catch((err) => {
        if (active) {
          setConfig({ ...FALLBACK });
          toast.error(err, "Couldn't load settings");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const patch = (partial: Partial<FullConfig>) => {
    setConfig((c) => (c ? { ...c, ...partial } : c));
  };

  const save = async (key: string, body: Partial<FullConfig>, title: string) => {
    setSavingKey(key);
    try {
      const res = await apiJson<{ config?: unknown }>("/api/admin/config", "PUT", body);
      setConfig(normalizeConfig(res.config));
      toast.success(title, "Changes are live for every visitor.");
    } catch (err) {
      toast.error(err, "Save failed");
    } finally {
      setSavingKey(null);
    }
  };

  /** Live-tests the Gemini key (unsaved input wins over the stored one). */
  const verifyGemini = async () => {
    setVerifyingGemini(true);
    setGeminiVerify(null);
    try {
      const keyInput = config?.geminiApiKey?.trim() ?? "";
      const res = await apiJson<GeminiVerifyResult>("/api/admin/verify-gemini", "POST",
        keyInput ? { key: keyInput } : {}
      );
      setGeminiVerify(res);
      if (res.ok) toast.success("Gemini key verified", `Model ${res.model ?? "gemini"} responded in ${res.latencyMs}ms.`);
    } catch (err) {
      toast.error(err, "Verification failed");
    } finally {
      setVerifyingGemini(false);
    }
  };

  if (!config) {
    return (
      <div className="space-y-5">
        {Array(3)
          .fill(0)
          .map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-2xl" />
          ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ---------------- Developer info ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 text-base">
            <GradientChip icon="badge-check" tone="amber" size="sm" />
            Developer Info
          </CardTitle>
          <CardDescription>
            Shown across the landing page, footer and support surfaces.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cfg-org">Organization</Label>
              <Input
                id="cfg-org"
                value={config.organization}
                onChange={(e) => patch({ organization: e.target.value })}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cfg-devname">Developer name</Label>
              <Input
                id="cfg-devname"
                value={config.devName}
                onChange={(e) => patch({ devName: e.target.value })}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cfg-devemail">Developer email</Label>
              <Input
                id="cfg-devemail"
                type="email"
                value={config.devEmail}
                onChange={(e) => patch({ devEmail: e.target.value })}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cfg-supemail">Support email</Label>
              <Input
                id="cfg-supemail"
                type="email"
                value={config.supportEmail}
                onChange={(e) => patch({ supportEmail: e.target.value })}
                maxLength={200}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cfg-logo">Logo</Label>
            <Input
              id="cfg-logo"
              value={config.logoUrl}
              onChange={(e) => patch({ logoUrl: e.target.value })}
              placeholder="https://…/logo.png — or upload a file below"
              maxLength={200000}
            />
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={logoFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  setUploadingLogo(true);
                  try {
                    const dataUrl = await fileToLogoDataUrl(file);
                    patch({ logoUrl: dataUrl });
                    toast.success("Logo ready", "Press “Save Developer Info” to publish it.");
                  } catch (err) {
                    toast.error(err, "Upload failed");
                  } finally {
                    setUploadingLogo(false);
                  }
                }}
              />
              <button
                type="button"
                disabled={uploadingLogo}
                onClick={() => logoFileRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-60"
              >
                {uploadingLogo ? (
                  <span className="qtb-spinner" aria-hidden />
                ) : (
                  <QTBIcon name="upload-cloud" size={14} />
                )}
                Upload from device
              </button>
              {config.logoUrl.trim() && (
                <button
                  type="button"
                  onClick={() => patch({ logoUrl: "" })}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50"
                >
                  <QTBIcon name="refresh" size={14} />
                  Use default mark
                </button>
              )}
            </div>
            <div className="flex items-center gap-4 rounded-xl border border-dashed border-neutral-200 bg-neutral-50/60 p-4">
              {config.logoUrl.trim() ? (
                <QTBLogo logoUrl={config.logoUrl.trim()} size={48} withWordmark />
              ) : (
                <>
                  <QTBLogo size={48} tile withWordmark />
                  <div>
                    <p className="text-sm font-semibold text-neutral-600">
                      Official QTB mark in use
                    </p>
                    <p className="text-xs text-neutral-400">
                      Upload an image or paste a URL to override it everywhere.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <QTBButton
              size="sm"
              loading={savingKey === "dev"}
              onClick={() =>
                void save(
                  "dev",
                  {
                    organization: config.organization,
                    devName: config.devName,
                    devEmail: config.devEmail,
                    supportEmail: config.supportEmail,
                    logoUrl: config.logoUrl,
                  },
                  "Developer info saved"
                )
              }
            >
              <QTBIcon name="check" size={15} /> Save Developer Info
            </QTBButton>
          </div>
        </CardContent>
      </Card>

      {/* ---------------- AI & Ad API keys ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 text-base">
            <GradientChip icon="key" tone="fuchsia" size="sm" />
            AI &amp; Agent API Keys
          </CardTitle>
          <CardDescription>
            When a Gemini key is present it is used for AI translation; otherwise the
            built-in assistant handles it. Values are write-only for the public API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <SecretInput
                id="cfg-gemini"
                label="Gemini API Key"
                value={config.geminiApiKey}
                onChange={(v) => patch({ geminiApiKey: v })}
              />
              <button
                type="button"
                onClick={() => void verifyGemini()}
                disabled={verifyingGemini}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-fuchsia-700 outline-none transition-colors hover:bg-fuchsia-50 disabled:opacity-60"
              >
                {verifyingGemini ? (
                  <span className="qtb-spinner" aria-hidden />
                ) : (
                  <QTBIcon name="bolt" size={13} />
                )}
                {verifyingGemini ? "Testing key…" : "Verify key with a live test call"}
              </button>
              {geminiVerify && (
                <p
                  role="status"
                  className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${
                    geminiVerify.ok
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-rose-200 bg-rose-50 text-rose-800"
                  }`}
                >
                  {geminiVerify.ok ? "✓ " : "✕ "}
                  {geminiVerify.message}
                </p>
              )}
            </div>
            <SecretInput
              id="cfg-agent"
              label="Agent API Key"
              value={config.agentApiKey}
              onChange={(v) => patch({ agentApiKey: v })}
            />
          </div>
          <div className="flex justify-end">
            <QTBButton
              size="sm"
              loading={savingKey === "keys"}
              onClick={() =>
                void save(
                  "keys",
                  { geminiApiKey: config.geminiApiKey, agentApiKey: config.agentApiKey },
                  "API keys saved"
                )
              }
            >
              <QTBIcon name="lock" size={15} /> Save Keys
            </QTBButton>
          </div>
        </CardContent>
      </Card>

      {/* ---------------- Ad networks ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 text-base">
            <GradientChip icon="bolt" tone="emerald" size="sm" />
            Ad Networks
          </CardTitle>
          <CardDescription>
            AdMob and AdSense identifiers used by the mobile &amp; web builds.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cfg-admob-app">AdMob App ID</Label>
              <Input
                id="cfg-admob-app"
                value={config.admobAppId}
                onChange={(e) => patch({ admobAppId: e.target.value })}
                placeholder="ca-app-pub-…"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cfg-admob-banner">AdMob Banner ID</Label>
              <Input
                id="cfg-admob-banner"
                value={config.admobBannerId}
                onChange={(e) => patch({ admobBannerId: e.target.value })}
                placeholder="ca-app-pub-…"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cfg-adsense-client">AdSense Client ID</Label>
              <Input
                id="cfg-adsense-client"
                value={config.adsenseClientId}
                onChange={(e) => patch({ adsenseClientId: e.target.value })}
                placeholder="ca-pub-…"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cfg-adsense-slot">AdSense Slot ID</Label>
              <Input
                id="cfg-adsense-slot"
                value={config.adsenseSlotId}
                onChange={(e) => patch({ adsenseSlotId: e.target.value })}
                placeholder="1234567890"
                className="font-mono text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <QTBButton
              size="sm"
              loading={savingKey === "ads"}
              onClick={() =>
                void save(
                  "ads",
                  {
                    admobAppId: config.admobAppId,
                    admobBannerId: config.admobBannerId,
                    adsenseClientId: config.adsenseClientId,
                    adsenseSlotId: config.adsenseSlotId,
                  },
                  "Ad network IDs saved"
                )
              }
            >
              <QTBIcon name="check" size={15} /> Save Ad IDs
            </QTBButton>
          </div>
        </CardContent>
      </Card>

      {/* ---------------- Announcement ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 text-base">
            <GradientChip icon="megaphone" tone="rose" size="sm" />
            Announcement Banner
          </CardTitle>
          <CardDescription>
            Displayed prominently to every visitor. Leave empty to hide it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={config.announcement}
            onChange={(e) => patch({ announcement: e.target.value })}
            rows={3}
            maxLength={5000}
            placeholder="e.g. Scheduled maintenance on Saturday 02:00 UTC"
          />
          <div className="flex justify-end">
            <QTBButton
              size="sm"
              loading={savingKey === "announce"}
              onClick={() =>
                void save("announce", { announcement: config.announcement }, "Announcement saved")
              }
            >
              <QTBIcon name="send" size={15} /> Save Announcement
            </QTBButton>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
