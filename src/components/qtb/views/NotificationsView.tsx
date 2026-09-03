"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { ar as arLocale } from "date-fns/locale";
import {
  useAppStore,
  type NotificationItem,
  type NotificationType,
} from "@/store/app-store";
import QTBIcon, { type QTBIconName } from "@/components/qtb/QTBIcon";
import QTBButton from "@/components/qtb/QTBButton";
import { EmptyState } from "@/components/qtb/ui-bits";
import { cn } from "@/lib/utils";

const TYPE_STYLES: Record<
  NotificationType,
  { icon: QTBIconName; chip: string; labelKey: string }
> = {
  info: {
    icon: "info",
    chip: "bg-neutral-100 text-neutral-600 border-neutral-200",
    labelKey: "notif.typeInfo",
  },
  offer: {
    icon: "gift",
    chip: "bg-fuchsia-100 text-fuchsia-600 border-fuchsia-200",
    labelKey: "notif.typeOffer",
  },
  warning: {
    icon: "alert",
    chip: "bg-amber-100 text-amber-600 border-amber-200",
    labelKey: "notif.typeWarning",
  },
  success: {
    icon: "check-circle",
    chip: "bg-emerald-100 text-emerald-600 border-emerald-200",
    labelKey: "notif.typeSuccess",
  },
};

export default function NotificationsView() {
  const notifications = useAppStore((s) => s.notifications);
  const refreshNotifications = useAppStore((s) => s.refreshNotifications);
  const markRead = useAppStore((s) => s.markRead);
  const markAllRead = useAppStore((s) => s.markAllRead);
  const t = useAppStore((s) => s.t);
  const lang = useAppStore((s) => s.lang);

  useEffect(() => {
    void refreshNotifications();
  }, [refreshNotifications]);

  const unread = notifications.filter((n) => !n.read).length;

  const handleOpen = (item: NotificationItem) => {
    if (!item.read) void markRead(item.id);
  };

  return (
    <div className="mx-auto max-w-2xl py-8 sm:py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-fuchsia-600">
            {t("notif.eyebrow")}
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-900 sm:text-3xl">
            {t("notif.title")}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {unread > 0
              ? unread === 1
                ? t("notif.unreadOne")
                : t("notif.unreadMany", { count: unread })
              : t("notif.sub")}
          </p>
        </div>
        {unread > 0 && (
          <QTBButton variant="outline" size="sm" onClick={() => void markAllRead()} className="shrink-0">
            <QTBIcon name="check" size={14} /> {t("notif.markAll")}
          </QTBButton>
        )}
      </div>

      <div className="mt-7 space-y-3">
        {notifications.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-white">
            <EmptyState
              icon="bell"
              title={t("notif.noneYet")}
              description={t("notif.noneYetSub")}
            />
          </div>
        ) : (
          notifications.map((item, i) => {
            const style = TYPE_STYLES[item.type] ?? TYPE_STYLES.info;
            return (
              <motion.button
                key={item.id}
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.3) }}
                onClick={() => handleOpen(item)}
                className={cn(
                  "flex w-full items-start gap-4 rounded-2xl border p-4 text-start outline-none transition-all hover:shadow-md",
                  item.read
                    ? "border-neutral-200 bg-white"
                    : "border-fuchsia-200 bg-fuchsia-50/40 hover:shadow-fuchsia-100"
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border",
                    style.chip
                  )}
                >
                  <QTBIcon name={style.icon} size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "truncate text-sm",
                        item.read ? "font-semibold text-neutral-700" : "font-bold text-neutral-900"
                      )}
                    >
                      {item.title}
                    </span>
                    {!item.read && <span className="size-2 shrink-0 rounded-full bg-fuchsia-500" />}
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-neutral-600">
                    {item.message}
                  </span>
                  <span className="mt-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5">{t(style.labelKey)}</span>
                    {formatDistanceToNow(new Date(item.createdAt), {
                      addSuffix: true,
                      locale: lang === "ar" ? arLocale : undefined,
                    })}
                  </span>
                </span>
              </motion.button>
            );
          })
        )}
      </div>

      {notifications.length > 0 && (
        <p className="mt-6 text-center text-xs text-neutral-400">
          {t("notif.clickHint")}
        </p>
      )}
    </div>
  );
}
