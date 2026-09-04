"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useAppStore, userInitials, isAdmin } from "@/store/app-store";
import { useQtbToast } from "@/components/qtb/use-qtb-toast";
import QTBLogo from "@/components/qtb/QTBLogo";
import QTBIcon from "@/components/qtb/QTBIcon";
import QTBButton from "@/components/qtb/QTBButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { View } from "@/store/app-store";
import LanguageToggle from "@/components/qtb/LanguageToggle";
import InstallAppButton from "@/components/qtb/InstallAppButton";

const NAV_LINKS: { labelKey: string; icon: "tools" | "wallet" | "bell"; view: View }[] = [
  { labelKey: "nav.tools", icon: "tools", view: "dashboard" },
  { labelKey: "nav.pricing", icon: "wallet", view: "subscription" },
  { labelKey: "nav.notifications", icon: "bell", view: "notifications" },
];

export default function Navbar() {
  const user = useAppStore((s) => s.user);
  const config = useAppStore((s) => s.config);
  const view = useAppStore((s) => s.view);
  const unreadCount = useAppStore((s) => s.unreadCount);
  const setView = useAppStore((s) => s.setView);
  const logout = useAppStore((s) => s.logout);
  const t = useAppStore((s) => s.t);
  const toast = useQtbToast();
  const [mobileOpen, setMobileOpen] = useState(false);

  const go = (next: View) => {
    setMobileOpen(false);
    setView(next);
  };

  const handleSignOut = async () => {
    setMobileOpen(false);
    await logout();
    toast.info(t("nav.signOut"), "See you soon!");
  };

  const home: View = user ? "dashboard" : "landing";

  return (
    <header className="sticky top-0 z-40 w-full">
      {config?.announcement && config.announcement.trim().length > 0 && (
        <div className="overflow-hidden bg-[linear-gradient(90deg,#f59e0b,#ec4899,#8b5cf6,#10b981,#f59e0b)]">
          <div className="qtb-marquee flex w-max whitespace-nowrap py-1.5">
            {[0, 1].map((copy) => (
              <span
                key={copy}
                aria-hidden={copy === 1}
                className="px-6 text-[11px] font-bold uppercase tracking-[0.2em] text-white"
              >
                {Array(4)
                  .fill(config.announcement.trim())
                  .join("  ✦  ")}
                {"  ✦  "}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="border-b border-neutral-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <nav
          aria-label="Main navigation"
          className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4"
        >
          <button
            type="button"
            onClick={() => go(home)}
            className="flex min-h-11 items-center rounded-xl outline-none"
            aria-label="QTB DEV TOOLS home"
          >
            <QTBLogo size={36} withWordmark logoUrl={config?.logoUrl || undefined} />
          </button>

          {/* Desktop links */}
          <div className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => (
              <button
                key={link.view}
                type="button"
                onClick={() => go(link.view)}
                aria-current={view === link.view ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold outline-none transition-colors",
                  view === link.view
                    ? "text-neutral-900"
                    : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                )}
              >
                {view === link.view && (
                  <motion.span
                    layoutId="qtb-nav-pill"
                    className="absolute inset-0 rounded-xl bg-neutral-100 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <QTBIcon name={link.icon} size={17} className="relative" />
                <span className="relative">{t(link.labelKey)}</span>
                {link.view === "notifications" && unreadCount > 0 && (
                  <span className="relative ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 px-1.5 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
            ))}
            {user && isAdmin(user) && (
              <button
                type="button"
                onClick={() => go("admin-settings")}
                aria-current={view.startsWith("admin-") ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold outline-none transition-colors",
                  view.startsWith("admin-")
                    ? "text-violet-700"
                    : "text-violet-600 hover:bg-violet-50"
                )}
              >
                {view.startsWith("admin-") && (
                  <motion.span
                    layoutId="qtb-nav-pill"
                    className="absolute inset-0 rounded-xl bg-violet-50 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.14)]"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <QTBIcon name="shield" size={17} className="relative" />
                <span className="relative">{t("nav.admin")}</span>
              </button>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("qtb:open-palette"))}
              aria-label={t("nav.search")}
              title={t("nav.search")}
              className="hidden h-10 items-center gap-2 rounded-xl border border-neutral-200 bg-white pl-3 pr-2 text-neutral-400 outline-none transition-all hover:border-neutral-300 hover:text-neutral-600 hover:shadow-sm md:inline-flex"
            >
              <QTBIcon name="search" size={15} />
              <span className="hidden text-xs font-semibold lg:inline">{t("cmd.placeholder").replace(/…$/, "")}</span>
              <kbd className="rounded-md border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-neutral-400">
                ⌘K
              </kbd>
            </button>
            <InstallAppButton className="hidden lg:inline-flex" />
            <LanguageToggle />
            {!user ? (
              <QTBButton size="sm" onClick={() => go("auth")} className="hidden sm:inline-flex">
                {t("nav.signIn")}
              </QTBButton>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex h-11 items-center gap-2 rounded-xl px-1.5 outline-none transition-colors hover:bg-neutral-100"
                    aria-label={t("nav.account")}
                  >
                    <Avatar className="size-9 border border-neutral-200">
                      <AvatarFallback className="bg-neutral-950 text-xs font-bold text-white">
                        {userInitials(user)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden max-w-28 truncate text-sm font-semibold text-neutral-700 lg:inline">
                      {user.name}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-xl">
                  <DropdownMenuLabel className="flex flex-col">
                    <span className="truncate font-semibold text-neutral-900">{user.name}</span>
                    <span className="truncate text-xs font-normal text-neutral-500">
                      {user.email}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="gap-2.5 rounded-lg py-2.5"
                    onClick={() => go("dashboard")}
                  >
                    <QTBIcon name="layout-dashboard" size={16} /> {t("nav.dashboard")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="gap-2.5 rounded-lg py-2.5"
                    onClick={() => go("profile-me")}
                  >
                    <QTBIcon name="user" size={16} /> {t("nav.profile")}
                  </DropdownMenuItem>
                  {isAdmin(user) && (
                    <DropdownMenuItem
                      className="gap-2.5 rounded-lg py-2.5"
                      onClick={() => go("admin-settings")}
                    >
                      <QTBIcon name="shield" size={16} /> {t("nav.adminPanel")}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    className="gap-2.5 rounded-lg py-2.5"
                    onClick={() => go("notifications")}
                  >
                    <QTBIcon name="bell" size={16} /> {t("nav.notifications")}
                    {unreadCount > 0 && (
                      <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-fuchsia-600 px-1.5 text-[10px] font-bold text-white">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="gap-2.5 rounded-lg py-2.5 text-rose-600 focus:text-rose-700"
                    onClick={handleSignOut}
                  >
                    <QTBIcon name="log-out" size={16} /> {t("nav.signOut")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Mobile hamburger */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label={t("nav.menu")}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-neutral-700 outline-none hover:bg-neutral-100 md:hidden"
                >
                  <QTBIcon name="menu" size={22} />
                </button>
              </SheetTrigger>
              <SheetContent
                side="right"
                aria-describedby={undefined}
                className="w-80 rounded-l-2xl p-0"
              >
                <SheetHeader className="border-b border-neutral-100 p-5 text-left">
                  <SheetTitle asChild>
                    <div>
                      <QTBLogo size={34} withWordmark logoUrl={config?.logoUrl || undefined} />
                    </div>
                  </SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-1 p-4">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      window.dispatchEvent(new Event("qtb:open-palette"));
                    }}
                    className="mb-1 flex h-12 items-center gap-3 rounded-xl border border-neutral-200 px-4 text-sm font-semibold text-neutral-500 outline-none hover:bg-neutral-50"
                  >
                    <QTBIcon name="search" size={17} />
                    {t("nav.search")}
                  </button>
                  <InstallAppButton className="mb-1 w-full justify-center" />
                  {NAV_LINKS.map((link) => (
                    <button
                      key={link.view}
                      type="button"
                      onClick={() => go(link.view)}
                      className="flex h-12 items-center gap-3 rounded-xl px-4 text-sm font-semibold text-neutral-700 outline-none hover:bg-neutral-100"
                    >
                      <QTBIcon name={link.icon} size={18} />
                      {t(link.labelKey)}
                      {link.view === "notifications" && unreadCount > 0 && (
                        <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 px-1.5 text-[10px] font-bold text-white">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      )}
                    </button>
                  ))}
                  {user && isAdmin(user) && (
                    <button
                      type="button"
                      onClick={() => go("admin-settings")}
                      className="flex h-12 items-center gap-3 rounded-xl px-4 text-sm font-semibold text-violet-600 outline-none hover:bg-violet-50"
                    >
                      <QTBIcon name="shield" size={18} />
                      {t("nav.adminPanel")}
                    </button>
                  )}
                  <Separator className="my-3" />
                  {user ? (
                    <>
                      <button
                        type="button"
                        onClick={() => go("profile-me")}
                        className="flex h-12 items-center gap-3 rounded-xl px-4 text-sm font-semibold text-neutral-700 outline-none hover:bg-neutral-100"
                      >
                        <QTBIcon name="user" size={18} />
                        {t("nav.profile")}
                      </button>
                      <QTBButton
                        variant="destructive"
                        onClick={handleSignOut}
                        wrapperClassName={undefined}
                        className="mt-2"
                      >
                        <QTBIcon name="log-out" size={16} /> {t("nav.signOut")}
                      </QTBButton>
                    </>
                  ) : (
                    <QTBButton onClick={() => go("auth")} className="mt-2" wrapperClassName="w-full">
                      {t("nav.signIn")}
                    </QTBButton>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </nav>
      </div>
    </header>
  );
}
