import "./globals.css";
import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { DemoStateProvider } from "@/lib/demoStore";
import { getPublicUrl } from "@/lib/appConfig";
import { LanguageProvider, type Language } from "@/lib/i18n";
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  LOCALE_HEADER,
  NEXT_LOCALE_COOKIE_NAME
} from "@/lib/localization";

export const metadata: Metadata = {
  metadataBase: new URL(getPublicUrl()),
  title: "Cadesca",
  description: "A verified private university community for students.",
  icons: {
    icon: "/cadesca-mark.png"
  }
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [requestCookies, requestHeaders] = await Promise.all([cookies(), headers()]);
  const headerLocale = requestHeaders.get(LOCALE_HEADER);
  const cookieLocale = requestCookies.get(NEXT_LOCALE_COOKIE_NAME)?.value;
  const initialLanguage: Language = isSupportedLocale(headerLocale)
    ? headerLocale
    : isSupportedLocale(cookieLocale)
      ? cookieLocale
      : DEFAULT_LOCALE;

  return (
    <html lang={initialLanguage} data-scroll-behavior="smooth">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#f7f7f8] font-sans text-black antialiased">
        <LanguageProvider initialLanguage={initialLanguage}>
          <DemoStateProvider>{children}</DemoStateProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
