"use client";

const installDismissedAtKey = "flyloop-install-dismissed-at";
const installDismissalMs = 7 * 24 * 60 * 60 * 1000;

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export type PwaInstallState = {
  installed: boolean;
  isIos: boolean;
  canPromptInstall: boolean;
  dismissed: boolean;
};

let installPromptEvent: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

export function isPwaInstalled() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export function isIosDevice() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function getPwaInstallState(): PwaInstallState {
  return {
    installed: isPwaInstalled(),
    isIos: isIosDevice(),
    canPromptInstall: Boolean(installPromptEvent),
    dismissed: isInstallGuidanceDismissed(),
  };
}

export function isInstallGuidanceDismissed() {
  if (typeof localStorage === "undefined") {
    return false;
  }

  const dismissedAt = Number(localStorage.getItem(installDismissedAtKey) ?? 0);

  return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < installDismissalMs;
}

export function dismissInstallGuidance() {
  localStorage.setItem(installDismissedAtKey, String(Date.now()));
  notifyInstallListeners();
}

export function clearInstallGuidanceDismissal() {
  localStorage.removeItem(installDismissedAtKey);
  notifyInstallListeners();
}

export function subscribeToPwaInstallChanges(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function setupPwaInstallListeners() {
  if (typeof window === "undefined") {
    return;
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPromptEvent = event as BeforeInstallPromptEvent;
    notifyInstallListeners();
  });

  window.addEventListener("appinstalled", () => {
    installPromptEvent = null;
    clearInstallGuidanceDismissal();
    notifyInstallListeners();
  });
}

export async function promptPwaInstall() {
  if (!installPromptEvent) {
    return null;
  }

  const promptEvent = installPromptEvent;
  installPromptEvent = null;
  await promptEvent.prompt();
  const choice = await promptEvent.userChoice;
  notifyInstallListeners();

  return choice;
}

function notifyInstallListeners() {
  for (const listener of listeners) {
    listener();
  }
}
