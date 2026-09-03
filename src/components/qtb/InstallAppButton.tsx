"use client";

import { usePwaStore } from "@/store/pwa-store";
import { useAppStore } from "@/store/app-store";
import QTBIcon from "@/components/qtb/QTBIcon";
import { cn } from "@/lib/utils";

/**
 * One-tap "Install App" button. Renders only when the browser has offered
 * the install prompt (Chrome/Edge on desktop + Android) and the app is not
 * already running in standalone mode.
 */
export default function InstallAppButton({ className }: { className?: string }) {
  const deferred = usePwaStore((s) => s.deferred);
  const standalone = usePwaStore((s) => s.standalone);
  const t = useAppStore((s) => s.t);

  if (!deferred || standalone) return null;

  const install = async () => {
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        usePwaStore.getState().clear();
      }
    } catch {
      /* user cancelled or browser aborted — hide nothing, keep chip */
      usePwaStore.getState().clear();
    }
  };

  return (
    <button
      type="button"
      onClick={install}
      aria-label={t("pwa.install")}
      title={t("pwa.install")}
      className={cn(
        "group relative inline-flex h-11 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 text-sm font-bold text-emerald-700 outline-none transition-all hover:border-emerald-300 hover:bg-emerald-100 focus-visible:ring-2 focus-visible:ring-emerald-400",
        className
      )}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <QTBIcon name="smartphone" size={16} className="transition-transform group-hover:-rotate-6" />
      <span>{t("pwa.install")}</span>
    </button>
  );
}
