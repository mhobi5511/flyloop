"use client";

import { useEffect, useState } from "react";
import { PROFILE_OPENED_STORAGE_KEY } from "@/lib/profile-completeness";

export function ProfileNavDot({ initialIncomplete }: { initialIncomplete: boolean }) {
  const [showDot, setShowDot] = useState(initialIncomplete);

  useEffect(() => {
    function refresh() {
      const hasOpenedProfile =
        localStorage.getItem(PROFILE_OPENED_STORAGE_KEY) === "true";

      setShowDot(initialIncomplete || !hasOpenedProfile);
    }

    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("flyloop-profile-opened", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("flyloop-profile-opened", refresh);
    };
  }, [initialIncomplete]);

  if (!showDot) {
    return null;
  }

  return (
    <span
      aria-hidden="true"
      className="absolute right-0 top-0 size-2.5 rounded-full bg-sky-500 ring-2 ring-white"
    />
  );
}
