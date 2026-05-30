"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function withdrawApplication(interestId: string): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, message: "Please log in again." };
  }

  const { data: interest, error: lookupError } = await supabase
    .from("opportunity_interests")
    .select("id,status,athlete_id")
    .eq("id", interestId)
    .maybeSingle();

  if (lookupError) {
    console.error("Application lookup failed", lookupError);
    return { ok: false, message: "Could not withdraw application. Please try again." };
  }

  if (!interest || interest.athlete_id !== user.id) {
    return { ok: false, message: "Application not found." };
  }

  if (interest.status === "accepted") {
    return {
      ok: false,
      message:
        "You have already been accepted. If you can no longer join, please contact the organizer directly via WhatsApp or Instagram.",
    };
  }

  if (interest.status === "declined") {
    return { ok: false, message: "This application was already declined." };
  }

  if (interest.status !== "pending" && interest.status !== "waitlist") {
    return { ok: false, message: "This application cannot be withdrawn." };
  }

  const { error } = await supabase
    .from("opportunity_interests")
    .delete()
    .eq("id", interestId)
    .eq("athlete_id", user.id);

  if (error) {
    console.error("Application withdrawal failed", error);
    return { ok: false, message: "Could not withdraw application. Please try again." };
  }

  revalidatePath("/app/applications");
  revalidatePath("/app/dashboard");

  return { ok: true, message: "Application withdrawn." };
}
