"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { CountrySelect } from "@/components/CountrySelect";
import {
  fallbackMobileCountryCode,
  formatMobileCountryCodeLabel,
  getMobileCountryCodeFromLocale,
  mobileCountryCodeOptions,
  normalizePhoneToE164,
} from "@/lib/phone";
import { getAppUrl } from "@/lib/site-url";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type SignupRoleId = "flyer" | "coach" | "tunnel";

type SignupRole = {
  id: SignupRoleId;
  title: string;
  emoji: string;
  selectable: boolean;
  disabled: boolean;
  isOrganizer: boolean;
  wantsToCreateOpportunities: boolean;
  tone: "sky" | "emerald" | "slate";
};

const SIGNUP_ROLES: SignupRole[] = [
  {
    id: "flyer",
    title: "Flyer",
    emoji: "✈️",
    selectable: true,
    disabled: false,
    isOrganizer: false,
    wantsToCreateOpportunities: false,
    tone: "sky",
  },
  {
    id: "coach",
    title: "Coach",
    emoji: "🎓",
    selectable: true,
    disabled: false,
    isOrganizer: true,
    wantsToCreateOpportunities: true,
    tone: "emerald",
  },
  {
    id: "tunnel",
    title: "Tunnel",
    emoji: "🏢",
    selectable: false,
    disabled: true,
    isOrganizer: false,
    wantsToCreateOpportunities: false,
    tone: "slate",
  },
];

export function SignupForm() {
  const searchParams = useSearchParams();
  const [selectedRoleId, setSelectedRoleId] = useState<SignupRoleId>("flyer");
  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState("");
  const [mobileCountryCode, setMobileCountryCode] = useState(() =>
    typeof navigator === "undefined"
      ? fallbackMobileCountryCode
      : getMobileCountryCodeFromLocale(navigator.language),
  );
  const [mobileNumber, setMobileNumber] = useState("");
  const [instagram, setInstagram] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const normalizedPhonePreview = normalizePhoneToE164(
    mobileCountryCode,
    mobileNumber,
  );
  const selectedRole =
    SIGNUP_ROLES.find((role) => role.id === selectedRoleId) ?? SIGNUP_ROLES[0];

  function getSafeNextPath() {
    const nextPath = searchParams.get("next");

    if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
      return "/app";
    }

    return nextPath;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (selectedRole.disabled) {
      setError("Please choose a different role.");
      return;
    }

    if (!mobileCountryCode) {
      setError("Please select a mobile country code.");
      return;
    }

    const normalizedPhone = normalizePhoneToE164(
      mobileCountryCode,
      mobileNumber,
    );

    if (!normalizedPhone) {
      setError("Please enter a valid phone number.");
      return;
    }

    setIsLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanFullName = fullName.trim();
      const cleanCountry = country.trim();
      const cleanInstagram = instagram.trim().replace(/^@/, "");
      const nextPath = getSafeNextPath();
      const supabase = createSupabaseBrowserClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo: getAppUrl(
            `/auth/callback?next=${encodeURIComponent(nextPath)}`,
            window.location.origin,
          ),
          data: {
            full_name: cleanFullName,
            country: cleanCountry,
            city: "",
            bio: "",
            disciplines: [],
            home_tunnel_id: null,
            website_url: "",
            youtube_url: "",
            mobile_country_code: mobileCountryCode,
            phone: normalizedPhone,
            whatsapp_number: normalizedPhone,
            instagram_handle: cleanInstagram,
            is_organizer: selectedRole.isOrganizer,
            wants_to_join_opportunities: true,
            wants_to_create_opportunities: selectedRole.wantsToCreateOpportunities,
            registration_role: selectedRole.id,
          },
        },
      });

      if (signUpError) {
        console.error("Signup failed", signUpError);
        setError(formatSignupError(signUpError.message));
        return;
      }

      if (!data.session || !data.user) {
        setMessage("Account created. Please confirm your email, then log in.");
        return;
      }

      window.location.assign(nextPath);
    } catch (signupError) {
      console.error("Signup request failed", signupError);
      setError("Could not create account. Please try again in a moment.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:gap-5">
      <fieldset aria-label="Choose your Flyloop role">
        <div className="grid gap-3 md:grid-cols-3 md:gap-4">
          {SIGNUP_ROLES.map((role) => {
            const isSelected = role.id === selectedRoleId;

            return (
              <RoleCard
                key={role.id}
                role={role}
                isSelected={isSelected}
                onSelect={setSelectedRoleId}
              />
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:gap-4">
        <label className="grid gap-1 text-sm font-bold text-slate-700">
          Full name
          <input
            required
            className="field h-12 sm:h-11"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Enter full name"
          />
        </label>

        <CountrySelect
          id="signup-country"
          label="Profile Country"
          value={country}
          onChange={setCountry}
        />

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <label className="grid min-w-0 gap-1 text-sm font-bold text-slate-700">
            Mobile Country Code
            <select
              required
              className="field h-12 sm:h-11"
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
              className="field h-12 sm:h-11"
              value={mobileNumber}
              onChange={(event) => setMobileNumber(event.target.value)}
              placeholder="Enter phone number"
              aria-label="Mobile number"
            />
          </label>
        </div>

        {normalizedPhonePreview ? (
          <p className="-mt-2 text-xs font-semibold text-slate-500">
            Stored as {normalizedPhonePreview}
          </p>
        ) : null}

        <label className="grid gap-1 text-sm font-bold text-slate-700">
          Instagram
          <input
            className="field h-12 sm:h-11"
            value={instagram}
            onChange={(event) => setInstagram(event.target.value)}
            placeholder="Enter Instagram username"
          />
        </label>

        <label className="grid gap-1 text-sm font-bold text-slate-700">
          Email
          <input
            type="email"
            required
            className="field h-12 sm:h-11"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter email address"
          />
        </label>

        <label className="grid gap-1 text-sm font-bold text-slate-700">
          Password
          <input
            type="password"
            required
            minLength={6}
            className="field h-12 sm:h-11"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 6 characters"
          />
        </label>

        {error ? (
          <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="rounded-xl bg-sky-50 p-3 text-sm font-semibold text-sky-700">
            {message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isLoading || selectedRole.disabled}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:h-11"
        >
          {isLoading ? "Creating account..." : "Create account"}
        </button>
      </div>
    </form>
  );
}

function RoleCard({
  role,
  isSelected,
  onSelect,
}: {
  role: SignupRole;
  isSelected: boolean;
  onSelect: (roleId: SignupRoleId) => void;
}) {
  const selectedStyles =
    role.tone === "emerald"
      ? "border-emerald-300 bg-emerald-50/80 shadow-emerald-100"
      : "border-sky-300 bg-sky-50/80 shadow-sky-100";
  const neutralStyles = "border-slate-200 bg-white shadow-sm";
  const disabledStyles = "border-slate-200 bg-slate-100 opacity-60";

  return (
    <button
      type="button"
      disabled={role.disabled}
      aria-pressed={isSelected}
      aria-disabled={role.disabled}
      onClick={() => {
        if (!role.selectable) {
          return;
        }

        onSelect(role.id);
      }}
      className={[
        "flex min-h-[10.75rem] w-full flex-col items-center rounded-[1.5rem] border p-4 text-center transition sm:min-h-[12rem] sm:rounded-[1.75rem] sm:p-5",
        role.disabled
          ? `${disabledStyles} cursor-not-allowed`
          : `${isSelected ? selectedStyles : neutralStyles} hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg`,
      ].join(" ")}
    >
      <div className="grid place-items-center">
        <div className="grid size-16 place-items-center rounded-2xl bg-white/80 text-4xl shadow-sm ring-1 ring-slate-200 sm:size-20 sm:text-5xl">
          {role.emoji}
        </div>
      </div>

      <h3 className="mt-5 text-xl font-black tracking-tight text-slate-950 sm:mt-6 sm:text-2xl">
        {role.title}
      </h3>
      {role.disabled ? (
        <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
          <CheckCircle2 size={15} />
          Coming Soon
        </p>
      ) : null}
    </button>
  );
}

function formatSignupError(message?: string) {
  const cleanMessage = message?.trim();
  const normalized = cleanMessage?.toLowerCase() ?? "";

  if (normalized.includes("already registered") || normalized.includes("already exists")) {
    return "This email is already registered. Please log in instead.";
  }

  if (normalized.includes("password")) {
    return cleanMessage ?? "Please choose a stronger password.";
  }

  if (normalized.includes("email")) {
    return cleanMessage ?? "Please enter a valid email address.";
  }

  if (normalized.includes("database")) {
    return "Could not create your Flyloop profile. Please try again. If it keeps happening, contact Flyloop support.";
  }

  return cleanMessage
    ? `Could not create account: ${cleanMessage}`
    : "Could not create account. Please check your details and try again.";
}
