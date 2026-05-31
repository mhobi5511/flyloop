"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "./Avatar";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type ProfileFormProps = {
  profile: {
    full_name: string;
    country: string | null;
    phone: string | null;
    whatsapp_number: string | null;
    instagram_handle: string | null;
    profile_image_url: string | null;
    is_organizer: boolean;
    wants_to_create_opportunities?: boolean;
    use_location_recommendations: boolean;
    latitude: number | null;
    longitude: number | null;
    preferred_radius_km: number;
  };
};

export function ProfileForm({ profile }: ProfileFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [country, setCountry] = useState(profile.country ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [whatsapp, setWhatsapp] = useState(profile.whatsapp_number ?? "");
  const [instagram, setInstagram] = useState(profile.instagram_handle ?? "");
  const [profileImageUrl, setProfileImageUrl] = useState(
    profile.profile_image_url ?? "",
  );
  const [isOrganizer, setIsOrganizer] = useState(
    profile.is_organizer || profile.wants_to_create_opportunities === true,
  );
  const [useLocationRecommendations, setUseLocationRecommendations] = useState(
    profile.use_location_recommendations,
  );
  const [latitude, setLatitude] = useState<number | null>(profile.latitude);
  const [longitude, setLongitude] = useState<number | null>(profile.longitude);
  const [preferredRadiusKm, setPreferredRadiusKm] = useState(
    String(profile.preferred_radius_km ?? 1000),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [locationStatus, setLocationStatus] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function optionalText(value: string) {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  function enableLocationRecommendations(enabled: boolean) {
    setLocationStatus("");

    if (!enabled) {
      setUseLocationRecommendations(false);
      setLatitude(null);
      setLongitude(null);
      void saveLocationRecommendationPreference(false, null, null);
      return;
    }

    if (!navigator.geolocation) {
      setUseLocationRecommendations(false);
      setLocationStatus("Location access is needed to show opportunities near you. You can still browse recommended opportunities.");
      setLatitude(null);
      setLongitude(null);
      void saveLocationRecommendationPreference(false, null, null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLatitude = position.coords.latitude;
        const nextLongitude = position.coords.longitude;
        setUseLocationRecommendations(true);
        setLatitude(nextLatitude);
        setLongitude(nextLongitude);
        setLocationStatus("Location recommendations are enabled.");
        void saveLocationRecommendationPreference(
          true,
          nextLatitude,
          nextLongitude,
        );
      },
      () => {
        setUseLocationRecommendations(false);
        setLatitude(null);
        setLongitude(null);
        setLocationStatus("Location access is needed to show opportunities near you. You can still browse recommended opportunities.");
        void saveLocationRecommendationPreference(false, null, null);
      },
      { enableHighAccuracy: false, maximumAge: 3_600_000, timeout: 10_000 },
    );
  }

  async function saveLocationRecommendationPreference(
    enabled: boolean,
    nextLatitude: number | null,
    nextLongitude: number | null,
  ) {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return;
    }

    const { error: saveError } = await supabase
      .from("profiles")
      .update({
        use_location_recommendations: enabled,
        latitude: enabled ? nextLatitude : null,
        longitude: enabled ? nextLongitude : null,
      })
      .eq("id", user.id);

    if (saveError) {
      console.error("Location recommendation preference save failed", saveError);
    }
  }

  async function uploadPhoto(file: File | undefined) {
    if (!file) {
      return;
    }

    setError("");
    setMessage("");

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setError("Please upload a JPG, PNG or WebP image.");
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setError("Profile photo must be smaller than 3 MB.");
      return;
    }

    setIsUploading(true);
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setIsUploading(false);
      setError("Please log in again before uploading a photo.");
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/profile.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("profile-images")
      .upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Profile image upload failed", uploadError);
      setIsUploading(false);
      setError("Could not upload profile photo. Please try again.");
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("profile-images")
      .getPublicUrl(path);
    const nextUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;
    const { error: saveError } = await supabase
      .from("profiles")
      .update({ profile_image_url: nextUrl })
      .eq("id", user.id);

    setIsUploading(false);

    if (saveError) {
      console.error("Profile image URL save failed", saveError);
      setError("Photo uploaded, but Flyloop could not save it to your profile.");
      return;
    }

    setProfileImageUrl(nextUrl);
    setMessage("Profile photo updated.");
    router.refresh();
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
    const cleanRadius = Math.max(1, Number(preferredRadiusKm) || 1000);
    const hasLocation = latitude !== null && longitude !== null;
    const locationRecommendationsEnabled =
      useLocationRecommendations && hasLocation;
    const profileValues = {
      full_name: cleanFullName,
      country: optionalText(country),
      phone: optionalText(phone),
      whatsapp_number: optionalText(whatsapp),
      instagram_handle: optionalText(instagram),
      profile_image_url: optionalText(profileImageUrl),
      is_organizer: isOrganizer,
      wants_to_join_opportunities: true,
      wants_to_create_opportunities: isOrganizer,
      use_location_recommendations: locationRecommendationsEnabled,
      latitude: locationRecommendationsEnabled ? latitude : null,
      longitude: locationRecommendationsEnabled ? longitude : null,
      current_country: null,
      current_city: null,
      region: null,
      preferred_radius_km: cleanRadius,
    };
    const profileSelect =
      "full_name,country,phone,whatsapp_number,instagram_handle,profile_image_url,is_organizer,wants_to_create_opportunities,use_location_recommendations,latitude,longitude,preferred_radius_km";
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
      console.error("Profile save failed", saveError);
      setError("Could not save profile. Please check your details and try again.");
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
    setProfileImageUrl(data.profile_image_url ?? "");
    setIsOrganizer(data.is_organizer || data.wants_to_create_opportunities === true);
    setUseLocationRecommendations(data.use_location_recommendations);
    setLatitude(data.latitude ?? null);
    setLongitude(data.longitude ?? null);
    setPreferredRadiusKm(String(data.preferred_radius_km ?? 1000));
    setMessage("Profile saved successfully.");
    router.refresh();
  }

  return (
    <form
      onSubmit={save}
      className="mt-5 grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="flex items-center gap-3">
        <Avatar name={fullName} imageUrl={profileImageUrl} size="lg" />
        <div className="min-w-0">
          <label className="inline-flex h-10 cursor-pointer items-center rounded-xl bg-sky-600 px-4 text-sm font-bold text-white">
            {isUploading ? "Uploading..." : "Upload photo"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={isUploading}
              className="sr-only"
              onChange={(event) => void uploadPhoto(event.target.files?.[0])}
            />
          </label>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            JPG, PNG or WebP. Max 3 MB.
          </p>
        </div>
      </div>

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

      <div className="grid gap-3 rounded-2xl bg-slate-50 p-4">
        <Toggle
          checked={isOrganizer}
          label="Enable organizer mode"
          description="Create and manage camps or Huck Jams while keeping athlete features."
          onChange={setIsOrganizer}
        />
        <Toggle
          checked={useLocationRecommendations}
          label="Use location-based recommendations"
          description="Use your browser location to sort nearby opportunities."
          onChange={enableLocationRecommendations}
        />
        <label className="grid gap-1 text-sm font-bold text-slate-700">
          Search radius
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              value={preferredRadiusKm}
              onChange={(event) => setPreferredRadiusKm(event.target.value)}
              className="field"
            />
            <span className="text-sm font-semibold text-slate-500">km</span>
          </div>
        </label>
        {locationStatus ? (
          <p className="rounded-xl bg-white p-3 text-sm font-semibold text-slate-600">
            {locationStatus}
          </p>
        ) : null}
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

function Toggle({
  checked,
  label,
  description,
  onChange,
}: {
  checked: boolean;
  label: string;
  description: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-3 rounded-xl bg-white p-3">
      <span>
        <span className="block text-sm font-black text-slate-800">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-500">
          {description}
        </span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 size-5 shrink-0"
      />
    </label>
  );
}
