"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { useAppStore, isSuperAdmin, type View } from "@/store/app-store";
import QTBIcon, { type QTBIconName } from "@/components/qtb/QTBIcon";
import { cn } from "@/lib/utils";

interface AdminNavItem {
  view: View;
  icon: QTBIconName;
  labelKey: string;
}

const ADMIN_NAV: AdminNavItem[] = [
  { view: "admin-settings", icon: "settings", labelKey: "admin.settings" },
  { view: "admin-monetization", icon: "wallet", labelKey: "admin.monetization" },
  { view: "admin-staff", icon: "users", labelKey: "admin.staff" },
  { view: "admin-notifications", icon: "megaphone", labelKey: "admin.broadcast" },
  { view: "admin-banks", icon: "bank", labelKey: "admin.banks" },
  { view: "admin-requests", icon: "list-check", labelKey: "admin.requests" },
  { view: "admin-jobs", icon: "activity", labelKey: "admin.jobs" },
];

function RoleBadge() {
  const user = useAppStore((s) => s.user);
  const superAdmin = isSuperAdmin(user);
  const role = user?.role ?? "admin";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide",
        superAdmin
          ? "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 [&>span]:bg-fuchsia-500"
          : "border-amber-200 bg-amber-50 text-amber-700 [&>span]:bg-amber-500"
      )}
    >
      <span className="size-1.5 rounded-full" />
      {superAdmin ? "Super Admin" : role}
    </span>
  );
}

function NavButton({
  item,
  active,
  onSelect,
}: {
  item: AdminNavItem;
  active: boolean;
  onSelect: (view: View) => void;
}) {
  const t = useAppStore((s) => s.t);
  return (
    <button
      type="button"
      onClick={() => onSelect(item.view)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none transition-colors",
        active
          ? "bg-neutral-950 text-white shadow-md shadow-fuchsia-100"
          : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
      )}
    >
      <span
        className={cn(
          "[&>svg]:size-[18px] [&>svg]:shrink-0 transition-colors",
          active ? "text-fuchsia-400" : "text-neutral-400 group-hover:text-fuchsia-500"
        )}
      >
        <QTBIcon name={item.icon} size={18} />
      </span>
      <span className="truncate">{t(item.labelKey)}</span>
      {active && <span className="ml-auto size-1.5 rounded-full bg-fuchsia-400" />}
    </button>
  );
}

/**
 * Layout wrapper for every admin-* view: sticky sidebar on desktop,
 * horizontally scrollable tab bar on mobile, plus the "Admin Panel" header.
 */
export default function AdminShell({ children }: { children: ReactNode }) {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const t = useAppStore((s) => s.t);

  return (
    <div className="py-6 sm:py-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-neutral-950 text-white shadow-md [&>svg]:size-5 [&>svg]:text-fuchsia-400">
            <QTBIcon name="shield" size={20} />
          </span>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-neutral-900 sm:text-2xl">
              {t("nav.adminPanel")}
            </h1>
            <p className="text-xs text-neutral-400">
              {t("admin.controlCenter")}
            </p>
          </div>
        </div>
        <RoleBadge />
      </div>

      {/* Mobile tab bar */}
      <nav
        aria-label="Admin sections"
        className="qtb-scroll mt-5 flex gap-2 overflow-x-auto pb-1 md:hidden"
      >
        {ADMIN_NAV.map((item) => {
          const active = view === item.view;
          return (
            <button
              key={item.view}
              type="button"
              onClick={() => setView(item.view)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold transition-colors",
                active
                  ? "border-neutral-950 bg-neutral-950 text-white"
                  : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-neutral-900"
              )}
            >
              <QTBIcon
                name={item.icon}
                size={14}
                className={active ? "text-fuchsia-400" : "text-neutral-400"}
              />
              {t(item.labelKey)}
            </button>
          );
        })}
      </nav>

      <div className="mt-5 flex items-start gap-6 md:mt-6">
        {/* Desktop sidebar */}
        <aside className="sticky top-6 hidden w-56 shrink-0 md:block">
          <div className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
            <p className="px-2 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
              {t("admin.management")}
            </p>
            <nav aria-label="Admin sections" className="space-y-1">
              {ADMIN_NAV.map((item) => (
                <NavButton
                  key={item.view}
                  item={item}
                  active={view === item.view}
                  onSelect={setView}
                />
              ))}
            </nav>
          </div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 px-2 text-[11px] leading-relaxed text-neutral-400"
          >
            {t("admin.note")}
          </motion.p>
        </aside>

        {/* Active admin view */}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
