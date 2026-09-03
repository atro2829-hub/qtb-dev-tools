"use client";

import { create } from "zustand";
import { api, apiJson } from "@/lib/client-api";
import { translate, type Lang, isRtl } from "@/lib/i18n";

/* ------------------------------------------------------------------ */
/* Types (must match the API contract in worklog.md)                   */
/* ------------------------------------------------------------------ */

export type UserRole = "user" | "staff" | "admin" | "super_admin";
export type SubscriptionStatus = "none" | "trial" | "active" | "expired";
export type NotificationType = "info" | "offer" | "warning" | "success";

export type View =
  | "landing"
  | "auth"
  | "profile"
  | "dashboard"
  | "tool-bg"
  | "tool-convert"
  | "tool-translate"
  | "tool-pdf"
  | "subscription"
  | "notifications"
  | "profile-me"
  | "admin-settings"
  | "admin-staff"
  | "admin-monetization"
  | "admin-notifications"
  | "admin-banks"
  | "admin-requests"
  | "admin-jobs";

/** User shape returned by every auth endpoint (never contains password). */
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  country: string | null;
  address: string | null;
  role: UserRole;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: string | null;
  profileComplete: boolean;
  createdAt: string;
}

/** PUBLIC site config fields (GET /api/config). */
export interface SiteConfigPublic {
  organization: string;
  devName: string;
  devEmail: string;
  supportEmail: string;
  logoUrl: string;
  freeTrialEnabled: boolean;
  announcement: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  audience: string;
  createdAt: string;
  read: boolean;
}

export interface ToolJob {
  id: string;
  toolType: string;
  fileName: string;
  status: string;
  createdAt: string;
}

export const DEFAULT_SITE_CONFIG: SiteConfigPublic = {
  organization: "QTB DEV",
  devName: "QTB Team",
  devEmail: "dev@qutaibiv.com",
  supportEmail: "support@qutaibiv.com",
  logoUrl: "",
  freeTrialEnabled: true,
  announcement: "",
};

/* ------------------------------------------------------------------ */
/* Defensive normalizers (backend may be mid-construction)             */
/* ------------------------------------------------------------------ */

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asOptString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function normalizeRole(v: unknown): UserRole {
  return v === "staff" || v === "admin" || v === "super_admin" ? v : "user";
}

function normalizeSubStatus(v: unknown): SubscriptionStatus {
  return v === "trial" || v === "active" || v === "expired" ? v : "none";
}

function normalizeType(v: unknown): NotificationType {
  return v === "offer" || v === "warning" || v === "success" ? v : "info";
}

export function normalizeUser(raw: unknown): SessionUser | null {
  if (typeof raw !== "object" || raw === null) return null;
  const u = raw as Record<string, unknown>;
  return {
    id: asString(u.id),
    email: asString(u.email),
    name: asString(u.name),
    country: asOptString(u.country),
    address: asOptString(u.address),
    role: normalizeRole(u.role),
    subscriptionStatus: normalizeSubStatus(u.subscriptionStatus),
    trialEndsAt: asOptString(u.trialEndsAt),
    profileComplete: u.profileComplete === true,
    createdAt: asString(u.createdAt, new Date().toISOString()),
  };
}

function normalizeNotification(raw: unknown): NotificationItem | null {
  if (typeof raw !== "object" || raw === null) return null;
  const n = raw as Record<string, unknown>;
  return {
    id: asString(n.id),
    title: asString(n.title),
    message: asString(n.message),
    type: normalizeType(n.type),
    audience: asString(n.audience, "all"),
    createdAt: asString(n.createdAt, new Date().toISOString()),
    read: n.read === true,
  };
}

function computeUnread(list: NotificationItem[]): number {
  return list.reduce((count, item) => (item.read ? count : count + 1), 0);
}

/**
 * Build a fresh `t` bound to a language. A NEW function identity per lang
 * change is what makes `useAppStore((s) => s.t)` subscribers re-render when
 * the user toggles language (zustand v5 compares selector output with
 * Object.is — a stable `t` reference would never trigger a re-render).
 */
function makeT(lang: Lang): AppState["t"] {
  return (key, vars) => translate(lang, key, vars);
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

interface AppState {
  booted: boolean;
  user: SessionUser | null;
  config: SiteConfigPublic | null;
  view: View;
  notifications: NotificationItem[];
  unreadCount: number;
  lang: Lang;

  setUser: (user: SessionUser | null) => void;
  setConfig: (config: SiteConfigPublic | null) => void;
  setView: (view: View) => void;
  setNotifications: (list: NotificationItem[]) => void;
  setLang: (lang: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  bootstrap: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  booted: false,
  user: null,
  config: null,
  view: "landing",
  notifications: [],
  unreadCount: 0,
  lang: "en",
  t: makeT("en"),

  setUser: (user) => set({ user }),
  setConfig: (config) => set({ config }),
  setView: (view) => set({ view }),
  setNotifications: (notifications) =>
    set({ notifications, unreadCount: computeUnread(notifications) }),

  setLang: (lang) => {
    set({ lang, t: makeT(lang) });
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("qtb_lang", lang);
      } catch {
        /* private mode — ignore */
      }
      document.documentElement.lang = lang;
      document.documentElement.dir = isRtl(lang) ? "rtl" : "ltr";
    }
  },

  markRead: async (id) => {
    const next = get().notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
    set({ notifications: next, unreadCount: computeUnread(next) });
    try {
      await apiJson("/api/notifications/read", "POST", { notificationId: id });
    } catch {
      /* optimistic — ignore */
    }
  },

  markAllRead: async () => {
    const unread = get().notifications.filter((n) => !n.read).map((n) => n.id);
    if (unread.length === 0) return;
    const next = get().notifications.map((n) => ({ ...n, read: true }));
    set({ notifications: next, unreadCount: 0 });
    try {
      await apiJson("/api/notifications/read-all", "POST", {});
    } catch {
      // fall back to per-item marking if the bulk endpoint fails
      await Promise.allSettled(
        unread.map((id) => apiJson("/api/notifications/read", "POST", { notificationId: id }))
      );
    }
  },

  refreshNotifications: async () => {
    try {
      const res = await api<{ notifications?: unknown[] }>("/api/notifications");
      const list = (res.notifications ?? [])
        .map(normalizeNotification)
        .filter((n): n is NotificationItem => n !== null);
      set({ notifications: list, unreadCount: computeUnread(list) });
    } catch {
      /* keep existing list on failure */
    }
  },

  bootstrap: async () => {
    // Restore persisted language before anything renders.
    if (typeof window !== "undefined") {
      let saved: string | null = null;
      try {
        saved = window.localStorage.getItem("qtb_lang");
      } catch {
        /* private mode */
      }
      if (saved === "ar" || saved === "en") {
        set({ lang: saved, t: makeT(saved) });
        document.documentElement.lang = saved;
        document.documentElement.dir = isRtl(saved) ? "rtl" : "ltr";
      }
    }

    const [meRes, cfgRes, notifRes] = await Promise.allSettled([
      api<{ user?: unknown }>("/api/auth/me"),
      api<{ config?: Partial<SiteConfigPublic> }>("/api/config"),
      api<{ notifications?: unknown[] }>("/api/notifications"),
    ]);

    const user =
      meRes.status === "fulfilled" ? normalizeUser(meRes.value.user ?? null) : null;
    const config =
      cfgRes.status === "fulfilled" &&
      typeof cfgRes.value.config === "object" &&
      cfgRes.value.config !== null
        ? { ...DEFAULT_SITE_CONFIG, ...cfgRes.value.config }
        : get().config ?? DEFAULT_SITE_CONFIG;
    const notifications =
      notifRes.status === "fulfilled"
        ? (notifRes.value.notifications ?? [])
            .map(normalizeNotification)
            .filter((n): n is NotificationItem => n !== null)
        : [];

    const current = get().view;
    let view: View = current;
    if (user) {
      if (!user.profileComplete) view = "profile";
      else if (current === "landing") view = "dashboard";
      // PWA shortcut / deep link: /?tool=bg|convert|translate|pdf
      if (user.profileComplete && typeof window !== "undefined") {
        const tool = new URLSearchParams(window.location.search).get("tool");
        const toolViews: Record<string, View> = {
          bg: "tool-bg",
          convert: "tool-convert",
          translate: "tool-translate",
          pdf: "tool-pdf",
        };
        if (tool && toolViews[tool]) view = toolViews[tool];
      }
    } else {
      view = "landing";
    }

    set({
      booted: true,
      user,
      config,
      notifications,
      unreadCount: computeUnread(notifications),
      view,
    });
  },

  logout: async () => {
    try {
      await apiJson<{ ok?: boolean }>("/api/auth/logout", "POST");
    } catch {
      /* clear locally regardless */
    }
    set({ user: null, notifications: [], unreadCount: 0, view: "landing" });
  },
}));

/* ------------------------------------------------------------------ */
/* Role helpers                                                        */
/* ------------------------------------------------------------------ */

export function isAdmin(user: SessionUser | null): boolean {
  return user?.role === "admin" || user?.role === "super_admin";
}

export function isSuperAdmin(user: SessionUser | null): boolean {
  return user?.role === "super_admin";
}

export function userInitials(user: SessionUser | null): string {
  if (!user?.name) return "Q";
  return user.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

/** Days left on a trial, computed client-side. Negative = expired. */
export function trialDaysLeft(user: SessionUser | null): number | null {
  if (!user || user.subscriptionStatus !== "trial" || !user.trialEndsAt) return null;
  const end = new Date(user.trialEndsAt);
  if (Number.isNaN(end.getTime())) return null;
  const ms = end.getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}
