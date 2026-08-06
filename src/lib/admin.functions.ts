import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminScan = {
  id: string;
  stress_index: number;
  fatigue_level: number;
  tension_level: number;
  symmetry_score: number;
  blink_rate: number;
  created_at: string;
};

export type AdminUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  age_range: string | null;
  baseline_notes: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  is_admin: boolean;
  scan_count: number;
  avg_stress: number | null;
  scans: AdminScan[];
};

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden: admin access required");
}

export const amIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { isAdmin: Boolean(data) };
  });

export const listAllUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminUser[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: authList, error: authError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (authError) throw authError;

    const [{ data: profiles }, { data: scans }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, age_range, baseline_notes"),
      supabaseAdmin
        .from("scans")
        .select(
          "id, user_id, stress_index, fatigue_level, tension_level, symmetry_score, blink_rate, created_at",
        )
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("user_roles").select("user_id, role").eq("role", "admin"),
    ]);

    const profileById = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const adminIds = new Set((roles ?? []).map((r: any) => r.user_id));
    const scansByUser = new Map<string, AdminScan[]>();
    for (const s of (scans ?? []) as any[]) {
      const list = scansByUser.get(s.user_id) ?? [];
      list.push({
        id: s.id,
        stress_index: s.stress_index,
        fatigue_level: s.fatigue_level,
        tension_level: s.tension_level,
        symmetry_score: s.symmetry_score,
        blink_rate: Number(s.blink_rate),
        created_at: s.created_at,
      });
      scansByUser.set(s.user_id, list);
    }

    return authList.users.map((u) => {
      const profile: any = profileById.get(u.id) ?? {};
      const userScans = scansByUser.get(u.id) ?? [];
      const avg =
        userScans.length > 0
          ? Math.round(userScans.reduce((a, s) => a + s.stress_index, 0) / userScans.length)
          : null;
      return {
        id: u.id,
        email: u.email ?? null,
        full_name: profile.full_name ?? null,
        age_range: profile.age_range ?? null,
        baseline_notes: profile.baseline_notes ?? null,
        created_at: u.created_at ?? null,
        last_sign_in_at: u.last_sign_in_at ?? null,
        is_admin: adminIds.has(u.id),
        scan_count: userScans.length,
        avg_stress: avg,
        scans: userScans,
      };
    });
  });

export const deleteUserScans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => {
    if (!input?.userId || typeof input.userId !== "string") throw new Error("userId required");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("scans").delete().eq("user_id", data.userId);
    if (error) throw error;
    return { ok: true };
  });

export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => {
    if (!input?.userId || typeof input.userId !== "string") throw new Error("userId required");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("You cannot delete your own admin account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw error;
    return { ok: true };
  });
