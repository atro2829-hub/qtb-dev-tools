"use client";

import { useEffect } from "react";
import { isStandaloneDisplay, usePwaStore } from "@/store/pwa-store";
import { useQtbToast } from "@/components/qtb/use-qtb-toast";
import { useAppStore } from "@/store/app-store";

/**
 * Mounted once in AppShell. Registers /sw.js (offline shell + installability)
 * and captures the browser's beforeinstallprompt so InstallAppButton can
 * offer a one-tap install. Also detects mid-session SW updates (new deploy)
 * and nudges the user to refresh.
 */
export default function PwaRegister() {
  const capture = usePwaStore((s) => s.capture);
  const setStandalone = usePwaStore((s) => s.setStandalone);
  const toast = useQtbToast();

  useEffect(() => {
    setStandalone(isStandaloneDisplay());

    const onPrompt = (event: Event) => capture(event);
    const onInstalled = () => {
      usePwaStore.getState().clear();
      usePwaStore.getState().setStandalone(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // Mid-session update detection: when a NEW service worker takes over a
    // tab that was already controlled, a fresh version just deployed — tell
    // the user to refresh (sw.js self-skipWaiting, so this fires instantly).
    let hadController = "serviceWorker" in navigator && !!navigator.serviceWorker.controller;
    const onControllerChange = () => {
      if (!hadController) {
        hadController = true;
        return;
      }
      const t = useAppStore.getState().t;
      toast.info(t("pwa.updateTitle"), t("pwa.updateSub"));
    };
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
      const register = () => {
        navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
          /* SW is a progressive enhancement — ignore failures */
        });
      };
      if (document.readyState === "complete") register();
      else window.addEventListener("load", register, { once: true });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      }
    };
  }, [capture, setStandalone, toast]);

  return null;
}
