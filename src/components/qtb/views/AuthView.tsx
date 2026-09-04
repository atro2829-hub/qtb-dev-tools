"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  useAppStore,
  isAdmin,
  DEFAULT_SITE_CONFIG,
  viewFromPath,
  consumePostAuthPath,
  type View,
} from "@/store/app-store";
import { api } from "@/lib/client-api";
import { useQtbToast } from "@/components/qtb/use-qtb-toast";
import QTBLogo from "@/components/qtb/QTBLogo";
import QTBIcon from "@/components/qtb/QTBIcon";
import QTBButton from "@/components/qtb/QTBButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordStrength } from "@/components/qtb/views/ProfileMeView";

const PERKS: { icon: "bolt" | "shield-check" | "sparkles"; textKey: string }[] = [
  { icon: "bolt", textKey: "auth.perk1" },
  { icon: "shield-check", textKey: "auth.perk2" },
  { icon: "sparkles", textKey: "auth.perk3" },
];

export default function AuthView() {
  const setView = useAppStore((s) => s.setView);
  const bootstrap = useAppStore((s) => s.bootstrap);
  const t = useAppStore((s) => s.t);
  const toast = useQtbToast();
  // Path remembered from a signed-out deep link (e.g. someone opening a
  // shared /tools/audio-to-pdf link) — after login we return them there.
  const [postAuthView, setPostAuthView] = useState<View | null>(null);

  useEffect(() => {
    const dest = consumePostAuthPath();
    if (dest) {
      const v = viewFromPath(dest);
      if (v && v !== "landing" && v !== "auth") setPostAuthView(v);
    }
  }, []);

  // Sign in
  const [siEmail, setSiEmail] = useState("");
  const [siPassword, setSiPassword] = useState("");
  const [siLoading, setSiLoading] = useState(false);

  // Sign up
  const [suName, setSuName] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suConfirm, setSuConfirm] = useState("");
  const [suLoading, setSuLoading] = useState(false);

  const passwordsMatch = suConfirm.length > 0 && suPassword === suConfirm;
  const passwordsMismatch = suConfirm.length > 0 && suPassword !== suConfirm;

  const routeAfterAuth = () => {
    const user = useAppStore.getState().user;
    if (!user) return;
    // 1) Honor a remembered deep-link destination (role-guarded).
    if (postAuthView) {
      if (!postAuthView.startsWith("admin-") || isAdmin(user)) {
        setView(postAuthView);
        return;
      }
    }
    if (!user.profileComplete) setView("profile");
    else if (isAdmin(user)) setView("admin-settings");
    else setView("dashboard");
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (siLoading) return;
    setSiLoading(true);
    try {
      const res = await api<{ user: unknown }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: siEmail.trim(), password: siPassword }),
      });
      if (!res.user) throw new Error(t("auth.invalidCredentials"));
      await bootstrap();
      const name = useAppStore.getState().user?.name ?? "";
      toast.success(t("auth.welcomeBackToast", { name }));
      routeAfterAuth();
    } catch (err) {
      toast.error(err, t("auth.signInFailed"));
    } finally {
      setSiLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (suLoading) return;
    if (!suName.trim()) {
      toast.error(new Error(t("auth.nameRequired")), t("auth.missingName"));
      return;
    }
    if (suPassword.length < 6) {
      toast.error(new Error(t("auth.pwTooShort")), t("auth.weakPassword"));
      return;
    }
    if (suPassword !== suConfirm) {
      toast.error(new Error(t("auth.pwMismatch")), t("auth.checkPassword"));
      return;
    }
    setSuLoading(true);
    try {
      const res = await api<{ user: unknown }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: suName.trim(),
          email: suEmail.trim(),
          password: suPassword,
        }),
      });
      if (!res.user) throw new Error(t("auth.registerFailedMsg"));
      await bootstrap();
      toast.success(t("auth.accountCreated"), t("auth.completeProfileNext"));
      routeAfterAuth();
    } catch (err) {
      toast.error(err, t("auth.registerFailed"));
    } finally {
      setSuLoading(false);
    }
  };

  const config = useAppStore((s) => s.config) ?? DEFAULT_SITE_CONFIG;

  return (
    <div className="flex items-stretch justify-center gap-0 py-10 sm:py-14">
      {/* Brand side panel */}
      <aside className="hidden w-[340px] shrink-0 flex-col justify-between rounded-2xl bg-neutral-950 p-8 text-white lg:flex">
        <div className="pointer-events-none absolute" aria-hidden="true" />
        <div>
          <QTBLogo size={44} />
          <h2 className="mt-8 text-2xl font-extrabold leading-snug tracking-tight">
            {t("auth.panelLine1")}
            <br />
            <span className="bg-gradient-to-r from-amber-400 via-fuchsia-400 to-emerald-400 bg-clip-text text-transparent">
              {t("auth.panelLine2")}
            </span>
          </h2>
          <ul className="mt-8 space-y-4">
            {PERKS.map((p) => (
              <li key={p.textKey} className="flex items-start gap-3 text-sm text-neutral-300">
                <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <QTBIcon name={p.icon} size={15} />
                </span>
                {t(p.textKey)}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-neutral-500">
          {config.organization} · {t("auth.trusted")}
        </p>
      </aside>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <Card className="rounded-2xl border-neutral-200 shadow-sm sm:min-w-[420px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl font-extrabold tracking-tight">
              {t("auth.cardTitle")}
            </CardTitle>
            <CardDescription>{t("auth.cardSub")}</CardDescription>
          </CardHeader>
          <CardContent>
            {postAuthView && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 flex items-center gap-2.5 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-xs font-semibold text-sky-800"
                role="status"
              >
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-sky-100">
                  <QTBIcon name="arrow-left" size={13} className="rtl:rotate-180" />
                </span>
                {t("auth.continueTo")}
              </motion.div>
            )}
            <Tabs defaultValue="signin">
              <TabsList className="mb-5 grid h-11 w-full grid-cols-2 rounded-xl">
                <TabsTrigger value="signin" className="rounded-lg font-semibold">
                  {t("auth.signIn")}
                </TabsTrigger>
                <TabsTrigger value="signup" className="rounded-lg font-semibold">
                  {t("auth.signUp")}
                </TabsTrigger>
              </TabsList>

              {/* Sign in */}
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="si-email">{t("auth.email")}</Label>
                    <Input
                      id="si-email"
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="you@example.com"
                      className="h-11 rounded-xl"
                      value={siEmail}
                      onChange={(e) => setSiEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="si-password">{t("auth.password")}</Label>
                    <Input
                      id="si-password"
                      type="password"
                      autoComplete="current-password"
                      required
                      placeholder="••••••••"
                      className="h-11 rounded-xl"
                      value={siPassword}
                      onChange={(e) => setSiPassword(e.target.value)}
                    />
                  </div>
                  <QTBButton
                    type="submit"
                    loading={siLoading}
                    className="w-full"
                    wrapperClassName="w-full [&>button]:w-full"
                  >
                    <QTBIcon name="lock" size={15} /> {t("auth.signIn")}
                  </QTBButton>
                </form>
              </TabsContent>

              {/* Sign up */}
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="su-name">{t("auth.name")}</Label>
                    <Input
                      id="su-name"
                      required
                      autoComplete="name"
                      placeholder="Qutaiba Dev"
                      className="h-11 rounded-xl"
                      value={suName}
                      onChange={(e) => setSuName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-email">{t("auth.email")}</Label>
                    <Input
                      id="su-email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="you@example.com"
                      className="h-11 rounded-xl"
                      value={suEmail}
                      onChange={(e) => setSuEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-password">{t("auth.password")}</Label>
                    <Input
                      id="su-password"
                      type="password"
                      required
                      autoComplete="new-password"
                      placeholder={t("auth.pwHint")}
                      className="h-11 rounded-xl"
                      value={suPassword}
                      onChange={(e) => setSuPassword(e.target.value)}
                    />
                    {suPassword.length > 0 && <PasswordStrength password={suPassword} />}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-confirm">{t("auth.confirmPassword")}</Label>
                    <Input
                      id="su-confirm"
                      type="password"
                      required
                      autoComplete="new-password"
                      placeholder={t("auth.pwRepeat")}
                      className="h-11 rounded-xl"
                      value={suConfirm}
                      onChange={(e) => setSuConfirm(e.target.value)}
                    />
                    {passwordsMatch && (
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                        <QTBIcon name="check-circle" size={14} /> {t("auth.passwordsMatch")}
                      </p>
                    )}
                    {passwordsMismatch && (
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                        <QTBIcon name="x" size={14} /> {t("auth.confirmMismatch")}
                      </p>
                    )}
                  </div>
                  <QTBButton
                    type="submit"
                    loading={suLoading}
                    className="w-full"
                    wrapperClassName="w-full [&>button]:w-full"
                  >
                    {t("auth.signUp")} <QTBIcon name="sparkles" size={15} />
                  </QTBButton>
                  <p className="text-center text-[11px] leading-relaxed text-neutral-400">
                    {t("auth.terms")}
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
