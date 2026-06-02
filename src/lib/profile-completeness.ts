export const PROFILE_OPENED_STORAGE_KEY = "flyloop:profile-opened";

export type ProfileCompletenessProfile = {
  profile_image_url?: string | null;
  full_name?: string | null;
  country?: string | null;
  city?: string | null;
  disciplines?: string[] | null;
  home_tunnel_id?: string | null;
  instagram_handle?: string | null;
};

export type ProfileCompletenessField = {
  key: keyof ProfileCompletenessProfile;
  label: string;
  targetId: string;
};

export const profileCompletenessFields: ProfileCompletenessField[] = [
  {
    key: "profile_image_url",
    label: "Add profile photo",
    targetId: "profile-photo-upload",
  },
  { key: "full_name", label: "Add name", targetId: "profile-full-name" },
  { key: "country", label: "Add country", targetId: "profile-country" },
  { key: "city", label: "Add city", targetId: "profile-city" },
  { key: "disciplines", label: "Add disciplines", targetId: "profile-disciplines" },
  {
    key: "home_tunnel_id",
    label: "Select Home Tunnel",
    targetId: "profile-home-tunnel",
  },
  {
    key: "instagram_handle",
    label: "Add Instagram",
    targetId: "profile-instagram",
  },
];

export function calculateProfileCompleteness(
  profile: ProfileCompletenessProfile | null | undefined,
) {
  const missingFields = profileCompletenessFields.filter(
    (field) => !hasCompletenessValue(profile?.[field.key]),
  );
  const total = profileCompletenessFields.length;
  const completed = total - missingFields.length;
  const percent = Math.round((completed / total) * 100);

  return {
    completed,
    total,
    percent,
    missingFields,
    isComplete: completed === total,
  };
}

function hasCompletenessValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.some((item) => String(item).trim().length > 0);
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return Boolean(value);
}
