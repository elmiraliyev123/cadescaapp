"use client";

import Image from "next/image";
import { useActionState } from "react";

import {
  updateApprovedClubProfileAction,
  type ClubProfileActionMessage,
  type ClubProfileActionState
} from "@/app/app/club/actions";
import { eventInput, eventPrimaryButton } from "@/components/events/EventPrimitives";
import type { ClubDashboard } from "@/lib/events/types";
import { useLanguage, type Language } from "@/lib/i18n";

type EditableClubProfile = Pick<
  ClubDashboard["club"],
  | "id"
  | "name"
  | "description"
  | "logoUrl"
  | "contactEmail"
  | "websiteUrl"
  | "instagramUrl"
  | "universityPageUrl"
  | "updatedAt"
>;

type ProfileCopy = {
  title: string;
  description: string;
  publicFieldsNote: string;
  clubDescription: string;
  contactEmail: string;
  website: string;
  instagram: string;
  universityPage: string;
  logo: string;
  logoHelp: string;
  currentLogoAlt: string;
  optional: string;
  save: string;
  saving: string;
  messages: Record<Exclude<ClubProfileActionMessage, "">, string>;
};

const PROFILE_COPY: Record<Language, ProfileCopy> = {
  en: {
    title: "Public club profile",
    description: "Keep the public details students see with your events up to date.",
    publicFieldsNote: "Club name, official email, university, approval, and member permissions remain review-controlled.",
    clubDescription: "Club description",
    contactEmail: "Public contact email",
    website: "Website",
    instagram: "Instagram",
    universityPage: "Official university page",
    logo: "Replace club logo",
    logoHelp: "Optional JPG, PNG, or WebP, up to 4 MB. Every new logo is safety-checked before publishing.",
    currentLogoAlt: "Current logo for {name}",
    optional: "Optional",
    save: "Save public profile",
    saving: "Saving…",
    messages: {
      updated: "The public club profile was updated.",
      invalid: "Check the profile details and upload a valid logo.",
      access_denied: "Only an active owner of an approved club can update this profile.",
      not_editable: "This club profile cannot be edited while its approval is inactive.",
      upload_failed: "The logo could not be stored. Try again shortly.",
      failed: "The club profile could not be updated. Try again."
    }
  },
  az: {
    title: "Klubun ictimai profili",
    description: "Tələbələrin tədbirlərinizlə birlikdə gördüyü ictimai məlumatları aktual saxlayın.",
    publicFieldsNote: "Klubun adı, rəsmi e-poçtu, universiteti, təsdiq statusu və üzv icazələri yoxlama komandası tərəfindən idarə olunur.",
    clubDescription: "Klub haqqında",
    contactEmail: "İctimai əlaqə e-poçtu",
    website: "Veb-sayt",
    instagram: "Instagram",
    universityPage: "Universitetin rəsmi səhifəsi",
    logo: "Klub loqosunu dəyiş",
    logoHelp: "İstəyə bağlı JPG, PNG və ya WebP, maksimum 4 MB. Hər yeni loqo dərc edilməzdən əvvəl təhlükəsizlik yoxlamasından keçir.",
    currentLogoAlt: "{name} klubunun cari loqosu",
    optional: "İstəyə bağlı",
    save: "İctimai profili saxla",
    saving: "Saxlanılır…",
    messages: {
      updated: "Klubun ictimai profili yeniləndi.",
      invalid: "Profil məlumatlarını yoxlayın və etibarlı loqo yükləyin.",
      access_denied: "Bu profili yalnız təsdiqlənmiş klubun aktiv sahibi yeniləyə bilər.",
      not_editable: "Təsdiqi aktiv olmayan klubun profili redaktə edilə bilməz.",
      upload_failed: "Loqo saxlanılmadı. Bir az sonra yenidən cəhd edin.",
      failed: "Klub profili yenilənmədi. Yenidən cəhd edin."
    }
  },
  tr: {
    title: "Herkese açık kulüp profili",
    description: "Öğrencilerin etkinliklerinle birlikte gördüğü herkese açık bilgileri güncel tut.",
    publicFieldsNote: "Kulüp adı, resmî e-posta, üniversite, onay durumu ve üye izinleri inceleme ekibinin kontrolünde kalır.",
    clubDescription: "Kulüp açıklaması",
    contactEmail: "Herkese açık iletişim e-postası",
    website: "Web sitesi",
    instagram: "Instagram",
    universityPage: "Resmî üniversite sayfası",
    logo: "Kulüp logosunu değiştir",
    logoHelp: "İsteğe bağlı JPG, PNG veya WebP, en fazla 4 MB. Her yeni logo yayımlanmadan önce güvenlik kontrolünden geçer.",
    currentLogoAlt: "{name} kulübünün mevcut logosu",
    optional: "İsteğe bağlı",
    save: "Herkese açık profili kaydet",
    saving: "Kaydediliyor…",
    messages: {
      updated: "Herkese açık kulüp profili güncellendi.",
      invalid: "Profil bilgilerini kontrol et ve geçerli bir logo yükle.",
      access_denied: "Bu profili yalnızca onaylı kulübün aktif sahibi güncelleyebilir.",
      not_editable: "Onayı etkin olmayan kulübün profili düzenlenemez.",
      upload_failed: "Logo kaydedilemedi. Kısa süre sonra tekrar dene.",
      failed: "Kulüp profili güncellenemedi. Tekrar dene."
    }
  },
  ru: {
    title: "Публичный профиль клуба",
    description: "Поддерживайте в актуальном состоянии данные, которые студенты видят рядом с вашими событиями.",
    publicFieldsNote: "Название клуба, официальная почта, университет, статус одобрения и права участников изменяются только через проверку.",
    clubDescription: "Описание клуба",
    contactEmail: "Публичная контактная почта",
    website: "Сайт",
    instagram: "Instagram",
    universityPage: "Официальная страница университета",
    logo: "Заменить логотип клуба",
    logoHelp: "Необязательный JPG, PNG или WebP до 4 МБ. Перед публикацией каждый новый логотип проходит проверку безопасности.",
    currentLogoAlt: "Текущий логотип клуба {name}",
    optional: "Необязательно",
    save: "Сохранить публичный профиль",
    saving: "Сохранение…",
    messages: {
      updated: "Публичный профиль клуба обновлён.",
      invalid: "Проверьте данные профиля и загрузите допустимый логотип.",
      access_denied: "Обновлять этот профиль может только активный владелец одобренного клуба.",
      not_editable: "Профиль нельзя редактировать, пока одобрение клуба неактивно.",
      upload_failed: "Не удалось сохранить логотип. Повторите попытку позже.",
      failed: "Не удалось обновить профиль клуба. Повторите попытку."
    }
  }
};

const INITIAL_STATE: ClubProfileActionState = { ok: false, message: "" };

function ProfileField({
  label,
  optional,
  children,
  className = ""
}: {
  label: string;
  optional?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] font-black uppercase tracking-[0.08em] text-black/60">
        <span>{label}</span>
        {optional ? <span className="normal-case tracking-normal text-black/45">{optional}</span> : null}
      </span>
      {children}
    </label>
  );
}

export function ApprovedClubProfileForm({ club }: { club: EditableClubProfile }) {
  const { language } = useLanguage();
  const copy = PROFILE_COPY[language];
  const [state, formAction, pending] = useActionState(updateApprovedClubProfileAction, INITIAL_STATE);
  const logoUrl = club.logoUrl
    ? `${club.logoUrl}${club.logoUrl.includes("?") ? "&" : "?"}v=${encodeURIComponent(club.updatedAt)}`
    : null;
  const logoHelpId = `club-logo-help-${club.id}`;

  return (
    <section className="mb-9 rounded-2xl border-2 border-black bg-white p-4 shadow-[4px_4px_0_#ffd400] sm:p-5">
      <div className="flex min-w-0 flex-wrap items-start gap-4">
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt={copy.currentLogoAlt.replace("{name}", club.name)}
            width={72}
            height={72}
            unoptimized
            className="h-[72px] w-[72px] shrink-0 rounded-xl border-2 border-black object-cover"
          />
        ) : (
          <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-black bg-[#fff5c2]" aria-hidden="true">
            <span className="material-symbols-outlined text-[34px]">groups</span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="break-words text-[22px] font-black">{copy.title}</h2>
          <p className="mt-1 max-w-2xl text-[14px] leading-6 text-black/65">{copy.description}</p>
          <p className="mt-2 max-w-2xl text-[12px] font-bold leading-5 text-black/55">{copy.publicFieldsNote}</p>
        </div>
      </div>

      <form action={formAction} className="mt-5">
        <input type="hidden" name="clubId" value={club.id} />
        <fieldset disabled={pending} aria-label={copy.title} className="grid gap-4 sm:grid-cols-2 disabled:opacity-70">
          <ProfileField label={copy.contactEmail}>
            <input name="contactEmail" type="email" required maxLength={254} autoComplete="email" defaultValue={club.contactEmail} className={eventInput} />
          </ProfileField>
          <ProfileField label={copy.website} optional={copy.optional}>
            <input name="websiteUrl" type="url" maxLength={2048} inputMode="url" autoComplete="url" defaultValue={club.websiteUrl || ""} className={eventInput} />
          </ProfileField>
          <ProfileField label={copy.instagram} optional={copy.optional}>
            <input name="instagramUrl" type="url" maxLength={2048} inputMode="url" defaultValue={club.instagramUrl || ""} className={eventInput} />
          </ProfileField>
          <ProfileField label={copy.universityPage} optional={copy.optional}>
            <input name="universityPageUrl" type="url" maxLength={2048} inputMode="url" defaultValue={club.universityPageUrl || ""} className={eventInput} />
          </ProfileField>
          <ProfileField label={copy.clubDescription} className="sm:col-span-2">
            <textarea name="description" required minLength={20} maxLength={4000} rows={6} defaultValue={club.description} className={`${eventInput} resize-y`} />
          </ProfileField>
          <ProfileField label={copy.logo} optional={copy.optional}>
            <input name="logo" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby={logoHelpId} className="block min-h-11 w-full rounded-xl border border-black/25 bg-white px-3.5 py-2 text-[13px] file:mr-3 file:rounded-lg file:border file:border-black file:bg-[#fff5c2] file:px-3 file:py-1.5 file:text-[12px] file:font-black" />
            <span id={logoHelpId} className="mt-1.5 block text-[11px] font-semibold leading-4 text-black/50">{copy.logoHelp}</span>
          </ProfileField>
        </fieldset>
        <button type="submit" disabled={pending} className={`${eventPrimaryButton} mt-5 w-full sm:w-auto`}>
          <span>{pending ? copy.saving : copy.save}</span>
        </button>
      </form>

      {state.message ? (
        <p
          role={state.ok ? "status" : "alert"}
          className={`mt-4 rounded-xl border border-black px-3 py-2 text-[13px] font-bold ${state.ok ? "bg-[#fff5c2] text-black" : "bg-black text-white"}`}
        >
          {copy.messages[state.message]}
        </p>
      ) : null}
    </section>
  );
}
