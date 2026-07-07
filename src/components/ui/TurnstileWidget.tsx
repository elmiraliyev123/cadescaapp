"use client";

import { useEffect, useMemo, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          action?: string;
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          "timeout-callback"?: () => void;
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove?: (widgetId: string) => void;
    };
  }
}

type TurnstileWidgetProps = {
  siteKey?: string;
  action: string;
  resetSignal: number;
  onVerify: (token: string) => void;
};

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-cadesca-turnstile]");
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("turnstile_script_failed")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.dataset.cadescaTurnstile = "true";
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("turnstile_script_failed"));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export function TurnstileWidget({ siteKey, action, resetSignal, onVerify }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [hasWidgetError, setHasWidgetError] = useState(false);
  const resolvedSiteKey = useMemo(
    () => (siteKey || process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "").trim(),
    [siteKey]
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !containerRef.current) return;

    if (!resolvedSiteKey) {
      if (process.env.NODE_ENV === "development") {
        onVerify("dev_dummy_token");
      } else {
        console.error("[turnstile] NEXT_PUBLIC_TURNSTILE_SITE_KEY is missing from the client bundle");
        onVerify("");
      }
      return;
    }

    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile || widgetIdRef.current) return;

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: resolvedSiteKey,
          action,
          callback: (token) => {
            setHasWidgetError(false);
            onVerify(token);
          },
          "expired-callback": () => onVerify(""),
          "timeout-callback": () => onVerify(""),
          "error-callback": () => {
            onVerify("");
            setHasWidgetError(true);
          }
        });
      })
      .catch(() => {
        onVerify("");
        setHasWidgetError(true);
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [action, isMounted, onVerify, resolvedSiteKey]);

  useEffect(() => {
    if (!isMounted) return;

    if (!resolvedSiteKey && process.env.NODE_ENV === "development") {
      onVerify("dev_dummy_token");
      return;
    }
    onVerify("");
    setHasWidgetError(false);
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, [isMounted, onVerify, resetSignal, resolvedSiteKey]);

  return (
    <div className="rounded-lg border border-outline-variant/70 bg-surface-container-lowest p-2">
      <div ref={containerRef} className="min-h-[65px]" />
      {hasWidgetError ? (
        <p className="px-1 pb-1 text-caption font-semibold text-secondary">
          Security verification failed to load. Please refresh and try again.
        </p>
      ) : null}
    </div>
  );
}
