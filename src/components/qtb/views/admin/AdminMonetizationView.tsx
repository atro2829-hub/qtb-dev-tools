"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, apiJson } from "@/lib/client-api";
import { useQtbToast } from "@/components/qtb/use-qtb-toast";
import QTBIcon, { type QTBIconName } from "@/components/qtb/QTBIcon";
import QTBButton from "@/components/qtb/QTBButton";
import { GradientChip } from "@/components/qtb/ui-bits";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface AdminStats {
  users: {
    total: number;
    active: number;
    trials: number;
    expired: number;
    pendingRequests: number;
  };
  toolJobs: {
    total: number;
    bgRemove: number;
    convert: number;
    translate: number;
    failed: number;
  };
  notifications: number;
}

const EMPTY_STATS: AdminStats = {
  users: { total: 0, active: 0, trials: 0, expired: 0, pendingRequests: 0 },
  toolJobs: { total: 0, bgRemove: 0, convert: 0, translate: 0, failed: 0 },
  notifications: 0,
};

function normalizeStats(raw: unknown): AdminStats {
  if (typeof raw !== "object" || raw === null) return { ...EMPTY_STATS };
  const s = raw as Record<string, unknown>;
  const u = (s.users ?? {}) as Record<string, unknown>;
  const t = (s.toolJobs ?? {}) as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    users: {
      total: n(u.total),
      active: n(u.active),
      trials: n(u.trials),
      expired: n(u.expired),
      pendingRequests: n(u.pendingRequests),
    },
    toolJobs: {
      total: n(t.total),
      bgRemove: n(t.bgRemove),
      convert: n(t.convert),
      translate: n(t.translate),
      failed: n(t.failed),
    },
    notifications: n(s.notifications),
  };
}

/* ------------------------------------------------------------------ */
/* Stat card                                                           */
/* ------------------------------------------------------------------ */

function StatCard({
  icon,
  tone,
  label,
  value,
  hint,
  delay = 0,
}: {
  icon: QTBIconName;
  tone: "amber" | "rose" | "emerald" | "fuchsia" | "violet";
  label: string;
  value: number;
  hint?: string;
  delay?: number;
}) {
  const tones: Record<string, string> = {
    amber: "bg-amber-100 text-amber-600",
    rose: "bg-rose-100 text-rose-600",
    emerald: "bg-emerald-100 text-emerald-600",
    fuchsia: "bg-fuchsia-100 text-fuchsia-600",
    violet: "bg-violet-100 text-violet-600",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
      className="flex items-center gap-3.5 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
    >
      <span
        className={cn(
          "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl [&>svg]:size-5",
          tones[tone]
        )}
      >
        <QTBIcon name={icon} size={20} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-bold uppercase tracking-wider text-neutral-400">
          {label}
        </p>
        <p className="text-xl font-extrabold tracking-tight text-neutral-900">
          {value.toLocaleString()}
        </p>
        {hint && <p className="truncate text-[11px] text-neutral-400">{hint}</p>}
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* View                                                                */
/* ------------------------------------------------------------------ */

interface AnalyticsDay {
  date: string;
  jobs: number;
  failed: number;
  signups: number;
}

interface AnalyticsData {
  days: AnalyticsDay[];
  byTool: { toolType: string; count: number }[];
  totals: { users: number; jobs: number; pendingRequests: number };
  byPlan?: { free: number; pro: number };
  topUsers?: { name: string; email: string; jobs: number; plan: "free" | "pro" }[];
}

const TOOL_LABELS: Record<string, string> = {
  "bg-remove": "Background",
  convert: "Converter",
  translate: "Translator",
  "pdf-merge": "PDF Merge",
  "pdf-split": "PDF Split",
};

const TOOL_COLORS = ["#d946ef", "#f59e0b", "#10b981", "#8b5cf6", "#f43f5e"];

export default function AdminMonetizationView() {
  const toast = useQtbToast();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [freeTrialEnabled, setFreeTrialEnabled] = useState(true);
  const [freeTrialDays, setFreeTrialDays] = useState("365");
  const [freeDailyLimit, setFreeDailyLimit] = useState("5");
  const [announcement, setAnnouncement] = useState("");
  const [savingTrial, setSavingTrial] = useState(false);
  const [savingAnnounce, setSavingAnnounce] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    let active = true;
    const statsPromise = api<{ stats?: unknown }>("/api/admin/stats")
      .then((res) => {
        if (active) setStats(normalizeStats(res.stats));
      })
      .catch((err) => {
        if (active) {
          setStats({ ...EMPTY_STATS });
          toast.error(err, "Couldn't load stats");
        }
      });
    const configPromise = api<{ config?: Record<string, unknown> }>("/api/admin/config")
      .then((res) => {
        if (!active || !res.config) return;
        setFreeTrialEnabled(res.config.freeTrialEnabled !== false);
        const days = res.config.freeTrialDays;
        setFreeTrialDays(String(typeof days === "number" ? days : 365));
        const limit = res.config.freeDailyLimit;
        setFreeDailyLimit(String(typeof limit === "number" ? limit : 5));
        setAnnouncement(typeof res.config.announcement === "string" ? res.config.announcement : "");
      })
      .catch(() => {
        /* config card stays at defaults */
      });
    const analyticsPromise = api<AnalyticsData>("/api/admin/analytics?days=14")
      .then((res) => {
        if (active) setAnalytics(res);
      })
      .catch(() => {
        /* charts stay hidden on failure */
      });
    void Promise.allSettled([statsPromise, configPromise, analyticsPromise]);
    return () => {
      active = false;
    };
  }, []);

  const saveTrial = async () => {
    const days = Number.parseInt(freeTrialDays, 10);
    if (!Number.isFinite(days) || days < 1 || days > 3650) {
      toast.info("Invalid trial length", "Enter a whole number between 1 and 3650 days.");
      return;
    }
    const limit = Number.parseInt(freeDailyLimit, 10);
    if (!Number.isFinite(limit) || limit < 1 || limit > 1000) {
      toast.info("Invalid daily limit", "Enter a whole number between 1 and 1000 uses.");
      return;
    }
    setSavingTrial(true);
    try {
      await apiJson("/api/admin/config", "PUT", {
        freeTrialEnabled,
        freeTrialDays: days,
        freeDailyLimit: limit,
      });
      toast.success(
        "Plan settings updated",
        `Trials: ${freeTrialEnabled ? `${days} days` : "off"} · Free tier: ${limit} uses/day.`
      );
    } catch (err) {
      toast.error(err, "Couldn't save trial settings");
    } finally {
      setSavingTrial(false);
    }
  };

  const saveAnnouncement = async () => {
    setSavingAnnounce(true);
    try {
      await apiJson("/api/admin/config", "PUT", { announcement });
      toast.success("Announcement saved", "The banner updated for every visitor.");
    } catch (err) {
      toast.error(err, "Couldn't save announcement");
    } finally {
      setSavingAnnounce(false);
    }
  };

  const u = stats?.users;
  const t = stats?.toolJobs;

  return (
    <div className="space-y-5">
      {/* ---------------- Stats grid ---------------- */}
      {stats === null ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array(6)
            .fill(0)
            .map((_, i) => (
              <Skeleton key={i} className="h-[74px] rounded-2xl" />
            ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard icon="users" tone="amber" label="Total Users" value={u?.total ?? 0} delay={0} />
            <StatCard icon="badge-check" tone="emerald" label="Active Members" value={u?.active ?? 0} delay={0.04} />
            <StatCard icon="gift" tone="fuchsia" label="On Trial" value={u?.trials ?? 0} delay={0.08} />
            <StatCard icon="clock" tone="rose" label="Expired" value={u?.expired ?? 0} delay={0.12} />
            <StatCard icon="wallet" tone="violet" label="Pending Requests" value={u?.pendingRequests ?? 0} delay={0.16} />
            <StatCard icon="megaphone" tone="amber" label="Notifications Sent" value={stats.notifications} delay={0.2} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon="bolt" tone="amber" label="Tool Jobs (all)" value={t?.total ?? 0} delay={0.24} />
            <StatCard icon="remove-bg" tone="fuchsia" label="Background Removals" value={t?.bgRemove ?? 0} delay={0.28} />
            <StatCard icon="convert" tone="emerald" label="Conversions" value={t?.convert ?? 0} delay={0.32} />
            <StatCard icon="translate" tone="violet" label="Translations" value={t?.translate ?? 0} hint={`${t?.failed ?? 0} failed`} delay={0.36} />
          </div>
        </>
      )}

      {/* ---------------- Usage trends (charts) ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 text-base">
            <GradientChip icon="activity" tone="violet" size="sm" />
            Usage Trends
          </CardTitle>
          <CardDescription>Tool activity and new sign-ups over the last 14 days.</CardDescription>
        </CardHeader>
        <CardContent>
          {!analytics ? (
            <Skeleton className="h-64 w-full rounded-2xl" />
          ) : (
            <div className="space-y-8">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.days} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="qtb-jobs-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#d946ef" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#d946ef" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="qtb-signups-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "#a3a3a3", fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: "#a3a3a3", fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ stroke: "#e5e5e5", strokeDasharray: "4 4" }}
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid #f0f0f0",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="jobs"
                      name="Tool jobs"
                      stroke="#d946ef"
                      strokeWidth={2.5}
                      fill="url(#qtb-jobs-fill)"
                    />
                    <Area
                      type="monotone"
                      dataKey="signups"
                      name="Sign-ups"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fill="url(#qtb-signups-fill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-neutral-500">
                    Jobs by tool
                  </p>
                  <div className="h-52 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={analytics.byTool.map((t) => ({
                          ...t,
                          label: TOOL_LABELS[t.toolType] ?? t.toolType,
                        }))}
                        layout="vertical"
                        margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} hide />
                        <YAxis
                          type="category"
                          dataKey="label"
                          width={86}
                          tick={{ fontSize: 11, fill: "#525252", fontWeight: 700 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          cursor={{ fill: "#fafafa" }}
                          contentStyle={{
                            borderRadius: 12,
                            border: "1px solid #f0f0f0",
                            boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        />
                        <Bar dataKey="count" name="Jobs" radius={[0, 8, 8, 0]} barSize={18}>
                          {analytics.byTool.map((entry, i) => (
                            <Cell key={entry.toolType} fill={TOOL_COLORS[i % TOOL_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="space-y-4">
                  {analytics.byPlan && (
                    <div>
                      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-neutral-500">
                        Free vs Pro usage
                      </p>
                      <div className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4">
                        <div className="relative h-32 w-32 shrink-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={[
                                  { name: "Free", value: analytics.byPlan.free },
                                  { name: "Pro", value: analytics.byPlan.pro },
                                ]}
                                dataKey="value"
                                innerRadius={40}
                                outerRadius={60}
                                paddingAngle={3}
                                strokeWidth={0}
                                startAngle={90}
                                endAngle={-270}
                              >
                                <Cell fill="#f59e0b" />
                                <Cell fill="#d946ef" />
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-lg font-extrabold leading-none text-neutral-900">
                              {analytics.byPlan.free + analytics.byPlan.pro}
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                              jobs
                            </span>
                          </div>
                        </div>
                        <div className="min-w-0 flex-1 space-y-2.5">
                          <div className="flex items-center gap-2.5">
                            <span className="h-3 w-3 shrink-0 rounded-full bg-amber-500" />
                            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Free tier</span>
                            <span className="ml-auto text-sm font-extrabold text-neutral-900">{analytics.byPlan.free}</span>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <span className="h-3 w-3 shrink-0 rounded-full bg-fuchsia-500" />
                            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Pro / trial</span>
                            <span className="ml-auto text-sm font-extrabold text-neutral-900">{analytics.byPlan.pro}</span>
                          </div>
                          {analytics.byPlan.free + analytics.byPlan.pro > 0 && (
                            <p className="border-t border-neutral-200 pt-2.5 text-[11px] leading-relaxed text-neutral-400">
                              {Math.round(
                                (analytics.byPlan.pro /
                                  (analytics.byPlan.free + analytics.byPlan.pro)) * 100
                              )}
                              % of the last 14 days&apos; jobs came from paying or trialling members.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4 text-center">
                      <p className="text-2xl font-extrabold text-neutral-900">{analytics.totals.users}</p>
                      <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-neutral-400">Members</p>
                    </div>
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4 text-center">
                      <p className="text-2xl font-extrabold text-neutral-900">{analytics.totals.jobs}</p>
                      <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-neutral-400">All jobs</p>
                    </div>
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4 text-center">
                      <p className="text-2xl font-extrabold text-fuchsia-600">{analytics.totals.pendingRequests}</p>
                      <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-neutral-400">Pending</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---------------- Top consumers (24h) ---------------- */}
      {analytics?.topUsers && analytics.topUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5 text-base">
              <GradientChip icon="crown" tone="amber" size="sm" />
              Top Consumers — Last 24h
            </CardTitle>
            <CardDescription>Most active members in the past day.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2.5">
              {analytics.topUsers.map((user, i) => (
                <motion.li
                  key={user.email}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.05 }}
                  className="flex items-center gap-3.5 rounded-xl border border-neutral-100 bg-neutral-50/60 p-3.5"
                >
                  <span
                    className={cn(
                      "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold",
                      i === 0
                        ? "bg-amber-100 text-amber-700"
                        : "bg-neutral-200/70 text-neutral-500"
                    )}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-neutral-800">{user.name}</p>
                    <p className="truncate text-xs text-neutral-400">{user.email}</p>
                  </div>
                  <span
                    className={cn(
                      "hidden rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider sm:inline-flex",
                      user.plan === "pro"
                        ? "bg-fuchsia-100 text-fuchsia-700"
                        : "bg-amber-100 text-amber-700"
                    )}
                  >
                    {user.plan}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-sm font-extrabold text-neutral-900 ring-1 ring-neutral-200">
                    <QTBIcon name="bolt" size={13} className="text-amber-500" />
                    {user.jobs}
                  </span>
                </motion.li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* ---------------- Free trial ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 text-base">
            <GradientChip icon="gift" tone="fuchsia" size="sm" />
            No-Card Free Trial
          </CardTitle>
          <CardDescription>
            New members with the Free plan receive an instant trial when they submit a
            subscription request — no payment proof required.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4">
            <div>
              <p className="text-sm font-bold text-neutral-800">Enable free trial</p>
              <p className="mt-0.5 text-xs text-neutral-500">
                Applies to accounts whose subscription status is still &quot;none&quot;.
              </p>
            </div>
            <Switch
              checked={freeTrialEnabled}
              onCheckedChange={(v) => setFreeTrialEnabled(v)}
              aria-label="Toggle free trial"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cfg-trial-days">Trial length (days)</Label>
              <Input
                id="cfg-trial-days"
                type="number"
                min={1}
                max={3650}
                value={freeTrialDays}
                onChange={(e) => setFreeTrialDays(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cfg-daily-limit">Free tier daily uses</Label>
              <Input
                id="cfg-daily-limit"
                type="number"
                min={1}
                max={1000}
                value={freeDailyLimit}
                onChange={(e) => setFreeDailyLimit(e.target.value)}
              />
              <p className="text-xs text-neutral-500">
                Tool runs per day for accounts without an active plan.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <QTBButton size="sm" loading={savingTrial} onClick={() => void saveTrial()}>
              <QTBIcon name="check" size={15} /> Save Plan Settings
            </QTBButton>
          </div>
        </CardContent>
      </Card>

      {/* ---------------- Quick announcement ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 text-base">
            <GradientChip icon="megaphone" tone="rose" size="sm" />
            Quick Announcement
          </CardTitle>
          <CardDescription>
            A fast way to update the site-wide banner. Leave empty to hide it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={announcement}
            onChange={(e) => setAnnouncement(e.target.value)}
            rows={3}
            maxLength={5000}
            placeholder="e.g. Launch week: all tools unlocked for new members!"
          />
          <div className="flex justify-end">
            <QTBButton size="sm" loading={savingAnnounce} onClick={() => void saveAnnouncement()}>
              <QTBIcon name="send" size={15} /> Save Announcement
            </QTBButton>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
