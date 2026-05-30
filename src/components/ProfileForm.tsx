"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type ProfileFormProps = {
  profile: {
    full_name: string;
    country: string | null;
    phone: string | null;
    whatsapp_number: string | null;
    instagram_handle: string | null;
    wants_to_join_opportunities: boolean;
    wants_to_create_opportunities: boolean;
  };
};

export function ProfileForm({ profile }: ProfileFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [country, setCountry] = useState(profile.country ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [whatsapp, setWhatsapp] = useState(profile.whatsapp_number ?? "");
  const [instagram, setInstagram] = useState(profile.instagram_handle ?? "");
  const [wantsToJoin, setWantsToJoin] = useState(
    profile.wants_to_join_opportunities,
  );
  const [wantsToCreate, setWantsToCreate] = useState(
    profile.wants_to_create_opportunities,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function optionalText(value: string) {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage("");
    setError("");

    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setIsLoading(false);
      setError("Please log in again before saving your profile.");
      return;
    }

    const fallbackName = user.email?.split("@")[0] ?? "Flyloop user";
    const cleanFullName = fullName.trim() || fallbackName;
    const profileValues = {
      full_name: cleanFullName,
      country: optionalText(country),
      phone: optionalText(phone),
      whatsapp_number: optionalText(whatsapp),
      instagram_handle: optionalText(instagram),
      wants_to_join_opportunities: wantsToJoin,
      wants_to_create_opportunities: wantsToCreate,
    };
    const profileSelect =
      "full_name,country,phone,whatsapp_number,instagram_handle,wants_to_join_opportunities,wants_to_create_opportunities";
    let { data, error: saveError } = await supabase
      .from("profiles")
      .update(profileValues)
      .eq("id", user.id)
      .select(profileSelect)
      .maybeSingle();

    if (!saveError && !data) {
      const insertResult = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          ...profileValues,
        })
        .select(profileSelect)
        .maybeSingle();

      data = insertResult.data;
      saveError = insertResult.error;
    }

    setIsLoading(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }

    if (!data) {
      setError("Profile was not saved because Supabase did not return an updated profile.");
      return;
    }

    setFullName(data.full_name ?? "");
    setCountry(data.country ?? "");
    setPhone(data.phone ?? "");
    setWhatsapp(data.whatsapp_number ?? "");
    setInstagram(data.instagram_handle ?? "");
    setWantsToJoin(data.wants_to_join_opportunities);
    setWantsToCreate(data.wants_to_create_opportunities);
    setMessage("Profile saved successfully.");
    router.refresh();
  }

  return (
    <form
      onSubmit={save}
      className="mt-5 grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <label className="grid gap-1 text-sm font-bold text-slate-700">
        Name
        <input
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          className="field"
        />
      </label>
      <label className="grid gap-1 text-sm font-bold text-slate-700">
        Country
        <input
          value={country}
          onChange={(event) => setCountry(event.target.value)}
          className="field"
        />
      </label>
      <label className="grid gap-1 text-sm font-bold text-slate-700">
        Phone
        <input
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className="field"
        />
      </label>
      <label className="grid gap-1 text-sm font-bold text-slate-700">
        WhatsApp
        <input
          value={whatsapp}
          onChange={(event) => setWhatsapp(event.target.value)}
          className="field"
        />
      </label>
      <label className="grid gap-1 text-sm font-bold text-slate-700">
        Instagram
        <input
          value={instagram}
          onChange={(event) => setInstagram(event.target.value)}
          className="field"
        />
      </label>
      <div className="grid gap-2 rounded-2xl bg-slate-50 p-4">
        <label className="flex items-start gap-3 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={wantsToJoin}
            onChange={(event) => setWantsToJoin(event.target.checked)}
            className="mt-1"
          />
          I want to join camps and Huck Jams
        </label>
        <label className="flex items-start gap-3 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={wantsToCreate}
            onChange={(event) => setWantsToCreate(event.target.checked)}
            className="mt-1"
          />
          I want to create camps or Huck Jams
        </label>
      </div>
      {message ? (
        <p className="rounded-xl bg-sky-50 p-3 text-sm font-semibold text-sky-700">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isLoading}
        className="mt-2 h-12 rounded-xl bg-sky-600 text-sm font-bold text-white disabled:bg-slate-300"
      >
        {isLoading ? "Saving..." : "Save profile"}
      </button>
    </form>
  );
}
