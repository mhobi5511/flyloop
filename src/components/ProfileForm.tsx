"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "./Avatar";
import {
  fallbackMobileCountryCode,
  formatMobileCountryCodeLabel,
  getMobileCountryCodeFromLocale,
  mobileCountryCodeOptions,
  normalizePhoneToE164,
  splitE164PhoneNumber,
} from "@/lib/phone";
import {
  calculateProfileCompleteness,
  PROFILE_OPENED_STORAGE_KEY,
} from "@/lib/profile-completeness";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type ProfileFormProps = {
  profile: {
    full_name: string;
    country: string | null;
    city: string | null;
    bio: string | null;
    disciplines: string[] | null;
    home_tunnel_id: string | null;
    website_url: string | null;
    youtube_url: string | null;
    mobile_country_code: string | null;
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
  tunnels: Array<{
    id: string;
    name: string;
    city: string | null;
    country: string | null;
  }>;
};

export function ProfileForm({ profile, tunnels }: ProfileFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [country, setCountry] = useState(profile.country ?? "");
  const [city, setCity] = useState(profile.city ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [disciplines, setDisciplines] = useState(
    (profile.disciplines ?? []).join(", "),
  );
  const [homeTunnelId, setHomeTunnelId] = useState(profile.home_tunnel_id ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(profile.website_url ?? "");
  const [youtubeUrl, setYoutubeUrl] = useState(profile.youtube_url ?? "");
  const [mobileCountryCode, setMobileCountryCode] = useState(() =>
    profile.mobile_country_code ??
    (typeof navigator === "undefined"
      ? fallbackMobileCountryCode
      : getMobileCountryCodeFromLocale(navigator.language)),
  );
  const [mobileNumber, setMobileNumber] = useState(
    profile.mobile_country_code
      ? splitE164PhoneNumber(
          profile.whatsapp_number ?? profile.phone,
          profile.mobile_country_code,
        )
      : "",
  );
  const [instagram, setInstagram] = useState(profile.instagram_handle ?? "");
  const [profileImageUrl, setProfileImageUrl] = useState(
    profile.profile_image_url ?? "",
  );
  const [wantsToCreateOpportunities, setWantsToCreateOpportunities] = useState(
    profile.wants_to_create_opportunities === true,
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
  const normalizedPhonePreview = normalizePhoneToE164(
    mobileCountryCode,
    mobileNumber,
  );
  const profileCompleteness = useMemo(
    () =>
      calculateProfileCompleteness({
        profile_image_url: profileImageUrl,
        full_name: fullName,
        country,
        city,
        disciplines: parseCsv(disciplines),
        home_tunnel_id: homeTunnelId,
        instagram_handle: instagram,
      }),
    [city, country, disciplines, fullName, homeTunnelId, instagram, profileImageUrl],
  );

  useEffect(() => {
    localStorage.setItem(PROFILE_OPENED_STORAGE_KEY, "true");
    window.dispatchEvent(new Event("flyloop-profile-opened"));
  }, []);

  function focusProfileField(targetId: string) {
    const element = document.getElementById(targetId);

    if (!element) {
      return;
    }

    element.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => element.focus({ preventScroll: true }), 250);
  }

  function optionalText(value: string) {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  function optionalUrl(value: string) {
    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
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
    const normalizedPhone = normalizePhoneToE164(
      mobileCountryCode,
      mobileNumber,
    );

    if (!mobileCountryCode) {
      setIsLoading(false);
      setError("Please select a mobile country code.");
      return;
    }

    if (!normalizedPhone) {
      setIsLoading(false);
      setError("Please enter a valid phone number.");
      return;
    }

    const hasLocation = latitude !== null && longitude !== null;
    const locationRecommendationsEnabled =
      useLocationRecommendations && hasLocation;
    const profileValues = {
      full_name: cleanFullName,
      country: optionalText(country),
      city: optionalText(city),
      bio: optionalText(bio),
      disciplines: parseCsv(disciplines),
      home_tunnel_id: optionalText(homeTunnelId),
      website_url: optionalUrl(websiteUrl),
      youtube_url: optionalUrl(youtubeUrl),
      mobile_country_code: mobileCountryCode,
      phone: normalizedPhone,
      whatsapp_number: normalizedPhone,
      instagram_handle: optionalText(instagram),
      profile_image_url: optionalText(profileImageUrl),
      is_organizer: wantsToCreateOpportunities,
      wants_to_join_opportunities: true,
      wants_to_create_opportunities: wantsToCreateOpportunities,
      use_location_recommendations: locationRecommendationsEnabled,
      latitude: locationRecommendationsEnabled ? latitude : null,
      longitude: locationRecommendationsEnabled ? longitude : null,
      current_country: null,
      current_city: null,
      region: null,
      preferred_radius_km: cleanRadius,
    };
    const profileSelect =
      "full_name,country,city,bio,disciplines,home_tunnel_id,website_url,youtube_url,mobile_country_code,phone,whatsapp_number,instagram_handle,profile_image_url,is_organizer,wants_to_create_opportunities,use_location_recommendations,latitude,longitude,preferred_radius_km";
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
    setCity(data.city ?? "");
    setBio(data.bio ?? "");
    setDisciplines((data.disciplines ?? []).join(", "));
    setHomeTunnelId(data.home_tunnel_id ?? "");
    setWebsiteUrl(data.website_url ?? "");
    setYoutubeUrl(data.youtube_url ?? "");
    setMobileCountryCode(data.mobile_country_code ?? fallbackMobileCountryCode);
    setMobileNumber(
      data.mobile_country_code
        ? splitE164PhoneNumber(
            data.whatsapp_number ?? data.phone,
            data.mobile_country_code,
          )
        : "",
    );
    setInstagram(data.instagram_handle ?? "");
    setProfileImageUrl(data.profile_image_url ?? "");
    setWantsToCreateOpportunities(data.wants_to_create_opportunities === true);
    setUseLocationRecommendations(data.use_location_recommendations);
    setLatitude(data.latitude ?? null);
    setLongitude(data.longitude ?? null);
    setPreferredRadiusKm(String(data.preferred_radius_km ?? 1000));
    setMessage("Profile saved successfully.");
    router.refresh();
  }

  return (
    <>
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-black tracking-tight text-slate-950">
              Profile Completion
            </h2>
            <p className="mt-1 text-sm font-bold text-sky-700">
              {profileCompleteness.percent}% Complete
            </p>
          </div>
          <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-black text-sky-700">
            {profileCompleteness.completed}/{profileCompleteness.total}
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-sky-600 transition-all"
            style={{ width: `${profileCompleteness.percent}%` }}
          />
        </div>
        {profileCompleteness.isComplete ? (
          <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
            <p className="font-black">✅ Profile complete</p>
            <p className="mt-1 leading-6">
              Your profile can now be discovered by athletes, coaches and
              organizers worldwide.
            </p>
          </div>
        ) : (
          <>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Complete your profile to improve your visibility for coaches,
              athletes and organizers.
            </p>
            <div className="mt-3">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                Missing:
              </p>
              <ul className="mt-2 grid gap-1 pl-4 text-sm text-slate-700">
                {profileCompleteness.missingFields.map((field) => (
                  <li key={field.key} className="list-disc">
                    <button
                      type="button"
                      onClick={() => focusProfileField(field.targetId)}
                      className="font-bold text-sky-700 underline-offset-2 hover:underline"
                    >
                      {field.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </section>

      <form
        onSubmit={save}
        className="mt-4 grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      >
      <div className="flex items-center gap-3">
        <Avatar name={fullName} imageUrl={profileImageUrl} size="lg" />
        <div className="min-w-0">
          <label
            id="profile-photo-upload"
            tabIndex={-1}
            className="inline-flex h-10 cursor-pointer items-center rounded-xl bg-sky-600 px-4 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
          >
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
          id="profile-full-name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          className="field"
        />
      </label>
      <label className="grid gap-1 text-sm font-bold text-slate-700">
        Profile Country
        <input
          id="profile-country"
          value={country}
          onChange={(event) => setCountry(event.target.value)}
          className="field"
        />
      </label>
      <label className="grid gap-1 text-sm font-bold text-slate-700">
        City
        <input
          id="profile-city"
          value={city}
          onChange={(event) => setCity(event.target.value)}
          className="field"
          placeholder="Eloy"
        />
      </label>
      <label className="grid gap-1 text-sm font-bold text-slate-700">
        Short bio
        <textarea
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          className="field min-h-24 resize-y"
          maxLength={500}
          placeholder="A few lines about your flying, coaching, or tunnel interests."
        />
      </label>
      <label className="grid gap-1 text-sm font-bold text-slate-700">
        Disciplines
        <input
          id="profile-disciplines"
          value={disciplines}
          onChange={(event) => setDisciplines(event.target.value)}
          className="field"
          placeholder="FS, VFS, Dynamic, Freestyle"
        />
      </label>
      <label className="grid gap-1 text-sm font-bold text-slate-700">
        Home Tunnel
        <select
          id="profile-home-tunnel"
          value={homeTunnelId}
          onChange={(event) => setHomeTunnelId(event.target.value)}
          className="field"
        >
          <option value="">No home tunnel</option>
          {tunnels.map((tunnel) => (
            <option key={tunnel.id} value={tunnel.id}>
              {formatTunnelOption(tunnel)}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-2">
        <label className="grid min-w-0 gap-1 text-sm font-bold text-slate-700">
          Mobile Country Code
          <select
            required
            className="field"
            value={mobileCountryCode}
            onChange={(event) => setMobileCountryCode(event.target.value)}
            aria-label="Mobile country code"
          >
            {mobileCountryCodeOptions.map((option) => (
              <option key={option.iso2} value={option.dialCode}>
                {formatMobileCountryCodeLabel(option)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-sm font-bold text-slate-700">
          Mobile Number
          <input
            required
            inputMode="tel"
            value={mobileNumber}
            onChange={(event) => setMobileNumber(event.target.value)}
            className="field"
            placeholder="1624234820"
            aria-label="Mobile number"
          />
        </label>
      </div>
      {normalizedPhonePreview ? (
        <p className="-mt-3 text-xs font-semibold text-slate-500">
          Stored as {normalizedPhonePreview}
        </p>
      ) : null}
      <label className="grid gap-1 text-sm font-bold text-slate-700">
        Instagram
        <input
          id="profile-instagram"
          value={instagram}
          onChange={(event) => setInstagram(event.target.value)}
          className="field"
        />
      </label>
      <label className="grid gap-1 text-sm font-bold text-slate-700">
        Website
        <input
          value={websiteUrl}
          onChange={(event) => setWebsiteUrl(event.target.value)}
          className="field"
          placeholder="https://example.com"
        />
      </label>
      <label className="grid gap-1 text-sm font-bold text-slate-700">
        YouTube
        <input
          value={youtubeUrl}
          onChange={(event) => setYoutubeUrl(event.target.value)}
          className="field"
          placeholder="https://youtube.com/@yourchannel"
        />
      </label>

      <div className="grid gap-3 rounded-2xl bg-slate-50 p-4">
        <Toggle
          checked={wantsToCreateOpportunities}
          label="I want to organize Camps or Huck Jams"
          description="Create and manage camps or Huck Jams while keeping athlete features."
          onChange={setWantsToCreateOpportunities}
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
    </>
  );
}

function parseCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatTunnelOption(tunnel: {
  name: string;
  city: string | null;
  country: string | null;
}) {
  const location = [tunnel.city, tunnel.country].filter(Boolean).join(", ");

  return location ? `${tunnel.name} - ${location}` : tunnel.name;
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
