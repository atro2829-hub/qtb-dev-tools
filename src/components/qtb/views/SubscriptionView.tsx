"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  api,
  copyToClipboard,
  formatBytes,
} from "@/lib/client-api";
import { useAppStore, trialDaysLeft } from "@/store/app-store";
import { formatDate } from "@/lib/i18n";
import { useQtbToast } from "@/components/qtb/use-qtb-toast";
import QTBIcon from "@/components/qtb/QTBIcon";
import QTBButton from "@/components/qtb/QTBButton";
import { GradientChip, StatusPill } from "@/components/qtb/ui-bits";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Types & plan data                                                   */
/* ------------------------------------------------------------------ */

interface Bank {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  iban: string | null;
  swiftCode: string | null;
  currency: string;
  instructions: string | null;
  iconSvg: string | null;
}

interface SubRequest {
  id: string;
  plan: string;
  status: string;
  createdAt: string;
  reviewNote: string | null;
  bankName: string | null;
  amount: string | number | null;
}

type PlanId = "monthly" | "yearly" | "lifetime";

const PLANS: {
  id: PlanId;
  nameKey: string;
  price: string;
  periodKey: string;
  popular?: boolean;
  featureKeys: string[];
}[] = [
  {
    id: "monthly",
    nameKey: "sub.planMonthly",
    price: "$4.99",
    periodKey: "sub.perMonth",
    featureKeys: ["sub.featAllTools", "sub.featCredits", "sub.featStandardQueue", "sub.featEmailSupport"],
  },
  {
    id: "yearly",
    nameKey: "sub.planYearly",
    price: "$29.99",
    periodKey: "sub.perYear",
    popular: true,
    featureKeys: [
      "sub.featEverythingMonthly",
      "sub.featUnlimitedCredits",
      "sub.featPriority",
      "sub.featTwoMonthsFree",
      "sub.featPrioritySupport",
    ],
  },
  {
    id: "lifetime",
    nameKey: "sub.planLifetime",
    price: "$99.99",
    periodKey: "sub.oneTime",
    featureKeys: ["sub.featEverythingYearly", "sub.featPayOnce", "sub.featEarlyAccess", "sub.featVipSupport"],
  },
];

const PLAN_AMOUNT: Record<PlanId, string> = {
  monthly: "4.99",
  yearly: "29.99",
  lifetime: "99.99",
};

/* ------------------------------------------------------------------ */
/* View                                                                */
/* ------------------------------------------------------------------ */

export default function SubscriptionView() {
  const user = useAppStore((s) => s.user);
  const config = useAppStore((s) => s.config);
  const bootstrap = useAppStore((s) => s.bootstrap);
  const setView = useAppStore((s) => s.setView);
  const lang = useAppStore((s) => s.lang);
  const t = useAppStore((s) => s.t);
  const toast = useQtbToast();

  const [banks, setBanks] = useState<Bank[] | null>(null);
  const [requests, setRequests] = useState<SubRequest[] | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);
  const [selectedBank, setSelectedBank] = useState<string>("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [activatingTrial, setActivatingTrial] = useState(false);
  const proofRef = useRef<HTMLInputElement>(null);

  const active = user?.subscriptionStatus === "active";
  const daysLeft = trialDaysLeft(user);
  const expired = user?.subscriptionStatus === "expired" || (daysLeft !== null && daysLeft < 0);

  useEffect(() => {
    let isActive = true;
    api<{ banks?: Bank[] }>("/api/banks")
      .then((r) => isActive && setBanks(r.banks ?? []))
      .catch(() => isActive && setBanks([]));
    api<{ requests?: SubRequest[] }>("/api/subscription/status")
      .then((r) => isActive && setRequests(r.requests ?? []))
      .catch(() => isActive && setRequests([]));
    return () => {
      isActive = false;
    };
  }, []);

  const activateTrial = async () => {
    if (activatingTrial) return;
    setActivatingTrial(true);
    try {
      const fd = new FormData();
      fd.set("plan", "yearly");
      fd.set("bankAccountId", "");
      fd.set("paymentReference", "");
      fd.set("note", "No-card 1-year free trial activation");
      const res = await api<{ ok?: boolean; trialGranted?: boolean }>(
        "/api/subscription/request",
        { method: "POST", body: fd }
      );
      if (res.trialGranted) toast.success(t("sub.trialActivated"), t("sub.trialActivatedSub"));
      else toast.success(t("sub.requestReceived"), t("sub.trialProcessing"));
      await bootstrap();
    } catch (err) {
      toast.error(err, t("sub.trialFailed"));
    } finally {
      setActivatingTrial(false);
    }
  };

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !selectedPlan) return;
    if (!selectedBank) {
      toast.error(new Error(t("sub.selectBank")), t("sub.missingBank"));
      return;
    }
    if (!reference.trim()) {
      toast.error(new Error(t("sub.enterRef")), t("sub.missingRef"));
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("plan", selectedPlan);
      fd.set("bankAccountId", selectedBank);
      fd.set("paymentReference", reference.trim());
      fd.set("note", note.trim());
      fd.set("amount", PLAN_AMOUNT[selectedPlan]);
      if (proof) fd.set("proof", proof);
      await api<{ ok?: boolean }>("/api/subscription/request", {
        method: "POST",
        body: fd,
      });
      setSubmitted(true);
      toast.success(t("sub.requestSent"), t("sub.requestSentSub"));
    } catch (err) {
      toast.error(err, t("sub.submitFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const plan = PLANS.find((p) => p.id === selectedPlan) ?? null;

  /* ----------------------------- render ----------------------------- */

  return (
    <div className="py-8 sm:py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-fuchsia-600">
            {t("sub.eyebrow")}
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-900 sm:text-3xl">
            {t("sub.title")}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">{t("sub.paySub")}</p>
        </div>
        {user && <StatusPill status={user.subscriptionStatus} className="shrink-0 self-start" />}
      </div>

      {/* Trial banner */}
      {config?.freeTrialEnabled && user?.subscriptionStatus === "none" && (
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <GradientChip icon="gift" tone="emerald" />
            <div>
              <p className="text-sm font-bold text-neutral-900">
                {t("sub.trialBanner")}
              </p>
              <p className="text-xs text-neutral-600">{t("sub.trialBannerSub")}</p>
            </div>
          </div>
          <QTBButton loading={activatingTrial} onClick={activateTrial} className="shrink-0">
            <QTBIcon name="gift" size={15} /> {t("sub.activateTrial")}
          </QTBButton>
        </div>
      )}
      {user?.subscriptionStatus === "trial" && daysLeft !== null && daysLeft >= 0 && (
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          <QTBIcon name="clock" size={18} />
          {daysLeft === 0 ? t("sub.trialEndsToday") : t("dash.trialLeft", { days: daysLeft })}
        </div>
      )}
      {expired && (
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2.5 text-sm font-semibold text-rose-800">
            <QTBIcon name="alert" size={18} />
            {t("sub.expired")}
          </p>
        </div>
      )}

      {/* Active success state */}
      {active && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-8 text-center"
        >
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
            <QTBIcon name="badge-check" size={32} />
          </span>
          <h2 className="text-xl font-extrabold text-neutral-900">{t("sub.proActive")}</h2>
          <p className="max-w-md text-sm text-neutral-600">{t("sub.proActiveSub")}</p>
          <QTBButton variant="outline" onClick={() => setView("dashboard")}>
            {t("tool.back")}
          </QTBButton>
        </motion.div>
      )}

      {/* Plans */}
      {!active && (
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {PLANS.map((p, i) => (
            <motion.button
              key={p.id}
              type="button"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.07 }}
              whileHover={{ y: -5 }}
              onClick={() => {
                setSelectedPlan(p.id);
                setSubmitted(false);
              }}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-white p-6 text-left shadow-sm outline-none transition-all",
                selectedPlan === p.id
                  ? "border-neutral-900 ring-2 ring-neutral-900"
                  : "border-neutral-200 hover:shadow-lg hover:shadow-fuchsia-100/50"
              )}
            >
              {p.popular && (
                <>
                  <span className="absolute inset-0 -z-0 rounded-2xl bg-[conic-gradient(from_140deg,#f59e0b,#ec4899,#8b5cf6,#10b981,#f59e0b)] p-[2px]" />
                  <span className="absolute inset-[2px] -z-0 rounded-[14px] bg-white" />
                </>
              )}
              <span className="relative">
                {p.popular && (
                  <span className="mb-3 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                    <QTBIcon name="sparkles" size={11} /> {t("sub.mostPopular")}
                  </span>
                )}
                <p className="text-sm font-bold uppercase tracking-wider text-neutral-500">
                  {t(p.nameKey)}
                </p>
                <p className="mt-2">
                  <span className="text-3xl font-extrabold tracking-tight text-neutral-900">
                    {p.price}
                  </span>
                  <span className="text-sm font-medium text-neutral-400"> {t(p.periodKey)}</span>
                </p>
                <ul className="mt-5 space-y-2.5">
                  {p.featureKeys.map((key) => (
                    <li key={key} className="flex items-start gap-2 text-sm text-neutral-600">
                      <QTBIcon
                        name="check"
                        size={15}
                        className="mt-0.5 shrink-0 text-emerald-500"
                      />
                      {t(key)}
                    </li>
                  ))}
                </ul>
                <span
                  className={cn(
                    "mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl text-sm font-bold transition-colors",
                    selectedPlan === p.id
                      ? "bg-neutral-950 text-white"
                      : "bg-neutral-100 text-neutral-800 hover:bg-neutral-200"
                  )}
                >
                  {selectedPlan === p.id ? t("sub.selected") : t("sub.choose", { plan: t(p.nameKey) })}
                </span>
              </span>
            </motion.button>
          ))}
        </div>
      )}

      {/* Payment / request form */}
      {!active && selectedPlan && !submitted && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-10 rounded-2xl border border-neutral-200 bg-white p-5 sm:p-7"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-extrabold text-neutral-900">
              {t("sub.payForPre")}{" "}
              <span className="text-fuchsia-600">{plan ? t(plan.nameKey) : ""}</span> ({plan?.price})
            </h2>
            <QTBButton variant="ghost" size="sm" onClick={() => setSelectedPlan(null)}>
              {t("sub.changePlan")}
            </QTBButton>
          </div>

          {/* Banks */}
          <h3 className="mb-3 mt-6 text-sm font-bold uppercase tracking-wider text-neutral-500">
            {t("sub.stepTransfer")}
          </h3>
          {banks === null ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array(2)
                .fill(0)
                .map((_, i) => (
                  <Skeleton key={i} className="h-28 rounded-2xl" />
                ))}
            </div>
          ) : banks.length === 0 ? (
            <p className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-500">
              {t("sub.noBanksPre")}{" "}
              <a className="font-semibold underline" href={`mailto:${config?.supportEmail ?? "support@qutaibiv.com"}`}>
                {config?.supportEmail ?? "support@qutaibiv.com"}
              </a>
              .
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {banks.map((bank) => (
                <BankCard
                  key={bank.id}
                  bank={bank}
                  selected={selectedBank === bank.id}
                  onSelect={() => setSelectedBank(bank.id)}
                />
              ))}
            </div>
          )}

          {/* Details */}
          <form onSubmit={submitRequest} className="mt-7 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500">
              {t("sub.stepConfirm")}
            </h3>
            <div className="space-y-2">
              <Label htmlFor="sub-ref">{t("sub.paymentRef")} *</Label>
              <Input
                id="sub-ref"
                required
                placeholder={t("sub.paymentRefPlaceholder")}
                className="h-11 rounded-xl"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sub-note">{t("sub.note")}</Label>
              <Textarea
                id="sub-note"
                rows={2}
                placeholder={t("sub.notePlaceholder")}
                className="rounded-xl"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sub-proof">{t("sub.proof")}</Label>
              <button
                type="button"
                onClick={() => proofRef.current?.click()}
                className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/60 px-4 py-2.5 text-left text-sm outline-none transition-colors hover:border-fuchsia-300"
              >
                <QTBIcon name="upload-cloud" size={18} className="text-neutral-400" />
                {proof ? (
                  <span className="truncate font-semibold text-neutral-800">
                    {proof.name} · {formatBytes(proof.size)}
                  </span>
                ) : (
                  <span className="text-neutral-500">{t("sub.proofHint")}</span>
                )}
              </button>
              <input
                ref={proofRef}
                id="sub-proof"
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => setProof(e.target.files?.[0] ?? null)}
              />
            </div>
            <QTBButton
              type="submit"
              loading={submitting}
              className="w-full"
              wrapperClassName="w-full [&>button]:w-full"
            >
              <QTBIcon name="send" size={15} /> {t("sub.submit")}
            </QTBButton>
          </form>
        </motion.div>
      )}

      {/* Submitted success */}
      {!active && submitted && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-10 text-center"
        >
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
            <QTBIcon name="clock" size={30} />
          </span>
          <h2 className="text-xl font-extrabold text-neutral-900">{t("sub.underReview")}</h2>
          <p className="max-w-md text-sm text-neutral-600">{t("sub.reviewSub")}</p>
          <QTBButton variant="outline" onClick={() => setView("dashboard")}>
            {t("tool.back")}
          </QTBButton>
        </motion.div>
      )}

      {/* Request history */}
      {requests !== null && requests.length > 0 && (
        <div className="mt-10 rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-neutral-900">
            <QTBIcon name="list-check" size={17} className="text-fuchsia-500" />
            {t("sub.yourRequests")}
          </h2>
          <ul className="space-y-2.5">
            {requests.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-neutral-100 bg-neutral-50/60 p-3.5"
              >
                <span className="text-sm font-bold capitalize text-neutral-800">
                  {r.plan || "plan"} {r.amount ? `· $${r.amount}` : ""}
                </span>
                <span className="text-xs text-neutral-500">
                  {r.bankName ?? "—"} · {formatDate(r.createdAt, lang)}
                </span>
                <RequestStatusBadge status={r.status} />
                {r.reviewNote && (
                  <span className="w-full text-xs italic text-neutral-500">
                    {t("sub.reviewerNote")} {r.reviewNote}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub components                                                      */
/* ------------------------------------------------------------------ */

function RequestStatusBadge({ status }: { status: string }) {
  const t = useAppStore((s) => s.t);
  const s = status.toLowerCase();
  const label =
    s === "approved"
      ? t("sub.approved")
      : s === "denied"
        ? t("sub.denied")
        : t("sub.pending");
  return (
    <span
      className={cn(
        "ml-auto inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold",
        s === "approved" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        s === "denied" && "border-rose-200 bg-rose-50 text-rose-700",
        s !== "approved" && s !== "denied" && "border-amber-200 bg-amber-50 text-amber-700"
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          s === "approved" && "bg-emerald-500",
          s === "denied" && "bg-rose-500",
          s !== "approved" && s !== "denied" && "bg-amber-500"
        )}
      />
      {label}
    </span>
  );
}

function BankCard({
  bank,
  selected,
  onSelect,
}: {
  bank: Bank;
  selected: boolean;
  onSelect: () => void;
}) {
  const toast = useQtbToast();
  const t = useAppStore((s) => s.t);
  const copy = async () => {
    const ok = await copyToClipboard(bank.accountNumber);
    if (ok) toast.success(t("sub.copied"));
    else toast.error(new Error(t("sub.copyFailMsg")), t("sub.copyFailed"));
  };

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full flex-col gap-2 rounded-2xl border p-4 text-left outline-none transition-all",
        selected
          ? "border-fuchsia-500 bg-fuchsia-50/50 ring-2 ring-fuchsia-200"
          : "border-neutral-200 bg-white hover:border-neutral-300"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2.5">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-950 text-white">
            {bank.iconSvg ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={bank.iconSvg} />
              </svg>
            ) : (
              <QTBIcon name="bank" size={18} />
            )}
          </span>
          <span>
            <span className="block text-sm font-bold text-neutral-900">{bank.bankName}</span>
            <span className="block text-xs text-neutral-500">{bank.accountName}</span>
          </span>
        </span>
        <span
          className={cn(
            "inline-flex h-5 min-w-5 items-center justify-center rounded-full border px-1 text-[10px] font-bold",
            selected ? "border-fuchsia-500 bg-fuchsia-500 text-white" : "border-neutral-300 text-transparent"
          )}
        >
          <QTBIcon name="check" size={11} />
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 rounded-lg bg-neutral-50 px-3 py-2">
        <span className="truncate font-mono text-xs text-neutral-700">
          {bank.accountNumber}
          {bank.currency ? ` · ${bank.currency}` : ""}
        </span>
        <span
          role="button"
          tabIndex={0}
          aria-label={t("sub.copyAccount")}
          onClick={(e) => {
            e.stopPropagation();
            void copy();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.stopPropagation();
              void copy();
            }
          }}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 outline-none hover:bg-neutral-200 hover:text-neutral-900"
        >
          <QTBIcon name="copy" size={14} />
        </span>
      </div>
      {bank.instructions && (
        <p className="text-xs leading-relaxed text-neutral-500">{bank.instructions}</p>
      )}
    </button>
  );
}
