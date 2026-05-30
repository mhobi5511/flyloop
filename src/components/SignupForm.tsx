"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getAppUrl } from "@/lib/site-url";

type FlyloopPurpose = "join" | "create" | "both";

function purposeFlags(purpose: FlyloopPurpose) {
  return {
    wants_to_join_opportunities: purpose === "join" || purpose === "both",
    wants_to_create_opportunities: purpose === "create" || purpose === "both",
  };
}

export function SignupForm() {
  const [purpose, setPurpose] = useState<FlyloopPurpose>("join");
  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
  const [instagram, setInstagram] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: getAppUrl(
            "/auth/callback?next=/app",
            window.location.origin,
          ),
          data: {
            full_name: fullName,
            country,
            phone,
            whatsapp_number: phone,
            instagram_handle: instagram,
            flyloop_purpose: purpose,
            ...purposeFlags(purpose),
          },
        },
      });

      if (signUpError) {
        console.error("Signup failed", signUpError);
        setError(
          signUpError.message === "User already registered"
            ? "This email is already registered. Please log in instead."
            : "Could not create account. Please check your details and try again.",
        );
        return;
      }

      if (!data.session || !data.user) {
        setMessage("Account created. Please confirm your email, then log in.");
        return;
      }

      window.location.assign("/app");
    } catch (signupError) {
      console.error("Signup request failed", signupError);
      setError("Could not create account. Please try again in a moment.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 grid gap-4">
      <fieldset className="grid gap-2">
        <legend className="text-sm font-bold text-slate-700">
          What do you want to use Flyloop for?
        </legend>
        <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-3 text-sm font-semibold text-slate-700">
          <input
            type="radio"
            name="purpose"
            value="join"
            checked={purpose === "join"}
            onChange={() => setPurpose("join")}
            className="mt-1"
          />
          Join camps and Huck Jams
        </label>
        <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-3 text-sm font-semibold text-slate-700">
          <input
            type="radio"
            name="purpose"
            value="create"
            checked={purpose === "create"}
            onChange={() => setPurpose("create")}
            className="mt-1"
          />
          Create camps or Huck Jams
        </label>
        <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-3 text-sm font-semibold text-slate-700">
          <input
            type="radio"
            name="purpose"
            value="both"
            checked={purpose === "both"}
            onChange={() => setPurpose("both")}
            className="mt-1"
          />
          Both
        </label>
      </fieldset>
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
        Country
        <input
          className="field"
          value={country}
          onChange={(event) => setCountry(event.target.value)}
          placeholder="Germany"
        />
      </label>
      <label className="grid gap-1 text-sm font-bold text-slate-700">
        WhatsApp or phone
        <input
          className="field"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="+49..."
        />
      </label>
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
