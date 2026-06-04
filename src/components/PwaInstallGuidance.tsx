"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

import {
  dismissInstallGuidance,
  getPwaInstallState,
  promptPwaInstall,
  setupPwaInstallListeners,
  subscribeToPwaInstallChanges,
  type PwaInstallState,
} from "@/lib/pwa-client";

type PwaInstallGuidanceProps = {
  active?: "home" | "profile" | string;
};

export function PwaInstallGuidance({ active }: PwaInstallGuidanceProps) {
  const [state, setState] = useState<PwaInstallState | null>(() =>
    typeof window === "undefined" ? null : getPwaInstallState(),
  );
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    setupPwaInstallListeners();

    return subscribeToPwaInstallChanges(() => setState(getPwaInstallState()));
  }, []);

  if (
    !state ||
    state.installed ||
    state.dismissed ||
    (active !== "home" && active !== "profile")
  ) {
    return null;
  }

  async function handleInstall() {
    if (!state) {
      return;
    }

    if (state.canPromptInstall && !state.isIos) {
      const choice = await promptPwaInstall();

      if (choice?.outcome === "accepted") {
        return;
      }
    }

    setShowInstructions(true);
  }

  function handleDismiss() {
    dismissInstallGuidance();
    setState(getPwaInstallState());
  }

  return (
    <section className="fixed inset-x-3 bottom-24 z-40 mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-xl md:bottom-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-black text-slate-950">
            📱 Get the full Flyloop experience
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Install Flyloop to your Home Screen for:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-semibold text-slate-600">
            <li>faster access</li>
            <li>better camp updates</li>
            <li>push notifications</li>
          </ul>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss install guidance"
          className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500"
        >
          <X size={16} />
        </button>
      </div>

      {showInstructions ? (
        <div className="mt-4 rounded-xl bg-sky-50 p-3 text-sm font-semibold text-sky-800">
          <p className="font-black">Add Flyloop to your Home Screen:</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Tap the Share button.</li>
            <li>Choose “Add to Home Screen”.</li>
            <li>Open Flyloop from the new icon.</li>
          </ol>
          <p className="mt-2">
            Push notifications work best when Flyloop is opened from the Home Screen.
          </p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void handleInstall()}
        className="mt-4 h-11 w-full rounded-xl bg-sky-600 px-4 text-sm font-bold text-white"
      >
        Install Flyloop
      </button>
    </section>
  );
}
