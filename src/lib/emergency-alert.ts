import { supabase } from "@/integrations/supabase/client";

/** Stress score at or above this counts as "high". */
export const ALERT_THRESHOLD = 70;
/** Number of consecutive high-stress scans that triggers an alert. */
export const ALERT_STREAK = 3;

/**
 * After a scan is saved: if the latest ALERT_STREAK scans are all high-stress
 * and the user enabled emergency alerts, open WhatsApp with a ready message.
 */
export async function checkAndSendEmergencyAlert(userId: string, userName?: string | null) {
  const [{ data: settings }, { data: scans }] = await Promise.all([
    supabase
      .from("settings")
      .select("emergency_name,emergency_phone,emergency_alert_enabled")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("scans")
      .select("stress_index")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(ALERT_STREAK),
  ]);
  if (!settings?.emergency_alert_enabled || !settings.emergency_phone) return false;
  if (!scans || scans.length < ALERT_STREAK) return false;
  if (!scans.every((s) => s.stress_index >= ALERT_THRESHOLD)) return false;

  const phone = settings.emergency_phone.replace(/[^\d]/g, "");
  if (!phone) return false;
  const who = userName?.trim() || "Your contact";
  const scores = scans.map((s) => s.stress_index).join(", ");
  const msg = `Hi ${settings.emergency_name ?? ""}, this is an automatic NeuroFace AI wellness alert. ${who} has shown high stress signals on their last ${ALERT_STREAK} check-ins (scores: ${scores}). Please consider reaching out to them. (This is a wellness screening, not a medical diagnosis.)`;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  return true;
}
