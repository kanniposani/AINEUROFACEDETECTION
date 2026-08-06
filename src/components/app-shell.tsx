import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  LayoutDashboard,
  LogOut,
  ScanFace,
  Settings,
  ShieldCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { amIAdmin } from "@/lib/admin.functions";

const LINKS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/scan", label: "Scan", icon: ScanFace },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;


export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const checkAdmin = useServerFn(amIAdmin);
  const { data: adminData } = useQuery({
    queryKey: ["me", "isAdmin"],
    queryFn: () => checkAdmin({}),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });



  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 grid-backdrop" aria-hidden="true" />
      <div className="relative flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 glass border-x-0 border-t-0 rounded-none">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
            <Link to="/dashboard" className="flex items-center gap-2" aria-label="NeuroFace AI home">
              <Activity className="size-5 text-primary" aria-hidden="true" />
              <span className="font-mono text-sm font-semibold tracking-tight">NEUROFACE AI</span>
            </Link>
            <nav aria-label="Main" className="flex items-center gap-1">
              {LINKS.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  activeProps={{ className: "bg-secondary text-primary" }}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              ))}
              {adminData?.isAdmin ? (
                <Link
                  to="/admin"
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  activeProps={{ className: "bg-secondary text-primary" }}
                >
                  <ShieldCheck className="size-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Admin</span>
                </Link>
              ) : null}

              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                aria-label="Sign out"
                className="min-h-11 min-w-11 text-muted-foreground"
              >
                <LogOut />
              </Button>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      </div>
    </div>
  );
}
