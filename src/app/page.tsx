"use client";

import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { authUrl, merchantUrl } from "@/lib/appConfig";
import { useLanguage } from "@/lib/i18n";

export default function Home() {
  const { t } = useLanguage();

  return (
    <div className="bg-surface text-on-surface font-sans antialiased overflow-x-hidden min-h-dvh flex flex-col">
      {/* TopAppBar */}
      <nav className="bg-surface dark:bg-surface w-full top-0 sticky border-b border-secondary-container dark:border-outline-variant max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop flex justify-between items-center h-20 z-50">
        <div className="w-1/3 flex items-center justify-start">
        </div>
        <div className="w-1/3 flex items-center justify-center">
          <Logo maxWidth={150} imgClassName="h-auto w-[120px] object-contain md:w-[150px]" />
        </div>
        <div className="w-1/3 flex items-center justify-end gap-4">
          <Link
            className="hidden md:inline-flex text-label-md text-primary dark:text-on-surface hover:bg-surface-container-low transition-all duration-300 ease-out cursor-pointer active:scale-[0.98] px-4 py-2 rounded-full"
            href={`${authUrl}/login`}
          >
            {t("landing.navLogin")}
          </Link>
        </div>
      </nav>

      <main className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop pb-8 flex-1">
        {/* 1. Hero Section */}
        <section className="py-12 md:py-24 flex flex-col items-center text-center relative">
          <div className="absolute top-10 left-4 md:left-20 opacity-50">
            <div className="absolute -top-10 left-10 opacity-60 rotate-[-8deg]">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary/10 to-transparent backdrop-blur-sm border border-outline-variant/30 animate-float"></div>
            </div>
          </div>
          <div className="absolute bottom-10 right-4 md:right-20 opacity-50">
            <div className="absolute top-10 right-10 opacity-60 rotate-[12deg]">
              <div className="w-20 h-20 rounded-full bg-gradient-to-bl from-primary/5 to-transparent backdrop-blur-sm border border-outline-variant/20 animate-float-delayed"></div>
            </div>
          </div>

          <h1 className="text-headline-lg-mobile md:text-display text-primary max-w-4xl mb-6 animate-fade-in-up">
            {t("landing.heroTitle")}
          </h1>
          <p className="text-body-lg text-on-surface-variant max-w-2xl mb-10 animate-fade-in-up delay-100">
            {t("landing.heroDescription")}
          </p>
          <div className="flex flex-col w-full md:w-auto md:flex-row gap-4 mb-8 animate-fade-in-up delay-200">
            <Link
              href={`${authUrl}/login`}
              className="w-full md:w-auto bg-primary text-on-primary text-label-md px-8 py-4 rounded-full text-center hover:opacity-90 transition-opacity active:scale-[0.98] shadow-lg shadow-primary/20"
            >
              {t("landing.heroCtaLogin")}
            </Link>
            <Link
              href={`${merchantUrl}/merchant/login`}
              className="w-full md:w-auto bg-surface text-primary border border-secondary-container text-label-md px-8 py-4 rounded-full text-center hover:bg-surface-container-low transition-colors active:scale-[0.98]"
            >
              {t("landing.heroCtaPartner")}
            </Link>
          </div>
          
          <div className="mt-16 w-full max-w-4xl relative rounded-2xl overflow-hidden border border-secondary-container bg-surface-container-lowest aspect-[1.8] animate-fade-in-up delay-300 shadow-2xl group flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10"></div>
             <img
              alt="Students enjoying food together, representing the Cadesca app usage."
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"
            />
          </div>
        </section>

        {/* 2. Why Cadesca? */}
        <section className="py-16 md:py-24 relative border-t border-secondary-container">
          <div className="absolute left-0 top-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10"></div>
          <h2 className="text-headline-lg text-primary mb-16 text-center animate-fade-in-up">{t("landing.whyCadesca")}</h2>
          
          <div className="flex flex-col gap-20">
            {/* For Students */}
            <div>
              <div className="flex items-center justify-center gap-3 mb-10 animate-fade-in-up">
                 <span className="material-symbols-outlined text-[32px] text-primary" data-icon="school">school</span>
                 <h3 className="text-headline-md text-primary font-bold">{t("landing.forStudents")}</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-surface border border-secondary-container rounded-2xl p-8 flex flex-col items-start hover:bg-surface-container-low transition-all duration-300 hover:-translate-y-1 hover:shadow-lg animate-fade-in-up delay-100">
                  <div className="bg-primary/10 w-14 h-14 rounded-full flex items-center justify-center mb-6 text-primary group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[28px]" data-icon="smartphone">smartphone</span>
                  </div>
                  <h4 className="text-body-lg font-bold text-primary mb-3">{t("landing.pocketCafeteria")}</h4>
                  <p className="text-body-md text-on-surface-variant leading-relaxed">
                    {t("landing.pocketCafeteriaDesc")}
                  </p>
                </div>
                <div className="bg-surface border border-secondary-container rounded-2xl p-8 flex flex-col items-start hover:bg-surface-container-low transition-all duration-300 hover:-translate-y-1 hover:shadow-lg animate-fade-in-up delay-200">
                  <div className="bg-primary/10 w-14 h-14 rounded-full flex items-center justify-center mb-6 text-primary group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[28px]" data-icon="account_balance_wallet">account_balance_wallet</span>
                  </div>
                  <h4 className="text-body-lg font-bold text-primary mb-3">{t("landing.budgetControl")}</h4>
                  <p className="text-body-md text-on-surface-variant leading-relaxed">
                    {t("landing.budgetControlDesc")}
                  </p>
                </div>
                <div className="bg-surface border border-secondary-container rounded-2xl p-8 flex flex-col items-start hover:bg-surface-container-low transition-all duration-300 hover:-translate-y-1 hover:shadow-lg animate-fade-in-up delay-300">
                  <div className="bg-primary/10 w-14 h-14 rounded-full flex items-center justify-center mb-6 text-primary group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[28px]" data-icon="restaurant_menu">restaurant_menu</span>
                  </div>
                  <h4 className="text-body-lg font-bold text-primary mb-3">{t("landing.personalMenus")}</h4>
                  <p className="text-body-md text-on-surface-variant leading-relaxed">
                    {t("landing.personalMenusDesc")}
                  </p>
                </div>
              </div>
            </div>

            {/* For Universities & Cafeterias */}
            <div>
              <div className="flex items-center justify-center gap-3 mb-10 animate-fade-in-up">
                 <span className="material-symbols-outlined text-[32px] text-primary" data-icon="storefront">storefront</span>
                 <h3 className="text-headline-md text-primary font-bold">{t("landing.forUniversities")}</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                <div className="bg-surface-container-low border border-secondary-container rounded-2xl p-8 flex flex-col items-start hover:bg-surface-container transition-all duration-300 hover:-translate-y-1 hover:shadow-lg animate-fade-in-up delay-100">
                  <div className="bg-primary text-on-primary w-14 h-14 rounded-xl shadow-md flex items-center justify-center mb-6 transform -rotate-3 group-hover:rotate-0 transition-transform">
                    <span className="material-symbols-outlined text-[28px]" data-icon="bolt">bolt</span>
                  </div>
                  <h4 className="text-body-lg font-bold text-primary mb-3">{t("landing.fastService")}</h4>
                  <p className="text-body-md text-on-surface-variant leading-relaxed">
                    {t("landing.fastServiceDesc")}
                  </p>
                </div>
                <div className="bg-surface-container-low border border-secondary-container rounded-2xl p-8 flex flex-col items-start hover:bg-surface-container transition-all duration-300 hover:-translate-y-1 hover:shadow-lg animate-fade-in-up delay-200">
                  <div className="bg-primary text-on-primary w-14 h-14 rounded-xl shadow-md flex items-center justify-center mb-6 transform rotate-3 group-hover:rotate-0 transition-transform">
                    <span className="material-symbols-outlined text-[28px]" data-icon="monitoring">monitoring</span>
                  </div>
                  <h4 className="text-body-lg font-bold text-primary mb-3">{t("landing.transparentTracking")}</h4>
                  <p className="text-body-md text-on-surface-variant leading-relaxed">
                    {t("landing.transparentTrackingDesc")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. How It Works */}
        <section className="py-16 md:py-24 border-t border-secondary-container relative overflow-hidden bg-surface-container-lowest rounded-3xl mb-8">
           <div className="absolute right-[-10%] top-0 w-[40%] h-full bg-gradient-to-l from-surface-container-low to-transparent -z-10 skew-x-[-10deg]"></div>
           <h2 className="text-headline-lg text-primary mb-16 text-center animate-fade-in-up">{t("landing.howItWorks")}</h2>
           
           <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-center items-center gap-8 md:gap-12 relative px-4">
              {/* Connecting line for desktop */}
              <div className="hidden md:block absolute top-1/2 left-10 right-10 h-[2px] bg-secondary-container -z-10 -translate-y-1/2"></div>
              
              {/* Step 1 */}
              <div className="flex flex-col items-center text-center w-full md:w-1/3 bg-surface p-6 rounded-2xl shadow-sm border border-secondary-container/50 relative z-10 animate-fade-in-up delay-100">
                 <div className="w-16 h-16 rounded-full bg-primary text-on-primary flex items-center justify-center text-headline-md font-bold mb-6 shadow-lg shadow-primary/20 ring-8 ring-surface">
                    1
                 </div>
                 <h3 className="text-body-lg font-bold text-primary mb-3">{t("landing.step1Title")}</h3>
                 <p className="text-body-md text-on-surface-variant">
                    {t("landing.step1Desc")}
                 </p>
              </div>

              {/* Step 2 */}
              <div className="flex flex-col items-center text-center w-full md:w-1/3 bg-surface p-6 rounded-2xl shadow-sm border border-secondary-container/50 relative z-10 animate-fade-in-up delay-200">
                 <div className="w-16 h-16 rounded-full bg-primary text-on-primary flex items-center justify-center text-headline-md font-bold mb-6 shadow-lg shadow-primary/20 ring-8 ring-surface">
                    2
                 </div>
                 <h3 className="text-body-lg font-bold text-primary mb-3">{t("landing.step2Title")}</h3>
                 <p className="text-body-md text-on-surface-variant">
                    {t("landing.step2Desc")}
                 </p>
              </div>

              {/* Step 3 */}
              <div className="flex flex-col items-center text-center w-full md:w-1/3 bg-surface p-6 rounded-2xl shadow-sm border border-secondary-container/50 relative z-10 animate-fade-in-up delay-300">
                 <div className="w-16 h-16 rounded-full bg-primary text-on-primary flex items-center justify-center text-headline-md font-bold mb-6 shadow-lg shadow-primary/20 ring-8 ring-surface">
                    3
                 </div>
                 <h3 className="text-body-lg font-bold text-primary mb-3">{t("landing.step3Title")}</h3>
                 <p className="text-body-md text-on-surface-variant">
                    {t("landing.step3Desc")}
                 </p>
              </div>
           </div>
        </section>

        {/* 4. Coming Soon — For Companies */}
        <section className="py-16 md:py-24 relative overflow-hidden">
           <div className="max-w-4xl mx-auto bg-primary text-on-primary rounded-[2.5rem] p-10 md:p-16 text-center relative shadow-2xl overflow-hidden animate-fade-in-up">
              {/* Background decors */}
              <div className="absolute -top-24 -left-24 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
              <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
              
              <div className="inline-flex items-center gap-2 bg-on-primary/10 px-4 py-2 rounded-full text-sm font-medium mb-6 backdrop-blur-md border border-on-primary/20">
                 <span className="material-symbols-outlined text-[18px]" data-icon="rocket_launch">rocket_launch</span>
                 {t("landing.comingSoon")}
              </div>
              
              <h2 className="text-headline-lg-mobile md:text-headline-lg font-bold mb-6 relative z-10">
                 {t("landing.forCompanies")}
              </h2>
              <p className="text-body-lg text-on-primary/90 leading-relaxed max-w-2xl mx-auto relative z-10">
                 {t("landing.forCompaniesDesc")}
              </p>
           </div>
        </section>

      </main>

      {/* 5. Footer */}
      <footer className="bg-surface border-t border-secondary-container py-12">
         <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex flex-col items-center md:items-start text-center md:text-left">
               <Logo maxWidth={120} imgClassName="h-auto w-[100px] object-contain mb-4" />
               <p className="text-body-md text-on-surface-variant max-w-md">
                  {t("landing.footerDescription")}
               </p>
            </div>
            
            <div className="flex flex-col items-center md:items-end gap-3">
               <h3 className="text-body-lg font-bold text-primary mb-1">{t("landing.contactUs")}</h3>
               <a href="mailto:hello@cadesca.com" className="text-body-md text-secondary hover:text-primary transition-colors flex items-center gap-2 hover:underline">
                  <span className="material-symbols-outlined text-[20px]" data-icon="mail">mail</span>
                  hello@cadesca.com
               </a>
               <div className="flex items-center gap-4 mt-2">
                 <a href="https://instagram.com/cadescacom" target="_blank" rel="noopener noreferrer" className="text-secondary hover:text-primary transition-colors" aria-label="Instagram">
                   <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
                 </a>
                 <a href="https://tiktok.com/@cadescacom" target="_blank" rel="noopener noreferrer" className="text-secondary hover:text-primary transition-colors" aria-label="TikTok">
                   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.12-3.44-3.17-3.61-5.46-.22-2.39.81-4.78 2.72-6.17 1.48-1.07 3.3-1.4 5.09-1.04 0 1.41.01 2.82 0 4.23-1.1-.18-2.26-.06-3.21.57-.93.63-1.51 1.69-1.5 2.8-.02 1.25.75 2.45 1.88 3.04 1.15.58 2.58.55 3.7-.09.91-.53 1.51-1.47 1.57-2.52.06-4.66.02-9.33.04-13.99Z"/></svg>
                 </a>
               </div>
            </div>
         </div>
      </footer>
    </div>
  );
}
