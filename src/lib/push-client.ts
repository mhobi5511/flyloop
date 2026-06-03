"use client";

export type PushSupportState = {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
};

export function getPushSupportState(): PushSupportState {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    return { supported: false, permission: "unsupported" };
  }

  return { supported: true, permission: Notification.permission };
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    output[index] = rawData.charCodeAt(index);
  }

  return output;
}

async function getVapidPublicKey() {
  const response = await fetch("/api/push/public-key", { method: "GET" });
  const data = (await response.json().catch(() => ({}))) as {
    enabled?: boolean;
    publicKey?: string;
  };

  if (!response.ok || !data.enabled || !data.publicKey) {
    throw new Error("Push notifications are not configured.");
  }

  return data.publicKey;
}

async function getServiceWorkerRegistration() {
  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  return registration;
}

export async function enablePushNotifications() {
  const support = getPushSupportState();

  if (!support.supported) {
    throw new Error("Push notifications are not supported by this browser.");
  }

  if (Notification.permission === "denied") {
    throw new Error("Push notifications are blocked in your browser settings.");
  }

  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();

  if (permission !== "granted") {
    await fetch("/api/push/dismiss", { method: "POST" });
    throw new Error("Push notification permission was not granted.");
  }

  const [publicKey, registration] = await Promise.all([
    getVapidPublicKey(),
    getServiceWorkerRegistration(),
  ]);
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      userAgent: navigator.userAgent,
    }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Could not save push subscription.");
  }

  await fetch("/api/push/send-pending", { method: "POST" });

  return true;
}

export async function disablePushNotifications() {
  const support = getPushSupportState();

  if (support.supported) {
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    const subscription = await registration?.pushManager.getSubscription();
    await subscription?.unsubscribe();
  }

  const response = await fetch("/api/push/disable", { method: "POST" });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Could not disable push notifications.");
  }
}

export async function dismissPushPrompt() {
  const response = await fetch("/api/push/dismiss", { method: "POST" });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Could not save push notification preference.");
  }
}

export async function sendPendingPushNotifications() {
  await fetch("/api/push/send-pending", { method: "POST" });
}
