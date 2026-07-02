import { createFileRoute, Outlet, redirect, Link, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, ScanLine, ListChecks, FileText, Settings, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: WorkspaceShell,
});

function NavItem({ to, icon: Icon, label }: { to: string; icon: typeof LayoutDashboard; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[status=active]:bg-accent data-[status=active]:text-foreground"
      activeOptions={{ exact: to === "/dashboard" }}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

function WorkspaceShell() {
  const { user } = Route.useRouteContext();
  const router = useRouter();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="grid min-h-dvh grid-cols-1 md:grid-cols-[260px_1fr]">
        <aside className="border-r border-border bg-card/40 backdrop-blur">
          <div className="flex h-16 items-center gap-2 border-b border-border px-5">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold tracking-tight">ComplianceScanr</span>
          </div>
          <nav className="flex flex-col gap-1 p-3">
            <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
            <NavItem to="/scans" icon={ScanLine} label="Scans" />
            <NavItem to="/findings" icon={ListChecks} label="Findings" />
            <NavItem to="/reports" icon={FileText} label="Reports" />
            <NavItem to="/settings" icon={Settings} label="Settings" />
          </nav>
          <div className="mt-auto border-t border-border p-3">
            <div className="mb-2 px-2 text-xs text-muted-foreground truncate">{user.email}</div>
            <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start gap-2">
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </aside>
        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
