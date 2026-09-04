"use client";

import { motion } from "framer-motion";
import { useAppStore, type View } from "@/store/app-store";
import QTBIcon, { type QTBIconName } from "@/components/qtb/QTBIcon";
import ToolIcon, { type ToolKey } from "@/components/qtb/ToolIcon";
import QTBButton from "@/components/qtb/QTBButton";
import { SectionHeading } from "@/components/qtb/ui-bits";

const TOOLS: {
  view: View;
  icon: QTBIconName;
  tone: "amber" | "rose" | "emerald" | "violet" | "sky";
  ring: string;
  titleKey: string;
  copyKey: string;
}[] = [
  {
    view: "tool-bg",
    icon: "remove-bg",
    tone: "amber",
    ring: "from-amber-400 to-orange-400",
    titleKey: "bg.title",
    copyKey: "bg.sub",
  },
  {
    view: "tool-convert",
    icon: "convert",
    tone: "rose",
    ring: "from-rose-400 to-fuchsia-400",
    titleKey: "cv.title",
    copyKey: "cv.sub",
  },
  {
    view: "tool-translate",
    icon: "translate",
    tone: "emerald",
    ring: "from-emerald-400 to-teal-400",
    titleKey: "tr.title",
    copyKey: "tr.sub",
  },
  {
    view: "tool-audio",
    icon: "mic",
    tone: "sky",
    ring: "from-sky-400 to-cyan-400",
    titleKey: "au.title",
    copyKey: "au.sub",
  },
  {
    view: "tool-pdf",
    icon: "pdf",
    tone: "violet",
    ring: "from-violet-400 to-fuchsia-400",
    titleKey: "pdf.title",
    copyKey: "pdf.sub",
  },
];

const FEATURES: { icon: QTBIconName; tone: "amber" | "emerald" | "fuchsia"; titleKey: string; copyKey: string }[] = [
  {
    icon: "bolt",
    tone: "amber",
    titleKey: "landing.featFast",
    copyKey: "landing.featFastCopy",
  },
  {
    icon: "shield-check",
    tone: "emerald",
    titleKey: "landing.featSecure",
    copyKey: "landing.featSecureCopy",
  },
  {
    icon: "sparkles",
    tone: "fuchsia",
    titleKey: "landing.featAi",
    copyKey: "landing.featAiCopy",
  },
];

const STEPS: { icon: QTBIconName; titleKey: string; copyKey: string }[] = [
  {
    icon: "user",
    titleKey: "landing.step1Title",
    copyKey: "landing.step1Copy",
  },
  {
    icon: "upload-cloud",
    titleKey: "landing.step2Title",
    copyKey: "landing.step2Copy",
  },
  {
    icon: "download",
    titleKey: "landing.step3Title",
    copyKey: "landing.step3Copy",
  },
];

export default function LandingView() {
  const user = useAppStore((s) => s.user);
  const config = useAppStore((s) => s.config);
  const setView = useAppStore((s) => s.setView);
  const t = useAppStore((s) => s.t);

  const goTool = (target: View) => setView(user ? target : "auth");

  return (
    <div className="relative overflow-hidden">
      {/* Aurora backdrop */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="qtb-aurora absolute -top-24 left-[-8%] h-72 w-72 rounded-full bg-amber-300/45" />
        <div className="qtb-aurora-alt absolute right-[-6%] top-10 h-80 w-80 rounded-full bg-fuchsia-300/40" />
        <div className="qtb-aurora absolute left-[30%] top-[420px] h-72 w-72 rounded-full bg-emerald-300/35" />
        <div className="qtb-aurora-alt absolute bottom-10 right-[20%] h-64 w-64 rounded-full bg-violet-300/35" />
      </div>

      {/* Hero */}
      <section className="pb-14 pt-12 text-center sm:pb-20 sm:pt-20">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/80 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.3em] text-neutral-600 shadow-sm">
            <QTBIcon name="sparkles" size={14} className="text-fuchsia-500" />
            QTB Dev
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold leading-[1.08] tracking-tight text-neutral-900 sm:text-5xl lg:text-6xl">
            {t("landing.title1")} {t("landing.title2")}
            <br />
            <span className="qtb-text-shimmer bg-gradient-to-r from-amber-500 via-fuchsia-500 to-violet-500 bg-clip-text text-transparent">
              {t("landing.titleAccent")}
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-neutral-600 sm:text-lg">
            {t("landing.subtitle")}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <QTBButton
              size="lg"
              wrapperClassName="w-full sm:w-auto [&>button]:w-full"
              onClick={() => setView(user ? "dashboard" : "auth")}
            >
              {user ? t("landing.goDashboard") : t("landing.ctaStart")}
              <QTBIcon name="bolt" size={16} />
            </QTBButton>
            <QTBButton
              variant="outline"
              size="lg"
              className="w-full sm:w-auto"
              onClick={() =>
                document.getElementById("qtb-tools")?.scrollIntoView({ behavior: "smooth" })
              }
            >
              {t("landing.ctaTools")}
            </QTBButton>
          </div>
          {config?.freeTrialEnabled && (
            <p className="mt-4 text-xs font-medium text-neutral-500">
              {t("landing.trialNote")}
            </p>
          )}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("qtb:open-palette"))}
            className="group mx-auto mt-6 flex w-fit items-center gap-2 rounded-full border border-neutral-200/80 bg-white/70 px-4 py-1.5 text-xs font-semibold text-neutral-500 shadow-sm outline-none backdrop-blur transition-all hover:border-neutral-300 hover:text-neutral-700 hover:shadow"
          >
            <QTBIcon name="search" size={12} className="text-neutral-400 transition-colors group-hover:text-fuchsia-500" />
            {t("cmd.tip")}
            <kbd className="rounded-md border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-neutral-400 transition-colors group-hover:text-neutral-600">
              Ctrl K
            </kbd>
          </button>
        </motion.div>
      </section>

      {/* Tools */}
      <section id="qtb-tools" className="scroll-mt-24 pb-16">
        <SectionHeading
          align="center"
          eyebrow={t("landing.eyebrow")}
          title={t("landing.toolsTitle")}
          description={t("landing.toolsSub")}
        />
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {TOOLS.map((tool, i) => (
            <motion.button
              key={tool.view}
              type="button"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.35, delay: i * 0.08 }}
              whileHover={{ y: -6 }}
              onClick={() => goTool(tool.view)}
              className="group relative flex min-h-44 flex-col items-start gap-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white p-6 text-left shadow-sm outline-none transition-shadow hover:shadow-xl hover:shadow-fuchsia-100/60 focus-visible:shadow-xl"
            >
              <span
                className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${tool.ring} opacity-70 transition-opacity group-hover:opacity-100`}
              />
              <span className="inline-flex items-center gap-3">
                <ToolIcon
                  tool={viewToToolKey(tool.view)}
                  size={48}
                  className="transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110"
                />
                <span className="text-lg font-bold text-neutral-900">{t(tool.titleKey)}</span>
              </span>
              <span className="text-sm leading-relaxed text-neutral-500">{t(tool.copyKey)}</span>
              <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-bold text-neutral-900">
                {t("landing.openTool")}
                <QTBIcon
                  name="bolt"
                  size={14}
                  className="text-amber-500 transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </motion.button>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="pb-16">
        <div className="grid gap-4 rounded-2xl border border-neutral-200 bg-white p-6 sm:grid-cols-3 sm:p-8">
          {FEATURES.map((f) => (
            <div key={f.titleKey} className="flex items-start gap-4">
              <span
                className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                  f.tone === "amber"
                    ? "bg-amber-100 text-amber-600"
                    : f.tone === "emerald"
                      ? "bg-emerald-100 text-emerald-600"
                      : "bg-fuchsia-100 text-fuchsia-600"
                }`}
              >
                <QTBIcon name={f.icon} size={22} />
              </span>
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-neutral-900">
                  {t(f.titleKey)}
                </p>
                <p className="mt-1 text-sm text-neutral-500">{t(f.copyKey)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="pb-16">
        <SectionHeading
          align="center"
          eyebrow={t("landing.howEyebrow")}
          title={t("landing.howTitle")}
        />
        <div className="relative mt-10 grid gap-8 sm:grid-cols-3">
          <div
            aria-hidden="true"
            className="absolute left-[16%] right-[16%] top-7 hidden h-0.5 bg-gradient-to-r from-amber-300 via-fuchsia-300 to-emerald-300 sm:block"
          />
          {STEPS.map((step, i) => (
            <motion.div
              key={step.titleKey}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: i * 0.1 }}
              className="relative flex flex-col items-center text-center"
            >
              <span className="relative z-10 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-950 text-white shadow-lg">
                <QTBIcon name={step.icon} size={24} />
              </span>
              <span className="mt-2 text-[11px] font-bold uppercase tracking-[0.25em] text-fuchsia-600">
                {t("landing.stepN", { n: i + 1 })}
              </span>
              <p className="mt-1 text-base font-bold text-neutral-900">{t(step.titleKey)}</p>
              <p className="mt-1 max-w-xs text-sm text-neutral-500">{t(step.copyKey)}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA banner */}
      <section className="pb-20">
        <div className="qtb-glow w-full rounded-3xl">
          <div className="relative overflow-hidden rounded-[1.4rem] bg-neutral-950 px-6 py-12 text-center sm:px-12">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-fuchsia-500/25 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-emerald-500/25 blur-3xl"
            />
            <h2 className="relative text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              {t("landing.ctaTitle")}
            </h2>
            <p className="relative mx-auto mt-3 max-w-md text-sm leading-relaxed text-neutral-300 sm:text-base">
              {t("landing.ctaSub", {
                org: config?.organization ?? "QTB DEV",
              })}
            </p>
            <div className="relative mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <QTBButton
                size="lg"
                wrapperClassName="w-full sm:w-auto [&>button]:w-full"
                onClick={() => setView(user ? "dashboard" : "auth")}
              >
                {user ? t("landing.goDashboard") : t("landing.ctaStart")}
              </QTBButton>
              <QTBButton
                variant="outline"
                size="lg"
                className="w-full border-neutral-700 bg-transparent text-white hover:bg-neutral-800 hover:text-white sm:w-auto"
                onClick={() => setView("subscription")}
              >
                {t("landing.seePricing")}
              </QTBButton>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function viewToToolKey(view: View): ToolKey {
  if (view === "tool-bg") return "bg";
  if (view === "tool-convert") return "convert";
  if (view === "tool-translate") return "translate";
  if (view === "tool-audio") return "audio";
  return "pdf";
}

