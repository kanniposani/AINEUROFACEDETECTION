import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Download, Loader2, Moon, Sun, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { GlassCard } from "@/components/glass-card";
import { Disclaimer } from "@/components/disclaimer";
import { supabase } from "@/integrations/supabase/client";
import { downloadHistoryCsv } from "@/lib/report-pdf";
import { useTheme } from "@/hooks/use-theme";
import type { ScanRow } from "./dashboard";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Profile & Settings — NeuroFace AI" },
      {
        name: "description",
        content:
          "Update your profile, set daily check-in reminders, export your scan history, or delete your NeuroFace AI data.",
      },
      { property: "og:title", content: "Profile & Settings — NeuroFace AI" },
      {
        property: "og:description",
        content: "Manage your NeuroFace AI profile, reminders, theme and data.",
      },
    ],
  }),
  component: SettingsPage,
});

const AGE_RANGES = ["Under 18", "18–24", "25–34", "35–44", "45–54", "55–64", "65+"];

function SettingsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const [fullName, setFullName] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [notes, setNotes] = useState("");
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState("09:00");

  const profileQuery = useQuery({
    queryKey: ["profile-settings"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not signed in");
      const [{ data: profile, error: pErr }, { data: settings, error: sErr }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
        supabase.from("settings").select("*").eq("user_id", uid).maybeSingle(),
      ]);
      if (pErr) throw pErr;
      if (sErr) throw sErr;
      return { uid, email: userData.user?.email ?? "", profile, settings };
    },
  });

  useEffect(() => {
    const d = profileQuery.data;
    if (!d) return;
    setFullName(d.profile?.full_name ?? "");
    setAgeRange(d.profile?.age_range ?? "");
    setNotes(d.profile?.baseline_notes ?? "");
    setReminderEnabled(d.settings?.reminder_enabled ?? false);
    setReminderTime((d.settings?.reminder_time ?? "09:00").slice(0, 5));
  }, [profileQuery.data]);

  const save = useMutation({
    mutationFn: async () => {
      const uid = profileQuery.data?.uid;
      if (!uid) throw new Error("Not signed in");
      const { error: pErr } = await supabase.from("profiles").upsert({
        id: uid,
        full_name: fullName.trim() || null,
        age_range: ageRange || null,
        baseline_notes: notes.trim() || null,
      });
      if (pErr) throw pErr;
      const { error: sErr } = await supabase.from("settings").upsert({
        user_id: uid,
        reminder_enabled: reminderEnabled,
        reminder_time: reminderTime,
        theme,
      });
      if (sErr) throw sErr;
    },
    onSuccess: () => {
      toast.success("Settings saved");
      queryClient.invalidateQueries({ queryKey: ["profile-settings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save settings"),
  });

  const clearData = useMutation({
    mutationFn: async () => {
      const uid = profileQuery.data?.uid;
      if (!uid) throw new Error("Not signed in");
      const { error } = await supabase.from("scans").delete().eq("user_id", uid);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("All scan history deleted");
      queryClient.invalidateQueries({ queryKey: ["scans"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not delete history"),
  });

  const deleteAccount = useMutation({
    mutationFn: async () => {
      const uid = profileQuery.data?.uid;
      if (!uid) throw new Error("Not signed in");
      await supabase.from("scans").delete().eq("user_id", uid);
      await supabase.from("settings").delete().eq("user_id", uid);
      const { error } = await supabase.from("profiles").delete().eq("id", uid);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut();
      toast.success("Your data has been deleted");
      navigate({ to: "/auth", replace: true });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not delete your data"),
  });

  async function exportData(kind: "csv" | "pdf") {
    const { data, error } = await supabase
      .from("scans")
      .select("created_at,stress_index,fatigue_level,tension_level,symmetry_score,blink_rate")
      .order("created_at", { ascending: false });
    if (error || !data?.length) {
      toast.error(error ? "Export failed" : "No scans to export yet");
      return;
    }
    if (kind === "csv") {
      downloadHistoryCsv(data as ScanRow[]);
      toast.success("CSV downloaded");
      return;
    }
    const { downloadScanReport } = await import("@/lib/report-pdf");
    await downloadScanReport(data[0]!, fullName || null);
    toast.success("Latest report downloaded");
  }

  if (profileQuery.isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  if (profileQuery.isError) {
    return (
      <GlassCard className="mx-auto max-w-md text-center">
        <h1 className="text-lg font-semibold">Couldn't load your settings</h1>
        <Button className="mt-4 min-h-11 w-full" onClick={() => profileQuery.refetch()}>
          Retry
        </Button>
      </GlassCard>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-2xl space-y-5"
    >
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Profile & settings</h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{profileQuery.data?.email}</p>
      </header>

      <GlassCard className="space-y-4">
        <h2 className="text-base font-semibold">Profile</h2>
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={fullName}
            maxLength={100}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="age">Age range</Label>
          <Select value={ageRange} onValueChange={setAgeRange}>
            <SelectTrigger id="age" aria-label="Age range">
              <SelectValue placeholder="Prefer not to say" />
            </SelectTrigger>
            <SelectContent>
              {AGE_RANGES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notes">Baseline wellness notes</Label>
          <Textarea
            id="notes"
            rows={3}
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </GlassCard>

      <GlassCard className="space-y-4">
        <h2 className="text-base font-semibold">Preferences</h2>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="reminder" className="font-normal">
            Daily check-in reminder
          </Label>
          <Switch
            id="reminder"
            checked={reminderEnabled}
            onCheckedChange={setReminderEnabled}
            aria-label="Daily check-in reminder"
          />
        </div>
        {reminderEnabled && (
          <div className="space-y-1.5">
            <Label htmlFor="reminder-time">Reminder time</Label>
            <Input
              id="reminder-time"
              type="time"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
              className="w-40"
            />
          </div>
        )}
        <div className="flex items-center justify-between gap-4">
          <Label className="font-normal">Appearance</Label>
          <div className="flex gap-1">
            <Button
              variant={theme === "dark" ? "default" : "outline"}
              size="icon"
              className="min-h-11 min-w-11"
              aria-label="Dark mode"
              aria-pressed={theme === "dark"}
              onClick={() => setTheme("dark")}
            >
              <Moon />
            </Button>
            <Button
              variant={theme === "light" ? "default" : "outline"}
              size="icon"
              className="min-h-11 min-w-11"
              aria-label="Light mode"
              aria-pressed={theme === "light"}
              onClick={() => setTheme("light")}
            >
              <Sun />
            </Button>
          </div>
        </div>
        <Button
          className="min-h-11 w-full"
          onClick={() => save.mutate()}
          disabled={save.isPending}
        >
          {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
          Save changes
        </Button>
      </GlassCard>

      <GlassCard className="space-y-4">
        <h2 className="text-base font-semibold">Your data</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="min-h-11 flex-1" onClick={() => exportData("csv")}>
            <Download aria-hidden="true" />
            Export history (CSV)
          </Button>
          <Button variant="outline" className="min-h-11 flex-1" onClick={() => exportData("pdf")}>
            <Download aria-hidden="true" />
            Latest report (PDF)
          </Button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <ConfirmAction
            trigger={
              <Button variant="outline" className="min-h-11 flex-1">
                <Trash2 aria-hidden="true" />
                Clear scan history
              </Button>
            }
            title="Clear all scan history?"
            description="Every saved scan will be permanently deleted. Your account and profile stay intact."
            confirmLabel="Delete history"
            onConfirm={() => clearData.mutate()}
          />
          <ConfirmAction
            trigger={
              <Button variant="destructive" className="min-h-11 flex-1">
                <Trash2 aria-hidden="true" />
                Delete my data
              </Button>
            }
            title="Delete your account data?"
            description="This permanently removes your profile, settings and every saved scan, then signs you out. This cannot be undone."
            confirmLabel="Delete everything"
            onConfirm={() => deleteAccount.mutate()}
          />
        </div>
      </GlassCard>

      <Disclaimer />
    </motion.div>
  );
}

function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-11">Cancel</AlertDialogCancel>
          <AlertDialogAction className="min-h-11" onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
