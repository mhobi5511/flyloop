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
  };
};

export function ProfileForm({ profile }: ProfileFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [country, setCountry] = useState(profile.country ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [whatsapp, setWhatsapp] = useState(profile.whatsapp_number ?? "");
  const [instagram, setInstagram] = useState(profile.instagram_handle ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage("");

    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setIsLoading(false);
      return;
    }

    await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        country,
        phone,
        whatsapp_number: whatsapp,
        instagram_handle: instagram,
      })
      .eq("id", user.id);

    setIsLoading(false);
    setMessage("Profile saved.");
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
      {message ? (
        <p className="rounded-xl bg-sky-50 p-3 text-sm font-semibold text-sky-700">
          {message}
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
