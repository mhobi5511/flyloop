"use client";

import { useEffect, useState } from "react";

import {
  dismissPushPrompt,
  enablePushNotifications,
  getPushSupportState,
} from "@/lib/push-client";
import { isPwaInstalled } from "@/lib/pwa-client";

type PushNotificationPromptProps = {
  enabled: boolean;
  answeredAt: string | null;
};

export function PushNotificationPrompt({
  enabled,
  answeredAt,
}: PushNotificationPromptProps) {
  const [visible, setVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isPwaInstalled()) {
      return;
    }

    const support = getPushSupportState();

    if (!support.supported) {
      return;
    }

    if (enabled && support.permission === "granted") {
      void enablePushNotifications().catch((subscriptionError) => {
        console.error("Push notification sync failed", subscriptionError);
      });
      return;
    }

    if (answeredAt || support.permission === "denied") {
      return;
    }

    const timeout = window.setTimeout(() => setVisible(true), 1200);

    return () => window.clearTimeout(timeout);
  }, [answeredAt, enabled]);

  async function handleEnable() {
    setIsSaving(true);
    setError("");

    try {
      await enablePushNotifications();
      setVisible(false);
    } catch (pushError) {
      console.error("Push notification opt-in failed", pushError);
      setError(
        pushError instanceof Error
          ? pushError.message
          : "Could not enable push notifications.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDismiss() {
    setIsSaving(true);
    setError("");

    try {
      await dismissPushPrompt();
      setVisible(false);
    } catch (dismissError) {
      console.error("Push notification prompt dismiss failed", dismissError);
      setError(
        dismissError instanceof Error
          ? dismissError.message
          : "Could not save your notification preference.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl md:bottom-5">
      <p className="text-base font-black text-slate-950">Stay updated</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Flyloop can notify you when something important happens, like accepted
        applications, new timetable availability or booking updates.
      </p>
      {error ? (
        <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {error}
        </p>
      ) : null}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={handleEnable}
          disabled={isSaving}
          className="h-11 rounded-xl bg-sky-600 px-4 text-sm font-bold text-white disabled:bg-slate-300"
        >
          {isSaving ? "Saving..." : "Enable Push Notifications"}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={isSaving}
          className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 disabled:text-slate-400"
        >
          Not Now
        </button>
      </div>
    </div>
  );
}
