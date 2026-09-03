"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useAppStore } from "@/store/app-store";
import { formatDate } from "@/lib/i18n";
import { apiJson } from "@/lib/client-api";
import { useQtbToast } from "@/components/qtb/use-qtb-toast";
import QTBIcon from "@/components/qtb/QTBIcon";
import QTBButton from "@/components/qtb/QTBButton";
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
import { cn } from "@/lib/utils";

export const COUNTRIES = [
  "United States", "United Kingdom", "Canada", "Australia", "Germany",
  "France", "Spain", "Italy", "Netherlands", "Sweden", "Norway", "Denmark",
  "Finland", "Poland", "Portugal", "Ireland", "Switzerland", "Austria",
  "Belgium", "Turkey", "Saudi Arabia", "United Arab Emirates", "Qatar",
  "Kuwait", "Egypt", "Jordan", "Yemen", "Oman", "Lebanon", "Morocco",
  "India", "Pakistan", "Indonesia", "Malaysia", "Singapore", "Japan",
  "China", "South Korea", "Brazil", "Mexico", "South Africa", "Nigeria",
  "Kenya", "Russia", "Other",
];

function StepBadge({
  step,
  label,
  state,
}: {
  step: number;
  label: string;
  state: "done" | "active" | "todo";
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-bold",
          state === "done" && "border-emerald-500 bg-emerald-500 text-white",
          state === "active" &&
            "border-neutral-950 bg-neutral-950 text-white shadow-md shadow-fuchsia-200",
          state === "todo" && "border-neutral-200 bg-white text-neutral-400"
        )}
      >
        {state === "done" ? <QTBIcon name="check" size={16} /> : step}
      </span>
      <span
        className={cn(
          "text-xs font-bold uppercase tracking-wider",
          state === "todo" ? "text-neutral-400" : "text-neutral-800"
        )}
      >
        {label}
      </span>
    </div>
  );
}

export default function CompleteProfileView() {
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const setView = useAppStore((s) => s.setView);
  const lang = useAppStore((s) => s.lang);
  const t = useAppStore((s) => s.t);
  const toast = useQtbToast();

  const [name, setName] = useState(user?.name ?? "");
  const [country, setCountry] = useState(user?.country ?? "");
  const [address, setAddress] = useState(user?.address ?? "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!name.trim()) {
      toast.error(new Error(t("auth.nameRequired")), t("auth.missingName"));
      return;
    }
    if (!country) {
      toast.error(new Error(t("profile.countryRequired")), t("profile.missingCountry"));
      return;
    }
    setSaving(true);
    try {
      const res = await apiJson<{ user: unknown }>("/api/profile", "PUT", {
        name: name.trim(),
        country,
        address: address.trim(),
      });
      if (res.user) {
        // Re-normalize via bootstrap so the store user matches the contract.
        await useAppStore.getState().bootstrap();
      }
      toast.success(t("profile.saved"), t("profile.savedSub"));
      setView("dashboard");
    } catch (err) {
      toast.error(err, t("profile.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl py-10 sm:py-14">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="mb-8 flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:px-6">
          <StepBadge step={1} label={t("profile.stepAccount")} state="done" />
          <span aria-hidden="true" className="h-0.5 flex-1 rounded bg-gradient-to-r from-emerald-300 via-fuchsia-300 to-neutral-200" />
          <StepBadge step={2} label={t("profile.stepProfile")} state="active" />
          <span aria-hidden="true" className="h-0.5 w-6 rounded bg-neutral-200" />
          <StepBadge step={3} label={t("profile.stepTools")} state="todo" />
        </div>

        <Card className="rounded-2xl border-neutral-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl font-extrabold tracking-tight">
              {t("profile.gateTitle")}
            </CardTitle>
            <CardDescription>
              {t("profile.gateSub")}
              {user?.createdAt && (
                <span className="mt-1 block text-xs text-neutral-400">
                  {t("profile.created", { date: formatDate(user.createdAt, lang) })}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="cp-name">{t("auth.name")}</Label>
                <Input
                  id="cp-name"
                  required
                  placeholder={t("profile.namePlaceholder")}
                  className="h-11 rounded-xl"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cp-country">{t("profile.country")}</Label>
                <Select value={country} onValueChange={setCountry} required>
                  <SelectTrigger id="cp-country" className="h-11 w-full rounded-xl">
                    <SelectValue placeholder={t("profile.countryPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent className="max-h-72 rounded-xl">
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c} value={c} className="rounded-lg">
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cp-address">{t("profile.address")}</Label>
                <Textarea
                  id="cp-address"
                  rows={3}
                  placeholder={t("profile.addressPlaceholder")}
                  className="rounded-xl"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <QTBButton
                type="submit"
                loading={saving}
                className="w-full"
                wrapperClassName="w-full [&>button]:w-full"
              >
                {t("profile.continue")} {" "}
                <QTBIcon
                  name="arrow-left"
                  size={15}
                  className={lang === "ar" ? "rotate-180 qtb-flip" : "rotate-180"}
                />
              </QTBButton>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
