import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getDashboard } from "@/lib/scanner.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FindingsTable } from "@/components/findings-table";

export const Route = createFileRoute("/_authenticated/findings")({
  component: FindingsPage,
});

function FindingsPage() {
  const dash = useServerFn(getDashboard);
  const q = useQuery({ queryKey: ["dashboard"], queryFn: () => dash() });
  const findings = q.data?.findings || [];

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 md:px-10 md:py-10">
      <h1 className="text-2xl font-semibold tracking-tight">All findings</h1>
      <p className="text-sm text-muted-foreground">Every open, resolved, and ignored finding across your workspace.</p>
      <Card className="mt-6 border-border">
        <CardHeader><CardTitle className="text-base">Workspace findings</CardTitle></CardHeader>
        <CardContent className="p-0">
          <FindingsTable findings={findings} />
        </CardContent>
      </Card>
    </div>
  );
}
