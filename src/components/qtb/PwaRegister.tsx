"use client";

import { useEffect } from "react";
import { isStandaloneDisplay, usePwaStore } from "@/store/pwa-store";

/**
 * Mounted once in AppShell. Registers /sw.js (offline shell + installability)
 * and captures the browser's beforeinstallprompt so InstallAppButton can
 * offer a one-tap install.
 */
export default function PwaRegister() {
  const capture = usePwaStore((s) => s.capture);
  const setStandalone = usePwaStore((s) => s.setStandalone);

  useEffect(() => {
    setStandalone(isStandaloneDisplay());

    const onPrompt = (event: Event) => capture(event);
    const onInstalled = () => {
      usePwaStore.getState().clear();
      usePwaStore.getState().setStandalone(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    if ("serviceWorker" in navigator) {
      const register = () => {
        navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
          /* SW is a progressive enhancement — ignore failures */
        });
      };
      if (document.readyState === "complete") register();
      else {
        window.addEventListener("load", register, { once: true });
        return () => {
          window.removeEventListener("load", register);
          window.removeEventListener("beforeinstallprompt", onPrompt);
          window.removeEventListener("appinstalled", onInstalled);
        };
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [capture, setStandalone]);

  return null;
}
