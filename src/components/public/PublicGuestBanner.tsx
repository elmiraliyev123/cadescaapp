"use client";

import { useLanguage } from "@/lib/i18n";

type PublicGuestBannerProps = {
  signupHref: string;
  loginHref: string;
};

export function PublicGuestBanner({
  signupHref,
  loginHref
}: PublicGuestBannerProps) {
  const { t } = useLanguage();

  return (
    <aside
      aria-labelledby="join-cadesca-title"
      className="public-maple-banner fixed inset-x-0 bottom-0 z-50 w-full border-t border-white/30 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_32px_rgba(62,31,20,0.22)] sm:px-6 sm:py-4"
    >
      <div className="relative z-10 mx-auto flex w-full max-w-[960px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <h2
            id="join-cadesca-title"
            className="text-[18px] font-semibold leading-6 text-white sm:text-[20px]"
          >
            {t("social.publicJoinTitle")}
          </h2>
          <p className="mt-0.5 max-w-[500px] text-[13px] font-normal leading-5 text-white/85">
            {t("social.publicJoinDescription")}
          </p>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex sm:w-auto">
          <a
            href={loginHref}
            className="inline-flex min-h-11 min-w-[112px] items-center justify-center rounded-xl border border-black/35 bg-white/95 px-5 text-[15px] font-semibold text-black transition-transform duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-[0.98]"
          >
            {t("social.publicLogIn")}
          </a>
          <a
            href={signupHref}
            className="inline-flex min-h-11 min-w-[112px] items-center justify-center rounded-xl border border-black bg-black px-5 text-[15px] font-semibold text-white transition-transform duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-[0.98]"
          >
            {t("social.publicSignUp")}
          </a>
        </div>
      </div>
    </aside>
  );
}
