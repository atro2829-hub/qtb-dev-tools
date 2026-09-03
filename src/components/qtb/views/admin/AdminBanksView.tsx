"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api, apiJson } from "@/lib/client-api";
import { useQtbToast } from "@/components/qtb/use-qtb-toast";
import QTBIcon from "@/components/qtb/QTBIcon";
import QTBButton from "@/components/qtb/QTBButton";
import { GradientChip, EmptyState } from "@/components/qtb/ui-bits";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface BankRow {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  iban: string;
  swiftCode: string;
  currency: string;
  instructions: string;
  iconSvg: string;
  active: boolean;
  createdAt: string;
}

interface BankForm {
  bankName: string;
  accountName: string;
  accountNumber: string;
  iban: string;
  swiftCode: string;
  currency: string;
  instructions: string;
  iconSvg: string;
}

const EMPTY_FORM: BankForm = {
  bankName: "",
  accountName: "",
  accountNumber: "",
  iban: "",
  swiftCode: "",
  currency: "USD",
  instructions: "",
  iconSvg: "",
};

const CURRENCY_OPTIONS = ["USD", "YER", "SAR", "EUR", "AED", "GBP"];
const KNOWN_CURRENCIES = new Set(CURRENCY_OPTIONS);

function normalizeBank(raw: unknown): BankRow | null {
  if (typeof raw !== "object" || raw === null) return null;
  const b = raw as Record<string, unknown>;
  if (typeof b.id !== "string") return null;
  const str = (k: string) => (typeof b[k] === "string" ? (b[k] as string) : "");
  return {
    id: b.id,
    bankName: str("bankName"),
    accountName: str("accountName"),
    accountNumber: str("accountNumber"),
    iban: str("iban"),
    swiftCode: str("swiftCode"),
    currency: str("currency") || "USD",
    instructions: str("instructions"),
    iconSvg: str("iconSvg"),
    active: b.active !== false,
    createdAt: typeof b.createdAt === "string" ? b.createdAt : new Date().toISOString(),
  };
}

/** Renders raw svg inner markup (paths) inside a normalized 24x24 stroke frame. */
function BankIconPreview({ markup, className }: { markup: string; className?: string }) {
  const clean = markup.replace(/<\s*\/?\s*(svg|g)[^>]*>/gi, "");
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-6 w-6", className)}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* View                                                                */
/* ------------------------------------------------------------------ */

export default function AdminBanksView() {
  const toast = useQtbToast();
  const [banks, setBanks] = useState<BankRow[] | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BankForm>(EMPTY_FORM);
  const [customCurrency, setCustomCurrency] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BankRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api<{ banks?: unknown[] }>("/api/admin/banks")
      .then((res) => {
        if (!active) return;
        const list = (res.banks ?? [])
          .map(normalizeBank)
          .filter((b): b is BankRow => b !== null);
        setBanks(list);
      })
      .catch((err) => {
        if (active) {
          setBanks([]);
          toast.error(err, "Couldn't load bank accounts");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const patchForm = (partial: Partial<BankForm>) =>
    setForm((f) => ({ ...f, ...partial }));

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setCustomCurrency(false);
    setDialogOpen(true);
  };

  const openEdit = (bank: BankRow) => {
    setEditingId(bank.id);
    setForm({
      bankName: bank.bankName,
      accountName: bank.accountName,
      accountNumber: bank.accountNumber,
      iban: bank.iban,
      swiftCode: bank.swiftCode,
      currency: bank.currency,
      instructions: bank.instructions,
      iconSvg: bank.iconSvg,
    });
    setCustomCurrency(bank.currency.length > 0 && !KNOWN_CURRENCIES.has(bank.currency));
    setDialogOpen(true);
  };

  const submitForm = async () => {
    if (
      form.bankName.trim().length === 0 ||
      form.accountName.trim().length === 0 ||
      form.accountNumber.trim().length === 0
    ) {
      toast.info("Missing details", "Bank name, account name and account number are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, bankName: form.bankName.trim(), accountName: form.accountName.trim(), accountNumber: form.accountNumber.trim() };
      if (editingId) {
        const res = await apiJson<{ bank?: unknown }>("/api/admin/banks", "PUT", {
          id: editingId,
          ...payload,
        });
        const updated = normalizeBank(res.bank);
        setBanks((list) =>
          list ? list.map((b) => (b.id === editingId && updated ? updated : b)) : list
        );
        toast.success("Bank account updated", payload.bankName);
      } else {
        const res = await apiJson<{ bank?: unknown }>("/api/admin/banks", "POST", payload);
        const created = normalizeBank(res.bank);
        if (created) setBanks((list) => [created, ...(list ?? [])]);
        toast.success("Bank account added", payload.bankName);
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(err, "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (bank: BankRow, active: boolean) => {
    setBusyId(bank.id);
    try {
      const res = await apiJson<{ bank?: unknown }>("/api/admin/banks", "PUT", {
        id: bank.id,
        active,
      });
      const updated = normalizeBank(res.bank);
      setBanks((list) =>
        list ? list.map((b) => (b.id === bank.id && updated ? updated : b)) : list
      );
      toast.success(
        active ? "Account shown to members" : "Account hidden from members",
        bank.bankName
      );
    } catch (err) {
      toast.error(err, "Couldn't update account");
    } finally {
      setBusyId(null);
    }
  };

  const removeBank = async (bank: BankRow) => {
    try {
      await apiJson(`/api/admin/banks?id=${encodeURIComponent(bank.id)}`, "DELETE");
      setBanks((list) => (list ? list.filter((b) => b.id !== bank.id) : list));
      toast.success("Bank account deleted", bank.bankName);
    } catch (err) {
      toast.error(err, "Delete failed");
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <GradientChip icon="bank" tone="emerald" />
          <div>
            <h2 className="text-base font-bold text-neutral-900">Bank Accounts</h2>
            <p className="text-xs text-neutral-400">
              Payment destinations shown on the subscription page.
            </p>
          </div>
        </div>
        <QTBButton size="sm" onClick={openCreate} className="shrink-0">
          <QTBIcon name="plus" size={15} /> Add Bank Account
        </QTBButton>
      </div>

      {/* Loading */}
      {banks === null && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array(3)
            .fill(0)
            .map((_, i) => (
              <Skeleton key={i} className="h-52 rounded-2xl" />
            ))}
        </div>
      )}

      {/* Empty */}
      {banks !== null && banks.length === 0 && (
        <div className="rounded-2xl border border-neutral-200 bg-white">
          <EmptyState
            icon="bank"
            title="No bank accounts yet"
            description="Add your first payment destination so members can subscribe."
            action={
              <QTBButton size="sm" onClick={openCreate}>
                <QTBIcon name="plus" size={15} /> Add Bank Account
              </QTBButton>
            }
          />
        </div>
      )}

      {/* Cards grid */}
      {banks !== null && banks.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {banks.map((bank, i) => (
            <motion.div
              key={bank.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: Math.min(i * 0.05, 0.25) }}
              className={cn(
                "flex flex-col rounded-2xl border bg-white p-5 shadow-sm transition-opacity",
                bank.active ? "border-neutral-200" : "border-dashed border-neutral-300 opacity-75"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    {bank.iconSvg.trim() ? (
                      <BankIconPreview markup={bank.iconSvg} />
                    ) : (
                      <QTBIcon name="bank" size={20} />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-neutral-900">{bank.bankName}</p>
                    <p className="truncate text-xs text-neutral-400">{bank.accountName}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <Badge
                    variant="outline"
                    className="border-amber-200 bg-amber-50 font-bold text-amber-700"
                  >
                    {bank.currency}
                  </Badge>
                  <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-neutral-400">
                    Active
                    <Switch
                      checked={bank.active}
                      disabled={busyId === bank.id}
                      onCheckedChange={(v) => void toggleActive(bank, v)}
                      aria-label={`Toggle ${bank.bankName} active`}
                    />
                  </label>
                </div>
              </div>

              <div className="mt-4 space-y-1.5 rounded-xl bg-neutral-50/80 p-3 text-sm">
                <p className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                    Number
                  </span>
                  <span className="font-mono text-xs font-bold text-neutral-800">
                    {bank.accountNumber}
                  </span>
                </p>
                {bank.iban && (
                  <p className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                      IBAN
                    </span>
                    <span className="truncate font-mono text-xs text-neutral-700">{bank.iban}</span>
                  </p>
                )}
                {bank.swiftCode && (
                  <p className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                      SWIFT
                    </span>
                    <span className="font-mono text-xs text-neutral-700">{bank.swiftCode}</span>
                  </p>
                )}
              </div>

              {bank.instructions && (
                <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-neutral-500">
                  {bank.instructions}
                </p>
              )}

              <div className="mt-4 flex items-center justify-end gap-2 border-t border-neutral-100 pt-3">
                <QTBButton size="sm" variant="ghost" onClick={() => openEdit(bank)}>
                  <QTBIcon name="edit" size={14} /> Edit
                </QTBButton>
                <QTBButton
                  size="sm"
                  variant="ghost"
                  className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  onClick={() => setDeleteTarget(bank)}
                >
                  <QTBIcon name="trash" size={14} /> Delete
                </QTBButton>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ---------------- Create / Edit dialog ---------------- */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto qtb-scroll sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Bank Account" : "Add Bank Account"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update the payment details below and save."
                : "Members will copy these details when paying for a subscription."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bank-name">Bank name *</Label>
                <Input
                  id="bank-name"
                  value={form.bankName}
                  onChange={(e) => patchForm({ bankName: e.target.value })}
                  maxLength={200}
                  placeholder="Emirates NBD"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bank-account-name">Account name *</Label>
                <Input
                  id="bank-account-name"
                  value={form.accountName}
                  onChange={(e) => patchForm({ accountName: e.target.value })}
                  maxLength={200}
                  placeholder="QTB DEV LLC"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="bank-number">Account number *</Label>
                <Input
                  id="bank-number"
                  value={form.accountNumber}
                  onChange={(e) => patchForm({ accountNumber: e.target.value })}
                  maxLength={120}
                  placeholder="1234 5678 9012"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bank-iban">IBAN</Label>
                <Input
                  id="bank-iban"
                  value={form.iban}
                  onChange={(e) => patchForm({ iban: e.target.value })}
                  maxLength={120}
                  placeholder="AE07 0331 …"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bank-swift">SWIFT / BIC</Label>
                <Input
                  id="bank-swift"
                  value={form.swiftCode}
                  onChange={(e) => patchForm({ swiftCode: e.target.value })}
                  maxLength={60}
                  placeholder="EBILAEAD"
                  className="font-mono"
                />
              </div>
            </div>

            {/* Currency */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bank-currency">Currency</Label>
                <Select
                  value={customCurrency ? "OTHER" : form.currency}
                  onValueChange={(v) => {
                    if (v === "OTHER") {
                      setCustomCurrency(true);
                    } else {
                      setCustomCurrency(false);
                      patchForm({ currency: v });
                    }
                  }}
                >
                  <SelectTrigger id="bank-currency" className="w-full">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                    <SelectItem value="OTHER">Other…</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {customCurrency && (
                <div className="space-y-2">
                  <Label htmlFor="bank-currency-other">Custom currency</Label>
                  <Input
                    id="bank-currency-other"
                    value={KNOWN_CURRENCIES.has(form.currency) ? "" : form.currency}
                    onChange={(e) =>
                      patchForm({ currency: e.target.value.toUpperCase().slice(0, 10) })
                    }
                    maxLength={10}
                    placeholder="e.g. KWD"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="bank-instructions">Payment instructions</Label>
              <Textarea
                id="bank-instructions"
                value={form.instructions}
                onChange={(e) => patchForm({ instructions: e.target.value })}
                maxLength={2000}
                rows={3}
                placeholder="Transfer the subscription amount, then submit your payment reference…"
              />
            </div>

            {/* Icon SVG */}
            <div className="space-y-2">
              <Label htmlFor="bank-icon">Icon (SVG path markup)</Label>
              <div className="flex items-start gap-3">
                <span className="mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-700">
                  {form.iconSvg.trim() ? (
                    <BankIconPreview markup={form.iconSvg} />
                  ) : (
                    <QTBIcon name="bank" size={20} className="text-neutral-300" />
                  )}
                </span>
                <Textarea
                  id="bank-icon"
                  value={form.iconSvg}
                  onChange={(e) => patchForm({ iconSvg: e.target.value })}
                  maxLength={2000}
                  rows={2}
                  placeholder='<path d="M3 10h18M5 10V7l7-4 7 4v3…" />'
                  className="font-mono text-xs"
                />
              </div>
              <p className="text-[11px] text-neutral-400">
                Rendered live inside a 24×24 stroke frame — leave empty for the default bank icon.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <QTBButton variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </QTBButton>
            <QTBButton loading={saving} onClick={() => void submitForm()}>
              <QTBIcon name="check" size={15} /> {editingId ? "Save Changes" : "Add Account"}
            </QTBButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this bank account?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.bankName}” will no longer be selectable on the subscription page.
              Existing requests keep their recorded bank name. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => deleteTarget && void removeBank(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
