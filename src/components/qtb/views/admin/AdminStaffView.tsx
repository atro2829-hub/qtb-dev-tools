"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { api, apiJson } from "@/lib/client-api";
import {
  useAppStore,
  isSuperAdmin,
  type UserRole,
} from "@/store/app-store";
import { useQtbToast } from "@/components/qtb/use-qtb-toast";
import QTBIcon from "@/components/qtb/QTBIcon";
import QTBButton from "@/components/qtb/QTBButton";
import { GradientChip, EmptyState } from "@/components/qtb/ui-bits";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Types & helpers                                                     */
/* ------------------------------------------------------------------ */

interface AdminUserRow {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  subscriptionStatus: string;
  profileComplete: boolean;
  country: string | null;
  createdAt: string;
  banned: boolean;
}

function normalizeRole(v: unknown): UserRole {
  return v === "staff" || v === "admin" || v === "super_admin" ? v : "user";
}

function normalizeUserRow(raw: unknown): AdminUserRow | null {
  if (typeof raw !== "object" || raw === null) return null;
  const u = raw as Record<string, unknown>;
  if (typeof u.id !== "string" || typeof u.email !== "string") return null;
  return {
    id: u.id,
    email: u.email,
    name: typeof u.name === "string" ? u.name : null,
    role: normalizeRole(u.role),
    subscriptionStatus: typeof u.subscriptionStatus === "string" ? u.subscriptionStatus : "none",
    profileComplete: u.profileComplete === true,
    country: typeof u.country === "string" ? u.country : null,
    createdAt: typeof u.createdAt === "string" ? u.createdAt : new Date().toISOString(),
    banned: u.banned === true,
  };
}

function RoleBadge({ role }: { role: UserRole }) {
  const styles: Record<UserRole, string> = {
    user: "border-neutral-200 bg-neutral-50 text-neutral-600",
    staff: "border-amber-200 bg-amber-50 text-amber-700",
    admin: "border-violet-200 bg-violet-50 text-violet-700",
    super_admin: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
  };
  const labels: Record<UserRole, string> = {
    user: "User",
    staff: "Staff",
    admin: "Admin",
    super_admin: "Super Admin",
  };
  return (
    <Badge variant="outline" className={cn("font-bold", styles[role])}>
      {role === "super_admin" && (
        <QTBIcon name="crown" size={11} className="mr-1 text-fuchsia-500" />
      )}
      {labels[role]}
    </Badge>
  );
}

function SubBadge({ status }: { status: string }) {
  const s = status === "active" || status === "trial" || status === "expired";
  const cls = {
    active: "border-emerald-200 bg-emerald-50 text-emerald-700",
    trial: "border-amber-200 bg-amber-50 text-amber-700",
    expired: "border-rose-200 bg-rose-50 text-rose-700",
  } as Record<string, string>;
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-semibold capitalize",
        s ? cls[status] : "border-neutral-200 bg-neutral-50 text-neutral-500"
      )}
    >
      {status}
    </Badge>
  );
}

/* ------------------------------------------------------------------ */
/* View                                                                */
/* ------------------------------------------------------------------ */

export default function AdminStaffView() {
  const caller = useAppStore((s) => s.user);
  const toast = useQtbToast();
  const callerIsSuper = isSuperAdmin(caller);

  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [banTarget, setBanTarget] = useState<AdminUserRow | null>(null);
  const [unbanTarget, setUnbanTarget] = useState<AdminUserRow | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryRef = useRef("");

  const fetchUsers = (q: string) => {
    const path = q.trim()
      ? `/api/admin/users?query=${encodeURIComponent(q.trim())}`
      : "/api/admin/users";
    return api<{ users?: unknown[] }>(path)
      .then((res) => {
        const list = (res.users ?? [])
          .map(normalizeUserRow)
          .filter((u): u is AdminUserRow => u !== null);
        setUsers(list);
      })
      .catch((err) => {
        setUsers([]);
        toast.error(err, "Couldn't load users");
      });
  };

  useEffect(() => {
    void fetchUsers("");
  }, []);

  // Debounced live search.
  useEffect(() => {
    if (query.trim() === queryRef.current.trim()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      queryRef.current = query;
      void fetchUsers(query);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const canEditRow = (row: AdminUserRow): boolean => {
    if (row.id === caller?.id) return false; // own row locked
    if (row.role === "super_admin" && !callerIsSuper) return false;
    return true;
  };

  const changeRole = async (row: AdminUserRow, role: UserRole) => {
    setRowBusy(row.id);
    try {
      const res = await apiJson<{ user?: Record<string, unknown> }>(
        "/api/admin/users",
        "PUT",
        { userId: row.id, role }
      );
      const updated = normalizeUserRow(res.user);
      setUsers((list) =>
        list ? list.map((u) => (u.id === row.id && updated ? updated : u)) : list
      );
      toast.success("Role updated", `${row.email} is now ${role === "super_admin" ? "a super admin" : role}.`);
    } catch (err) {
      toast.error(err, "Role change failed");
    } finally {
      setRowBusy(null);
    }
  };

  const setBanned = async (row: AdminUserRow, banned: boolean) => {
    setRowBusy(row.id);
    try {
      const res = await apiJson<{ user?: Record<string, unknown> }>(
        "/api/admin/users",
        "PUT",
        { userId: row.id, banned }
      );
      const updated = normalizeUserRow(res.user);
      setUsers((list) =>
        list ? list.map((u) => (u.id === row.id && updated ? updated : u)) : list
      );
      toast.success(
        banned ? "User banned" : "User unbanned",
        `${row.email} ${banned ? "can no longer sign in." : "can sign in again."}`
      );
    } catch (err) {
      toast.error(err, "Ban action failed");
    } finally {
      setRowBusy(null);
      setBanTarget(null);
      setUnbanTarget(null);
    }
  };

  const roleOptions: UserRole[] = callerIsSuper
    ? ["user", "staff", "admin", "super_admin"]
    : ["user", "staff", "admin"];

  const rowControlsLocked = (row: AdminUserRow) => !canEditRow(row) || rowBusy === row.id;

  const renderRowActions = (row: AdminUserRow) => {
    const locked = rowControlsLocked(row);
    return (
      <div className="flex items-center justify-end gap-2.5">
        <Select
          value={row.role}
          disabled={locked}
          onValueChange={(v) => void changeRole(row, normalizeRole(v))}
        >
          <SelectTrigger
            size="sm"
            className="h-9 w-[132px] text-xs font-semibold"
            aria-label={`Role for ${row.email}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roleOptions.map((r) => (
              <SelectItem key={r} value={r} className="text-xs">
                {r === "super_admin" ? "Super Admin" : r.charAt(0).toUpperCase() + r.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5">
          <Switch
            checked={!row.banned}
            disabled={locked}
            onCheckedChange={(active) => {
              if (active) setUnbanTarget(row);
              else setBanTarget(row);
            }}
            aria-label={row.banned ? "Unban user" : "Ban user"}
          />
          <span
            className={cn(
              "w-10 text-[10px] font-bold uppercase tracking-wide",
              row.banned ? "text-rose-500" : "text-neutral-400"
            )}
          >
            {row.banned ? "Banned" : "Active"}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Search */}
      <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <QTBIcon
            name="search"
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="pl-9"
            aria-label="Search users"
          />
        </div>
        <QTBButton
          size="sm"
          variant="outline"
          className="shrink-0"
          loading={users === null}
          onClick={() => void fetchUsers(query)}
        >
          <QTBIcon name="refresh" size={14} /> Search
        </QTBButton>
        <QTBButton
          size="sm"
          variant="outline"
          className="shrink-0"
          onClick={() => {
            const qs = query.trim() ? `&query=${encodeURIComponent(query.trim())}` : "";
            window.location.href = `/api/admin/users?format=csv${qs}`;
          }}
        >
          <QTBIcon name="download" size={14} /> Export CSV
        </QTBButton>
      </div>

      {/* Loading skeleton */}
      {users === null && (
        <div className="space-y-3">
          {Array(5)
            .fill(0)
            .map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))}
        </div>
      )}

      {/* Empty */}
      {users !== null && users.length === 0 && (
        <div className="rounded-2xl border border-neutral-200 bg-white">
          <EmptyState
            icon="users"
            title="No users found"
            description={query ? `Nothing matches “${query}”.` : "No members have registered yet."}
          />
        </div>
      )}

      {/* Desktop table */}
      {users !== null && users.length > 0 && (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-neutral-200 bg-white md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-neutral-50/80 hover:bg-neutral-50/80">
                  <TableHead className="pl-5">Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="pr-5 text-right">Access</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((row) => (
                  <TableRow key={row.id} className={cn(row.id === caller?.id && "bg-fuchsia-50/40")}>
                    <TableCell className="max-w-56 pl-5">
                      <p className="truncate text-sm font-bold text-neutral-900">
                        {row.name || "—"} {row.id === caller?.id && <span className="text-xs font-semibold text-fuchsia-500">(you)</span>}
                      </p>
                      <p className="truncate text-xs text-neutral-400">{row.email}</p>
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={row.role} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <SubBadge status={row.subscriptionStatus} />
                        {row.banned && (
                          <Badge variant="outline" className="border-rose-300 bg-rose-100 font-bold text-rose-700">
                            Banned
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-neutral-500">
                      {format(new Date(row.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="pr-5">{renderRowActions(row)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {users.map((row) => (
              <div
                key={row.id}
                className={cn(
                  "rounded-2xl border bg-white p-4",
                  row.id === caller?.id ? "border-fuchsia-200 bg-fuchsia-50/30" : "border-neutral-200"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-neutral-900">
                      {row.name || "—"} {row.id === caller?.id && <span className="text-xs font-semibold text-fuchsia-500">(you)</span>}
                    </p>
                    <p className="truncate text-xs text-neutral-400">{row.email}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                    <RoleBadge role={row.role} />
                    {row.banned && (
                      <Badge variant="outline" className="border-rose-300 bg-rose-100 font-bold text-rose-700">
                        Banned
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-neutral-400">
                  <SubBadge status={row.subscriptionStatus} />
                  <span>· Joined {format(new Date(row.createdAt), "MMM d, yyyy")}</span>
                </div>
                <div className="mt-3 border-t border-neutral-100 pt-3">
                  {renderRowActions(row)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="flex items-center gap-2 text-xs text-neutral-400">
        <GradientChip icon="shield" tone="neutral" size="sm" className="!h-6 !w-6 [&>svg]:size-3" />
        Your own row is locked. Only a super admin can manage other super admins.
      </p>

      {/* Ban confirm */}
      <AlertDialog open={banTarget !== null} onOpenChange={(open) => !open && setBanTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ban this member?</AlertDialogTitle>
            <AlertDialogDescription>
              {banTarget?.email} will be signed out immediately and won&apos;t be able to
              log in until unbanned. Their data is kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => banTarget && void setBanned(banTarget, true)}
            >
              Ban User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unban confirm */}
      <AlertDialog open={unbanTarget !== null} onOpenChange={(open) => !open && setUnbanTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore access?</AlertDialogTitle>
            <AlertDialogDescription>
              {unbanTarget?.email} will be able to sign in again right away.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => unbanTarget && void setBanned(unbanTarget, false)}
            >
              Unban
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
