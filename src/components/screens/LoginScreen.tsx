"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Logo } from "@/components/ui/Logo";
import { Toast } from "@/components/ui/Toast";
import { TurnstileWidget } from "@/components/ui/TurnstileWidget";
import { useLanguage } from "@/lib/i18n";
import { isStrongPassword, useDemoState } from "@/lib/demoStore";

type AuthMode = "login" | "signup" | "verify";

type LoginInput = {
  email: string;
  password: string;
  turnstileToken?: string;
};

type SignupInput = {
  name: string;
  displayName?: string;
  username?: string;
  email: string;
  password?: string;
  accountType?: "user";
  acceptedTermsAt?: string;
  emailVerified?: boolean;
  emailVerificationCode?: string;
  emailVerificationToken?: string;
  turnstileToken?: string;
  verifiedVia?: "email" | "ocr";
};

type VerificationPurpose = "signup" | "login";

type PendingVerification = {
  input: SignupInput;
  purpose: VerificationPurpose;
  sentAt: number;
};

type LoginMessageKey =
  | "common.accountSuspended"
  | "common.accountUnavailable"
  | "login.accountNotFound"
  | "login.invalidCredentials";

type LoginResult =
  | { status: "authenticated" }
  | { status: "error"; message: LoginMessageKey }
  | { status: "unverified"; user: { name: string; email: string; acceptedTermsAt?: string } };

type VerificationMessageKey =
  | "login.emailServiceUnavailable"
  | "login.invalidVerificationCode"
  | "login.resendRateLimited"
  | "login.securityVerificationFailed"
  | "login.securityVerificationInvalid"
  | "login.securityVerificationMissing"
  | "login.tooManyVerificationAttempts"
  | "login.verificationCodeExpired";

function isValidEmailInput(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function verificationMessageKey(message: string): VerificationMessageKey {
  if (message === "email_send_rate_limited") return "login.resendRateLimited";
  if (message === "turnstile_missing") return "login.securityVerificationMissing";
  if (message === "turnstile_invalid") return "login.securityVerificationInvalid";
  if (message === "turnstile_verification_failed") return "login.securityVerificationFailed";
  if (message === "verification_code_expired") return "login.verificationCodeExpired";
  if (message === "verification_too_many_attempts") return "login.tooManyVerificationAttempts";
  if (message === "email_expired") return "login.verificationCodeExpired";
  if (message === "email_too_many_attempts") return "login.tooManyVerificationAttempts";
  if (message === "email_verification_expired") return "login.verificationCodeExpired";
  if (message === "email_verification_invalid") return "login.invalidVerificationCode";
  if (message === "email_invalid" || message === "email_not_found" || message === "email_verification_required") return "login.invalidVerificationCode";
  if (message === "email_service_not_configured" || message === "auth_service_not_configured" || message === "email_send_failed" || message === "resend_send_failed") {
    return "login.emailServiceUnavailable";
  }
  return "login.invalidVerificationCode";
}

function isRegistrationServiceError(message: string) {
  return (
    message === "Registration failed" ||
    message === "internal_server_error" ||
    message === "supabase_auth_not_configured" ||
    message === "supabase_auth_create_failed" ||
    message === "supabase_auth_sign_in_failed" ||
    message === "supabase_auth_delete_failed"
  );
}

async function requestVerificationCode(input: SignupInput, purpose: VerificationPurpose, language: string, turnstileToken: string, resend = false) {
  const response = await fetch(resend ? "/api/auth/resend-verification-code" : "/api/auth/send-verification-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: input.email, name: input.name, locale: language, purpose, turnstileToken })
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body?.message === "string" ? body.message : "email_unavailable");
  }
}

async function submitVerificationCode(email: string, code: string, purpose: VerificationPurpose, turnstileToken?: string) {
  const response = await fetch("/api/auth/verify-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code, purpose, turnstileToken })
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof body?.message === "string"
        ? body.message
        : typeof body?.error === "string"
          ? body.error
          : "verification_code_invalid"
    );
  }

  return {
    emailVerificationToken: typeof body?.emailVerificationToken === "string" ? body.emailVerificationToken : undefined
  };
}

async function checkUniversityEmail(email: string) {
  const response = await fetch("/api/auth/university-domain/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(typeof body?.error === "string" ? body.error : "university_check_failed");
  }

  return {
    supported: body?.status === "supported" || body?.ok === true,
    emailDomain: typeof body?.emailDomain === "string" ? body.emailDomain : ""
  };
}

export function LoginScreen({
  initialMode = "login",
  turnstileSiteKey,
  onLogin,
  onAccountSubmit,
  onEmailVerified
}: {
  initialMode?: AuthMode;
  turnstileSiteKey?: string;
  onLogin: (input: LoginInput) => Promise<LoginResult> | LoginResult;
  onAccountSubmit: (input: SignupInput) => Promise<void> | void;
  onEmailVerified: (email: string) => void;
}) {
  const { t, language } = useLanguage();
  const { state } = useDemoState();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [signupStep, setSignupStep] = useState<1 | 2>(1);
  const [emailVerificationToken, setEmailVerificationToken] = useState("");

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [verificationInput, setVerificationInput] = useState("");
  const [pendingVerification, setPendingVerification] = useState<PendingVerification | null>(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileTokenRef = useRef("");
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0);

  const handleTurnstileTokenChange = useCallback((token: string) => {
    turnstileTokenRef.current = token;
    setTurnstileToken(token);
  }, []);

  const resetTurnstile = useCallback(() => {
    turnstileTokenRef.current = "";
    setTurnstileToken("");
    setTurnstileResetSignal((value) => value + 1);
  }, []);

  const subtitle =
    mode === "verify"
      ? "Enter the code sent to your university email."
      : "Connect with verified students from your campus.";

  const formTitle = useMemo(() => {
    if (mode === "signup" && signupStep === 1) return "What's your university email?";
    if (mode === "signup") return "Create your account";
    if (mode === "verify") return "Verify your email";
    return "Log in";
  }, [mode, signupStep]);

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFeedback("");

    if (!turnstileToken) {
      setError(t("login.securityVerificationFailed"));
      return;
    }

    const result = await onLogin({ email, password, turnstileToken });

    if (result.status === "error") {
      setError(t(result.message));
      resetTurnstile();
      return;
    }

    resetTurnstile();
    if (result.status === "unverified") {
      if (process.env.NODE_ENV === "development") {
        onEmailVerified(result.user.email);
      } else {
        await startEmailVerification(
          {
            name: result.user.name,
            email: result.user.email,
            acceptedTermsAt: result.user.acceptedTermsAt,
            emailVerified: false
          },
          "login"
        );
      }
    }
  }

  async function startEmailVerification(input: SignupInput, purpose: VerificationPurpose, previous?: PendingVerification | null) {
    setPendingVerification({ input, purpose, sentAt: previous?.sentAt || 0 });
    setMode("verify");
    setFeedback("");

    if (previous && Date.now() - previous.sentAt < 60 * 1000) {
      setError(t("login.resendRateLimited"));
      return false;
    }

    setError("");
    setIsSendingCode(true);
    try {
      await requestVerificationCode(input, purpose, language, purpose === "signup" ? turnstileToken : "", Boolean(previous));
      setPendingVerification({ input, purpose, sentAt: Date.now() });
      setVerificationInput("");
      if (previous) setFeedback(t("login.newVerificationCodeSent"));
      if (purpose === "signup") resetTurnstile();
      return true;
    } catch (caughtError) {
      setError(t(verificationMessageKey(caughtError instanceof Error ? caughtError.message : "email_unavailable")));
      if (purpose === "signup") resetTurnstile();
      return false;
    } finally {
      setIsSendingCode(false);
    }
  }

  async function handleSignupStep1Submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFeedback("");

    if (!isValidEmailInput(email)) {
      setError(t("management.emailRequired"));
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if ((state.users || []).some((user) => user.email.toLowerCase() === normalizedEmail)) {
      setError(t("management.duplicateEmail"));
      return;
    }

    if (!turnstileToken && process.env.NODE_ENV !== "development") {
      setError(t("login.securityVerificationFailed"));
      return;
    }

    if (process.env.NODE_ENV === "development") {
      setSignupStep(2);
      resetTurnstile();
      return;
    }

    try {
      const check = await checkUniversityEmail(normalizedEmail);
      if (!check.supported) {
        const params = new URLSearchParams({
          email: normalizedEmail,
          domain: check.emailDomain || normalizedEmail.split("@").pop() || ""
        });
        window.location.href = `/request-university?${params.toString()}`;
        return;
      }

      await startEmailVerification(
        {
          name: normalizedEmail.split("@")[0] || normalizedEmail,
          email: normalizedEmail,
          verifiedVia: "email"
        },
        "signup"
      );
    } catch (caughtError) {
      setError(t(verificationMessageKey(caughtError instanceof Error ? caughtError.message : "email_unavailable")));
    }
  }

  async function handleSignupFinalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFeedback("");

    if (!name.trim()) {
      setError(t("management.nameRequired"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("login.passwordMismatch"));
      return;
    }

    if (!isStrongPassword(password)) {
      setError(t("login.passwordRequirements"));
      return;
    }

    if (!termsAccepted) {
      setError(t("login.termsRequired"));
      return;
    }

    if (process.env.NODE_ENV !== "development" && !emailVerificationToken) {
      setError(t("login.invalidVerificationCode"));
      return;
    }

    const input = {
      name: name.trim(),
      displayName: name.trim(),
      username: username.trim() || undefined,
      email: email.trim().toLowerCase(),
      password,
      accountType: "user",
      acceptedTermsAt: new Date().toISOString(),
      emailVerified: true,
      verifiedVia: "email",
      emailVerificationToken: emailVerificationToken || undefined
    } satisfies SignupInput;

    try {
      await onAccountSubmit(input);
      onEmailVerified(input.email);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Registration failed";
      if (message === "duplicate_email" || message === "email_in_use") {
        setError(t("management.duplicateEmail"));
        return;
      }
      if (message === "duplicate_username") {
        setError("That username is already taken.");
        return;
      }
      if (message === "invalid_username") {
        setError("Usernames can use lowercase letters, numbers, underscores and dots only.");
        return;
      }
      if (message === "university_not_supported") {
        window.location.href = `/request-university?email=${encodeURIComponent(input.email)}`;
        return;
      }
      if (isRegistrationServiceError(message)) {
        setError(t("login.emailServiceUnavailable"));
        return;
      }
      setError(t(verificationMessageKey(message)));
    }
  }

  async function handleVerifySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFeedback("");

    if (!pendingVerification) {
      setError(t("login.invalidVerificationCode"));
      return;
    }

    const code = verificationInput.trim();
    if (!/^\d{6}$/.test(code)) {
      setError(t("login.invalidVerificationCode"));
      return;
    }

    setIsVerifying(true);
    try {
      if (pendingVerification.purpose === "signup") {
        const currentTurnstileToken = turnstileTokenRef.current || turnstileToken;
        if (!currentTurnstileToken) {
          setError(t("login.securityVerificationFailed"));
          return;
        }
        const verification = await submitVerificationCode(
          pendingVerification.input.email,
          code,
          pendingVerification.purpose,
          currentTurnstileToken
        );
        setEmailVerificationToken(verification.emailVerificationToken || "");
        setEmail(pendingVerification.input.email);
        setMode("signup");
        setSignupStep(2);
        setFeedback("");
        resetTurnstile();
        return;
      } else {
        await submitVerificationCode(pendingVerification.input.email, code, pendingVerification.purpose);
      }
      onEmailVerified(pendingVerification.input.email);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "verification_code_invalid";
      if (message === "duplicate_email" || message === "email_in_use") {
        setError(t("management.duplicateEmail"));
        return;
      }
      if (isRegistrationServiceError(message)) {
        setError(t("login.emailServiceUnavailable"));
        return;
      }
      setError(t(verificationMessageKey(message)));
      if (message.startsWith("turnstile_")) {
        resetTurnstile();
      }
    } finally {
      setIsVerifying(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-margin-mobile py-6 text-on-background md:px-gutter md:py-8">
      <div className="mx-auto flex min-h-[calc(100dvh-48px)] w-full max-w-container-max flex-col">
        <header className="flex justify-center py-3 md:justify-start">
          <Logo maxWidth={190} imgClassName="h-auto w-[170px] object-contain md:w-[190px]" />
        </header>

        <div className="grid flex-1 items-center gap-7 py-6 lg:grid-cols-[minmax(0,0.9fr)_440px] lg:gap-12">
          <section className="mx-auto w-full max-w-xl text-center lg:mx-0 lg:text-left">
            <p className="text-caption font-semibold uppercase tracking-[0.12em] text-secondary">Cadesca</p>
            <h1 className="mt-4 text-[36px] font-bold leading-[42px] text-primary md:text-[48px] md:leading-[56px]">
              Join your private university community
            </h1>
            <p className="mt-4 text-body-lg text-secondary">{subtitle}</p>
          </section>

          <section className="mx-auto w-full max-w-[440px] rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-5 md:p-6">
            <div className="mb-5">
              <h2 className="text-headline-md font-semibold text-primary">{formTitle}</h2>
              {mode === "verify" ? (
                <p className="mt-1 text-body-md text-secondary">
                  {pendingVerification?.purpose === "login" ? t("login.emailNotVerified") : t("login.verificationSent")}
                </p>
              ) : null}
              {mode === "signup" && signupStep === 1 ? (
                <p className="mt-1 text-body-md text-secondary">
                  We'll use this to verify your university community.
                </p>
              ) : null}
              {mode === "signup" && signupStep === 2 ? (
                <p className="mt-1 text-body-md text-secondary">Choose how verified students will see you.</p>
              ) : null}
            </div>

            {mode === "login" ? (
              <form className="space-y-4" onSubmit={handleLoginSubmit}>
                <Input label={t("login.usernameOrEmail")} icon="alternate_email" type="text" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
                <Input label={t("login.password")} icon="lock" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
                <a className="block text-right text-label-md font-semibold text-secondary transition-colors hover:text-primary" href="/forgot-password">
                  Forgot password?
                </a>
                <TurnstileWidget siteKey={turnstileSiteKey} action="user_login" resetSignal={turnstileResetSignal} onVerify={handleTurnstileTokenChange} />
                <Button type="submit" size="lg" className="w-full" icon="arrow_forward" disabled={!turnstileToken}>
                  Log in
                </Button>
                <button
                  type="button"
                  className="w-full rounded-lg border border-outline-variant/70 bg-surface-container-lowest px-4 py-3 text-label-md font-semibold text-primary transition-colors hover:bg-surface-container-low"
                  onClick={() => {
                    setMode("signup");
                    setSignupStep(1);
                    setError("");
                    resetTurnstile();
                  }}
                >
                  Create new account
                </button>
              </form>
            ) : null}

            {mode === "signup" ? (
              <>
                {signupStep === 1 && (
                  <form className="space-y-4" onSubmit={handleSignupStep1Submit}>
                    <Input label="University email" icon="mail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                    <TurnstileWidget siteKey={turnstileSiteKey} action="user_signup" resetSignal={turnstileResetSignal} onVerify={handleTurnstileTokenChange} />
                    <Button type="submit" size="lg" className="w-full" icon="arrow_forward" disabled={isSendingCode || !turnstileToken}>
                      {isSendingCode ? t("login.sendingVerificationCode") : "Next"}
                    </Button>
                    <button
                      type="button"
                      className="w-full text-label-md font-semibold text-secondary transition-colors hover:text-primary"
                      onClick={() => {
                        setMode("login");
                        setError("");
                        resetTurnstile();
                      }}
                    >
                      I already have an account
                    </button>
                  </form>
                )}

                {signupStep === 2 && (
                  <form className="space-y-4" onSubmit={handleSignupFinalSubmit}>
                    <Input label="Display name" icon="person" value={name} onChange={(event) => setName(event.target.value)} required />
                    <Input label="Username (optional)" icon="alternate_email" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
                    <Input label={t("login.password")} icon="lock" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
                    <Input label={t("login.confirmPassword")} icon="lock_reset" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
                    <p className="text-caption font-semibold text-secondary">{t("login.passwordRequirements")}</p>

                    <label className="flex items-start gap-3 rounded-lg border border-outline-variant/70 bg-surface-container-low p-3 text-label-md font-semibold text-primary">
                      <input className="mt-1" type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} />
                      <span>{t("login.acceptTerms")}</span>
                    </label>
                    <Button type="submit" size="lg" className="w-full" icon="arrow_forward">
                      Create account
                    </Button>
                    <button
                      type="button"
                      className="w-full text-label-md font-semibold text-secondary transition-colors hover:text-primary"
                      onClick={() => {
                        setSignupStep(1);
                        setError("");
                        resetTurnstile();
                      }}
                    >
                      Back
                    </button>
                  </form>
                )}
              </>
            ) : null}

            {mode === "verify" ? (
              <form className="space-y-4" onSubmit={handleVerifySubmit}>
                <Input label={t("login.verificationCode")} icon="pin" value={verificationInput} onChange={(event) => setVerificationInput(event.target.value)} inputMode="numeric" maxLength={6} required />
                <Button type="submit" size="lg" className="w-full" icon="verified" disabled={isVerifying || (pendingVerification?.purpose === "signup" && !turnstileToken)}>
                  {t("common.confirm")}
                </Button>
                {pendingVerification?.purpose === "signup" ? (
                  <TurnstileWidget siteKey={turnstileSiteKey} action="user_verify_email" resetSignal={turnstileResetSignal} onVerify={handleTurnstileTokenChange} />
                ) : null}
                <button
                  type="button"
                  className="w-full rounded-lg border border-outline-variant/70 bg-surface-container-lowest px-4 py-3 text-label-md font-semibold text-primary transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isSendingCode || !pendingVerification || (pendingVerification.purpose === "signup" && !turnstileToken)}
                  onClick={() => {
                    if (pendingVerification) void startEmailVerification(pendingVerification.input, pendingVerification.purpose, pendingVerification);
                  }}
                >
                  {isSendingCode ? t("login.sendingVerificationCode") : t("login.resendCode")}
                </button>
              </form>
            ) : null}

            {error || feedback ? <p className="mt-4 rounded-lg border border-outline-variant/70 bg-surface-container-low p-3 text-caption font-semibold text-secondary">{error || feedback}</p> : null}

          </section>
        </div>
      </div>
      <Toast message={state.toast} visible={Boolean(state.toast)} />
    </main>
  );
}
