"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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
      setError(signInError.message);
      return;
    }

    router.push(searchParams.get("next") ?? "/app");
    router.refresh();
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
      <button
        type="submit"
        disabled={isLoading}
        className="h-12 rounded-xl bg-sky-600 text-sm font-bold text-white disabled:bg-slate-300"
      >
        {isLoading ? "Logging in..." : "Log in"}
      </button>
    </form>
  );
}
