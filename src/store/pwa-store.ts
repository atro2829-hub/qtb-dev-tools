"use client";

import { create } from "zustand";

/**
 * PWA install state — shared between the SW registrar and the
 * InstallAppButton in the navbar. The BeforeInstallPromptEvent is captured
 * once and kept until the user accepts or dismisses it.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PwaState {
  /** Captured install event — null means the browser can't prompt right now. */
  deferred: BeforeInstallPromptEvent | null;
  /** True when the app is already running installed (display-mode standalone). */
  standalone: boolean;
  capture: (event: Event) => void;
  clear: () => void;
  setStandalone: (value: boolean) => void;
}

export const usePwaStore = create<PwaState>((set) => ({
  deferred: null,
  standalone: false,
  capture: (event) => {
    event.preventDefault();
    set({ deferred: event as BeforeInstallPromptEvent });
  },
  clear: () => set({ deferred: null }),
  setStandalone: (standalone) => set({ standalone }),
}));

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}
