"use client";

import { isRtl } from "@/lib/i18n";
import { useAppStore } from "@/store/app-store";
import QTBIcon from "@/components/qtb/QTBIcon";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type HelpTool = "bg" | "cv" | "tr" | "au" | "pdf";

const TONES: Record<HelpTool, { chip: string; badge: string }> = {
  bg: { chip: "text-amber-600", badge: "bg-amber-100 text-amber-700" },
  cv: { chip: "text-rose-600", badge: "bg-rose-100 text-rose-700" },
  tr: { chip: "text-emerald-600", badge: "bg-emerald-100 text-emerald-700" },
  au: { chip: "text-sky-600", badge: "bg-sky-100 text-sky-700" },
  pdf: { chip: "text-violet-600", badge: "bg-violet-100 text-violet-700" },
};

/**
 * Per-tool help drawer: a "?" chip in the tool header opens a side sheet
 * with a 3-step guide, pro tips and a privacy note. Fully bilingual;
 * the sheet slides from the left when the UI is in Arabic (RTL).
 */
export default function ToolHelpSheet({ tool }: { tool: HelpTool }) {
  const t = useAppStore((s) => s.t);
  const lang = useAppStore((s) => s.lang);
  const rtl = isRtl(lang);
  const tone = TONES[tool];

  const steps = [1, 2, 3].map((n) => t(`help.${tool}.s${n}`));
  const tips = [1, 2].map((n) => t(`help.${tool}.tip${n}`));

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={t("help.open")}
          className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3.5 text-sm font-bold text-neutral-600 outline-none transition-all hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-fuchsia-400"
        >
          <QTBIcon name="help" size={17} className="text-fuchsia-500" />
          <span className="hidden sm:inline">{t("help.open")}</span>
        </button>
      </SheetTrigger>
      <SheetContent
        side={rtl ? "left" : "right"}
        aria-describedby={undefined}
        className="w-full overflow-y-auto rounded-r-2xl p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-neutral-100 p-5 text-left rtl:text-right">
          <SheetTitle className="flex items-center gap-2.5 text-base font-extrabold text-neutral-900">
            <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-xl", tone.badge)}>
              <QTBIcon name="help" size={18} />
            </span>
            {t("help.title")} — {t(`help.${tool}.title`)}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 p-5">
          <p className="text-sm leading-relaxed text-neutral-600">{t(`help.${tool}.intro`)}</p>

          {/* Steps */}
          <ol className="space-y-3">
            {steps.map((step, i) => (
              <li key={i} className="flex items-start gap-3 rounded-xl border border-neutral-100 bg-neutral-50/60 p-3.5">
                <span
                  className={cn(
                    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold",
                    tone.badge
                  )}
                >
                  {i + 1}
                </span>
                <p className="pt-0.5 text-sm leading-relaxed text-neutral-700">{step}</p>
              </li>
            ))}
          </ol>

          {/* Tips */}
          <div>
            <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-neutral-500">
              <QTBIcon name="sparkles" size={14} className={tone.chip} />
              Pro tips
            </h3>
            <ul className="space-y-2">
              {tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-neutral-600">
                  <QTBIcon name="check" size={15} className="mt-0.5 shrink-0 text-emerald-500" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          {/* Privacy note */}
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
              <QTBIcon name="shield-check" size={17} />
            </span>
            <div>
              <p className="text-sm font-bold text-emerald-800">{t("help.privacy")}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-emerald-700/90">
                {t("help.privacyBody")}
              </p>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
