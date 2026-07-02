import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setEmail(u.user.email || "");
      const { data } = await supabase.from("profiles").select("*").eq("user_id", u.user.id).maybeSingle();
      if (data) {
        setDisplayName(data.display_name || "");
        setCompany(data.company || "");
      }
      setLoading(false);
    })();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("profiles").update({
      display_name: displayName,
      company,
    }).eq("user_id", u.user.id);
    setSaving(false);
    setMsg(error ? error.message : "Saved.");
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 md:px-10 md:py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <Card className="mt-6 border-border">
        <CardHeader><CardTitle className="text-base">Organization profile</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <form onSubmit={save} className="space-y-4 max-w-md">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Display name</label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Company</label>
                <Input value={company} onChange={(e) => setCompany(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Email</label>
                <Input value={email} disabled />
              </div>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save changes
              </Button>
              {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
            </form>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6 border-border">
        <CardHeader><CardTitle className="text-base">Team roles</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Multi-user roles are on the roadmap. Today, assign findings to teammates by email inside each finding.
        </CardContent>
      </Card>
    </div>
  );
}
