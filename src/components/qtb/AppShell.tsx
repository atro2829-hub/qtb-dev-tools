"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  useAppStore,
  isAdmin,
  viewFromPath,
  type View,
} from "@/store/app-store";
import { useQtbToast } from "@/components/qtb/use-qtb-toast";
import QTBLogo from "@/components/qtb/QTBLogo";
import Navbar from "@/components/qtb/Navbar";
import Footer from "@/components/qtb/Footer";
import LandingView from "@/components/qtb/views/LandingView";
import AuthView from "@/components/qtb/views/AuthView";
import CompleteProfileView from "@/components/qtb/views/CompleteProfileView";
import DashboardView from "@/components/qtb/views/DashboardView";
import ToolBgRemoveView from "@/components/qtb/views/ToolBgRemoveView";
import ToolConvertView from "@/components/qtb/views/ToolConvertView";
import ToolTranslateView from "@/components/qtb/views/ToolTranslateView";
import ToolAudioView from "@/components/qtb/views/ToolAudioView";
import ToolPdfView from "@/components/qtb/views/ToolPdfView";
import SubscriptionView from "@/components/qtb/views/SubscriptionView";
import NotificationsView from "@/components/qtb/views/NotificationsView";
import ProfileMeView from "@/components/qtb/views/ProfileMeView";
import AdminShell from "@/components/qtb/views/admin/AdminShell";
import AdminSettingsView from "@/components/qtb/views/admin/AdminSettingsView";
import AdminMonetizationView from "@/components/qtb/views/admin/AdminMonetizationView";
import AdminStaffView from "@/components/qtb/views/admin/AdminStaffView";
import AdminNotificationsView from "@/components/qtb/views/admin/AdminNotificationsView";
import AdminBanksView from "@/components/qtb/views/admin/AdminBanksView";
import AdminRequestsView from "@/components/qtb/views/admin/AdminRequestsView";
import AdminJobsView from "@/components/qtb/views/admin/AdminJobsView";
import PwaRegister from "@/components/qtb/PwaRegister";
import CommandPalette from "@/components/qtb/CommandPalette";

/* ------------------------------------------------------------------ */
/* Guards                                                              */
/* ------------------------------------------------------------------ */

function UserGate({ children }: { children: React.ReactNode }) {
  const user = useAppStore((s) => s.user);
  if (!user) return <AuthView />;
  return <>{children}</>;
}

/** Requires a signed-in user with an admin|super_admin role. */
function AdminGate({ children }: { children: React.ReactNode }) {
  const user = useAppStore((s) => s.user);
  const toast = useQtbToast();
  const warned = useRef(false);

  useEffect(() => {
    if (user && !isAdmin(user) && !warned.current) {
      warned.current = true;
      toast.error(new Error("You don't have permission to open the admin panel."), "Access denied");
    }
  }, [user]);

  if (!user) return <AuthView />;
  if (!isAdmin(user)) return <DashboardView />;
  return <AdminShell>{children}</AdminShell>;
}

/* ------------------------------------------------------------------ */
/* View switch                                                         */
/* ------------------------------------------------------------------ */

function ViewSwitch({ view }: { view: View }) {
  switch (view) {
    case "landing":
      return <LandingView />;
    case "auth":
      return <AuthView />;
    case "profile":
      return (
        <UserGate>
          <CompleteProfileView />
        </UserGate>
      );
    case "dashboard":
      return (
        <UserGate>
          <DashboardView />
        </UserGate>
      );
    case "tool-bg":
      return (
        <UserGate>
          <ToolBgRemoveView />
        </UserGate>
      );
    case "tool-convert":
      return (
        <UserGate>
          <ToolConvertView />
        </UserGate>
      );
    case "tool-translate":
      return (
        <UserGate>
          <ToolTranslateView />
        </UserGate>
      );
    case "tool-audio":
      return (
        <UserGate>
          <ToolAudioView />
        </UserGate>
      );
    case "tool-pdf":
      return (
        <UserGate>
          <ToolPdfView />
        </UserGate>
      );
    case "subscription":
      return (
        <UserGate>
          <SubscriptionView />
        </UserGate>
      );
    case "notifications":
      return (
        <UserGate>
          <NotificationsView />
        </UserGate>
      );
    case "profile-me":
      return (
        <UserGate>
          <ProfileMeView />
        </UserGate>
      );
    case "admin-settings":
      return (
        <AdminGate>
          <AdminSettingsView />
        </AdminGate>
      );
    case "admin-monetization":
      return (
        <AdminGate>
          <AdminMonetizationView />
        </AdminGate>
      );
    case "admin-staff":
      return (
        <AdminGate>
          <AdminStaffView />
        </AdminGate>
      );
    case "admin-notifications":
      return (
        <AdminGate>
          <AdminNotificationsView />
        </AdminGate>
      );
    case "admin-banks":
      return (
        <AdminGate>
          <AdminBanksView />
        </AdminGate>
      );
    case "admin-requests":
      return (
        <AdminGate>
          <AdminRequestsView />
        </AdminGate>
      );
    case "admin-jobs":
      return (
        <AdminGate>
          <AdminJobsView />
        </AdminGate>
      );
    default:
      return <LandingView />;
  }
}

/* ------------------------------------------------------------------ */
/* Boot screen                                                         */
/* ------------------------------------------------------------------ */

function BootScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-7 bg-white">
      <motion.div
        animate={{ scale: [1, 1.07, 1], opacity: [0.85, 1, 0.85] }}
        transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
      >
        <QTBLogo size={76} />
      </motion.div>
      <div className="qtb-spinner" aria-hidden="true" />
      <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-neutral-400">
        QTB Dev Tools
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

export default function AppShell() {
  const booted = useAppStore((s) => s.booted);
  const view = useAppStore((s) => s.view);
  const bootstrap = useAppStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  // Browser back/forward: map the URL path back to its view (no push).
  useEffect(() => {
    const onPop = () => {
      const next = viewFromPath(window.location.pathname) ?? "landing";
      useAppStore.setState({ view: next });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [view]);

  if (!booted) return <BootScreen />;

  return (
    <div className="flex min-h-screen flex-col bg-white text-neutral-900">
      <PwaRegister />
      <CommandPalette />
      <Navbar />
      <main id="main" className="w-full flex-1">
        <div className="mx-auto w-full max-w-6xl px-4">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <ViewSwitch view={view} />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      <Footer />
    </div>
  );
}
