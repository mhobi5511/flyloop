"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";

export function SignupForm() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>("athlete");
  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState("");
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

    const supabase = createSupabaseBrowserClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          country,
          role,
        },
      },
    });

    if (signUpError) {
      setIsLoading(false);
      setError(signUpError.message);
      return;
    }

    if (!data.session || !data.user) {
      setIsLoading(false);
      setMessage("Please confirm your email, then log in.");
      return;
    }

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: data.user.id,
      role,
      full_name: fullName,
      country,
      disciplines: [],
    });

    if (profileError) {
      setIsLoading(false);
      setError(profileError.message);
      return;
    }

    if (role === "coach") {
      await supabase
        .from("coach_profiles")
        .upsert(
          {
            user_id: data.user.id,
            bio: "",
            disciplines: [],
            languages: [],
            achievements: [],
            coaching_tunnels: [],
          },
          { onConflict: "user_id" },
        );
    }

    setIsLoading(false);
    router.push("/app");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mt-6 grid gap-4">
      <label className="grid gap-1 text-sm font-bold text-slate-700">
        Account type
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as UserRole)}
          className="field"
        >
          <option value="athlete">Athlete</option>
          <option value="coach">Coach</option>
          <option value="admin">Admin</option>
        </select>
      </label>
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
