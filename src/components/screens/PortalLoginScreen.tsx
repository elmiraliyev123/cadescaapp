"use client";

import { useCallback, useState } from "react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Logo } from "@/components/ui/Logo";
import { Toast } from "@/components/ui/Toast";
import { TurnstileWidget } from "@/components/ui/TurnstileWidget";
import { useDemoState } from "@/lib/demoStore";
import { useLanguage } from "@/lib/i18n";

export function PortalLoginScreen({
  portal,
  domain,
  turnstileSiteKey,
  onSubmit
}: {
  portal: "merchant" | "admin";
  domain: string;
  turnstileSiteKey?: string;
  onSubmit: (input: { email: string; password: string; turnstileToken?: string }) => void | boolean | Promise<void | boolean>;
}) {
  const { t } = useLanguage();
  const { state } = useDemoState();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0);
  const title = portal === "merchant" ? t("login.merchantPortal") : t("login.adminConsole");
  const turnstileRequired = portal === "merchant";

  const handleTurnstileTokenChange = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  function resetTurnstile() {
    setTurnstileToken("");
    setTurnstileResetSignal((value) => value + 1);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (turnstileRequired && !turnstileToken) return;

    const result = await onSubmit({ email, password, turnstileToken: turnstileRequired ? turnstileToken : undefined });
    if (turnstileRequired && result === false) {
      resetTurnstile();
    }
  }

  return (
    <main className="min-h-screen bg-background px-margin-mobile py-6 text-on-background md:px-gutter md:py-8">
      <div className="mx-auto flex min-h-[calc(100dvh-48px)] w-full max-w-md flex-col justify-center">
        <section className="premium-card p-5 md:p-6">
          <div className="flex flex-col items-center border-b border-outline-variant/70 pb-6 text-center">
            <Logo maxWidth={190} imgClassName="h-auto w-[170px] object-contain md:w-[190px]" />
            <p className="mt-5 text-caption font-semibold uppercase tracking-[0.12em] text-secondary">{domain}</p>
            <h1 className="mt-2 text-headline-md font-semibold text-primary">{title}</h1>
          </div>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <Input label={t("login.email")} icon="mail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            <Input label={t("login.password")} icon="lock" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            {turnstileRequired ? (
              <TurnstileWidget siteKey={turnstileSiteKey} action="merchant_login" resetSignal={turnstileResetSignal} onVerify={handleTurnstileTokenChange} />
            ) : null}
            <Button type="submit" size="lg" className="w-full" icon="arrow_forward" disabled={turnstileRequired && !turnstileToken}>
              {t("login.logIn")}
            </Button>
          </form>
        </section>
      </div>
      <Toast message={state.toast} visible={Boolean(state.toast)} />
    </main>
  );
}
