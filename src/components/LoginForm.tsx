"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getAppUrl } from "@/lib/site-url";

export function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(searchParams.get("error") ?? "");
  const [message, setMessage] = useState(searchParams.get("message") ?? "");
  const [isLoading, setIsLoading] = useState(false);

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
    setIsLoading(true);

    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setIsLoading(false);

    if (signInError) {
      setError(
        signInError.message === "Email not confirmed"
          ? "Please confirm your email first, then try logging in again."
          : signInError.message,
      );
      return;
    }

    window.location.assign(getSafeNextPath());
  }

  async function requestPasswordReset() {
    setError("");
    setMessage("");

    if (!email) {
      setError("Enter your email address first.");
      return;
    }

    setIsLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: getAppUrl("/auth/callback?next=/reset-password"),
      },
    );

    setIsLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setMessage("Password reset email sent.");
  }

  return (
    <form onSubmit={submit} className="mt-6 grid gap-4">
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
          className="field"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Your password"
        />
      </label>
      {error ? (
        <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {error}
        </p>
      ) : null}
      {!error && message ? (
        <p className="rounded-xl bg-sky-50 p-3 text-sm font-semibold text-sky-700">
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isLoading}
        className="h-12 rounded-xl bg-sky-600 text-sm font-bold text-white disabled:bg-slate-300"
      >
        {isLoading ? "Logging in..." : "Log in"}
      </button>
      <button
        type="button"
        disabled={isLoading}
        onClick={requestPasswordReset}
        className="text-sm font-bold text-sky-700 disabled:text-slate-400"
      >
        Send password reset email
      </button>
    </form>
  );
}
