"use client";

import { useActionState } from "react";

import { ScreenHeader } from "@/components/screens/ScreenHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { AdminClubApplication, ClubApplicationStatus } from "@/lib/server/studentClubs";
import { useLanguage, type Language } from "@/lib/i18n";

type AdminMutationState = {
  ok: boolean;
  action?: "approve" | "request_clarification" | "reject" | "suspend" | "reactivate";
  error: "" | "invalid" | "conflict" | "authentication_required" | "failed";
};

type AdminAction = (previousState: AdminMutationState, formData: FormData) => Promise<AdminMutationState>;

type Copy = {
  title: string;
  description: string;
  awaitingReview: string;
  representative: string;
  submitted: string;
  clubEmail: string;
  representativeEmail: string;
  clubDescription: string;
  website: string;
  instagram: string;
  universityPage: string;
  recognitionDocument: string;
  opensNewTab: string;
  applicantNote: string;
  latestResponse: string;
  approveClub: string;
  decisionNote: string;
  decisionNoteHint: string;
  decisionNotePlaceholder: string;
  requestClarification: string;
  rejectClub: string;
  savingDecision: string;
  reviewError: string;
  invalidAction: string;
  conflictAction: string;
  authenticationRequired: string;
  clubApproved: string;
  clarificationRequested: string;
  clubRejected: string;
  suspensionReason: string;
  suspensionReasonHint: string;
  suspensionReasonPlaceholder: string;
  suspendClub: string;
  reactivateClub: string;
  savingStatus: string;
  statusError: string;
  clubSuspended: string;
  clubReactivated: string;
  noLogo: string;
  logoAlt: string;
  noApplications: string;
  noApplicationsBody: string;
  status: Record<ClubApplicationStatus, string>;
};

const COPY: Record<Language, Copy> = {
  en: {
    title: "Club applications",
    description: "Review official university recognition materials. Approval activates only the applicant’s individual club-owner membership.",
    awaitingReview: "Awaiting review",
    representative: "Representative",
    submitted: "Submitted",
    clubEmail: "Club email",
    representativeEmail: "Representative email",
    clubDescription: "Description",
    website: "Website",
    instagram: "Instagram",
    universityPage: "University page",
    recognitionDocument: "Recognition document",
    opensNewTab: "opens in a new tab",
    applicantNote: "Applicant note",
    latestResponse: "Latest representative response",
    approveClub: "Approve club",
    decisionNote: "Decision note",
    decisionNoteHint: "Required when requesting more information or rejecting an application.",
    decisionNotePlaceholder: "Explain what the representative should clarify or why the application cannot be approved.",
    requestClarification: "Request more information",
    rejectClub: "Reject application",
    savingDecision: "Saving decision…",
    reviewError: "We couldn’t save this review decision. Refresh the page and try again.",
    invalidAction: "Complete the required note and check the action before trying again.",
    conflictAction: "This application changed after the page loaded. Refresh to review its current status.",
    authenticationRequired: "Your admin session expired. Sign in again, then retry the action.",
    clubApproved: "The club was approved.",
    clarificationRequested: "The request for more information was sent.",
    clubRejected: "The application was rejected.",
    suspensionReason: "Suspension reason",
    suspensionReasonHint: "Tell the club why access is being suspended.",
    suspensionReasonPlaceholder: "Describe the policy or verification issue that requires suspension.",
    suspendClub: "Suspend club",
    reactivateClub: "Reactivate club",
    savingStatus: "Updating status…",
    statusError: "We couldn’t update the club’s status. Refresh the page and try again.",
    clubSuspended: "The club was suspended.",
    clubReactivated: "The club was reactivated.",
    noLogo: "No logo preview",
    logoAlt: "{name} club logo",
    noApplications: "No club applications",
    noApplicationsBody: "New verified submissions will appear here.",
    status: {
      pending_review: "Pending review",
      clarification_requested: "More information requested",
      approved: "Approved",
      rejected: "Rejected",
      suspended: "Suspended",
      archived: "Archived"
    }
  },
  az: {
    title: "Klub müraciətləri",
    description: "Universitetin rəsmi tanınma materiallarını yoxlayın. Təsdiq yalnız müraciətçinin fərdi klub sahibi üzvlüyünü aktivləşdirir.",
    awaitingReview: "Yoxlama gözləyir",
    representative: "Nümayəndə",
    submitted: "Göndərilib",
    clubEmail: "Klubun e-poçtu",
    representativeEmail: "Nümayəndənin e-poçtu",
    clubDescription: "Təsvir",
    website: "Veb-sayt",
    instagram: "Instagram",
    universityPage: "Universitet səhifəsi",
    recognitionDocument: "Tanınma sənədi",
    opensNewTab: "yeni pəncərədə açılır",
    applicantNote: "Müraciətçinin qeydi",
    latestResponse: "Nümayəndənin son cavabı",
    approveClub: "Klubu təsdiqlə",
    decisionNote: "Qərar qeydi",
    decisionNoteHint: "Əlavə məlumat istəyərkən və ya müraciəti rədd edərkən tələb olunur.",
    decisionNotePlaceholder: "Nümayəndənin nəyi dəqiqləşdirməli olduğunu və ya müraciətin niyə təsdiqlənmədiyini izah edin.",
    requestClarification: "Əlavə məlumat istə",
    rejectClub: "Müraciəti rədd et",
    savingDecision: "Qərar saxlanılır…",
    reviewError: "Yoxlama qərarını saxlamaq mümkün olmadı. Səhifəni yeniləyib təkrar cəhd edin.",
    invalidAction: "Tələb olunan qeydi doldurun, əməliyyatı yoxlayın və yenidən cəhd edin.",
    conflictAction: "Səhifə açıldıqdan sonra müraciət dəyişib. Cari statusu görmək üçün səhifəni yeniləyin.",
    authenticationRequired: "Admin sessiyanız bitib. Yenidən daxil olun və əməliyyatı təkrarlayın.",
    clubApproved: "Klub təsdiqləndi.",
    clarificationRequested: "Əlavə məlumat sorğusu göndərildi.",
    clubRejected: "Müraciət rədd edildi.",
    suspensionReason: "Dayandırma səbəbi",
    suspensionReasonHint: "Girişin niyə dayandırıldığını kluba bildirin.",
    suspensionReasonPlaceholder: "Fəaliyyətin dayandırılmasını tələb edən qayda və ya təsdiq problemini təsvir edin.",
    suspendClub: "Klubun fəaliyyətini dayandır",
    reactivateClub: "Klubu yenidən aktivləşdir",
    savingStatus: "Status yenilənir…",
    statusError: "Klubun statusunu yeniləmək mümkün olmadı. Səhifəni yeniləyib təkrar cəhd edin.",
    clubSuspended: "Klubun fəaliyyəti dayandırıldı.",
    clubReactivated: "Klub yenidən aktivləşdirildi.",
    noLogo: "Loqo önbaxışı yoxdur",
    logoAlt: "{name} klubunun loqosu",
    noApplications: "Klub müraciəti yoxdur",
    noApplicationsBody: "Yeni təsdiqlənmiş müraciətlər burada görünəcək.",
    status: {
      pending_review: "Yoxlanılır",
      clarification_requested: "Əlavə məlumat tələb olunur",
      approved: "Təsdiqlənib",
      rejected: "Rədd edilib",
      suspended: "Dayandırılıb",
      archived: "Arxivlənib"
    }
  },
  tr: {
    title: "Kulüp başvuruları",
    description: "Üniversitenin resmî tanınma belgelerini inceleyin. Onay yalnızca başvuru sahibinin bireysel kulüp sahibi üyeliğini etkinleştirir.",
    awaitingReview: "İnceleme bekliyor",
    representative: "Temsilci",
    submitted: "Gönderildi",
    clubEmail: "Kulüp e-postası",
    representativeEmail: "Temsilci e-postası",
    clubDescription: "Açıklama",
    website: "Web sitesi",
    instagram: "Instagram",
    universityPage: "Üniversite sayfası",
    recognitionDocument: "Tanınma belgesi",
    opensNewTab: "yeni sekmede açılır",
    applicantNote: "Başvuru sahibi notu",
    latestResponse: "Temsilcinin son yanıtı",
    approveClub: "Kulübü onayla",
    decisionNote: "Karar notu",
    decisionNoteHint: "Ek bilgi isterken veya başvuruyu reddederken zorunludur.",
    decisionNotePlaceholder: "Temsilcinin neyi açıklaması gerektiğini veya başvurunun neden onaylanamadığını belirtin.",
    requestClarification: "Ek bilgi iste",
    rejectClub: "Başvuruyu reddet",
    savingDecision: "Karar kaydediliyor…",
    reviewError: "İnceleme kararı kaydedilemedi. Sayfayı yenileyip tekrar deneyin.",
    invalidAction: "Zorunlu notu doldurun, işlemi kontrol edin ve yeniden deneyin.",
    conflictAction: "Başvuru sayfa açıldıktan sonra değişti. Güncel durumu görmek için sayfayı yenileyin.",
    authenticationRequired: "Yönetici oturumunuz sona erdi. Yeniden giriş yapıp işlemi tekrar deneyin.",
    clubApproved: "Kulüp onaylandı.",
    clarificationRequested: "Ek bilgi isteği gönderildi.",
    clubRejected: "Başvuru reddedildi.",
    suspensionReason: "Askıya alma nedeni",
    suspensionReasonHint: "Erişimin neden askıya alındığını kulübe bildirin.",
    suspensionReasonPlaceholder: "Askıya almayı gerektiren kural veya doğrulama sorununu açıklayın.",
    suspendClub: "Kulübü askıya al",
    reactivateClub: "Kulübü yeniden etkinleştir",
    savingStatus: "Durum güncelleniyor…",
    statusError: "Kulüp durumu güncellenemedi. Sayfayı yenileyip tekrar deneyin.",
    clubSuspended: "Kulüp askıya alındı.",
    clubReactivated: "Kulüp yeniden etkinleştirildi.",
    noLogo: "Logo önizlemesi yok",
    logoAlt: "{name} kulüp logosu",
    noApplications: "Kulüp başvurusu yok",
    noApplicationsBody: "Yeni doğrulanmış başvurular burada görünecek.",
    status: {
      pending_review: "İncelemede",
      clarification_requested: "Ek bilgi istendi",
      approved: "Onaylandı",
      rejected: "Reddedildi",
      suspended: "Askıya alındı",
      archived: "Arşivlendi"
    }
  },
  ru: {
    title: "Заявки студенческих клубов",
    description: "Проверьте официальные материалы о признании клубов университетом. Одобрение активирует только личное членство заявителя с ролью владельца клуба.",
    awaitingReview: "Ожидают проверки",
    representative: "Представитель",
    submitted: "Отправлено",
    clubEmail: "Эл. почта клуба",
    representativeEmail: "Эл. почта представителя",
    clubDescription: "Описание",
    website: "Сайт",
    instagram: "Instagram",
    universityPage: "Страница университета",
    recognitionDocument: "Документ о признании",
    opensNewTab: "откроется в новой вкладке",
    applicantNote: "Примечание заявителя",
    latestResponse: "Последний ответ представителя",
    approveClub: "Одобрить клуб",
    decisionNote: "Комментарий к решению",
    decisionNoteHint: "Обязателен при запросе дополнительных сведений или отклонении заявки.",
    decisionNotePlaceholder: "Укажите, что представителю нужно уточнить или почему заявку нельзя одобрить.",
    requestClarification: "Запросить сведения",
    rejectClub: "Отклонить заявку",
    savingDecision: "Решение сохраняется…",
    reviewError: "Не удалось сохранить решение. Обновите страницу и повторите попытку.",
    invalidAction: "Заполните обязательный комментарий, проверьте действие и повторите попытку.",
    conflictAction: "Заявка изменилась после загрузки страницы. Обновите страницу, чтобы увидеть текущий статус.",
    authenticationRequired: "Сеанс администратора истёк. Войдите снова и повторите действие.",
    clubApproved: "Клуб одобрен.",
    clarificationRequested: "Запрос дополнительных сведений отправлен.",
    clubRejected: "Заявка отклонена.",
    suspensionReason: "Причина приостановки",
    suspensionReasonHint: "Сообщите клубу, почему доступ приостанавливается.",
    suspensionReasonPlaceholder: "Опишите нарушение правил или проблему с проверкой, из-за которой требуется приостановка.",
    suspendClub: "Приостановить клуб",
    reactivateClub: "Возобновить работу клуба",
    savingStatus: "Статус обновляется…",
    statusError: "Не удалось обновить статус клуба. Обновите страницу и повторите попытку.",
    clubSuspended: "Работа клуба приостановлена.",
    clubReactivated: "Работа клуба возобновлена.",
    noLogo: "Предпросмотр логотипа недоступен",
    logoAlt: "Логотип клуба {name}",
    noApplications: "Заявок от клубов пока нет",
    noApplicationsBody: "Новые проверенные заявки появятся здесь.",
    status: {
      pending_review: "На рассмотрении",
      clarification_requested: "Запрошены дополнительные сведения",
      approved: "Одобрено",
      rejected: "Отклонено",
      suspended: "Приостановлено",
      archived: "В архиве"
    }
  }
};

const INITIAL_MUTATION_STATE: AdminMutationState = { ok: false, error: "" };

function formatDate(value: string, language: Language) {
  const locale = language === "az" ? "az-AZ" : language === "tr" ? "tr-TR" : language === "ru" ? "ru-RU" : "en-US";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function replaceName(template: string, name: string) {
  return template.replace("{name}", name);
}

function statusTone(status: ClubApplicationStatus): "success" | "muted" | "warning" {
  if (status === "approved") return "success";
  if (status === "rejected" || status === "suspended" || status === "archived") return "muted";
  return "warning";
}

function feedbackClass(success: boolean) {
  return success
    ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-body-sm font-medium text-emerald-950"
    : "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-body-sm font-medium text-red-950";
}

function mutationError(copy: Copy, state: AdminMutationState, fallback: string) {
  if (state.error === "invalid") return copy.invalidAction;
  if (state.error === "conflict") return copy.conflictAction;
  if (state.error === "authentication_required") return copy.authenticationRequired;
  return fallback;
}

function ApplicationCard({
  application,
  language,
  copy,
  reviewApplicationAction,
  moderateStatusAction
}: {
  application: AdminClubApplication;
  language: Language;
  copy: Copy;
  reviewApplicationAction: AdminAction;
  moderateStatusAction: AdminAction;
}) {
  const [reviewFeedback, reviewFormAction, reviewPending] = useActionState(reviewApplicationAction, INITIAL_MUTATION_STATE);
  const [statusFeedback, statusFormAction, statusPending] = useActionState(moderateStatusAction, INITIAL_MUTATION_STATE);
  const reviewable = application.status === "pending_review" || application.status === "clarification_requested";
  const noteId = `club-decision-note-${application.id}`;
  const noteHintId = `${noteId}-hint`;
  const suspensionId = `club-suspension-reason-${application.id}`;
  const suspensionHintId = `${suspensionId}-hint`;

  const reviewSuccess = reviewFeedback.action === "approve"
    ? copy.clubApproved
    : reviewFeedback.action === "request_clarification"
      ? copy.clarificationRequested
      : copy.clubRejected;
  const statusSuccess = statusFeedback.action === "suspend" ? copy.clubSuspended : copy.clubReactivated;

  return (
    <article className="premium-card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-outline-variant/70 p-5">
        <div>
          <p className="text-caption font-semibold uppercase tracking-[0.08em] text-secondary">{application.universityName}</p>
          <h2 className="mt-1 text-title-lg font-semibold text-primary">{application.name}</h2>
          <p className="mt-1 text-body-sm text-secondary">/{application.slug}</p>
        </div>
        <Badge tone={statusTone(application.status)}>{copy.status[application.status]}</Badge>
      </div>

      <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_180px]">
        <div className="space-y-5">
          <dl className="grid gap-3 text-body-sm sm:grid-cols-2">
            <div>
              <dt className="text-caption font-semibold uppercase tracking-[0.08em] text-secondary">{copy.representative}</dt>
              <dd className="mt-1 text-primary">{application.representative.name}</dd>
              {application.representative.username ? <dd className="text-secondary">@{application.representative.username}</dd> : null}
            </div>
            <div>
              <dt className="text-caption font-semibold uppercase tracking-[0.08em] text-secondary">{copy.submitted}</dt>
              <dd className="mt-1 text-primary">
                <time dateTime={application.createdAt}>{formatDate(application.createdAt, language)}</time>
              </dd>
            </div>
            <div>
              <dt className="text-caption font-semibold uppercase tracking-[0.08em] text-secondary">{copy.clubEmail}</dt>
              <dd className="mt-1 break-all text-primary">{application.officialEmail}</dd>
            </div>
            <div>
              <dt className="text-caption font-semibold uppercase tracking-[0.08em] text-secondary">{copy.representativeEmail}</dt>
              <dd className="mt-1 break-all text-primary">{application.contactEmail}</dd>
            </div>
          </dl>

          <div>
            <h3 className="text-caption font-semibold uppercase tracking-[0.08em] text-secondary">{copy.clubDescription}</h3>
            <p className="mt-2 whitespace-pre-wrap text-body-sm leading-6 text-primary">{application.description}</p>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2 text-body-sm">
            {application.websiteUrl ? (
              <a href={application.websiteUrl} target="_blank" rel="noreferrer" className="font-semibold text-primary underline" aria-label={`${copy.website}: ${application.name} (${copy.opensNewTab})`}>
                {copy.website}
              </a>
            ) : null}
            {application.instagramUrl ? (
              <a href={application.instagramUrl} target="_blank" rel="noreferrer" className="font-semibold text-primary underline" aria-label={`${copy.instagram}: ${application.name} (${copy.opensNewTab})`}>
                {copy.instagram}
              </a>
            ) : null}
            {application.universityPageUrl ? (
              <a href={application.universityPageUrl} target="_blank" rel="noreferrer" className="font-semibold text-primary underline" aria-label={`${copy.universityPage}: ${application.name} (${copy.opensNewTab})`}>
                {copy.universityPage}
              </a>
            ) : null}
            {application.verificationDocumentUrl ? (
              <a href={application.verificationDocumentUrl} target="_blank" rel="noreferrer" className="font-semibold text-primary underline" aria-label={`${copy.recognitionDocument}: ${application.name} (${copy.opensNewTab})`}>
                {copy.recognitionDocument}
              </a>
            ) : null}
          </div>

          {application.additionalNote ? (
            <div className="rounded-lg bg-surface-container-low p-4">
              <h3 className="text-caption font-semibold uppercase tracking-[0.08em] text-secondary">{copy.applicantNote}</h3>
              <p className="mt-2 whitespace-pre-wrap text-body-sm text-primary">{application.additionalNote}</p>
            </div>
          ) : null}

          {application.latestRepresentativeMessage ? (
            <div className="rounded-lg bg-surface-container-low p-4">
              <h3 className="text-caption font-semibold uppercase tracking-[0.08em] text-secondary">{copy.latestResponse}</h3>
              <p className="mt-2 whitespace-pre-wrap text-body-sm text-primary">{application.latestRepresentativeMessage}</p>
            </div>
          ) : null}

          {reviewable ? (
            <div className="space-y-3 border-t border-outline-variant/70 pt-5">
              <form action={reviewFormAction}>
                <input type="hidden" name="clubId" value={application.id} />
                <input type="hidden" name="decision" value="approve" />
                <Button type="submit" size="sm" icon="verified" disabled={reviewPending} aria-busy={reviewPending}>
                  {reviewPending ? copy.savingDecision : copy.approveClub}
                </Button>
              </form>
              <form action={reviewFormAction} className="space-y-3">
                <input type="hidden" name="clubId" value={application.id} />
                <label htmlFor={noteId} className="block">
                  <span className="mb-2 block text-caption font-semibold uppercase tracking-[0.08em] text-secondary">{copy.decisionNote}</span>
                  <textarea
                    id={noteId}
                    name="message"
                    required
                    minLength={2}
                    maxLength={2000}
                    rows={3}
                    placeholder={copy.decisionNotePlaceholder}
                    aria-describedby={noteHintId}
                    className="w-full rounded-lg border border-outline-variant/80 bg-surface-container-lowest px-3 py-2 text-body-sm text-primary outline-none focus:border-primary"
                  />
                </label>
                <p id={noteHintId} className="text-caption leading-5 text-secondary">{copy.decisionNoteHint}</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" name="decision" value="request_clarification" size="sm" variant="secondary" icon="help" disabled={reviewPending} aria-busy={reviewPending}>
                    {reviewPending ? copy.savingDecision : copy.requestClarification}
                  </Button>
                  <Button type="submit" name="decision" value="reject" size="sm" variant="secondary" icon="block" disabled={reviewPending} aria-busy={reviewPending}>
                    {reviewPending ? copy.savingDecision : copy.rejectClub}
                  </Button>
                </div>
              </form>
            </div>
          ) : null}

          {application.status === "approved" ? (
            <form action={statusFormAction} className="space-y-3 border-t border-outline-variant/70 pt-5">
              <input type="hidden" name="clubId" value={application.id} />
              <input type="hidden" name="action" value="suspend" />
              <label htmlFor={suspensionId} className="block">
                <span className="mb-2 block text-caption font-semibold uppercase tracking-[0.08em] text-secondary">{copy.suspensionReason}</span>
                <textarea
                  id={suspensionId}
                  name="reason"
                  required
                  minLength={2}
                  maxLength={2000}
                  rows={3}
                  placeholder={copy.suspensionReasonPlaceholder}
                  aria-describedby={suspensionHintId}
                  className="w-full rounded-lg border border-outline-variant/80 bg-surface-container-lowest px-3 py-2 text-body-sm text-primary outline-none focus:border-primary"
                />
              </label>
              <p id={suspensionHintId} className="text-caption leading-5 text-secondary">{copy.suspensionReasonHint}</p>
              <Button type="submit" size="sm" variant="secondary" icon="block" disabled={statusPending} aria-busy={statusPending}>
                {statusPending ? copy.savingStatus : copy.suspendClub}
              </Button>
            </form>
          ) : null}

          {application.status === "suspended" ? (
            <form action={statusFormAction} className="border-t border-outline-variant/70 pt-5">
              <input type="hidden" name="clubId" value={application.id} />
              <input type="hidden" name="action" value="reactivate" />
              <Button type="submit" size="sm" icon="restart_alt" disabled={statusPending} aria-busy={statusPending}>
                {statusPending ? copy.savingStatus : copy.reactivateClub}
              </Button>
            </form>
          ) : null}

          {reviewFeedback.error || reviewFeedback.ok ? (
            <p role={reviewFeedback.ok ? "status" : "alert"} className={feedbackClass(reviewFeedback.ok)}>
              {reviewFeedback.ok ? reviewSuccess : mutationError(copy, reviewFeedback, copy.reviewError)}
            </p>
          ) : null}
          {statusFeedback.error || statusFeedback.ok ? (
            <p role={statusFeedback.ok ? "status" : "alert"} className={feedbackClass(statusFeedback.ok)}>
              {statusFeedback.ok ? statusSuccess : mutationError(copy, statusFeedback, copy.statusError)}
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border border-outline-variant/70 bg-surface-container-low p-2">
          {application.logoPreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={application.logoPreviewUrl}
              alt={replaceName(copy.logoAlt, application.name)}
              className="h-44 w-full rounded-md bg-white object-contain"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-44 items-center justify-center rounded-md bg-surface-container-lowest px-3 text-center text-caption font-semibold text-secondary">
              {copy.noLogo}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export function ClubApplicationsAdminView({
  applications,
  reviewApplicationAction,
  moderateStatusAction
}: {
  applications: AdminClubApplication[];
  reviewApplicationAction: AdminAction;
  moderateStatusAction: AdminAction;
}) {
  const { language } = useLanguage();
  const copy = COPY[language];
  const pendingCount = applications.filter((application) =>
    application.status === "pending_review" || application.status === "clarification_requested"
  ).length;

  return (
    <section>
      <ScreenHeader
        title={copy.title}
        description={copy.description}
        action={<Badge tone="warning">{copy.awaitingReview}: {pendingCount}</Badge>}
      />

      {applications.length ? (
        <div className="grid gap-5 xl:grid-cols-2">
          {applications.map((application) => (
            <ApplicationCard
              key={application.id}
              application={application}
              language={language}
              copy={copy}
              reviewApplicationAction={reviewApplicationAction}
              moderateStatusAction={moderateStatusAction}
            />
          ))}
        </div>
      ) : (
        <div className="premium-card p-8 text-center">
          <span className="material-symbols-outlined text-[40px] text-secondary" aria-hidden="true">fact_check</span>
          <h2 className="mt-3 text-title-lg font-semibold text-primary">{copy.noApplications}</h2>
          <p className="mt-2 text-body-md text-secondary">{copy.noApplicationsBody}</p>
        </div>
      )}
    </section>
  );
}
