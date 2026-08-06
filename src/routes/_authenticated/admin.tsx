import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, RefreshCw, Search, ShieldCheck, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { GlassCard } from "@/components/glass-card";
import { stressBand } from "@/lib/scoring";
import {
  deleteUserAccount,
  deleteUserScans,
  listAllUsers,
  type AdminUser,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin console — NeuroFace AI" },
      {
        name: "description",
        content:
          "Root admin console for NeuroFace AI: review every registered account, their scan history and wellness metrics.",
      },
      { property: "og:title", content: "Admin console — NeuroFace AI" },
      {
        property: "og:description",
        content: "Manage NeuroFace AI users and their scan data.",
      },
    ],
  }),
  component: AdminPage,
});

function fmt(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function AdminPage() {
  const [query, setQuery] = useState("");
  const queryClient = useQueryClient();
  const fetchUsers = useServerFn(listAllUsers);
  const purgeScans = useServerFn(deleteUserScans);
  const removeAccount = useServerFn(deleteUserAccount);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => fetchUsers({}),
    retry: false,
  });

  const scanMutation = useMutation({
    mutationFn: (userId: string) => purgeScans({ data: { userId } }),
    onSuccess: () => {
      toast.success("Scan history deleted");
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const accountMutation = useMutation({
    mutationFn: (userId: string) => removeAccount({ data: { userId } }),
    onSuccess: () => {
      toast.success("Account deleted");
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const users = useMemo(() => {
    const list: AdminUser[] = data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (u) =>
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.full_name ?? "").toLowerCase().includes(q),
    );
  }, [data, query]);

  const totals = useMemo(() => {
    const list: AdminUser[] = data ?? [];
    const scans = list.reduce((a, u) => a + u.scan_count, 0);
    return { users: list.length, scans };
  }, [data]);

  if (isError) {
    return (
      <GlassCard className="mx-auto max-w-lg p-6 text-center">
        <AlertTriangle className="mx-auto size-6 text-destructive" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-semibold">Admin access required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {(error as Error)?.message?.includes("Forbidden")
            ? "This account does not have the admin role."
            : (error as Error)?.message}
        </p>
        <Button asChild variant="outline" className="mt-4 min-h-11">
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <ShieldCheck className="size-6 text-primary" aria-hidden="true" />
            Admin console
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every registered account and their scan data. Handle with care — this is real user
            health-adjacent data.
          </p>
        </div>
        <Button
          variant="outline"
          className="min-h-11"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={isFetching ? "animate-spin" : ""} aria-hidden="true" />
          Refresh
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <GlassCard className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total users</p>
          <p className="mt-1 font-mono text-2xl font-semibold">
            {isLoading ? <Skeleton className="h-7 w-12" /> : totals.users}
          </p>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total scans</p>
          <p className="mt-1 font-mono text-2xl font-semibold">
            {isLoading ? <Skeleton className="h-7 w-12" /> : totals.scans}
          </p>
        </GlassCard>
      </div>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by email or name"
          aria-label="Search users"
          className="min-h-11 pl-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <GlassCard className="p-8 text-center text-sm text-muted-foreground">
          <Users className="mx-auto mb-2 size-5" aria-hidden="true" />
          No users match this search.
        </GlassCard>
      ) : (
        <ul className="space-y-3">
          {users.map((u) => (
            <li key={u.id}>
              <GlassCard className="p-4">
                <Collapsible>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        <span className="truncate">{u.full_name || "Unnamed user"}</span>
                        {u.is_admin ? <Badge variant="secondary">admin</Badge> : null}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">{u.email ?? "—"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Joined {fmt(u.created_at)} · Last sign-in {fmt(u.last_sign_in_at)}
                        {u.age_range ? ` · Age ${u.age_range}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-right">
                        <p className="font-mono text-lg font-semibold">
                          {u.avg_stress ?? "—"}
                          <span className="ml-1 text-xs text-muted-foreground">avg stress</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{u.scan_count} scans</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <CollapsibleTrigger asChild>
                          <Button variant="outline" size="sm" className="min-h-9">
                            Scans
                          </Button>
                        </CollapsibleTrigger>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="min-h-9 text-destructive"
                              disabled={u.scan_count === 0}
                            >
                              <Trash2 aria-hidden="true" />
                              Scans
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete all scans?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This permanently removes {u.scan_count} scan(s) for{" "}
                                {u.email ?? "this user"}. The account itself stays active.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => scanMutation.mutate(u.id)}>
                                Delete scans
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="min-h-9 text-destructive"
                              disabled={u.is_admin}
                            >
                              <Trash2 aria-hidden="true" />
                              Account
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this account?</AlertDialogTitle>
                              <AlertDialogDescription>
                                {u.email ?? "This user"} and all of their profile, settings and scan
                                data will be permanently deleted. This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => accountMutation.mutate(u.id)}>
                                Delete account
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                  <CollapsibleContent className="mt-4 border-t border-border/60 pt-4">
                    {u.scans.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No scans yet.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                            <tr>
                              <th className="py-2 pr-4 font-medium">When</th>
                              <th className="py-2 pr-4 font-medium">Stress</th>
                              <th className="py-2 pr-4 font-medium">Fatigue</th>
                              <th className="py-2 pr-4 font-medium">Tension</th>
                              <th className="py-2 pr-4 font-medium">Symmetry</th>
                              <th className="py-2 font-medium">Blink/min</th>
                            </tr>
                          </thead>
                          <tbody>
                            {u.scans.map((s) => (
                              <tr key={s.id} className="border-t border-border/40">
                                <td className="py-2 pr-4 whitespace-nowrap">{fmt(s.created_at)}</td>
                                <td className="py-2 pr-4 font-mono">
                                  {s.stress_index}{" "}
                                  <span className="text-xs text-muted-foreground">
                                    {stressBand(s.stress_index).label}
                                  </span>
                                </td>
                                <td className="py-2 pr-4 font-mono">{s.fatigue_level}</td>
                                <td className="py-2 pr-4 font-mono">{s.tension_level}</td>
                                <td className="py-2 pr-4 font-mono">{s.symmetry_score}</td>
                                <td className="py-2 font-mono">{s.blink_rate}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </GlassCard>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
