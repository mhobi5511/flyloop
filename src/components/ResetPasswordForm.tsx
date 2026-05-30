"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    setIsLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    window.location.assign("/app");
  }

  return (
    <form onSubmit={submit} className="mt-6 grid gap-4">
      <label className="grid gap-1 text-sm font-bold text-slate-700">
        New password
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
      <button
        type="submit"
        disabled={isLoading}
        className="h-12 rounded-xl bg-sky-600 text-sm font-bold text-white disabled:bg-slate-300"
      >
        {isLoading ? "Saving..." : "Save new password"}
      </button>
    </form>
  );
}
