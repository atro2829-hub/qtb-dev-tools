"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { format, formatDistanceToNow } from "date-fns";
import { api, apiJson, downloadDataUrl } from "@/lib/client-api";
import { useQtbToast } from "@/components/qtb/use-qtb-toast";
import QTBIcon from "@/components/qtb/QTBIcon";
import QTBButton from "@/components/qtb/QTBButton";
import { GradientChip, EmptyState } from "@/components/qtb/ui-bits";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface RequestRow {
  id: string;
  plan: string;
  bankName: string;
  amount: number | null;
  currency: string;
  paymentReference: string;
  note: string;
  status: "pending" | "approved" | "denied" | string;
  reviewNote: string;
  reviewedAt: string | null;
  createdAt: string;
  proofFileName: string;
  proofData: string;
  user: { email: string; name: string | null } | null;
}

type Filter = "pending" | "approved" | "denied" | "all";

function normalizeRequest(raw: unknown): RequestRow | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string") return null;
  const str = (k: string) => (typeof r[k] === "string" ? (r[k] as string) : "");
  const userRaw = r.user;
  const user =
    typeof userRaw === "object" && userRaw !== null
      ? {
          email: String((userRaw as Record<string, unknown>).email ?? ""),
          name:
            typeof (userRaw as Record<string, unknown>).name === "string"
              ? ((userRaw as Record<string, unknown>).name as string)
              : null,
        }
      : null;
  return {
    id: r.id,
    plan: str("plan") || "yearly",
    bankName: str("bankName"),
    amount: typeof r.amount === "number" ? r.amount : null,
    currency: str("currency") || "USD",
    paymentReference: str("paymentReference"),
    note: str("note"),
    status: str("status") || "pending",
    reviewNote: str("reviewNote"),
    reviewedAt: typeof r.reviewedAt === "string" ? r.reviewedAt : null,
    createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString(),
    proofFileName: str("proofFileName"),
    proofData: str("proofData"),
    user,
  };
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "approved"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "denied"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-amber-200 bg-amber-50 text-amber-700";
  return (
    <Badge variant="outline" className={cn("font-bold capitalize", cls)}>
      {status}
    </Badge>
  );
}

/* ------------------------------------------------------------------ */
/* View                                                                */
/* ------------------------------------------------------------------ */

export default function AdminRequestsView() {
  const toast = useQtbToast();
  const [requests, setRequests] = useState<RequestRow[] | null>(null);
  const [filter, setFilter] = useState<Filter>("pending");
  const [proofTarget, setProofTarget] = useState<RequestRow | null>(null);
  const [reviewTarget, setReviewTarget] = useState<{ row: RequestRow; action: "approve" | "deny" } | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewing, setReviewing] = useState(false);

  const load = () =>
    api<{ requests?: unknown[] }>("/api/admin/subscription-requests")
      .then((res) => {
        const list = (res.requests ?? [])
          .map(normalizeRequest)
          .filter((r): r is RequestRow => r !== null);
        setRequests(list);
      })
      .catch((err) => {
        setRequests([]);
        toast.error(err, "Couldn't load requests");
      });

  useEffect(() => {
    void load();
  }, []);

  const counts = useMemo(() => {
    const list = requests ?? [];
    return {
      pending: list.filter((r) => r.status === "pending").length,
      approved: list.filter((r) => r.status === "approved").length,
      denied: list.filter((r) => r.status === "denied").length,
      all: list.length,
    };
  }, [requests]);

  const filtered = useMemo(() => {
    const list = requests ?? [];
    return filter === "all" ? list : list.filter((r) => r.status === filter);
  }, [requests, filter]);

  const openReview = (row: RequestRow, action: "approve" | "deny") => {
    setReviewNote("");
    setReviewTarget({ row, action });
  };

  const submitReview = async () => {
    if (!reviewTarget) return;
    setReviewing(true);
    try {
      const body: Record<string, string> = {
        id: reviewTarget.row.id,
        action: reviewTarget.action,
      };
      if (reviewNote.trim()) body.reviewNote = reviewNote.trim();
      await apiJson("/api/admin/subscription-requests", "PUT", body);
      toast.success(
        reviewTarget.action === "approve" ? "Request approved" : "Request denied",
        `${reviewTarget.row.user?.email ?? "Member"} ${
          reviewTarget.action === "approve"
            ? "is now an active member."
            : "keeps their current plan status."
        }`
      );
      setReviewTarget(null);
      await load();
    } catch (err) {
      toast.error(err, "Review failed");
    } finally {
      setReviewing(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Filter tabs */}
      <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <GradientChip icon="list-check" tone="violet" />
          <div>
            <h2 className="text-base font-bold text-neutral-900">Subscription Requests</h2>
            <p className="text-xs text-neutral-400">
              Payment proofs submitted by members. Approving activates their plan instantly.
            </p>
          </div>
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList className="h-auto flex-wrap">
            {(["pending", "approved", "denied", "all"] as Filter[]).map((f) => (
              <TabsTrigger key={f} value={f} className="gap-1.5 capitalize">
                {f}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[10px] font-bold",
                    f === "pending" && counts.pending > 0
                      ? "bg-amber-100 text-amber-700"
                      : "bg-neutral-100 text-neutral-500"
                  )}
                >
                  {counts[f]}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Loading */}
      {requests === null && (
        <div className="space-y-4">
          {Array(3)
            .fill(0)
            .map((_, i) => (
              <Skeleton key={i} className="h-44 w-full rounded-2xl" />
            ))}
        </div>
      )}

      {/* Empty */}
      {requests !== null && filtered.length === 0 && (
        <div className="rounded-2xl border border-neutral-200 bg-white">
          <EmptyState
            icon="file-check"
            title={filter === "pending" ? "No pending requests" : `No ${filter === "all" ? "" : filter} requests`}
            description="When members submit payment proofs they will appear here for review."
          />
        </div>
      )}

      {/* Request cards */}
      {requests !== null && filtered.length > 0 && (
        <div className="space-y-4">
          {filtered.map((row, i) => {
            const isImage = row.proofData.startsWith("data:image");
            const isPdf = row.proofData.startsWith("data:application/pdf");
            const hasProof = isImage || isPdf;
            return (
              <motion.div
                key={row.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: Math.min(i * 0.04, 0.2) }}
                className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
              >
                {/* Top row: member + status */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-950 text-sm font-extrabold text-white">
                      {(row.user?.name ?? row.user?.email ?? "Q").charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-neutral-900">
                        {row.user?.name || "Unnamed member"}
                      </p>
                      <p className="truncate text-xs text-neutral-400">{row.user?.email}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Badge variant="outline" className="border-fuchsia-200 bg-fuchsia-50 font-bold capitalize text-fuchsia-700">
                      {row.plan}
                    </Badge>
                    <StatusBadge status={row.status} />
                    <span className="text-[11px] text-neutral-400">
                      {format(new Date(row.createdAt), "MMM d, yyyy · HH:mm")}
                    </span>
                  </div>
                </div>

                {/* Details grid */}
                <div className="mt-4 grid gap-3 rounded-xl bg-neutral-50/80 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Bank</p>
                    <p className="mt-0.5 truncate font-semibold text-neutral-800">
                      {row.bankName || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Amount</p>
                    <p className="mt-0.5 font-semibold text-neutral-800">
                      {row.amount !== null
                        ? `${row.currency} ${row.amount.toLocaleString()}`
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Payment ref.</p>
                    <p className="mt-0.5 truncate font-mono text-xs font-bold text-neutral-800">
                      {row.paymentReference || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Proof</p>
                    <div className="mt-0.5">
                      {hasProof ? (
                        isImage ? (
                          <button
                            type="button"
                            onClick={() => setProofTarget(row)}
                            className="group flex items-center gap-2 rounded-lg border border-neutral-200 bg-white p-1 pr-2.5 transition-colors hover:border-fuchsia-300"
                            aria-label="View payment proof"
                          >
                            <img
                              src={row.proofData}
                              alt="Payment proof thumbnail"
                              className="qtb-checker h-9 w-9 rounded object-cover"
                            />
                            <span className="max-w-28 truncate text-[11px] font-semibold text-neutral-600 group-hover:text-fuchsia-700">
                              {row.proofFileName || "image"}
                            </span>
                          </button>
                        ) : (
                          <QTBButton
                            size="sm"
                            variant="outline"
                            className="h-9 gap-1.5 px-2.5 text-xs"
                            onClick={() =>
                              downloadDataUrl(
                                row.proofData,
                                row.proofFileName || `proof-${row.id}.pdf`
                              )
                            }
                          >
                            <QTBIcon name="file-text" size={13} className="text-rose-500" />
                            <span className="max-w-28 truncate">{row.proofFileName || "proof.pdf"}</span>
                          </QTBButton>
                        )
                      ) : (
                        <span className="text-xs text-neutral-400">Not provided</span>
                      )}
                    </div>
                  </div>
                </div>

                {row.note && (
                  <p className="mt-3 rounded-xl border border-neutral-100 bg-white p-3 text-xs leading-relaxed text-neutral-600">
                    <span className="font-bold text-neutral-500">Member note: </span>
                    {row.note}
                  </p>
                )}

                {row.reviewNote && row.status !== "pending" && (
                  <p className="mt-2 rounded-xl border border-neutral-100 bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-500">
                    <span className="font-bold">Review note: </span>
                    {row.reviewNote}
                    {row.reviewedAt && (
                      <span className="ml-1 text-neutral-400">
                        · {formatDistanceToNow(new Date(row.reviewedAt), { addSuffix: true })}
                      </span>
                    )}
                  </p>
                )}

                {/* Actions */}
                {row.status === "pending" ? (
                  <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-neutral-100 pt-3">
                    <QTBButton
                      size="sm"
                      variant="outline"
                      className="border-emerald-300 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50"
                      onClick={() => openReview(row, "approve")}
                    >
                      <QTBIcon name="check" size={14} /> Approve
                    </QTBButton>
                    <QTBButton
                      size="sm"
                      variant="outline"
                      className="border-rose-300 text-rose-700 hover:border-rose-400 hover:bg-rose-50"
                      onClick={() => openReview(row, "deny")}
                    >
                      <QTBIcon name="x" size={14} /> Deny
                    </QTBButton>
                  </div>
                ) : (
                  <p className="mt-3 border-t border-neutral-100 pt-3 text-right text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                    Reviewed
                  </p>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Proof full-size dialog */}
      <Dialog open={proofTarget !== null} onOpenChange={(open) => !open && setProofTarget(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Payment Proof</DialogTitle>
            <DialogDescription>
              {proofTarget?.user?.email} · {proofTarget?.proofFileName || "attachment"}
            </DialogDescription>
          </DialogHeader>
          {proofTarget?.proofData && (
            <div className="qtb-scroll max-h-[60vh] overflow-auto rounded-xl border border-neutral-200 qtb-checker p-2">
              <img
                src={proofTarget.proofData}
                alt={`Payment proof from ${proofTarget.user?.email ?? "member"}`}
                className="mx-auto max-h-[55vh] w-auto rounded-lg object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve / Deny review dialog */}
      <Dialog
        open={reviewTarget !== null}
        onOpenChange={(open) => !open && setReviewTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {reviewTarget?.action === "approve" ? "Approve request" : "Deny request"}
            </DialogTitle>
            <DialogDescription>
              {reviewTarget?.row.user?.email} · {reviewTarget?.row.plan} plan
              {reviewTarget?.action === "approve"
                ? " — approving marks this member as Active immediately."
                : " — denying leaves the member's current plan unchanged."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="review-note">Review note (optional)</Label>
            <Textarea
              id="review-note"
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder={
                reviewTarget?.action === "approve"
                  ? "e.g. Payment verified against bank statement."
                  : "e.g. Reference number not found — please double-check."
              }
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <QTBButton variant="outline" onClick={() => setReviewTarget(null)}>
              Cancel
            </QTBButton>
            <QTBButton
              loading={reviewing}
              className={
                reviewTarget?.action === "approve"
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-rose-600 text-white hover:bg-rose-700"
              }
              onClick={() => void submitReview()}
            >
              <QTBIcon name={reviewTarget?.action === "approve" ? "check" : "x"} size={15} />
              {reviewTarget?.action === "approve" ? "Approve" : "Deny"}
            </QTBButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
