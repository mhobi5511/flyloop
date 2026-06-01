"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  fallbackMobileCountryCode,
  formatMobileCountryCodeLabel,
  getMobileCountryCodeFromLocale,
  mobileCountryCodeOptions,
  normalizePhoneToE164,
} from "@/lib/phone";
import { getAppUrl } from "@/lib/site-url";

export function SignupForm() {
  const searchParams = useSearchParams();
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
  const [wantsToCreateOpportunities, setWantsToCreateOpportunities] =
    useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const normalizedPhonePreview = normalizePhoneToE164(
    mobileCountryCode,
    mobileNumber,
  );

  function getSafeNextPath() {
    const nextPath = searchParams.get("next");

    if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
      return "/app";
    }

    return nextPath;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

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
            is_organizer: wantsToCreateOpportunities,
            wants_to_join_opportunities: true,
            wants_to_create_opportunities: wantsToCreateOpportunities,
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
    <form onSubmit={submit} className="mt-6 grid gap-4">
      <label className="grid gap-1 text-sm font-bold text-slate-700">
        Full name
        <input
          required
          className="field"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          placeholder="Your name"
        />
      </label>
      <label className="grid gap-1 text-sm font-bold text-slate-700">
        Profile Country
        <input
          className="field"
          value={country}
          onChange={(event) => setCountry(event.target.value)}
          placeholder="Germany"
        />
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
            className="field"
            value={mobileNumber}
            onChange={(event) => setMobileNumber(event.target.value)}
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
          className="field"
          value={instagram}
          onChange={(event) => setInstagram(event.target.value)}
          placeholder="yourhandle"
        />
      </label>
      <label className="grid gap-1 text-sm font-bold text-slate-700">
        Email
        <input
          type="email"
          required
          className="field"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />
      </label>
      <label className="grid gap-1 text-sm font-bold text-slate-700">
        Password
        <input
          type="password"
          required
          minLength={6}
          className="field"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 6 characters"
        />
      </label>
      <label className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-700">
        <span>I want to organize Camps or Huck Jams</span>
        <input
          type="checkbox"
          checked={wantsToCreateOpportunities}
          onChange={(event) => setWantsToCreateOpportunities(event.target.checked)}
          className="mt-0.5 size-5 shrink-0"
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
        disabled={isLoading}
        className="h-12 rounded-xl bg-sky-600 text-sm font-bold text-white disabled:bg-slate-300"
      >
        {isLoading ? "Creating account..." : "Create account"}
      </button>
    </form>
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
