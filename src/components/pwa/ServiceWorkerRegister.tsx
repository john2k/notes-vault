"use client";

import { useEffect } from "react";

/** Register service worker for installable offline shell */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        // ignore SW errors in dev
      });
    }
  }, []);
  return null;
}
