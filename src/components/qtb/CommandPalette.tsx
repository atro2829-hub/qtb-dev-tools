"use client";

/**
 * Global quick-navigation palette (Ctrl/⌘ + K).
 * Zero new dependencies — built on the shadcn Command (cmdk) dialog that is
 * already in the client bundle. Opened via the keyboard shortcut or the
 * search chip in the navbar (window event "qtb:open-palette").
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { useAppStore, isAdmin, POST_AUTH_PATH_KEY, VIEW_PATHS, type View } from "@/store/app-store";
import QTBIcon, { type QTBIconName } from "@/components/qtb/QTBIcon";

interface PaletteItem {
  view: View;
  icon: QTBIconName;
  labelKey: string;
  /** Extra search terms (both locales) so the palette finds items either way. */
  keywords?: string;
}

const TOOL_ITEMS: PaletteItem[] = [
  { view: "tool-bg", icon: "remove-bg", labelKey: "bg.title", keywords: "background remove خلفية إزالة bg" },
  { view: "tool-convert", icon: "convert", labelKey: "cv.title", keywords: "convert file محول تحويل ملفات convert" },
  { view: "tool-translate", icon: "translate", labelKey: "tr.title", keywords: "translate ترجمة مترجم language translator" },
  { view: "tool-audio", icon: "mic", labelKey: "au.title", keywords: "audio صوت تسجيل تفريغ transcribe speech pdf" },
  { view: "tool-pdf", icon: "pdf", labelKey: "pdf.title", keywords: "pdf merge split دمج تقسيم ملفات" },
];

const WORKSPACE_ITEMS: PaletteItem[] = [
  { view: "dashboard", icon: "layout-dashboard", labelKey: "nav.dashboard", keywords: "dashboard home الرئيسية لوحة" },
  { view: "subscription", icon: "gift", labelKey: "sub.title", keywords: "pro subscribe plan اشتراك ترقية pricing" },
  { view: "notifications", icon: "bell", labelKey: "notif.title", keywords: "notifications alerts إشعارات تنبيهات" },
  { view: "profile-me", icon: "user", labelKey: "me.title", keywords: "profile account الملف الشخصي حساب" },
];

const ADMIN_ITEMS: PaletteItem[] = [
  { view: "admin-settings", icon: "settings", labelKey: "admin.settings", keywords: "settings admin إعدادات لوحة" },
  { view: "admin-monetization", icon: "wallet", labelKey: "admin.monetization", keywords: "money revenue analytics أرباح إحصاءات" },
  { view: "admin-staff", icon: "users", labelKey: "admin.staff", keywords: "users staff staffs المستخدمون الفريق" },
  { view: "admin-notifications", icon: "megaphone", labelKey: "admin.broadcast", keywords: "broadcast send إرسال بث إشعار" },
  { view: "admin-banks", icon: "bank", labelKey: "admin.banks", keywords: "bank accounts حسابات بنك" },
  { view: "admin-requests", icon: "list-check", labelKey: "admin.requests", keywords: "requests طلبات" },
  { view: "admin-jobs", icon: "activity", labelKey: "admin.jobs", keywords: "jobs activity logs سجل النشاط مهام" },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const setView = useAppStore((s) => s.setView);
  const t = useAppStore((s) => s.t);
  const lang = useAppStore((s) => s.lang);
  const user = useAppStore((s) => s.user);
  const view = useAppStore((s) => s.view);
  const admin = user ? isAdmin(user) : false;

  const go = useCallback(
    (v: View) => {
      setOpen(false);
      // Guests: remember the destination and route through the auth gate so
      // they land on the picked page right after signing in/up.
      const user = useAppStore.getState().user;
      if (!user && v !== "landing" && v !== "auth") {
        try {
          sessionStorage.setItem(POST_AUTH_PATH_KEY, VIEW_PATHS[v]);
        } catch {
          /* ignore */
        }
        setView("auth");
        return;
      }
      setView(v);
    },
    [setView]
  );

  // Global shortcut + navbar trigger event.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("qtb:open-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("qtb:open-palette", onOpen);
    };
  }, []);

  const groups = useMemo(
    () =>
      [
        { heading: t("nav.tools"), items: TOOL_ITEMS },
        { heading: t("cmd.workspace"), items: WORKSPACE_ITEMS },
        ...(admin ? [{ heading: t("nav.admin"), items: ADMIN_ITEMS }] : []),
      ] as { heading: string; items: PaletteItem[] }[],
    [t, admin]
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title={t("cmd.placeholder")}
      description={t("cmd.placeholder")}
      className="max-w-[560px] top-[16%] translate-y-0 rounded-2xl border-neutral-200 shadow-2xl"
    >
      <CommandInput placeholder={t("cmd.placeholder")} className="h-13 border-0 text-sm font-semibold focus:ring-0" />
      <CommandList className="max-h-[min(60vh,420px)] py-1">
        <CommandEmpty className="py-10 text-center text-sm font-semibold text-neutral-400">
          {t("cmd.empty")}
        </CommandEmpty>
        {groups.map((g, gi) => (
          <div key={g.heading}>
            {gi > 0 && <CommandSeparator className="my-1" />}
            <CommandGroup heading={g.heading} className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-extrabold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-neutral-400">
              {g.items.map((item) => {
                const active = view === item.view;
                return (
                  <CommandItem
                    key={item.view}
                    value={`${t(item.labelKey)} ${item.keywords ?? ""}`}
                    onSelect={() => go(item.view)}
                    className="gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold aria-selected:bg-neutral-100"
                  >
                    <span
                      className={
                        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors " +
                        (active
                          ? "bg-neutral-950 text-white"
                          : "bg-neutral-100 text-neutral-500")
                      }
                    >
                      <QTBIcon name={item.icon} size={14} />
                    </span>
                    <span className="flex-1 truncate">{t(item.labelKey)}</span>
                    {active && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                        {lang === "ar" ? "الحالي" : "current"}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
      <div className="flex items-center justify-between border-t border-neutral-100 px-4 py-2 text-[10px] font-semibold text-neutral-400">
        <span className="inline-flex items-center gap-1.5">
          <QTBIcon name="bolt" size={11} />
          {t("cmd.tip")}
        </span>
        <span className="font-mono">qutaibiv.com</span>
      </div>
    </CommandDialog>
  );
}
