"use client";

import { Languages } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import type { Lang } from "@/lib/i18n";

/**
 * Compact EN/ع segmented language switch for the navbar.
 * Shows the OTHER language's native name (standard locale-switch pattern).
 */
export default function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const lang = useAppStore((s) => s.lang);
  const setLang = useAppStore((s) => s.setLang);

  const next: Lang = lang === "en" ? "ar" : "en";
  const label = next === "ar" ? "عربية" : "EN";

  return (
    <button
      type="button"
      onClick={() => setLang(next)}
      aria-label={next === "ar" ? "التبديل إلى العربية" : "Switch to English"}
      title={next === "ar" ? "التبديل إلى العربية" : "Switch to English"}
      className={`inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white font-semibold text-neutral-700 outline-none transition-all hover:border-fuchsia-300 hover:bg-fuchsia-50 hover:text-fuchsia-700 focus-visible:ring-2 focus-visible:ring-fuchsia-300 ${
        compact ? "h-8 px-2.5 text-[11px]" : "h-9 px-3 text-xs"
      }`}
    >
      <Languages className="size-3.5 shrink-0" aria-hidden />
      <span className={next === "ar" ? "qtb-ltr" : ""}>{label}</span>
    </button>
  );
}
