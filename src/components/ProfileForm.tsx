"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { CountrySelect, normalizeCountrySelection } from "@/components/CountrySelect";
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
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushSupportState,
} from "@/lib/push-client";
import { getPwaInstallState, type PwaInstallState } from "@/lib/pwa-client";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const pushNotificationReleaseDate = new Date(
  process.env.NEXT_PUBLIC_PUSH_NOTIFICATION_RELEASE_DATE ??
    "2026-06-04T00:00:00.000Z",
);

type ProfileFormProps = {
  profile: {
    created_at?: string | null;
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
    push_notifications_enabled?: boolean;
    push_prompt_answered_at?: string | null;
  };
  tunnels: Array<{
    id: string;
    name: string;
    city: string | null;
    country: string | null;
  }>;
};

type TunnelOption = ProfileFormProps["tunnels"][number];

export function ProfileForm({ profile, tunnels }: ProfileFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [country, setCountry] = useState(() => normalizeCountrySelection(profile.country));
  const [city, setCity] = useState(profile.city ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [disciplines, setDisciplines] = useState(
    (profile.disciplines ?? []).join(", "),
  );
  const [homeTunnelId, setHomeTunnelId] = useState(profile.home_tunnel_id ?? "");
  const [tunnelSearch, setTunnelSearch] = useState("");
  const [isTunnelListOpen, setIsTunnelListOpen] = useState(false);
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
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(
    profile.push_notifications_enabled === true,
  );
  const [pushPermission, setPushPermission] = useState<
    NotificationPermission | "unsupported" | "unknown"
  >("unknown");
  const [pushStatus, setPushStatus] = useState("");
  const [showIosPwaHint, setShowIosPwaHint] = useState(false);
  const [pwaState, setPwaState] = useState<PwaInstallState | null>(null);
  const showPushTroubleshooting =
    Boolean(profile.created_at) &&
    new Date(profile.created_at as string) < pushNotificationReleaseDate;
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [locationStatus, setLocationStatus] = useState("");
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  const selectedTunnel = useMemo(
    () => tunnels.find((tunnel) => tunnel.id === homeTunnelId),
    [homeTunnelId, tunnels],
  );
  const tunnelMatches = useMemo(() => {
    const query = tunnelSearch.trim().toLowerCase();

    if (!query) {
      return tunnels.slice(0, 8);
    }

    return tunnels
      .filter((tunnel) =>
        `${tunnel.name} ${tunnel.city} ${tunnel.country}`.toLowerCase().includes(query),
      )
      .slice(0, 8);
  }, [tunnelSearch, tunnels]);
  const parsedDisciplines = useMemo(() => parseCsv(disciplines), [disciplines]);
  const primaryDiscipline = parsedDisciplines[0];
  const profileCompleteness = useMemo(
    () =>
      calculateProfileCompleteness({
        profile_image_url: profileImageUrl,
        full_name: fullName,
        country,
        city,
        disciplines: parsedDisciplines,
        home_tunnel_id: homeTunnelId,
        instagram_handle: instagram,
      }),
    [city, country, fullName, homeTunnelId, instagram, parsedDisciplines, profileImageUrl],
  );
  const normalizedPhonePreview = normalizePhoneToE164(
    mobileCountryCode,
    mobileNumber,
  );
  const currentSnapshot = JSON.stringify({
    fullName,
    country,
    city,
    bio,
    disciplines,
    homeTunnelId,
    websiteUrl,
    youtubeUrl,
    mobileCountryCode,
    mobileNumber,
    instagram,
    profileImageUrl,
    wantsToCreateOpportunities,
    useLocationRecommendations,
    latitude,
    longitude,
    preferredRadiusKm,
  });
  const [savedSnapshot, setSavedSnapshot] = useState(currentSnapshot);
  const isDirty = currentSnapshot !== savedSnapshot;

  useEffect(() => {
    localStorage.setItem(PROFILE_OPENED_STORAGE_KEY, "true");
    window.dispatchEvent(new Event("flyloop-profile-opened"));
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const support = getPushSupportState();
      const nextPwaState = getPwaInstallState();
      setPushPermission(support.permission);
      setPwaState(nextPwaState);
      setShowIosPwaHint(nextPwaState.isIos && !nextPwaState.installed);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

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

  function focusProfileField(targetId: string) {
    const element = document.getElementById(targetId);

    if (!element) {
      return;
    }

    element.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => element.focus({ preventScroll: true }), 250);
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
        void saveLocationRecommendationPreference(true, nextLatitude, nextLongitude);
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

  async function togglePushNotifications(enabled: boolean) {
    setPushStatus("");
    setError("");

    if (enabled && pwaState?.installed === false) {
      setPushStatus("Install Flyloop to your Home Screen before enabling push notifications.");
      return;
    }

    try {
      if (enabled) {
        setPushStatus("Enabling push notifications...");
        await enablePushNotifications();
        setPushNotificationsEnabled(true);
        setPushPermission(getPushSupportState().permission);
        setPushStatus("Push notifications are on.");
        return;
      }

      setPushStatus("Disabling push notifications...");
      await disablePushNotifications();
      setPushNotificationsEnabled(false);
      setPushPermission(getPushSupportState().permission);
      setPushStatus("Push notifications are off.");
    } catch (pushError) {
      console.error("Push notification preference update failed", pushError);
      setPushNotificationsEnabled(false);
      setPushPermission(getPushSupportState().permission);
      setPushStatus(
        pushError instanceof Error
          ? pushError.message
          : "Could not update push notifications.",
      );
    }
  }

  async function uploadPhoto(file: File | undefined) {
    if (!file) {
      return;
    }

    setError("");
    setToast("");

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
    setSavedSnapshot((previous) =>
      JSON.stringify({ ...JSON.parse(previous), profileImageUrl: nextUrl }),
    );
    setToast("✅ Profile photo updated.");
    router.refresh();
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isDirty) {
      return;
    }

    setIsLoading(true);
    setToast("");
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
    const normalizedPhone = normalizePhoneToE164(mobileCountryCode, mobileNumber);

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
    const locationRecommendationsEnabled = useLocationRecommendations && hasLocation;
    const profileValues = {
      full_name: cleanFullName,
      country: optionalText(country),
      city: optionalText(city),
      bio: optionalText(bio),
      disciplines: parsedDisciplines,
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
        .insert({ id: user.id, ...profileValues })
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
    setCountry(normalizeCountrySelection(data.country));
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
    setSavedSnapshot(
      JSON.stringify({
        fullName: data.full_name ?? "",
        country: normalizeCountrySelection(data.country),
        city: data.city ?? "",
        bio: data.bio ?? "",
        disciplines: (data.disciplines ?? []).join(", "),
        homeTunnelId: data.home_tunnel_id ?? "",
        websiteUrl: data.website_url ?? "",
        youtubeUrl: data.youtube_url ?? "",
        mobileCountryCode: data.mobile_country_code ?? fallbackMobileCountryCode,
        mobileNumber: data.mobile_country_code
          ? splitE164PhoneNumber(
              data.whatsapp_number ?? data.phone,
              data.mobile_country_code,
            )
          : "",
        instagram: data.instagram_handle ?? "",
        profileImageUrl: data.profile_image_url ?? "",
        wantsToCreateOpportunities: data.wants_to_create_opportunities === true,
        useLocationRecommendations: data.use_location_recommendations,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        preferredRadiusKm: String(data.preferred_radius_km ?? 1000),
      }),
    );
    setToast("✅ Profile updated successfully");
    router.refresh();
  }

  return (
    <>
      <form onSubmit={save} className="mx-auto grid max-w-2xl gap-5 pb-8">
        <ProfileHeader
          fullName={fullName}
          city={city}
          country={country}
          imageUrl={profileImageUrl}
          isUploading={isUploading}
          selectedTunnel={selectedTunnel}
          primaryDiscipline={primaryDiscipline}
          instagram={instagram}
          onUpload={uploadPhoto}
        />

        <ProfileCompletionCard
          percent={profileCompleteness.percent}
          completed={profileCompleteness.completed}
          total={profileCompleteness.total}
          isComplete={profileCompleteness.isComplete}
          missingFields={profileCompleteness.missingFields}
          onFocusField={focusProfileField}
        />

        <ProfileSection
          title="Public Profile"
          description="Visible to other Flyloop users."
        >
          <Field label="Name">
            <input
              id="profile-full-name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="field"
              placeholder="Enter full name"
            />
          </Field>
          <CountrySelect
            id="profile-country"
            value={country}
            onChange={setCountry}
          />
          <Field label="City">
            <input
              id="profile-city"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              className="field"
              placeholder="Enter city"
            />
          </Field>
          <Field
            label="Short Bio"
            helper="Tell people what you fly, coach, organize or want to learn."
          >
            <textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              className="field min-h-28 resize-y py-3"
              maxLength={500}
              placeholder="A few lines about your flying, coaching, or tunnel interests."
            />
          </Field>
        </ProfileSection>

        <ProfileSection
          title="Flying"
          description="Used for discovery and recommendations."
        >
          <Field
            label="Disciplines"
            helper="Your first discipline becomes your primary profile chip."
          >
            <input
              id="profile-disciplines"
              value={disciplines}
              onChange={(event) => setDisciplines(event.target.value)}
              className="field"
              placeholder="Enter disciplines"
            />
          </Field>
          <TunnelCombobox
            matches={tunnelMatches}
            selectedTunnel={selectedTunnel}
            tunnelSearch={tunnelSearch}
            isOpen={isTunnelListOpen}
            onSearch={(value) => {
              setTunnelSearch(value);
              setIsTunnelListOpen(true);
            }}
            onFocus={() => setIsTunnelListOpen(true)}
            onSelect={(tunnel) => {
              setHomeTunnelId(tunnel.id);
              setTunnelSearch("");
              setIsTunnelListOpen(false);
            }}
          />
        </ProfileSection>

        <ProfileSection
          title="Social Links"
          description="Instagram helps coaches and athletes discover your flying."
        >
          <Field
            label="Instagram"
            helper="Add Instagram so athletes can see your flying."
          >
            <input
              id="profile-instagram"
              value={instagram}
              onChange={(event) => setInstagram(event.target.value)}
              className="field"
              placeholder="Enter Instagram username"
            />
          </Field>
          <Field label="Website">
            <input
              value={websiteUrl}
              onChange={(event) => setWebsiteUrl(event.target.value)}
              className="field"
              placeholder="Enter website URL"
            />
          </Field>
          <Field label="YouTube">
            <input
              value={youtubeUrl}
              onChange={(event) => setYoutubeUrl(event.target.value)}
              className="field"
              placeholder="Enter YouTube URL"
            />
          </Field>
        </ProfileSection>

        <ProfileSection
          title="Preferences"
          description="Private settings that shape your Flyloop experience."
        >
          <SettingsRow
            title="Organize Camps and Huck Jams"
            description="Create and manage opportunities."
            checked={wantsToCreateOpportunities}
            onChange={setWantsToCreateOpportunities}
          />
          <SettingsRow
            title="Location Recommendations"
            description="Use your location for nearby opportunities."
            checked={useLocationRecommendations}
            onChange={enableLocationRecommendations}
          />
          <div className="rounded-2xl border border-slate-100 bg-white p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-black text-slate-900">Search Radius</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Select your home tunnel to improve recommendations.
                </p>
              </div>
              <label className="flex max-w-36 shrink-0 items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={preferredRadiusKm}
                  onChange={(event) => setPreferredRadiusKm(event.target.value)}
                  className="field text-right"
                  aria-label="Search radius"
                />
                <span className="text-sm font-bold text-slate-500">km</span>
              </label>
            </div>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-2">
            <Field label="Mobile Country Code">
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
            </Field>
            <Field label="Mobile Number">
              <input
                required
                inputMode="tel"
                value={mobileNumber}
                onChange={(event) => setMobileNumber(event.target.value)}
                className="field"
                placeholder="Enter phone number"
                aria-label="Mobile number"
              />
            </Field>
          </div>
          {normalizedPhonePreview ? (
            <p className="-mt-2 text-xs font-semibold text-slate-500">
              Stored privately as {normalizedPhonePreview}
            </p>
          ) : null}
          {locationStatus ? (
            <p className="rounded-xl bg-white p-3 text-sm font-semibold text-slate-600">
              {locationStatus}
            </p>
          ) : null}
        </ProfileSection>

        <ProfileSection
          title="Notifications"
          description="Private notification preferences."
        >
          <SettingsRow
            title={`Push Notifications ${pushNotificationsEnabled ? "On" : "Off"}`}
            description={
              pushPermission === "denied"
                ? "Push notifications are blocked in your browser settings."
                : pushPermission === "unsupported"
                  ? "Push notifications are not supported by this browser."
                  : "We only notify you about relevant Flyloop activity."
            }
            checked={pushNotificationsEnabled && pushPermission !== "denied"}
            disabled={
              pushPermission === "denied" ||
              pushPermission === "unsupported" ||
              pwaState?.installed === false
            }
            onChange={togglePushNotifications}
          />
          <div className="rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-600">
            <p className="font-black text-slate-900">
              {pwaState?.installed ? "🟢 Flyloop installed" : "🟡 Browser mode"}
            </p>
            {!pwaState?.installed ? (
              <p className="mt-1">
                Install Flyloop for the best experience and reliable push notifications.
              </p>
            ) : null}
          </div>
          {pushStatus ? (
            <p className="rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-600">
              {pushStatus}
            </p>
          ) : null}
          {showIosPwaHint ? (
            <p className="rounded-xl bg-sky-50 p-3 text-sm font-semibold text-sky-700">
              On iPhone, push notifications work best when Flyloop is added to your Home Screen.
            </p>
          ) : null}
          {showPushTroubleshooting ? (
            <div className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">
              <p className="font-black">Having trouble with push notifications?</p>
              <p className="mt-2">
                If push notifications do not appear on your phone:
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>Delete Flyloop from your home screen.</li>
                <li>Install Flyloop again.</li>
                <li>Go to Profile &gt; Notifications.</li>
                <li>Turn push notifications off.</li>
                <li>Turn push notifications on again.</li>
              </ol>
              <p className="mt-2">This usually refreshes your device connection.</p>
            </div>
          ) : null}
        </ProfileSection>

        {toast ? (
          <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
            {toast}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!isDirty || isLoading}
          className="hidden h-12 rounded-xl bg-sky-600 text-sm font-bold text-white disabled:bg-slate-300 md:block"
        >
          {isLoading ? "Saving..." : "Save Changes"}
        </button>

        {isDirty ? (
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 backdrop-blur md:hidden">
            <button
              type="submit"
              disabled={isLoading}
              className="h-12 w-full rounded-xl bg-sky-600 text-sm font-bold text-white disabled:bg-slate-300"
            >
              {isLoading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        ) : null}
      </form>
    </>
  );
}

function ProfileHeader({
  fullName,
  city,
  country,
  imageUrl,
  isUploading,
  selectedTunnel,
  primaryDiscipline,
  instagram,
  onUpload,
}: {
  fullName: string;
  city: string;
  country: string;
  imageUrl: string;
  isUploading: boolean;
  selectedTunnel?: TunnelOption;
  primaryDiscipline?: string;
  instagram: string;
  onUpload: (file: File | undefined) => void;
}) {
  const displayName = fullName.trim() || "Your Flyloop Profile";
  const location = [city.trim(), country.trim()].filter(Boolean).join(", ");
  const cleanInstagram = instagram.trim().replace(/^@/, "");

  return (
    <section className="rounded-3xl border border-slate-200 bg-white px-5 py-7 text-center shadow-sm">
      <label className="group relative mx-auto grid size-[120px] cursor-pointer place-items-center rounded-full">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={`${displayName} profile photo`}
            className="size-[120px] rounded-full object-cover ring-4 ring-sky-50"
          />
        ) : (
          <span className="grid size-[120px] place-items-center rounded-full bg-sky-50 text-4xl font-black text-sky-700 ring-4 ring-sky-100">
            {getInitials(displayName)}
          </span>
        )}
        <span className="absolute bottom-1 right-1 grid size-9 place-items-center rounded-full bg-sky-600 text-white shadow-lg ring-4 ring-white">
          <Camera size={17} />
        </span>
        <input
          id="profile-photo-upload"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={isUploading}
          className="sr-only"
          onChange={(event) => onUpload(event.target.files?.[0])}
        />
      </label>
      <p className="mt-3 text-xs font-bold text-slate-500">
        Profiles with photos receive more attention.
      </p>
      <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
        {displayName}
      </h2>
      <p className="mt-1 text-sm font-semibold text-slate-500">
        {location || "Add your city and country"}
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <ProfileChip text={selectedTunnel?.name ?? "Select Home Tunnel"} />
        <ProfileChip text={primaryDiscipline ?? "Add Discipline"} />
        {cleanInstagram ? <ProfileChip text={`@${cleanInstagram}`} /> : null}
      </div>
    </section>
  );
}

function ProfileCompletionCard({
  percent,
  completed,
  total,
  isComplete,
  missingFields,
  onFocusField,
}: {
  percent: number;
  completed: number;
  total: number;
  isComplete: boolean;
  missingFields: ReturnType<typeof calculateProfileCompleteness>["missingFields"];
  onFocusField: (targetId: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-black tracking-tight text-slate-950">
            Profile Completion
          </h2>
          <p className="mt-1 text-sm font-bold text-sky-700">{percent}% Complete</p>
        </div>
        <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-black text-sky-700">
          {completed}/{total}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-sky-600 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      {isComplete ? (
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
              {missingFields.map((field) => (
                <li key={field.key} className="list-disc">
                  <button
                    type="button"
                    onClick={() => onFocusField(field.targetId)}
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
  );
}

function ProfileSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-xl font-black tracking-tight text-slate-950">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </div>
      <div className="mt-4 grid gap-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-bold text-slate-700">
      {label}
      {children}
      {helper ? (
        <span className="text-xs leading-5 font-semibold text-slate-500">{helper}</span>
      ) : null}
    </label>
  );
}

// Kept temporarily to avoid changing picker internals beyond this form cleanup.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CountryField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const countries = useMemo(
    () =>
      Array.from(
        new Set(mobileCountryCodeOptions.map((option) => option.country)),
      ),
    [],
  );
  const matches = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return countries;
    }

    return countries.filter((countryName) =>
      countryName.toLowerCase().includes(query),
    );
  }, [countries, search]);

  function openPicker() {
    setIsOpen(true);
    window.setTimeout(() => searchRef.current?.focus(), 0);
  }

  function selectCountry(countryName: string) {
    onChange(countryName);
    setSearch("");
    setIsOpen(false);
  }

  return (
    <div className="grid gap-1.5 text-sm font-bold text-slate-700">
      <span>Country</span>
      <div className="relative">
        <button
          id="profile-country"
          type="button"
          onClick={openPicker}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openPicker();
            }
          }}
          className="field flex items-center justify-between text-left"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls="profile-country-options"
        >
          <span className={value ? "text-slate-900" : "text-slate-400"}>
            {value || "Select country"}
          </span>
          <span aria-hidden="true" className="text-slate-400">
            ▼
          </span>
        </button>
        {isOpen ? (
          <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            <input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setIsOpen(false);
                }

                if (event.key === "Enter" && matches[0]) {
                  event.preventDefault();
                  selectCountry(matches[0]);
                }
              }}
              className="field"
              placeholder="Search country"
              role="combobox"
              aria-expanded={isOpen}
              aria-controls="profile-country-options"
              autoComplete="off"
            />
            <div
              id="profile-country-options"
              role="listbox"
              className="mt-2 max-h-72 overflow-y-auto rounded-lg"
            >
              {matches.length > 0 ? (
                matches.map((countryName) => (
                  <button
                    key={countryName}
                    type="button"
                    role="option"
                    aria-selected={value === countryName}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm font-bold ${
                      value === countryName
                        ? "bg-sky-50 text-sky-700"
                        : "text-slate-800 hover:bg-slate-50"
                    }`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectCountry(countryName)}
                  >
                    {countryName}
                  </button>
                ))
              ) : (
                <p className="px-3 py-2 text-sm font-semibold text-slate-500">
                  No country matches.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TunnelCombobox({
  matches,
  selectedTunnel,
  tunnelSearch,
  isOpen,
  onSearch,
  onFocus,
  onSelect,
}: {
  matches: TunnelOption[];
  selectedTunnel?: TunnelOption;
  tunnelSearch: string;
  isOpen: boolean;
  onSearch: (value: string) => void;
  onFocus: () => void;
  onSelect: (tunnel: TunnelOption) => void;
}) {
  return (
    <div className="grid gap-1.5 text-sm font-bold text-slate-700">
      <span>Home Tunnel</span>
      <div className="relative">
        <input
          id="profile-home-tunnel"
          className="field"
          value={tunnelSearch}
          onChange={(event) => onSearch(event.target.value)}
          onFocus={onFocus}
          placeholder="Search tunnel, city or country"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="profile-home-tunnel-options"
          autoComplete="off"
        />
        {selectedTunnel && !tunnelSearch ? (
          <p className="mt-2 rounded-xl bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700">
            Selected: {formatTunnelOption(selectedTunnel)}
          </p>
        ) : null}
        {isOpen ? (
          <div
            id="profile-home-tunnel-options"
            role="listbox"
            className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
          >
            {matches.length > 0 ? (
              matches.map((tunnel) => (
                <button
                  key={tunnel.id}
                  type="button"
                  role="option"
                  aria-selected={selectedTunnel?.id === tunnel.id}
                  className="grid w-full gap-0.5 rounded-lg px-3 py-2 text-left hover:bg-sky-50"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onSelect(tunnel)}
                >
                  <span className="text-sm font-black text-slate-900">
                    {tunnel.name}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    {[tunnel.city, tunnel.country].filter(Boolean).join(", ")}
                  </span>
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-sm font-semibold text-slate-500">
                No tunnel matches.
              </p>
            )}
          </div>
        ) : null}
      </div>
      <p className="text-xs leading-5 font-semibold text-slate-500">
        Select your home tunnel to improve recommendations.
      </p>
    </div>
  );
}

function SettingsRow({
  title,
  description,
  checked,
  disabled = false,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-4">
      <span>
        <span className="block text-sm font-black text-slate-900">{title}</span>
        <span className="mt-1 block text-sm leading-6 text-slate-500">
          {description}
        </span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          disabled ? "bg-slate-100" : checked ? "bg-sky-600" : "bg-slate-200"
        }`}
      >
        <span
          className={`absolute top-1 size-5 rounded-full bg-white shadow transition ${
            checked ? "left-6" : "left-1"
          }`}
        />
      </span>
    </label>
  );
}

function ProfileChip({ text }: { text: string }) {
  return (
    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-bold text-slate-700">
      {text}
    </span>
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

function getInitials(name?: string | null) {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];

  if (parts.length === 0) {
    return "F";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function normalizeProfileCountry(country?: string | null) {
  const value = country?.trim();

  if (!value) {
    return "";
  }

  return mobileCountryCodeOptions.some((option) => option.country === value)
    ? value
    : "";
}
