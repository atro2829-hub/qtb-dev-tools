"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { apiJson } from "@/lib/client-api";
import { useQtbToast } from "@/components/qtb/use-qtb-toast";
import { useAppStore, type NotificationType } from "@/store/app-store";
import QTBIcon, { type QTBIconName } from "@/components/qtb/QTBIcon";
import QTBButton from "@/components/qtb/QTBButton";
import { GradientChip, EmptyState } from "@/components/qtb/ui-bits";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Types & styles                                                      */
/* ------------------------------------------------------------------ */

interface SentItem {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  audience: string;
  createdAt: string;
}

const TYPE_OPTIONS: { value: NotificationType; label: string; icon: QTBIconName }[] = [
  { value: "info", label: "Info", icon: "info" },
  { value: "offer", label: "Offer", icon: "gift" },
  { value: "warning", label: "Warning", icon: "alert" },
  { value: "success", label: "Success", icon: "check-circle" },
];

const AUDIENCE_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Everyone" },
  { value: "trial", label: "Trial users" },
  { value: "expired", label: "Expired users" },
  { value: "active", label: "Active members" },
];

const TYPE_CHIP: Record<NotificationType, string> = {
  info: "border-neutral-200 bg-neutral-100 text-neutral-600",
  offer: "border-fuchsia-200 bg-fuchsia-100 text-fuchsia-600",
  warning: "border-amber-200 bg-amber-100 text-amber-600",
  success: "border-emerald-200 bg-emerald-100 text-emerald-600",
};

/* ------------------------------------------------------------------ */
/* View                                                                */
/* ------------------------------------------------------------------ */

export default function AdminNotificationsView() {
  const toast = useQtbToast();
  const refreshNotifications = useAppStore((s) => s.refreshNotifications);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<NotificationType>("info");
  const [audience, setAudience] = useState("all");
  const [sending, setSending] = useState(false);
  const [sentList, setSentList] = useState<SentItem[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<SentItem | null>(null);

  const send = async () => {
    if (title.trim().length === 0 || message.trim().length === 0) {
      toast.info("Missing content", "Give the broadcast a title and a message.");
      return;
    }
    setSending(true);
    try {
      const res = await apiJson<{ notification?: Record<string, unknown> }>(
        "/api/admin/notifications",
        "POST",
        { title: title.trim(), message: message.trim(), type, audience }
      );
      const n = res.notification;
      if (n && typeof n.id === "string") {
        setSentList((list) => [
          {
            id: n.id as string,
            title: String(n.title ?? title),
            message: String(n.message ?? message),
            type: (["offer", "warning", "success"].includes(String(n.type))
              ? String(n.type)
              : "info") as NotificationType,
            audience: String(n.audience ?? audience),
            createdAt: String(n.createdAt ?? new Date().toISOString()),
          },
          ...list,
        ]);
      }
      // Refresh the in-app inbox so other admin surfaces stay in sync.
      void refreshNotifications();
      toast.success("Broadcast sent", "It's now visible to the selected audience.");
      setTitle("");
      setMessage("");
      setType("info");
      setAudience("all");
    } catch (err) {
      toast.error(err, "Broadcast failed");
    } finally {
      setSending(false);
    }
  };

  const removeSent = async (item: SentItem) => {
    try {
      await apiJson(`/api/admin/notifications?id=${encodeURIComponent(item.id)}`, "DELETE");
      setSentList((list) => list.filter((n) => n.id !== item.id));
      void refreshNotifications();
      toast.success("Notification deleted", "It no longer appears in member inboxes.");
    } catch (err) {
      toast.error(err, "Delete failed");
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[1fr_380px]">
      {/* ---------------- Compose ---------------- */}
      <div className="rounded-2xl border border-neutral-200 bg-white">
        <div className="flex items-center gap-3 border-b border-neutral-100 p-5">
          <GradientChip icon="megaphone" tone="rose" />
          <div>
            <h2 className="text-base font-bold text-neutral-900">New Broadcast</h2>
            <p className="text-xs text-neutral-400">
              Delivered instantly to the in-app notification inbox.
            </p>
          </div>
        </div>
        <div className="space-y-4 p-5">
          <div className="space-y-2">
            <Label htmlFor="bc-title">Title</Label>
            <Input
              id="bc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="e.g. New tool just dropped!"
            />
            <p className="text-right text-[11px] text-neutral-300">{title.length}/120</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bc-message">Message</Label>
            <Textarea
              id="bc-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
              rows={5}
              placeholder="Write the announcement your members will read in their inbox…"
            />
            <p className="text-right text-[11px] text-neutral-300">{message.length}/2000</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bc-type">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as NotificationType)}>
                <SelectTrigger id="bc-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      <span className="flex items-center gap-2">
                        <QTBIcon name={t.icon} size={13} />
                        {t.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bc-audience">Audience</Label>
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger id="bc-audience" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUDIENCE_OPTIONS.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-neutral-400">
              Audience lists are evaluated live — members join/leave segments automatically.
            </p>
            <QTBButton onClick={() => void send()} loading={sending} className="shrink-0">
              <QTBIcon name="send" size={15} /> Send Broadcast
            </QTBButton>
          </div>
        </div>
      </div>

      {/* ---------------- Sent this session ---------------- */}
      <div className="rounded-2xl border border-neutral-200 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-neutral-100 p-5">
          <div>
            <h2 className="text-base font-bold text-neutral-900">Sent</h2>
            <p className="text-xs text-neutral-400">This session, newest first.</p>
          </div>
          {sentList.length > 0 && (
            <Badge variant="outline" className="border-neutral-200 font-bold text-neutral-500">
              {sentList.length}
            </Badge>
          )}
        </div>

        {sentList.length === 0 ? (
          <EmptyState
            icon="megaphone"
            title="Nothing sent yet"
            description="Broadcasts you send from this device will appear here so you can undo mistakes."
          />
        ) : (
          <ul className="qtb-scroll max-h-[520px] space-y-2.5 overflow-y-auto p-4">
            {sentList.map((item, i) => (
              <motion.li
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.2) }}
                className="rounded-xl border border-neutral-100 bg-neutral-50/70 p-3.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-neutral-800">{item.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-neutral-500">
                      {item.message}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(item)}
                    aria-label={`Delete "${item.title}"`}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-300 transition-colors hover:bg-rose-50 hover:text-rose-600"
                  >
                    <QTBIcon name="trash" size={15} />
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      "rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                      TYPE_CHIP[item.type]
                    )}
                  >
                    {item.type}
                  </span>
                  <span className="rounded border border-neutral-200 bg-white px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                    {item.audience}
                  </span>
                  <span className="text-[10px] font-medium text-neutral-400">
                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </div>

      {/* Delete confirm */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this broadcast?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.title}” will be removed from every member inbox. This can&apos;t
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => deleteTarget && void removeSent(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
