"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAppStore, userInitials, type UserRole } from "@/store/app-store";
import { apiJson } from "@/lib/client-api";
import { useQtbToast } from "@/components/qtb/use-qtb-toast";
import { formatDate } from "@/lib/i18n";
import QTBIcon from "@/components/qtb/QTBIcon";
import QTBButton from "@/components/qtb/QTBButton";
import { GradientChip, StatusPill } from "@/components/qtb/ui-bits";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { COUNTRIES } from "@/components/qtb/views/CompleteProfileView";

const ROLE_LABEL_KEYS: Record<UserRole, string> = {
  user: "me.roleUser",
  staff: "me.roleStaff",
  admin: "me.roleAdmin",
  super_admin: "me.roleSuperAdmin",
};

export default function ProfileMeView() {
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const t = useAppStore((s) => s.t);
  const lang = useAppStore((s) => s.lang);
  const toast = useQtbToast();

  const [name, setName] = useState(user?.name ?? "");
  const [country, setCountry] = useState(user?.country ?? "");
  const [address, setAddress] = useState(user?.address ?? "");
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    if (user && !hydrated) {
      setName(user.name ?? "");
      setCountry(user.country ?? "");
      setAddress(user.address ?? "");
      setHydrated(true);
    }
  }, [user, hydrated]);

  if (!user) return null;

  const handleSave = async () => {
    if (name.trim().length === 0) {
      toast.info(t("me.nameRequired"), t("me.nameRequiredSub"));
      return;
    }
    setSaving(true);
    try {
      const res = await apiJson<{ user?: unknown }>("/api/profile", "PUT", {
        name: name.trim(),
        country: country.trim(),
        address: address.trim(),
      });
      if (res.user && typeof res.user === "object") {
        const u = res.user as Record<string, unknown>;
        setUser({
          ...user,
          name: String(u.name ?? ""),
          country: typeof u.country === "string" && u.country ? u.country : null,
          address: typeof u.address === "string" && u.address ? u.address : null,
          profileComplete: u.profileComplete === true,
        });
      }
      toast.success(t("me.saved"), t("me.savedSub"));
    } catch (err) {
      toast.error(err, t("me.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (pwSaving) return;
    if (pwNew.length < 6) {
      toast.error(new Error(t("me.pwMinError")), t("me.weakPw"));
      return;
    }
    if (pwNew !== pwConfirm) {
      toast.error(new Error(t("me.pwMatchError")), t("me.checkPw"));
      return;
    }
    setPwSaving(true);
    try {
      await apiJson("/api/auth/change-password", "POST", {
        currentPassword: pwCurrent,
        newPassword: pwNew,
      });
      setPwCurrent("");
      setPwNew("");
      setPwConfirm("");
      toast.success(t("me.pwChanged"), t("me.pwChangedSub"));
    } catch (err) {
      toast.error(err, t("me.pwFailed"));
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl py-8 sm:py-10">
      <p className="text-xs font-bold uppercase tracking-[0.25em] text-fuchsia-600">
        {t("me.eyebrow")}
      </p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-900 sm:text-3xl">
        {t("me.title")}
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        {t("me.sub")}
      </p>

      {/* Identity card */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="mt-6 flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5 sm:flex-row sm:items-center sm:p-6"
      >
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-neutral-950 text-lg font-extrabold text-white">
          {userInitials(user)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold text-neutral-900">
            {user.name || t("me.unnamed")}
          </p>
          <p className="truncate text-sm text-neutral-500 qtb-ltr-force">{user.email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusPill status={user.subscriptionStatus} />
            <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-600">
              <QTBIcon name="shield" size={12} />
              {t(ROLE_LABEL_KEYS[user.role])}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-neutral-400">
              <QTBIcon name="clock" size={12} />
              {t("me.joined")} {formatDate(user.createdAt, lang)}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Edit form */}
      <Card className="mt-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GradientChip icon="user" tone="violet" size="sm" />
            {t("me.personalDetails")}
          </CardTitle>
          <CardDescription>
            {t("me.editSub")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pm-name">{t("me.fullName")}</Label>
            <Input
              id="pm-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("me.namePlaceholder")}
              maxLength={80}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pm-country">{t("me.country")}</Label>
            <Select
              value={country || undefined}
              onValueChange={(v) => setCountry(v)}
            >
              <SelectTrigger id="pm-country" className="w-full">
                <SelectValue placeholder={t("me.countryPlaceholder")} />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {COUNTRIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pm-address">{t("me.address")}</Label>
            <Textarea
              id="pm-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t("me.addressPlaceholder")}
              rows={3}
              maxLength={300}
            />
          </div>
          <div className="flex justify-end">
            <QTBButton onClick={() => void handleSave()} loading={saving}>
              <QTBIcon name="check" size={15} /> {t("me.save")}
            </QTBButton>
          </div>
        </CardContent>
      </Card>

      {/* Security — change password */}
      <Card className="mt-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GradientChip icon="shield-check" tone="emerald" size="sm" />
            {t("me.security")}
          </CardTitle>
          <CardDescription>
            {t("me.pwStay")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pw-current">{t("me.currentPw")}</Label>
            <Input
              id="pw-current"
              type="password"
              autoComplete="current-password"
              value={pwCurrent}
              onChange={(e) => setPwCurrent(e.target.value)}
              className="h-11 rounded-xl"
              placeholder="••••••••"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pw-new">{t("me.newPw")}</Label>
              <Input
                id="pw-new"
                type="password"
                autoComplete="new-password"
                value={pwNew}
                onChange={(e) => setPwNew(e.target.value)}
                className="h-11 rounded-xl"
                placeholder={t("me.pwNewHint")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw-confirm">{t("me.confirmPw")}</Label>
              <Input
                id="pw-confirm"
                type="password"
                autoComplete="new-password"
                value={pwConfirm}
                onChange={(e) => setPwConfirm(e.target.value)}
                className="h-11 rounded-xl"
                placeholder={t("me.pwConfirmHint")}
              />
            </div>
          </div>
          {pwNew.length > 0 && <PasswordStrength password={pwNew} />}
          {pwConfirm.length > 0 && pwNew !== pwConfirm && (
            <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-600">
              <QTBIcon name="shield" size={12} /> {t("me.pwMismatch")}
            </p>
          )}
          <div className="flex justify-end">
            <QTBButton
              size="sm"
              loading={pwSaving}
              disabled={
                !pwCurrent ||
                pwNew.length < 6 ||
                pwNew !== pwConfirm ||
                pwCurrent === pwNew
              }
              onClick={handleChangePassword}
            >
              <QTBIcon name="shield-check" size={15} /> {t("me.updatePw")}
            </QTBButton>
          </div>
        </CardContent>
      </Card>

      {/* Account snapshot */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            {t("me.snapshotProfile")}
          </p>
          <p
            className={`mt-1 text-sm font-bold ${
              user.profileComplete ? "text-emerald-600" : "text-amber-600"
            }`}
          >
            {user.profileComplete ? t("me.complete") : t("me.incomplete")}
          </p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            {t("me.snapshotPlan")}
          </p>
          <p className="mt-1 text-sm font-bold capitalize text-neutral-800">
            {user.subscriptionStatus === "active"
              ? t("me.proMember")
              : user.subscriptionStatus === "trial"
                ? t("me.freeTrial")
                : user.subscriptionStatus}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Colored password strength meter — 4 segments (rose / amber / amber / emerald).
 * Also exported for reuse in the register form.
 */
export function passwordScore(password: string): number {
  let score = 0;
  if (password.length >= 6) score += 1;
  if (password.length >= 10) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
  return score; // 0..4
}

const STRENGTH_STEPS = [
  { labelKey: "me.pwVeryWeak", bar: "bg-rose-500", text: "text-rose-600" },
  { labelKey: "me.pwWeak", bar: "bg-rose-400", text: "text-rose-600" },
  { labelKey: "me.pwOkay", bar: "bg-amber-400", text: "text-amber-600" },
  { labelKey: "me.pwGood", bar: "bg-amber-500", text: "text-amber-600" },
  { labelKey: "me.pwStrong", bar: "bg-emerald-500", text: "text-emerald-600" },
];

export function PasswordStrength({ password }: { password: string }) {
  const score = passwordScore(password);
  const step = STRENGTH_STEPS[Math.min(score, STRENGTH_STEPS.length - 1)];
  const t = useAppStore((s) => s.t);
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        {STRENGTH_STEPS.map((s, i) => (
          <span
            key={s.labelKey}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
              password.length > 0 && i < Math.max(score, 1) ? step.bar : "bg-neutral-200"
            }`}
          />
        ))}
      </div>
      <p className={`text-[11px] font-bold ${step.text}`}>
        {t("me.pwStrength")}: {password.length === 0 ? "—" : t(step.labelKey)}
      </p>
    </div>
  );
}
