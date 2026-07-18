"use client";

import {
  EventEmptyState,
  EventMetric,
  EventStatusPill,
  EventsFrame
} from "@/components/events/EventPrimitives";
import { useEventsI18n } from "@/lib/events/localization";
import type { AdminEventsOperationsData } from "@/lib/server/adminEvents";
import type { Language } from "@/lib/i18n";

type OperationsCopy = {
  eyebrow: string;
  title: string;
  description: string;
  privacyNote: string;
  statistics: string;
  statisticsDescription: string;
  totalEvents: string;
  pendingModeration: string;
  liveUpcoming: string;
  ticketRequests: string;
  approvedTickets: string;
  paymentAttention: string;
  checkedIn: string;
  refunded: string;
  checkInRate: string;
  paymentQueue: string;
  paymentQueueDescription: string;
  noPaymentQueue: string;
  refundQueue: string;
  refundQueueDescription: string;
  noRefundQueue: string;
  memberOverview: string;
  memberOverviewDescription: string;
  noClubs: string;
  auditLogs: string;
  auditLogsDescription: string;
  noAuditLogs: string;
  club: string;
  event: string;
  student: string;
  amount: string;
  method: string;
  updated: string;
  submitted: string;
  clarificationAt: string;
  refundRequiredAt: string;
  refundedAt: string;
  activePeople: string;
  invitedPeople: string;
  suspendedPeople: string;
  owners: string;
  organizers: string;
  financeManagers: string;
  scanners: string;
  actor: string;
  systemOrAdmin: string;
  otherActivity: string;
};

const operationsCopy: Record<Language, OperationsCopy> = {
  en: {
    eyebrow: "Protected admin view",
    title: "Event operations",
    description: "Monitor event activity, payment exceptions, refunds, club access, and the latest audited actions.",
    privacyNote: "Only the minimum operational data is shown. Bank details, receipts, payment references, QR data, and audit metadata are excluded.",
    statistics: "Event statistics",
    statisticsDescription: "A current platform-wide view of event, ticket, payment, and attendance activity.",
    totalEvents: "Total events",
    pendingModeration: "Pending moderation",
    liveUpcoming: "Live or upcoming",
    ticketRequests: "Ticket requests",
    approvedTickets: "Approved tickets",
    paymentAttention: "Payment attention",
    checkedIn: "Checked in",
    refunded: "Refunded tickets",
    checkInRate: "Check-in rate",
    paymentQueue: "Payment disputes and clarifications",
    paymentQueueDescription: "Payments under review, clarification requests, and recently rejected payment submissions.",
    noPaymentQueue: "There are no payment exceptions to review.",
    refundQueue: "Refund disputes and refunded tickets",
    refundQueueDescription: "Tickets awaiting an audited refund and the most recently completed refunds.",
    noRefundQueue: "No refund cases are recorded.",
    memberOverview: "Club-member overview",
    memberOverviewDescription: "Aggregate access assignments by club; personal member details are intentionally omitted.",
    noClubs: "No clubs are available.",
    auditLogs: "Recent audit logs",
    auditLogsDescription: "Latest security and operational actions without raw metadata or secret values.",
    noAuditLogs: "No audited event activity is recorded.",
    club: "Club",
    event: "Event",
    student: "Student",
    amount: "Amount",
    method: "Method",
    updated: "Updated",
    submitted: "Submitted",
    clarificationAt: "Clarification requested",
    refundRequiredAt: "Refund required",
    refundedAt: "Refunded",
    activePeople: "Active people",
    invitedPeople: "Invited",
    suspendedPeople: "Suspended",
    owners: "Owners",
    organizers: "Organizers",
    financeManagers: "Finance",
    scanners: "Scanners",
    actor: "Actor",
    systemOrAdmin: "Cadesca admin or system",
    otherActivity: "Other audited activity"
  },
  az: {
    eyebrow: "Qorunan admin görünüşü",
    title: "Tədbir əməliyyatları",
    description: "Tədbir fəaliyyətini, ödəniş istisnalarını, geri ödənişləri, klub girişini və son audit əməliyyatlarını izləyin.",
    privacyNote: "Yalnız minimum əməliyyat məlumatı göstərilir. Bank detalları, qəbzlər, ödəniş istinadları, QR məlumatları və audit metadatası daxil edilmir.",
    statistics: "Tədbir statistikası",
    statisticsDescription: "Tədbir, bilet, ödəniş və iştirak fəaliyyəti üzrə cari platforma icmalı.",
    totalEvents: "Ümumi tədbirlər",
    pendingModeration: "Moderasiya gözləyir",
    liveUpcoming: "Aktiv və ya qarşıdakı",
    ticketRequests: "Bilet sorğuları",
    approvedTickets: "Təsdiqlənmiş biletlər",
    paymentAttention: "Diqqət tələb edən ödəniş",
    checkedIn: "Giriş edənlər",
    refunded: "Geri ödənmiş biletlər",
    checkInRate: "Giriş faizi",
    paymentQueue: "Ödəniş mübahisələri və dəqiqləşdirmələr",
    paymentQueueDescription: "Yoxlamada olan ödənişlər, dəqiqləşdirmə sorğuları və son rədd edilmiş ödəniş təqdimatları.",
    noPaymentQueue: "Yoxlanacaq ödəniş istisnası yoxdur.",
    refundQueue: "Geri ödəniş mübahisələri və qaytarılmış biletlər",
    refundQueueDescription: "Auditli geri ödəniş gözləyən biletlər və son tamamlanmış geri ödənişlər.",
    noRefundQueue: "Geri ödəniş işi qeydə alınmayıb.",
    memberOverview: "Klub üzvlərinə icmal",
    memberOverviewDescription: "Klublar üzrə giriş rollarının cəmi; şəxsi üzv detalları qəsdən göstərilmir.",
    noClubs: "Heç bir klub yoxdur.",
    auditLogs: "Son audit qeydləri",
    auditLogsDescription: "Xam metadata və məxfi dəyərlər olmadan son təhlükəsizlik və əməliyyat hərəkətləri.",
    noAuditLogs: "Audit edilmiş tədbir fəaliyyəti qeydə alınmayıb.",
    club: "Klub",
    event: "Tədbir",
    student: "Tələbə",
    amount: "Məbləğ",
    method: "Üsul",
    updated: "Yenilənib",
    submitted: "Göndərilib",
    clarificationAt: "Dəqiqləşdirmə istənib",
    refundRequiredAt: "Geri ödəniş tələb olunur",
    refundedAt: "Geri ödənib",
    activePeople: "Aktiv şəxslər",
    invitedPeople: "Dəvət edilib",
    suspendedPeople: "Dayandırılıb",
    owners: "Sahiblər",
    organizers: "Təşkilatçılar",
    financeManagers: "Maliyyə",
    scanners: "Skanerlər",
    actor: "İcraçı",
    systemOrAdmin: "Cadesca admini və ya sistem",
    otherActivity: "Digər audit fəaliyyəti"
  },
  tr: {
    eyebrow: "Korumalı yönetici görünümü",
    title: "Etkinlik operasyonları",
    description: "Etkinlik hareketlerini, ödeme istisnalarını, iadeleri, kulüp erişimini ve son denetim işlemlerini izle.",
    privacyNote: "Yalnızca gerekli operasyon verileri gösterilir. Banka bilgileri, dekontlar, ödeme referansları, QR verileri ve denetim meta verileri dahil edilmez.",
    statistics: "Etkinlik istatistikleri",
    statisticsDescription: "Etkinlik, bilet, ödeme ve katılım hareketlerinin güncel platform geneli görünümü.",
    totalEvents: "Toplam etkinlik",
    pendingModeration: "Moderasyon bekliyor",
    liveUpcoming: "Aktif veya yaklaşan",
    ticketRequests: "Bilet talepleri",
    approvedTickets: "Onaylı biletler",
    paymentAttention: "İncelenecek ödeme",
    checkedIn: "Giriş yapanlar",
    refunded: "İade edilen biletler",
    checkInRate: "Giriş oranı",
    paymentQueue: "Ödeme itirazları ve açıklamalar",
    paymentQueueDescription: "İncelenen ödemeler, açıklama talepleri ve yakın zamanda reddedilen ödeme gönderimleri.",
    noPaymentQueue: "İncelenecek ödeme istisnası yok.",
    refundQueue: "İade itirazları ve iade edilen biletler",
    refundQueueDescription: "Denetimli iade bekleyen biletler ve en son tamamlanan iadeler.",
    noRefundQueue: "Kayıtlı bir iade vakası yok.",
    memberOverview: "Kulüp üye özeti",
    memberOverviewDescription: "Kulüp bazında toplu erişim atamaları; kişisel üye ayrıntıları özellikle gösterilmez.",
    noClubs: "Kullanılabilir kulüp yok.",
    auditLogs: "Son denetim kayıtları",
    auditLogsDescription: "Ham meta veriler veya gizli değerler olmadan son güvenlik ve operasyon işlemleri.",
    noAuditLogs: "Denetlenmiş etkinlik hareketi kaydı yok.",
    club: "Kulüp",
    event: "Etkinlik",
    student: "Öğrenci",
    amount: "Tutar",
    method: "Yöntem",
    updated: "Güncellendi",
    submitted: "Gönderildi",
    clarificationAt: "Açıklama istendi",
    refundRequiredAt: "İade gerekli",
    refundedAt: "İade edildi",
    activePeople: "Aktif kişiler",
    invitedPeople: "Davetli",
    suspendedPeople: "Askıda",
    owners: "Sahipler",
    organizers: "Organizatörler",
    financeManagers: "Finans",
    scanners: "Tarayıcılar",
    actor: "İşlemi yapan",
    systemOrAdmin: "Cadesca yöneticisi veya sistem",
    otherActivity: "Diğer denetim hareketi"
  },
  ru: {
    eyebrow: "Защищённый раздел администратора",
    title: "Операции с событиями",
    description: "Отслеживайте события, исключения по оплате, возвраты, доступ клубов и последние аудируемые действия.",
    privacyNote: "Показан только необходимый минимум данных. Банковские реквизиты, квитанции, платёжные ссылки, QR-данные и метаданные аудита исключены.",
    statistics: "Статистика событий",
    statisticsDescription: "Текущая сводка по событиям, билетам, оплатам и посещаемости на всей платформе.",
    totalEvents: "Всего событий",
    pendingModeration: "Ждут модерации",
    liveUpcoming: "Активные и будущие",
    ticketRequests: "Запросы билетов",
    approvedTickets: "Одобренные билеты",
    paymentAttention: "Оплаты к проверке",
    checkedIn: "Вошли",
    refunded: "Возвращённые билеты",
    checkInRate: "Доля входов",
    paymentQueue: "Споры по оплате и уточнения",
    paymentQueueDescription: "Оплаты на проверке, запросы уточнений и недавно отклонённые подтверждения оплаты.",
    noPaymentQueue: "Нет исключений по оплате для проверки.",
    refundQueue: "Споры по возвратам и возвращённые билеты",
    refundQueueDescription: "Билеты, ожидающие аудируемого возврата, и последние завершённые возвраты.",
    noRefundQueue: "Случаев возврата нет.",
    memberOverview: "Обзор участников клубов",
    memberOverviewDescription: "Сводные назначения доступа по клубам; личные данные участников намеренно не показаны.",
    noClubs: "Клубов нет.",
    auditLogs: "Последние журналы аудита",
    auditLogsDescription: "Последние действия безопасности и операции без исходных метаданных и секретных значений.",
    noAuditLogs: "Аудируемые действия с событиями не зарегистрированы.",
    club: "Клуб",
    event: "Событие",
    student: "Студент",
    amount: "Сумма",
    method: "Способ",
    updated: "Обновлено",
    submitted: "Отправлено",
    clarificationAt: "Запрошено уточнение",
    refundRequiredAt: "Требуется возврат",
    refundedAt: "Возвращено",
    activePeople: "Активные участники",
    invitedPeople: "Приглашены",
    suspendedPeople: "Приостановлены",
    owners: "Владельцы",
    organizers: "Организаторы",
    financeManagers: "Финансы",
    scanners: "Сканеры",
    actor: "Исполнитель",
    systemOrAdmin: "Администратор Cadesca или система",
    otherActivity: "Другое аудируемое действие"
  }
};

const auditActionLabels: Record<string, Record<Language, string>> = {
  club_application_submitted: { en: "Club application submitted", az: "Klub müraciəti göndərildi", tr: "Kulüp başvurusu gönderildi", ru: "Заявка клуба отправлена" },
  club_application_otp_verified: { en: "Club email code verified", az: "Klub e-poçt kodu təsdiqləndi", tr: "Kulüp e-posta kodu doğrulandı", ru: "Код электронной почты клуба подтверждён" },
  club_application_updated: { en: "Club application updated", az: "Klub müraciəti yeniləndi", tr: "Kulüp başvurusu güncellendi", ru: "Заявка клуба обновлена" },
  club_application_clarification_responded: { en: "Club clarification answered", az: "Klub dəqiqləşdirməsinə cavab verildi", tr: "Kulüp açıklaması yanıtlandı", ru: "На уточнение клуба дан ответ" },
  club_application_approve: { en: "Club application approved", az: "Klub müraciəti təsdiqləndi", tr: "Kulüp başvurusu onaylandı", ru: "Заявка клуба одобрена" },
  club_application_reject: { en: "Club application rejected", az: "Klub müraciəti rədd edildi", tr: "Kulüp başvurusu reddedildi", ru: "Заявка клуба отклонена" },
  club_application_request_clarification: { en: "Club clarification requested", az: "Klubdan dəqiqləşdirmə istəndi", tr: "Kulüpten açıklama istendi", ru: "У клуба запрошено уточнение" },
  club_suspended: { en: "Club suspended", az: "Klub dayandırıldı", tr: "Kulüp askıya alındı", ru: "Работа клуба приостановлена" },
  club_reactivated: { en: "Club reactivated", az: "Klub yenidən aktivləşdirildi", tr: "Kulüp yeniden etkinleştirildi", ru: "Клуб снова активирован" },
  member_invited: { en: "Member invited", az: "Üzv dəvət edildi", tr: "Üye davet edildi", ru: "Участник приглашён" },
  membership_accepted: { en: "Membership accepted", az: "Üzvlük qəbul edildi", tr: "Üyelik kabul edildi", ru: "Участие принято" },
  role_revoked: { en: "Club role revoked", az: "Klub rolu ləğv edildi", tr: "Kulüp rolü geri alındı", ru: "Роль в клубе отозвана" },
  scanner_assigned: { en: "Event scanner assigned", az: "Tədbir skaneri təyin edildi", tr: "Etkinlik tarayıcısı atandı", ru: "Назначен сканер события" },
  scanner_revoked: { en: "Event scanner assignment removed", az: "Tədbir skaneri təyinatı silindi", tr: "Etkinlik tarayıcısı ataması kaldırıldı", ru: "Назначение сканера события снято" },
  event_created: { en: "Event created", az: "Tədbir yaradıldı", tr: "Etkinlik oluşturuldu", ru: "Событие создано" },
  event_edited: { en: "Event edited", az: "Tədbir redaktə edildi", tr: "Etkinlik düzenlendi", ru: "Событие изменено" },
  event_submitted: { en: "Event submitted for review", az: "Tədbir yoxlamaya göndərildi", tr: "Etkinlik incelemeye gönderildi", ru: "Событие отправлено на проверку" },
  event_approved: { en: "Event approved", az: "Tədbir təsdiqləndi", tr: "Etkinlik onaylandı", ru: "Событие одобрено" },
  event_rejected: { en: "Event rejected", az: "Tədbir rədd edildi", tr: "Etkinlik reddedildi", ru: "Событие отклонено" },
  event_cancelled: { en: "Event cancelled", az: "Tədbir ləğv edildi", tr: "Etkinlik iptal edildi", ru: "Событие отменено" },
  event_featured: { en: "Event featured", az: "Tədbir seçilmiş edildi", tr: "Etkinlik öne çıkarıldı", ru: "Событие добавлено в рекомендуемые" },
  event_unfeatured: { en: "Event removed from featured", az: "Tədbir seçilmişdən çıxarıldı", tr: "Etkinlik öne çıkanlardan kaldırıldı", ru: "Событие убрано из рекомендуемых" },
  reservation_created: { en: "Reservation created", az: "Rezervasiya yaradıldı", tr: "Rezervasyon oluşturuldu", ru: "Бронь создана" },
  reservation_expired: { en: "Reservation expired", az: "Rezervasiya vaxtı bitdi", tr: "Rezervasyon süresi doldu", ru: "Срок брони истёк" },
  reservation_released: { en: "Reservation released", az: "Rezervasiya azad edildi", tr: "Rezervasyon serbest bırakıldı", ru: "Бронь освобождена" },
  payment_evidence_uploaded: { en: "Payment evidence uploaded", az: "Ödəniş sübutu yükləndi", tr: "Ödeme kanıtı yüklendi", ru: "Подтверждение оплаты загружено" },
  cash_payment_arranged: { en: "Cash payment arranged", az: "Nağd ödəniş planlaşdırıldı", tr: "Nakit ödeme planlandı", ru: "Оплата наличными согласована" },
  payment_approved: { en: "Payment approved", az: "Ödəniş təsdiqləndi", tr: "Ödeme onaylandı", ru: "Оплата одобрена" },
  payment_rejected: { en: "Payment rejected", az: "Ödəniş rədd edildi", tr: "Ödeme reddedildi", ru: "Оплата отклонена" },
  clarification_requested: { en: "Payment clarification requested", az: "Ödəniş dəqiqləşdirməsi istəndi", tr: "Ödeme açıklaması istendi", ru: "Запрошено уточнение оплаты" },
  cash_payment_confirmed: { en: "Cash payment confirmed", az: "Nağd ödəniş təsdiqləndi", tr: "Nakit ödeme onaylandı", ru: "Оплата наличными подтверждена" },
  free_ticket_approved: { en: "Free ticket approved", az: "Pulsuz bilet təsdiqləndi", tr: "Ücretsiz bilet onaylandı", ru: "Бесплатный билет одобрен" },
  ticket_cancelled: { en: "Ticket cancelled", az: "Bilet ləğv edildi", tr: "Bilet iptal edildi", ru: "Билет отменён" },
  ticket_refunded: { en: "Ticket refunded", az: "Bilet geri ödənildi", tr: "Bilet iade edildi", ru: "Стоимость билета возвращена" },
  refund_required: { en: "Ticket refund required", az: "Bilet üçün geri ödəniş tələb olunur", tr: "Bilet iadesi gerekli", ru: "Требуется возврат стоимости билета" },
  qr_scanned: { en: "Student Pass scanned", az: "Student Pass skan edildi", tr: "Student Pass tarandı", ru: "Student Pass отсканирован" },
  entry_confirmed: { en: "Entry confirmed", az: "Giriş təsdiqləndi", tr: "Giriş onaylandı", ru: "Вход подтверждён" },
  duplicate_entry_attempted: { en: "Duplicate entry attempted", az: "Təkrar giriş cəhdi edildi", tr: "Yinelenen giriş denendi", ru: "Попытка повторного входа" },
  unauthorized_scan_attempted: { en: "Unauthorized scan attempted", az: "İcazəsiz skan cəhdi edildi", tr: "Yetkisiz tarama denendi", ru: "Попытка сканирования без доступа" }
};

function AdminSection({
  id,
  title,
  description,
  children
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 border-t-2 border-black pt-6">
      <div className="mb-4">
        <h3 id={`${id}-title`} className="text-[24px] font-black leading-tight tracking-[-0.02em] text-black">{title}</h3>
        <p className="mt-1 max-w-3xl text-[13px] leading-5 text-black/65">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Definition({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-black uppercase tracking-[0.09em] text-black/50">{label}</dt>
      <dd className="mt-1 break-words text-[13px] font-bold leading-5 text-black">{children}</dd>
    </div>
  );
}

export function AdminEventsOperationsView({ data }: { data: AdminEventsOperationsData }) {
  const { language, locale, formatCurrency, formatDateTime } = useEventsI18n();
  const copy = operationsCopy[language];
  const number = new Intl.NumberFormat(locale);
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });

  return (
    <EventsFrame className="max-w-none">
      <header className="mb-6">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-black/55">{copy.eyebrow}</p>
        <h2 className="mt-2 text-[clamp(28px,5vw,42px)] font-black leading-none tracking-[-0.04em] text-black">{copy.title}</h2>
        <p className="mt-3 max-w-3xl text-[15px] leading-6 text-black/65">{copy.description}</p>
        <p className="mt-4 flex max-w-4xl items-start gap-2 rounded-xl border border-black bg-white p-3 text-[12px] font-semibold leading-5 text-black/65">
          <span className="material-symbols-outlined mt-0.5 text-[17px] text-black" aria-hidden="true">shield_lock</span>
          <span>{copy.privacyNote}</span>
        </p>
      </header>

      <nav className="no-scrollbar mb-6 flex gap-2 overflow-x-auto pb-1" aria-label={copy.title}>
        {[
          ["event-statistics", copy.statistics],
          ["payment-queue", copy.paymentQueue],
          ["refund-queue", copy.refundQueue],
          ["club-members", copy.memberOverview],
          ["audit-logs", copy.auditLogs]
        ].map(([href, label]) => (
          <a key={href} href={`#${href}`} className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-black bg-white px-3.5 text-[12px] font-extrabold text-black hover:bg-[#fff5c2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black">
            {label}
          </a>
        ))}
      </nav>

      <div className="space-y-8">
        <AdminSection id="event-statistics" title={copy.statistics} description={copy.statisticsDescription}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <EventMetric label={copy.totalEvents} value={number.format(data.statistics.totalEvents)} icon="event" />
            <EventMetric label={copy.pendingModeration} value={number.format(data.statistics.pendingReviewEvents)} icon="pending_actions" />
            <EventMetric label={copy.liveUpcoming} value={number.format(data.statistics.liveUpcomingEvents)} icon="calendar_month" />
            <EventMetric label={copy.ticketRequests} value={number.format(data.statistics.totalTicketRequests)} icon="confirmation_number" />
            <EventMetric label={copy.approvedTickets} value={number.format(data.statistics.approvedTickets)} icon="verified" />
            <EventMetric label={copy.paymentAttention} value={number.format(data.statistics.paymentsNeedingAttention)} icon="payments" />
            <EventMetric label={copy.checkedIn} value={number.format(data.statistics.checkedInTickets)} icon="how_to_reg" />
            <EventMetric label={copy.refunded} value={number.format(data.statistics.refundedTickets)} icon="currency_exchange" />
            <EventMetric label={copy.checkInRate} value={percent.format(data.statistics.checkInRate)} icon="monitoring" />
          </div>
        </AdminSection>

        <AdminSection id="payment-queue" title={copy.paymentQueue} description={copy.paymentQueueDescription}>
          {data.paymentQueue.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {data.paymentQueue.map((payment) => (
                <article key={payment.id} className="rounded-2xl border-2 border-black bg-white p-4 shadow-[3px_3px_0_#ffd400]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-[0.08em] text-black/50">{payment.clubName}</p>
                      <h4 className="mt-1 break-words text-[18px] font-black leading-6">{payment.eventTitle}</h4>
                    </div>
                    <EventStatusPill status={payment.paymentStatus} />
                  </div>
                  <dl className="mt-4 grid gap-3 border-t border-black/10 pt-4 sm:grid-cols-2 xl:grid-cols-3">
                    <Definition label={copy.student}>{payment.studentName}{payment.studentUsername ? ` · @${payment.studentUsername}` : ""}</Definition>
                    <Definition label={copy.amount}>{formatCurrency(payment.amount, payment.currency)}</Definition>
                    <Definition label={copy.method}>{payment.paymentMethod ? <EventStatusPill status={payment.paymentMethod} /> : "—"}</Definition>
                    <Definition label={copy.submitted}>{payment.submittedAt ? <time dateTime={payment.submittedAt}>{formatDateTime(payment.submittedAt)}</time> : "—"}</Definition>
                    {payment.clarificationRequestedAt ? <Definition label={copy.clarificationAt}><time dateTime={payment.clarificationRequestedAt}>{formatDateTime(payment.clarificationRequestedAt)}</time></Definition> : null}
                    <Definition label={copy.updated}><time dateTime={payment.updatedAt}>{formatDateTime(payment.updatedAt)}</time></Definition>
                  </dl>
                </article>
              ))}
            </div>
          ) : <EventEmptyState text={copy.noPaymentQueue} />}
        </AdminSection>

        <AdminSection id="refund-queue" title={copy.refundQueue} description={copy.refundQueueDescription}>
          {data.refundQueue.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {data.refundQueue.map((refund) => (
                <article key={refund.id} className="rounded-2xl border-2 border-black bg-white p-4 shadow-[3px_3px_0_#ffd400]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-[0.08em] text-black/50">{refund.clubName}</p>
                      <h4 className="mt-1 break-words text-[18px] font-black leading-6">{refund.eventTitle}</h4>
                    </div>
                    {refund.refundRequiredAt && !refund.refundedAt
                      ? <span className="rounded-full border border-black bg-[#ffd400] px-3 py-1 text-[11px] font-black uppercase tracking-[0.06em]">{copy.refundRequiredAt}</span>
                      : <EventStatusPill status="refunded" />}
                  </div>
                  <dl className="mt-4 grid gap-3 border-t border-black/10 pt-4 sm:grid-cols-2 xl:grid-cols-4">
                    <Definition label={copy.student}>{refund.studentName}{refund.studentUsername ? ` · @${refund.studentUsername}` : ""}</Definition>
                    <Definition label={copy.amount}>{formatCurrency(refund.amount, refund.currency)}</Definition>
                    <Definition label={copy.method}>{refund.paymentMethod ? <EventStatusPill status={refund.paymentMethod} /> : "—"}</Definition>
                    {refund.refundedAt
                      ? <Definition label={copy.refundedAt}><time dateTime={refund.refundedAt}>{formatDateTime(refund.refundedAt)}</time></Definition>
                      : refund.refundRequiredAt
                        ? <Definition label={copy.refundRequiredAt}><time dateTime={refund.refundRequiredAt}>{formatDateTime(refund.refundRequiredAt)}</time></Definition>
                        : null}
                  </dl>
                </article>
              ))}
            </div>
          ) : <EventEmptyState text={copy.noRefundQueue} />}
        </AdminSection>

        <AdminSection id="club-members" title={copy.memberOverview} description={copy.memberOverviewDescription}>
          {data.clubMembers.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.clubMembers.map((club) => (
                <article key={club.id} className="rounded-2xl border-2 border-black bg-white p-4 shadow-[3px_3px_0_#ffd400]">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <h4 className="min-w-0 break-words text-[18px] font-black leading-6">{club.clubName}</h4>
                    <EventStatusPill status={club.status} />
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-black/10 pt-4">
                    <Definition label={copy.activePeople}>{number.format(club.activePeople)}</Definition>
                    <Definition label={copy.invitedPeople}>{number.format(club.invitedPeople)}</Definition>
                    <Definition label={copy.suspendedPeople}>{number.format(club.suspendedPeople)}</Definition>
                    <Definition label={copy.owners}>{number.format(club.ownerAssignments)}</Definition>
                    <Definition label={copy.organizers}>{number.format(club.organizerAssignments)}</Definition>
                    <Definition label={copy.financeManagers}>{number.format(club.financeAssignments)}</Definition>
                    <Definition label={copy.scanners}>{number.format(club.scannerAssignments)}</Definition>
                  </dl>
                </article>
              ))}
            </div>
          ) : <EventEmptyState text={copy.noClubs} />}
        </AdminSection>

        <AdminSection id="audit-logs" title={copy.auditLogs} description={copy.auditLogsDescription}>
          {data.auditLogs.length ? (
            <ol className="divide-y divide-black/10 overflow-hidden rounded-2xl border-2 border-black bg-white">
              {data.auditLogs.map((entry) => (
                <li key={entry.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(180px,auto)] sm:items-center">
                  <div className="min-w-0">
                    <p className="break-words text-[14px] font-black leading-5">{auditActionLabels[entry.action]?.[language] || copy.otherActivity}</p>
                    <p className="mt-1 break-words text-[12px] leading-5 text-black/55">
                      {[entry.clubName && `${copy.club}: ${entry.clubName}`, entry.eventTitle && `${copy.event}: ${entry.eventTitle}`].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-[12px] font-bold text-black/65">{copy.actor}: {entry.actorName || copy.systemOrAdmin}</p>
                    <time dateTime={entry.createdAt} className="mt-1 block text-[11px] font-semibold text-black/50">{formatDateTime(entry.createdAt)}</time>
                  </div>
                </li>
              ))}
            </ol>
          ) : <EventEmptyState text={copy.noAuditLogs} />}
        </AdminSection>
      </div>
    </EventsFrame>
  );
}
