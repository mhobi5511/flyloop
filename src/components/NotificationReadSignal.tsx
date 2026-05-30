"use client";

import { useEffect } from "react";

export function NotificationReadSignal() {
  useEffect(() => {
    window.dispatchEvent(new Event("flyloop-notifications-read"));
  }, []);

  return null;
}
