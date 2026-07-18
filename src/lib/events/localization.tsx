"use client";

import type {
  AdmissionResultCode,
  ClubRole,
  ClubStatus,
  EventStatus,
  FeaturedStatus,
  FreeTicketMode,
  PaymentMethod,
  PaymentStatus,
  ReservationStatus,
  TicketRequestStatus,
  TicketStatus
} from "@/lib/events/types";
import { useLanguage, type Language } from "@/lib/i18n";

export type EventPresentationStatus =
  | ClubStatus
  | ClubRole
  | EventStatus
  | FeaturedStatus
  | FreeTicketMode
  | PaymentMethod
  | PaymentStatus
  | ReservationStatus
  | TicketRequestStatus
  | TicketStatus
  | AdmissionResultCode
  | "invited"
  | "left"
  | "revoked";

export type EventPresentationError =
  | "authentication_required"
  | "verified_student_required"
  | "club_not_found"
  | "club_not_approved"
  | "club_access_denied"
  | "club_member_invalid"
  | "club_member_not_found"
  | "club_membership_not_editable"
  | "finance_access_denied"
  | "scanner_access_denied"
  | "scanner_candidate_invalid"
  | "scanner_assignment_not_editable"
  | "event_not_found"
  | "event_not_editable"
  | "event_invalid"
  | "event_cover_required"
  | "event_image_invalid"
  | "event_image_too_large"
  | "event_image_upload_failed"
  | "database_unavailable"
  | "event_unavailable"
  | "ticket_not_found"
  | "duplicate_ticket_request"
  | "no_places_available"
  | "reservation_expired"
  | "invalid_payment_method"
  | "payment_not_available"
  | "payment_evidence_required"
  | "payment_evidence_invalid"
  | "payment_evidence_too_large"
  | "payment_evidence_upload_failed"
  | "refund_required"
  | "ticket_transition_invalid"
  | "rate_limited"
  | "internal_server_error"
  | "unauthorized_scanner"
  | "invalid_preview_token"
  | "invalid_qr"
  | "admission_unavailable"
  | "request_not_allowed"
  | "scan_failed"
  | "search_unavailable"
  | "history_unavailable"
  | "generic";

type EventsCopy = {
  events: string;
  discoverTitle: string;
  discoverDescription: string;
  featured: string;
  approvedClub: string;
  upcoming: string;
  searchPlaceholder: string;
  search: string;
  clearSearch: string;
  noEvents: string;
  free: string;
  from: string;
  placesLeft: string;
  soldOut: string;
  viewEvent: string;
  organizedBy: string;
  dateAndTime: string;
  location: string;
  venueDetails: string;
  ticketDetails: string;
  ticketDeadline: string;
  capacity: string;
  ageRequirement: string;
  yearsAndOlder: string;
  refundPolicy: string;
  reservePlace: string;
  choosePayment: string;
  bankTransfer: string;
  cash: string;
  requestTicket: string;
  reservationCreated: string;
  completePaymentBeforeExpiry: string;
  reservationEndsIn: string;
  refreshingReservation: string;
  myTickets: string;
  myTicketsDescription: string;
  noTickets: string;
  browseEvents: string;
  ticket: string;
  payment: string;
  paymentReference: string;
  optional: string;
  receipt: string;
  uploadReceipt: string;
  submitPayment: string;
  paymentSubmitted: string;
  submittedAt: string;
  arrangeCash: string;
  cashPaymentDeadline: string;
  cashDeadlineHelp: string;
  cashAwaitingArrangement: string;
  cancelTicket: string;
  cancelConfirm: string;
  cancelEvent: string;
  cancelEventConfirm: string;
  paymentInstructions: string;
  accountName: string;
  copied: string;
  checkedInAt: string;
  clarification: string;
  backToTickets: string;
  publicCta: string;
  publicNote: string;
  clubDashboard: string;
  clubDashboardDescription: string;
  clubEvents: string;
  createEvent: string;
  editEvent: string;
  finance: string;
  scanner: string;
  members: string;
  overview: string;
  requests: string;
  activeReservations: string;
  paymentsToReview: string;
  approvedTickets: string;
  checkedIn: string;
  remainingCapacity: string;
  checkInRate: string;
  conversionRate: string;
  noClubEvents: string;
  edit: string;
  submitForReview: string;
  eventFormDescription: string;
  title: string;
  description: string;
  start: string;
  end: string;
  timezone: string;
  requestDeadline: string;
  price: string;
  currency: string;
  isFree: string;
  allowBankTransfer: string;
  allowCash: string;
  approvalMode: string;
  iban: string;
  coverImage: string;
  paymentNotes: string;
  saveDraft: string;
  draftSaved: string;
  eventSaved: string;
  role: string;
  financeDescription: string;
  noFinanceRequests: string;
  student: string;
  actions: string;
  approve: string;
  reject: string;
  requestClarification: string;
  confirmCash: string;
  approveFree: string;
  refund: string;
  reviewMessage: string;
  openReceipt: string;
  scannerEvents: string;
  scannerEventsDescription: string;
  noScannerEvents: string;
  openScanner: string;
  cameraScanner: string;
  startCamera: string;
  stopCamera: string;
  cameraUnavailable: string;
  manualQr: string;
  scan: string;
  attendeeSearch: string;
  searchByName: string;
  recentEntries: string;
  noRecentEntries: string;
  confirmEntry: string;
  entryConfirmed: string;
  scannedBy: string;
  adminEvents: string;
  adminEventsDescription: string;
  moderationQueue: string;
  pendingReview: string;
  featureEvent: string;
  removeFeature: string;
  featureUntil: string;
  rejectionReason: string;
  noModerationEvents: string;
  retry: string;
  loading: string;
  somethingWentWrong: string;
  statusText: string;
  status: Record<EventPresentationStatus, string>;
  errors: Record<EventPresentationError, string>;
};

const statusEn: Record<EventPresentationStatus, string> = {
  pending_review: "Pending review",
  clarification_requested: "Clarification requested",
  approved: "Approved",
  rejected: "Rejected",
  suspended: "Suspended",
  archived: "Archived",
  club_owner: "Club owner",
  event_organizer: "Event organizer",
  finance_manager: "Finance manager",
  door_scanner: "Door scanner",
  draft: "Draft",
  published: "Published",
  sold_out: "Sold out",
  cancelled: "Cancelled",
  completed: "Completed",
  none: "Not featured",
  candidate: "Feature candidate",
  expired: "Expired",
  automatic: "Automatic approval",
  organizer_approval: "Organizer approval",
  bank_transfer: "Bank transfer",
  cash: "Cash",
  free: "Free",
  not_required: "No payment required",
  pending: "Pending",
  under_review: "Under review",
  refunded: "Refunded",
  active: "Active",
  held_for_review: "Place held for review",
  released: "Released",
  submitted: "Submitted",
  checked_in: "Checked in",
  revoked: "Revoked",
  valid_ticket: "Valid ticket",
  already_checked_in: "Already checked in",
  payment_pending: "Payment pending",
  payment_under_review: "Payment under review",
  reservation_expired: "Reservation expired",
  ticket_rejected: "Ticket rejected",
  ticket_cancelled: "Ticket cancelled",
  ticket_refunded: "Ticket refunded",
  no_ticket: "No ticket for this event",
  event_cancelled: "Event cancelled",
  event_completed: "Event completed",
  wrong_university: "Different university",
  invalid_qr: "Invalid QR code",
  unauthorized_scanner: "Scanner access denied",
  invited: "Invited",
  left: "Left"
};

const errorsEn: Record<EventPresentationError, string> = {
  authentication_required: "Sign in to continue.",
  verified_student_required: "Only verified university students can request tickets.",
  club_not_found: "No club workspace is linked to this account.",
  club_not_approved: "The club must be approved before publishing events.",
  club_access_denied: "You do not have permission to manage this club.",
  club_member_invalid: "Enter a username or university email and choose an available club role.",
  club_member_not_found: "No active student from this university matches that username or email.",
  club_membership_not_editable: "That membership has already changed. Refresh the member list and try again.",
  finance_access_denied: "Finance access is required for this action.",
  scanner_access_denied: "Scanner access is required for this event.",
  scanner_candidate_invalid: "This member needs an active door-scanner role before being assigned to the event.",
  scanner_assignment_not_editable: "That scanner assignment has already changed. Refresh the event and try again.",
  event_not_found: "This event could not be found.",
  event_not_editable: "This event can no longer be edited.",
  event_invalid: "Review the event details and try again.",
  event_cover_required: "Add a cover image before submitting the event.",
  event_image_invalid: "Use a JPG, PNG, WebP, or AVIF cover image.",
  event_image_too_large: "The cover image is too large.",
  event_image_upload_failed: "The cover image could not be uploaded.",
  database_unavailable: "Events are temporarily unavailable.",
  event_unavailable: "Ticket requests are closed for this event.",
  ticket_not_found: "This ticket could not be found.",
  duplicate_ticket_request: "You already have a ticket request for this event.",
  no_places_available: "No places are currently available.",
  reservation_expired: "Your reservation expired. Request a new place if one is available.",
  invalid_payment_method: "Choose an available payment method.",
  payment_not_available: "That payment method is no longer available.",
  payment_evidence_required: "Attach a payment receipt.",
  payment_evidence_invalid: "Use a PDF, JPG, PNG, or WebP receipt.",
  payment_evidence_too_large: "The receipt is too large.",
  payment_evidence_upload_failed: "The receipt could not be uploaded.",
  refund_required: "This paid ticket must be refunded instead of cancelled.",
  ticket_transition_invalid: "This ticket cannot be changed from its current status.",
  rate_limited: "Too many attempts. Please wait and try again.",
  internal_server_error: "The request could not be completed. Please try again.",
  unauthorized_scanner: "You are not assigned to scan this event.",
  invalid_preview_token: "The scan preview expired. Scan the pass again.",
  invalid_qr: "The QR code is invalid or expired.",
  admission_unavailable: "Entry could not be confirmed. Refresh and try again.",
  request_not_allowed: "This request was blocked for your protection.",
  scan_failed: "The pass could not be scanned.",
  search_unavailable: "Attendee search is temporarily unavailable.",
  history_unavailable: "Recent entries are temporarily unavailable.",
  generic: "Something went wrong. Please try again."
};

const en = {
  approvedClub: "Approved club",
  completePaymentBeforeExpiry: "Complete the required payment step before this timer ends.",
  submittedAt: "Submitted at",
  events: "Events", discoverTitle: "Find your next campus event", discoverDescription: "Discover approved events from student clubs at your university.", featured: "Featured", upcoming: "Upcoming events", searchPlaceholder: "Search events, clubs, or locations", search: "Search", clearSearch: "Clear search", noEvents: "No upcoming events match your search.", free: "Free", from: "From", placesLeft: "places left", soldOut: "Sold out", viewEvent: "View event", organizedBy: "Organized by", dateAndTime: "Date and time", location: "Location", venueDetails: "Venue details", ticketDetails: "Ticket details", ticketDeadline: "Request deadline", capacity: "Capacity", ageRequirement: "Age requirement", yearsAndOlder: "years and older", refundPolicy: "Refund policy", reservePlace: "Reserve your place", choosePayment: "Choose a payment method", bankTransfer: "Bank transfer", cash: "Cash", requestTicket: "Request ticket", reservationCreated: "Your place is reserved.", reservationEndsIn: "Reservation ends in", refreshingReservation: "Refreshing reservation…", myTickets: "My tickets", myTicketsDescription: "Track reservations, payments, and entry status.", noTickets: "You do not have any event tickets yet.", browseEvents: "Browse events", ticket: "Ticket", payment: "Payment", paymentReference: "Payment reference", optional: "Optional", receipt: "Receipt", uploadReceipt: "Choose receipt", submitPayment: "Submit payment", arrangeCash: "Arrange cash payment", cancelTicket: "Cancel ticket", cancelConfirm: "Cancel this ticket request?", paymentInstructions: "Payment instructions", accountName: "Account name", copied: "Copied", checkedInAt: "Checked in at", clarification: "Clarification needed", backToTickets: "Back to tickets", publicCta: "Open in Cadesca", publicNote: "Sign in with your Cadesca student account to request a ticket.", clubDashboard: "Club dashboard", clubDashboardDescription: "Plan events, manage access, and track attendance.", clubEvents: "Club events", createEvent: "Create event", editEvent: "Edit event", finance: "Finance", scanner: "Scanner", members: "Members", overview: "Overview", requests: "Requests", activeReservations: "Active reservations", paymentsToReview: "Payments to review", approvedTickets: "Approved tickets", checkedIn: "Checked in", remainingCapacity: "Remaining capacity", checkInRate: "Check-in rate", conversionRate: "Approval rate", noClubEvents: "No events have been created for this club.", edit: "Edit", submitForReview: "Submit for review", eventFormDescription: "Save a complete draft, then submit it for Cadesca review.", title: "Title", description: "Description", start: "Starts", end: "Ends", timezone: "Time zone", requestDeadline: "Ticket request deadline", price: "Price", currency: "Currency", isFree: "This is a free event", allowBankTransfer: "Accept bank transfer", allowCash: "Accept cash payment", approvalMode: "Free-ticket approval", iban: "IBAN", coverImage: "Cover image", paymentNotes: "Payment instructions", saveDraft: "Save draft", draftSaved: "Draft saved.", eventSaved: "Event saved.", role: "Role", financeDescription: "Review payment evidence and approve tickets.", noFinanceRequests: "There are no ticket requests to review.", student: "Student", actions: "Actions", approve: "Approve", reject: "Reject", requestClarification: "Request clarification", confirmCash: "Confirm cash", approveFree: "Approve free ticket", refund: "Refund", reviewMessage: "Message to student", openReceipt: "Open receipt", scannerEvents: "Assigned events", scannerEventsDescription: "Open an assigned event to scan Student Pass QR codes.", noScannerEvents: "No events are assigned to you.", openScanner: "Open scanner", cameraScanner: "Camera scanner", startCamera: "Start camera", stopCamera: "Stop camera", cameraUnavailable: "Camera scanning is unavailable. Enter the QR value manually.", manualQr: "QR value or pass link", scan: "Scan pass", attendeeSearch: "Attendee search", searchByName: "Search by name or username", recentEntries: "Recent entries", noRecentEntries: "No one has checked in yet.", confirmEntry: "Confirm entry", entryConfirmed: "Entry confirmed.", scannedBy: "Scanned by", adminEvents: "Event moderation", adminEventsDescription: "Review club events and manage featured placement.", moderationQueue: "Moderation queue", pendingReview: "Pending review", featureEvent: "Feature event", removeFeature: "Remove feature", featureUntil: "Featured until", rejectionReason: "Reason for rejection", noModerationEvents: "There are no events in the moderation queue.", retry: "Try again", loading: "Loading events…", somethingWentWrong: "Events could not be loaded.", status: statusEn, errors: errorsEn,
  statusText: "Status", cancelEvent: "Cancel event", cancelEventConfirm: "Cancel this event? Existing ticket holders will see it as cancelled.", paymentSubmitted: "Payment submitted for review.", cashPaymentDeadline: "Cash payment deadline", cashDeadlineHelp: "Optional. A safe 24-hour deadline is used when left blank.", cashAwaitingArrangement: "The organizer must arrange the cash payment before this reservation expires."
} satisfies EventsCopy;

const az = {
  ...en,
  approvedClub: "Təsdiqlənmiş klub",
  completePaymentBeforeExpiry: "Tələb olunan ödəniş addımını taymer bitməzdən əvvəl tamamlayın.",
  submittedAt: "Göndərilmə vaxtı",
  events: "Tədbirlər", discoverTitle: "Növbəti kampus tədbirini tap", discoverDescription: "Universitetinizdə tələbə klublarının təsdiqlənmiş tədbirlərini kəşf edin.", featured: "Seçilmiş", upcoming: "Qarşıdakı tədbirlər", searchPlaceholder: "Tədbir, klub və ya məkan axtarın", search: "Axtar", clearSearch: "Axtarışı təmizlə", noEvents: "Axtarışınıza uyğun tədbir yoxdur.", free: "Pulsuz", from: "Başlanğıc", placesLeft: "yer qalıb", soldOut: "Yerlər dolub", viewEvent: "Tədbirə bax", organizedBy: "Təşkilatçı", dateAndTime: "Tarix və saat", location: "Məkan", venueDetails: "Məkan detalları", ticketDetails: "Bilet detalları", ticketDeadline: "Sorğu üçün son tarix", capacity: "Tutum", ageRequirement: "Yaş tələbi", yearsAndOlder: "yaş və yuxarı", refundPolicy: "Geri ödəniş qaydası", reservePlace: "Yerinizi ayırın", choosePayment: "Ödəniş üsulunu seçin", bankTransfer: "Bank köçürməsi", cash: "Nağd", requestTicket: "Bilet istə", reservationCreated: "Yeriniz ayrıldı.", reservationEndsIn: "Rezervasiyanın bitməsinə", refreshingReservation: "Rezervasiya yenilənir…", myTickets: "Biletlərim", myTicketsDescription: "Rezervasiya, ödəniş və giriş statusunu izləyin.", noTickets: "Hələ tədbir biletiniz yoxdur.", browseEvents: "Tədbirlərə bax", ticket: "Bilet", payment: "Ödəniş", paymentReference: "Ödəniş istinadı", optional: "İstəyə bağlı", receipt: "Qəbz", uploadReceipt: "Qəbz seç", submitPayment: "Ödənişi göndər", arrangeCash: "Nağd ödənişi planlaşdır", cancelTicket: "Bileti ləğv et", cancelConfirm: "Bu bilet sorğusu ləğv edilsin?", paymentInstructions: "Ödəniş təlimatları", accountName: "Hesab adı", copied: "Kopyalandı", checkedInAt: "Giriş vaxtı", clarification: "Dəqiqləşdirmə lazımdır", backToTickets: "Biletlərə qayıt", publicCta: "Cadesca-da aç", publicNote: "Bilet istəmək üçün Cadesca tələbə hesabınıza daxil olun.", clubDashboard: "Klub paneli", clubDashboardDescription: "Tədbirləri planlaşdırın, girişi idarə edin və davamiyyəti izləyin.", clubEvents: "Klub tədbirləri", createEvent: "Tədbir yarat", editEvent: "Tədbiri redaktə et", finance: "Maliyyə", scanner: "Skaner", members: "Üzvlər", overview: "İcmal", requests: "Sorğular", activeReservations: "Aktiv rezervasiyalar", paymentsToReview: "Yoxlanacaq ödənişlər", approvedTickets: "Təsdiqlənmiş biletlər", checkedIn: "Giriş edənlər", remainingCapacity: "Qalan tutum", checkInRate: "Giriş faizi", conversionRate: "Təsdiq faizi", noClubEvents: "Bu klub üçün tədbir yaradılmayıb.", edit: "Redaktə et", submitForReview: "Yoxlamaya göndər", eventFormDescription: "Tam qaralamanı saxlayın, sonra Cadesca yoxlamasına göndərin.", title: "Başlıq", description: "Təsvir", start: "Başlayır", end: "Bitir", timezone: "Saat qurşağı", requestDeadline: "Bilet sorğusu üçün son tarix", price: "Qiymət", currency: "Valyuta", isFree: "Bu tədbir pulsuzdur", allowBankTransfer: "Bank köçürməsini qəbul et", allowCash: "Nağd ödənişi qəbul et", approvalMode: "Pulsuz bilet təsdiqi", iban: "IBAN", coverImage: "Örtük şəkli", paymentNotes: "Ödəniş təlimatları", saveDraft: "Qaralamanı saxla", draftSaved: "Qaralama saxlanıldı.", eventSaved: "Tədbir saxlanıldı.", role: "Rol", financeDescription: "Ödəniş sübutlarını yoxlayın və biletləri təsdiqləyin.", noFinanceRequests: "Yoxlanacaq bilet sorğusu yoxdur.", student: "Tələbə", actions: "Əməliyyatlar", approve: "Təsdiqlə", reject: "Rədd et", requestClarification: "Dəqiqləşdirmə istə", confirmCash: "Nağdı təsdiqlə", approveFree: "Pulsuz bileti təsdiqlə", refund: "Geri ödə", reviewMessage: "Tələbəyə mesaj", openReceipt: "Qəbzi aç", scannerEvents: "Təyin edilmiş tədbirlər", scannerEventsDescription: "Student Pass QR kodlarını oxutmaq üçün tədbiri açın.", noScannerEvents: "Sizə tədbir təyin edilməyib.", openScanner: "Skaneri aç", cameraScanner: "Kamera skaneri", startCamera: "Kameranı başlat", stopCamera: "Kameranı dayandır", cameraUnavailable: "Kamera ilə oxutma mümkün deyil. QR dəyərini əl ilə daxil edin.", manualQr: "QR dəyəri və ya keçid", scan: "Keçidi oxut", attendeeSearch: "İştirakçı axtarışı", searchByName: "Ad və ya istifadəçi adı ilə axtar", recentEntries: "Son girişlər", noRecentEntries: "Hələ heç kim giriş etməyib.", confirmEntry: "Girişi təsdiqlə", entryConfirmed: "Giriş təsdiqləndi.", scannedBy: "Skan edən", adminEvents: "Tədbir moderasiyası", adminEventsDescription: "Klub tədbirlərini yoxlayın və seçilmiş yerləşdirməni idarə edin.", moderationQueue: "Yoxlama növbəsi", pendingReview: "Yoxlama gözləyir", featureEvent: "Seçilmiş et", removeFeature: "Seçilmişdən çıxar", featureUntil: "Seçilmə müddəti", rejectionReason: "Rədd səbəbi", noModerationEvents: "Yoxlama növbəsində tədbir yoxdur.", retry: "Yenidən cəhd et", loading: "Tədbirlər yüklənir…", somethingWentWrong: "Tədbirlər yüklənmədi.",
  status: { ...statusEn, pending_review: "Yoxlama gözləyir", clarification_requested: "Dəqiqləşdirmə istənib", approved: "Təsdiqlənib", rejected: "Rədd edilib", suspended: "Dayandırılıb", archived: "Arxivlənib", club_owner: "Klub sahibi", event_organizer: "Tədbir təşkilatçısı", finance_manager: "Maliyyə meneceri", door_scanner: "Giriş skaneri", draft: "Qaralama", published: "Yayımlanıb", sold_out: "Yerlər dolub", cancelled: "Ləğv edilib", completed: "Tamamlanıb", none: "Seçilməyib", candidate: "Seçim namizədi", expired: "Müddəti bitib", automatic: "Avtomatik təsdiq", organizer_approval: "Təşkilatçı təsdiqi", bank_transfer: "Bank köçürməsi", cash: "Nağd", free: "Pulsuz", not_required: "Ödəniş tələb olunmur", pending: "Gözləyir", under_review: "Yoxlanır", refunded: "Geri ödənib", active: "Aktiv", held_for_review: "Yer yoxlama üçün saxlanılıb", released: "Azad edilib", submitted: "Göndərilib", checked_in: "Giriş edilib", revoked: "Ləğv edilib", valid_ticket: "Etibarlı bilet", already_checked_in: "Artıq giriş edib", payment_pending: "Ödəniş gözləyir", payment_under_review: "Ödəniş yoxlanır", reservation_expired: "Rezervasiyanın vaxtı bitib", ticket_rejected: "Bilet rədd edilib", ticket_cancelled: "Bilet ləğv edilib", ticket_refunded: "Bilet geri ödənib", no_ticket: "Bu tədbir üçün bilet yoxdur", event_cancelled: "Tədbir ləğv edilib", event_completed: "Tədbir tamamlanıb", wrong_university: "Fərqli universitet", invalid_qr: "QR kod etibarsızdır", unauthorized_scanner: "Skaner icazəsi yoxdur", invited: "Dəvət edilib", left: "Ayrılıb" },
  errors: { ...errorsEn, authentication_required: "Davam etmək üçün daxil olun.", verified_student_required: "Yalnız təsdiqlənmiş universitet tələbələri bilet istəyə bilər.", club_not_found: "Bu hesaba bağlı klub iş sahəsi yoxdur.", club_not_approved: "Tədbir yayımlamaq üçün klub təsdiqlənməlidir.", club_access_denied: "Bu klubu idarə etmək icazəniz yoxdur.", finance_access_denied: "Bu əməliyyat üçün maliyyə icazəsi lazımdır.", scanner_access_denied: "Bu tədbir üçün skaner icazəsi lazımdır.", event_not_found: "Tədbir tapılmadı.", event_not_editable: "Bu tədbir artıq redaktə edilə bilməz.", event_invalid: "Tədbir məlumatlarını yoxlayıb yenidən cəhd edin.", event_cover_required: "Tədbiri göndərməzdən əvvəl örtük şəkli əlavə edin.", event_unavailable: "Bu tədbir üçün bilet sorğuları bağlıdır.", ticket_not_found: "Bilet tapılmadı.", duplicate_ticket_request: "Bu tədbir üçün artıq bilet sorğunuz var.", no_places_available: "Hazırda boş yer yoxdur.", reservation_expired: "Rezervasiyanın vaxtı bitdi. Yer varsa yenidən sorğu göndərin.", invalid_payment_method: "Mövcud ödəniş üsulunu seçin.", payment_evidence_required: "Ödəniş qəbzini əlavə edin.", rate_limited: "Çox sayda cəhd edildi. Bir az gözləyin.", invalid_qr: "QR kod etibarsızdır və ya vaxtı bitib.", unauthorized_scanner: "Bu tədbir üçün skaner təyinatınız yoxdur.", generic: "Xəta baş verdi. Yenidən cəhd edin." },
  statusText: "Status", cancelEvent: "Tədbiri ləğv et", cancelEventConfirm: "Bu tədbir ləğv edilsin? Mövcud bilet sahibləri tədbiri ləğv edilmiş görəcək.", paymentSubmitted: "Ödəniş yoxlamaya göndərildi.", cashPaymentDeadline: "Nağd ödəniş üçün son tarix", cashDeadlineHelp: "İstəyə bağlıdır. Boş saxlanıldıqda təhlükəsiz 24 saatlıq müddət tətbiq edilir.", cashAwaitingArrangement: "Rezervasiya bitməzdən əvvəl təşkilatçı nağd ödənişi planlaşdırmalıdır."
} satisfies EventsCopy;

const tr = {
  ...en,
  approvedClub: "Onaylı kulüp",
  completePaymentBeforeExpiry: "Gerekli ödeme adımını bu sayaç bitmeden tamamlayın.",
  submittedAt: "Gönderilme zamanı",
  events: "Etkinlikler", discoverTitle: "Bir sonraki kampüs etkinliğini bul", discoverDescription: "Üniversitendeki öğrenci kulüplerinin onaylı etkinliklerini keşfet.", featured: "Öne çıkanlar", upcoming: "Yaklaşan etkinlikler", searchPlaceholder: "Etkinlik, kulüp veya konum ara", search: "Ara", clearSearch: "Aramayı temizle", noEvents: "Aramana uygun yaklaşan etkinlik yok.", free: "Ücretsiz", from: "Başlangıç", placesLeft: "yer kaldı", soldOut: "Tükendi", viewEvent: "Etkinliği görüntüle", organizedBy: "Düzenleyen", dateAndTime: "Tarih ve saat", location: "Konum", venueDetails: "Mekân bilgileri", ticketDetails: "Bilet bilgileri", ticketDeadline: "Son başvuru", capacity: "Kapasite", ageRequirement: "Yaş şartı", yearsAndOlder: "yaş ve üzeri", refundPolicy: "İade politikası", reservePlace: "Yerini ayır", choosePayment: "Ödeme yöntemini seç", bankTransfer: "Banka havalesi", cash: "Nakit", requestTicket: "Bilet iste", reservationCreated: "Yerin ayrıldı.", reservationEndsIn: "Rezervasyonun bitmesine", refreshingReservation: "Rezervasyon yenileniyor…", myTickets: "Biletlerim", myTicketsDescription: "Rezervasyon, ödeme ve giriş durumunu takip et.", noTickets: "Henüz etkinlik biletin yok.", browseEvents: "Etkinliklere göz at", ticket: "Bilet", payment: "Ödeme", paymentReference: "Ödeme referansı", optional: "İsteğe bağlı", receipt: "Dekont", uploadReceipt: "Dekont seç", submitPayment: "Ödemeyi gönder", arrangeCash: "Nakit ödemeyi ayarla", cancelTicket: "Bileti iptal et", cancelConfirm: "Bu bilet talebi iptal edilsin mi?", paymentInstructions: "Ödeme talimatları", accountName: "Hesap adı", copied: "Kopyalandı", checkedInAt: "Giriş zamanı", clarification: "Açıklama gerekiyor", backToTickets: "Biletlere dön", publicCta: "Cadesca'da aç", publicNote: "Bilet istemek için Cadesca öğrenci hesabınla giriş yap.", clubDashboard: "Kulüp paneli", clubDashboardDescription: "Etkinlikleri planla, erişimi yönet ve katılımı takip et.", clubEvents: "Kulüp etkinlikleri", createEvent: "Etkinlik oluştur", editEvent: "Etkinliği düzenle", finance: "Finans", scanner: "Tarayıcı", members: "Üyeler", overview: "Genel bakış", requests: "Talepler", activeReservations: "Aktif rezervasyonlar", paymentsToReview: "İncelenecek ödemeler", approvedTickets: "Onaylı biletler", checkedIn: "Giriş yapanlar", remainingCapacity: "Kalan kapasite", checkInRate: "Giriş oranı", conversionRate: "Onay oranı", noClubEvents: "Bu kulüp için henüz etkinlik oluşturulmadı.", edit: "Düzenle", submitForReview: "İncelemeye gönder", eventFormDescription: "Eksiksiz taslağı kaydet, ardından Cadesca incelemesine gönder.", title: "Başlık", description: "Açıklama", start: "Başlangıç", end: "Bitiş", timezone: "Saat dilimi", requestDeadline: "Bilet talebi son tarihi", price: "Fiyat", currency: "Para birimi", isFree: "Bu etkinlik ücretsiz", allowBankTransfer: "Banka havalesini kabul et", allowCash: "Nakit ödemeyi kabul et", approvalMode: "Ücretsiz bilet onayı", iban: "IBAN", coverImage: "Kapak görseli", paymentNotes: "Ödeme talimatları", saveDraft: "Taslağı kaydet", draftSaved: "Taslak kaydedildi.", eventSaved: "Etkinlik kaydedildi.", role: "Rol", financeDescription: "Ödeme kanıtlarını incele ve biletleri onayla.", noFinanceRequests: "İncelenecek bilet talebi yok.", student: "Öğrenci", actions: "İşlemler", approve: "Onayla", reject: "Reddet", requestClarification: "Açıklama iste", confirmCash: "Nakit ödemeyi onayla", approveFree: "Ücretsiz bileti onayla", refund: "İade et", reviewMessage: "Öğrenciye mesaj", openReceipt: "Dekontu aç", scannerEvents: "Atanan etkinlikler", scannerEventsDescription: "Student Pass QR kodlarını okutmak için atanmış etkinliği aç.", noScannerEvents: "Sana atanmış etkinlik yok.", openScanner: "Tarayıcıyı aç", cameraScanner: "Kamera tarayıcısı", startCamera: "Kamerayı başlat", stopCamera: "Kamerayı durdur", cameraUnavailable: "Kamera ile tarama kullanılamıyor. QR değerini elle gir.", manualQr: "QR değeri veya geçiş bağlantısı", scan: "Kartı tara", attendeeSearch: "Katılımcı arama", searchByName: "Ad veya kullanıcı adıyla ara", recentEntries: "Son girişler", noRecentEntries: "Henüz giriş yapan yok.", confirmEntry: "Girişi onayla", entryConfirmed: "Giriş onaylandı.", scannedBy: "Tarayan", adminEvents: "Etkinlik moderasyonu", adminEventsDescription: "Kulüp etkinliklerini incele ve öne çıkarılanları yönet.", moderationQueue: "İnceleme sırası", pendingReview: "İnceleme bekliyor", featureEvent: "Öne çıkar", removeFeature: "Öne çıkarmayı kaldır", featureUntil: "Öne çıkarma bitişi", rejectionReason: "Ret nedeni", noModerationEvents: "İnceleme sırasında etkinlik yok.", retry: "Tekrar dene", loading: "Etkinlikler yükleniyor…", somethingWentWrong: "Etkinlikler yüklenemedi.",
  status: { ...statusEn, pending_review: "İnceleme bekliyor", clarification_requested: "Açıklama istendi", approved: "Onaylandı", rejected: "Reddedildi", suspended: "Askıya alındı", archived: "Arşivlendi", club_owner: "Kulüp sahibi", event_organizer: "Etkinlik düzenleyicisi", finance_manager: "Finans yöneticisi", door_scanner: "Kapı tarayıcısı", draft: "Taslak", published: "Yayında", sold_out: "Tükendi", cancelled: "İptal edildi", completed: "Tamamlandı", none: "Öne çıkarılmadı", candidate: "Öne çıkarma adayı", expired: "Süresi doldu", automatic: "Otomatik onay", organizer_approval: "Düzenleyici onayı", bank_transfer: "Banka havalesi", cash: "Nakit", free: "Ücretsiz", not_required: "Ödeme gerekmiyor", pending: "Bekliyor", under_review: "İnceleniyor", refunded: "İade edildi", active: "Aktif", held_for_review: "Yer inceleme için tutuluyor", released: "Serbest bırakıldı", submitted: "Gönderildi", checked_in: "Giriş yaptı", revoked: "İptal edildi", valid_ticket: "Geçerli bilet", already_checked_in: "Zaten giriş yaptı", payment_pending: "Ödeme bekleniyor", payment_under_review: "Ödeme inceleniyor", reservation_expired: "Rezervasyon süresi doldu", ticket_rejected: "Bilet reddedildi", ticket_cancelled: "Bilet iptal edildi", ticket_refunded: "Bilet iade edildi", no_ticket: "Bu etkinlik için bilet yok", event_cancelled: "Etkinlik iptal edildi", event_completed: "Etkinlik tamamlandı", wrong_university: "Farklı üniversite", invalid_qr: "Geçersiz QR kodu", unauthorized_scanner: "Tarayıcı erişimi reddedildi", invited: "Davet edildi", left: "Ayrıldı" },
  errors: { ...errorsEn, authentication_required: "Devam etmek için giriş yap.", verified_student_required: "Yalnızca doğrulanmış üniversite öğrencileri bilet isteyebilir.", club_not_found: "Bu hesaba bağlı bir kulüp çalışma alanı yok.", club_not_approved: "Etkinlik yayınlamak için kulüp onaylanmalıdır.", club_access_denied: "Bu kulübü yönetme iznin yok.", finance_access_denied: "Bu işlem için finans erişimi gerekiyor.", scanner_access_denied: "Bu etkinlik için tarayıcı erişimi gerekiyor.", event_not_found: "Etkinlik bulunamadı.", event_not_editable: "Bu etkinlik artık düzenlenemez.", event_invalid: "Etkinlik bilgilerini kontrol edip tekrar dene.", event_cover_required: "Etkinliği göndermeden önce kapak görseli ekle.", event_unavailable: "Bu etkinlik için bilet talepleri kapalı.", ticket_not_found: "Bilet bulunamadı.", duplicate_ticket_request: "Bu etkinlik için zaten bir bilet talebin var.", no_places_available: "Şu anda boş yer yok.", reservation_expired: "Rezervasyonun süresi doldu. Yer varsa yeniden talep et.", invalid_payment_method: "Kullanılabilir bir ödeme yöntemi seç.", payment_evidence_required: "Ödeme dekontunu ekle.", rate_limited: "Çok fazla deneme yaptın. Biraz bekleyip tekrar dene.", invalid_qr: "QR kodu geçersiz veya süresi dolmuş.", unauthorized_scanner: "Bu etkinliğe tarayıcı olarak atanmadın.", generic: "Bir sorun oluştu. Tekrar dene." },
  statusText: "Durum", cancelEvent: "Etkinliği iptal et", cancelEventConfirm: "Bu etkinlik iptal edilsin mi? Mevcut bilet sahipleri etkinliği iptal edilmiş görecek.", paymentSubmitted: "Ödeme incelemeye gönderildi.", cashPaymentDeadline: "Nakit ödeme son tarihi", cashDeadlineHelp: "İsteğe bağlıdır. Boş bırakılırsa güvenli bir 24 saatlik süre uygulanır.", cashAwaitingArrangement: "Rezervasyon sona ermeden önce düzenleyici nakit ödemeyi ayarlamalıdır."
} satisfies EventsCopy;

const ru = {
  ...en,
  approvedClub: "Одобренный клуб",
  completePaymentBeforeExpiry: "Завершите обязательный шаг оплаты до окончания таймера.",
  submittedAt: "Отправлено",
  events: "События", discoverTitle: "Найдите следующее событие в кампусе", discoverDescription: "Открывайте одобренные события студенческих клубов вашего университета.", featured: "Рекомендуемые", upcoming: "Предстоящие события", searchPlaceholder: "Поиск по событиям, клубам и местам", search: "Найти", clearSearch: "Очистить поиск", noEvents: "Предстоящих событий по вашему запросу нет.", free: "Бесплатно", from: "От", placesLeft: "мест осталось", soldOut: "Мест нет", viewEvent: "Открыть событие", organizedBy: "Организатор", dateAndTime: "Дата и время", location: "Место", venueDetails: "Подробности места", ticketDetails: "Информация о билете", ticketDeadline: "Срок подачи заявки", capacity: "Вместимость", ageRequirement: "Возрастное ограничение", yearsAndOlder: "лет и старше", refundPolicy: "Правила возврата", reservePlace: "Забронировать место", choosePayment: "Выберите способ оплаты", bankTransfer: "Банковский перевод", cash: "Наличные", requestTicket: "Запросить билет", reservationCreated: "Место забронировано.", reservationEndsIn: "До конца брони", refreshingReservation: "Обновляем бронь…", myTickets: "Мои билеты", myTicketsDescription: "Следите за бронью, оплатой и статусом входа.", noTickets: "У вас пока нет билетов на события.", browseEvents: "Смотреть события", ticket: "Билет", payment: "Оплата", paymentReference: "Назначение платежа", optional: "Необязательно", receipt: "Квитанция", uploadReceipt: "Выбрать квитанцию", submitPayment: "Отправить оплату", arrangeCash: "Согласовать оплату наличными", cancelTicket: "Отменить билет", cancelConfirm: "Отменить эту заявку на билет?", paymentInstructions: "Инструкции по оплате", accountName: "Получатель", copied: "Скопировано", checkedInAt: "Вход отмечен", clarification: "Нужно уточнение", backToTickets: "Назад к билетам", publicCta: "Открыть в Cadesca", publicNote: "Войдите в студенческий аккаунт Cadesca, чтобы запросить билет.", clubDashboard: "Панель клуба", clubDashboardDescription: "Планируйте события, управляйте доступом и отслеживайте посещаемость.", clubEvents: "События клуба", createEvent: "Создать событие", editEvent: "Редактировать событие", finance: "Финансы", scanner: "Сканер", members: "Участники", overview: "Обзор", requests: "Заявки", activeReservations: "Активные брони", paymentsToReview: "Платежи на проверке", approvedTickets: "Одобренные билеты", checkedIn: "Вошли", remainingCapacity: "Осталось мест", checkInRate: "Доля входов", conversionRate: "Доля одобрений", noClubEvents: "У клуба пока нет созданных событий.", edit: "Изменить", submitForReview: "Отправить на проверку", eventFormDescription: "Сохраните полный черновик, затем отправьте его на проверку Cadesca.", title: "Название", description: "Описание", start: "Начало", end: "Окончание", timezone: "Часовой пояс", requestDeadline: "Срок запроса билетов", price: "Цена", currency: "Валюта", isFree: "Это бесплатное событие", allowBankTransfer: "Принимать банковские переводы", allowCash: "Принимать наличные", approvalMode: "Одобрение бесплатных билетов", iban: "IBAN", coverImage: "Обложка", paymentNotes: "Инструкции по оплате", saveDraft: "Сохранить черновик", draftSaved: "Черновик сохранён.", eventSaved: "Событие сохранено.", role: "Роль", financeDescription: "Проверяйте подтверждения оплаты и одобряйте билеты.", noFinanceRequests: "Нет заявок на билеты для проверки.", student: "Студент", actions: "Действия", approve: "Одобрить", reject: "Отклонить", requestClarification: "Запросить уточнение", confirmCash: "Подтвердить наличные", approveFree: "Одобрить бесплатный билет", refund: "Вернуть оплату", reviewMessage: "Сообщение студенту", openReceipt: "Открыть квитанцию", scannerEvents: "Назначенные события", scannerEventsDescription: "Откройте назначенное событие для сканирования QR-кодов Student Pass.", noScannerEvents: "У вас нет назначенных событий.", openScanner: "Открыть сканер", cameraScanner: "Сканер камеры", startCamera: "Включить камеру", stopCamera: "Остановить камеру", cameraUnavailable: "Сканирование камерой недоступно. Введите значение QR вручную.", manualQr: "Значение QR или ссылка пропуска", scan: "Сканировать пропуск", attendeeSearch: "Поиск участника", searchByName: "Поиск по имени или логину", recentEntries: "Последние входы", noRecentEntries: "Пока никто не вошёл.", confirmEntry: "Подтвердить вход", entryConfirmed: "Вход подтверждён.", scannedBy: "Сканировал", adminEvents: "Модерация событий", adminEventsDescription: "Проверяйте события клубов и управляйте рекомендациями.", moderationQueue: "Очередь модерации", pendingReview: "Ожидает проверки", featureEvent: "Добавить в рекомендуемые", removeFeature: "Убрать из рекомендуемых", featureUntil: "Рекомендовать до", rejectionReason: "Причина отклонения", noModerationEvents: "Очередь модерации пуста.", retry: "Повторить", loading: "Загружаем события…", somethingWentWrong: "Не удалось загрузить события.",
  status: { ...statusEn, pending_review: "Ожидает проверки", clarification_requested: "Запрошено уточнение", approved: "Одобрено", rejected: "Отклонено", suspended: "Приостановлено", archived: "В архиве", club_owner: "Владелец клуба", event_organizer: "Организатор события", finance_manager: "Финансовый менеджер", door_scanner: "Сканер на входе", draft: "Черновик", published: "Опубликовано", sold_out: "Мест нет", cancelled: "Отменено", completed: "Завершено", none: "Не рекомендуется", candidate: "Кандидат в рекомендации", expired: "Срок истёк", automatic: "Автоматическое одобрение", organizer_approval: "Одобрение организатора", bank_transfer: "Банковский перевод", cash: "Наличные", free: "Бесплатно", not_required: "Оплата не требуется", pending: "Ожидает", under_review: "На проверке", refunded: "Возвращено", active: "Активно", held_for_review: "Место удерживается на время проверки", released: "Освобождено", submitted: "Отправлено", checked_in: "Вход отмечен", revoked: "Отозвано", valid_ticket: "Действительный билет", already_checked_in: "Уже вошёл", payment_pending: "Ожидается оплата", payment_under_review: "Оплата проверяется", reservation_expired: "Бронь истекла", ticket_rejected: "Билет отклонён", ticket_cancelled: "Билет отменён", ticket_refunded: "Оплата билета возвращена", no_ticket: "Нет билета на это событие", event_cancelled: "Событие отменено", event_completed: "Событие завершено", wrong_university: "Другой университет", invalid_qr: "Недействительный QR-код", unauthorized_scanner: "Нет доступа к сканеру", invited: "Приглашён", left: "Вышел" },
  errors: { ...errorsEn, authentication_required: "Войдите, чтобы продолжить.", verified_student_required: "Запрашивать билеты могут только подтверждённые студенты университета.", club_not_found: "К этому аккаунту не привязано пространство клуба.", club_not_approved: "Для публикации событий клуб должен быть одобрен.", club_access_denied: "У вас нет права управлять этим клубом.", finance_access_denied: "Для этого действия нужен финансовый доступ.", scanner_access_denied: "Для этого события нужен доступ сканера.", event_not_found: "Событие не найдено.", event_not_editable: "Это событие больше нельзя редактировать.", event_invalid: "Проверьте данные события и повторите попытку.", event_cover_required: "Добавьте обложку перед отправкой события.", event_unavailable: "Запрос билетов на это событие закрыт.", ticket_not_found: "Билет не найден.", duplicate_ticket_request: "У вас уже есть заявка на это событие.", no_places_available: "Свободных мест сейчас нет.", reservation_expired: "Срок брони истёк. Запросите место снова, если оно доступно.", invalid_payment_method: "Выберите доступный способ оплаты.", payment_evidence_required: "Прикрепите квитанцию об оплате.", rate_limited: "Слишком много попыток. Подождите и повторите.", invalid_qr: "QR-код недействителен или просрочен.", unauthorized_scanner: "Вы не назначены сканером на это событие.", generic: "Что-то пошло не так. Повторите попытку." },
  statusText: "Статус", cancelEvent: "Отменить событие", cancelEventConfirm: "Отменить это событие? Владельцы билетов увидят, что событие отменено.", paymentSubmitted: "Оплата отправлена на проверку.", cashPaymentDeadline: "Срок оплаты наличными", cashDeadlineHelp: "Необязательно. Если оставить поле пустым, будет установлен безопасный срок в 24 часа.", cashAwaitingArrangement: "Организатор должен согласовать оплату наличными до истечения брони."
} satisfies EventsCopy;

const localizedErrors = {
  az: {
    ...az.errors,
    event_image_invalid: "JPG, PNG, WebP və ya AVIF örtük şəkli istifadə edin.",
    event_image_too_large: "Örtük şəkli çox böyükdür.",
    event_image_upload_failed: "Örtük şəkli yüklənmədi.",
    database_unavailable: "Tədbirlər müvəqqəti olaraq əlçatan deyil.",
    payment_not_available: "Bu ödəniş üsulu artıq əlçatan deyil.",
    payment_evidence_invalid: "PDF, JPG, PNG və ya WebP qəbzi istifadə edin.",
    payment_evidence_too_large: "Qəbz faylı çox böyükdür.",
    payment_evidence_upload_failed: "Qəbz yüklənmədi.",
    refund_required: "Bu ödənişli bilet ləğv edilmək əvəzinə geri ödənilməlidir.",
    ticket_transition_invalid: "Bu bilet cari statusunda dəyişdirilə bilməz.",
    internal_server_error: "Sorğu tamamlanmadı. Yenidən cəhd edin.",
    invalid_preview_token: "Skan önizləməsinin vaxtı bitdi. Keçidi yenidən oxudun.",
    admission_unavailable: "Giriş təsdiqlənmədi. Səhifəni yeniləyib yenidən cəhd edin.",
    request_not_allowed: "Təhlükəsizliyiniz üçün bu sorğu bloklandı.",
    scan_failed: "Keçid oxunmadı.",
    search_unavailable: "İştirakçı axtarışı müvəqqəti olaraq əlçatan deyil.",
    history_unavailable: "Son girişlər müvəqqəti olaraq əlçatan deyil.",
    club_member_invalid: "İstifadəçi adı və ya universitet e-poçtu daxil edin və mövcud klub rolunu seçin.",
    club_member_not_found: "Bu universitetdə həmin istifadəçi adı və ya e-poçtla aktiv tələbə tapılmadı.",
    club_membership_not_editable: "Bu üzvlük artıq dəyişib. Üzv siyahısını yeniləyib təkrar cəhd edin.",
    scanner_candidate_invalid: "Tədbirə təyin etməzdən əvvəl üzvün aktiv giriş skaneri rolu olmalıdır.",
    scanner_assignment_not_editable: "Bu skaner təyinatı artıq dəyişib. Tədbiri yeniləyib təkrar cəhd edin."
  },
  tr: {
    ...tr.errors,
    event_image_invalid: "JPG, PNG, WebP veya AVIF kapak görseli kullan.",
    event_image_too_large: "Kapak görseli çok büyük.",
    event_image_upload_failed: "Kapak görseli yüklenemedi.",
    database_unavailable: "Etkinlikler geçici olarak kullanılamıyor.",
    payment_not_available: "Bu ödeme yöntemi artık kullanılamıyor.",
    payment_evidence_invalid: "PDF, JPG, PNG veya WebP dekont kullan.",
    payment_evidence_too_large: "Dekont dosyası çok büyük.",
    payment_evidence_upload_failed: "Dekont yüklenemedi.",
    refund_required: "Bu ücretli bilet iptal edilmek yerine iade edilmelidir.",
    ticket_transition_invalid: "Bu bilet mevcut durumundan değiştirilemez.",
    internal_server_error: "İstek tamamlanamadı. Tekrar dene.",
    invalid_preview_token: "Tarama önizlemesinin süresi doldu. Kartı yeniden tara.",
    admission_unavailable: "Giriş onaylanamadı. Yenileyip tekrar dene.",
    request_not_allowed: "Bu istek güvenliğin için engellendi.",
    scan_failed: "Kart taranamadı.",
    search_unavailable: "Katılımcı araması geçici olarak kullanılamıyor.",
    history_unavailable: "Son girişler geçici olarak kullanılamıyor.",
    club_member_invalid: "Bir kullanıcı adı veya üniversite e-postası girin ve kullanılabilir bir kulüp rolü seçin.",
    club_member_not_found: "Bu üniversitede bu kullanıcı adı veya e-postayla eşleşen aktif öğrenci bulunamadı.",
    club_membership_not_editable: "Bu üyelik zaten değişti. Üye listesini yenileyip tekrar deneyin.",
    scanner_candidate_invalid: "Etkinliğe atanmadan önce üyenin etkin bir kapı tarayıcısı rolü olmalıdır.",
    scanner_assignment_not_editable: "Bu tarayıcı ataması zaten değişti. Etkinliği yenileyip tekrar deneyin."
  },
  ru: {
    ...ru.errors,
    event_image_invalid: "Используйте обложку в формате JPG, PNG, WebP или AVIF.",
    event_image_too_large: "Файл обложки слишком большой.",
    event_image_upload_failed: "Не удалось загрузить обложку.",
    database_unavailable: "События временно недоступны.",
    payment_not_available: "Этот способ оплаты больше недоступен.",
    payment_evidence_invalid: "Используйте квитанцию в формате PDF, JPG, PNG или WebP.",
    payment_evidence_too_large: "Файл квитанции слишком большой.",
    payment_evidence_upload_failed: "Не удалось загрузить квитанцию.",
    refund_required: "Для этого оплаченного билета нужен возврат, а не отмена.",
    ticket_transition_invalid: "Билет нельзя изменить из его текущего статуса.",
    internal_server_error: "Не удалось выполнить запрос. Повторите попытку.",
    invalid_preview_token: "Предварительный просмотр сканирования истёк. Отсканируйте пропуск снова.",
    admission_unavailable: "Не удалось подтвердить вход. Обновите страницу и повторите.",
    request_not_allowed: "Запрос заблокирован в целях безопасности.",
    scan_failed: "Не удалось отсканировать пропуск.",
    search_unavailable: "Поиск участников временно недоступен.",
    history_unavailable: "Последние входы временно недоступны.",
    club_member_invalid: "Введите имя пользователя или университетскую почту и выберите доступную роль клуба.",
    club_member_not_found: "Активный студент этого университета с таким именем пользователя или адресом не найден.",
    club_membership_not_editable: "Это членство уже изменилось. Обновите список участников и повторите попытку.",
    scanner_candidate_invalid: "Перед назначением на событие участнику нужна активная роль сканера на входе.",
    scanner_assignment_not_editable: "Это назначение сканера уже изменилось. Обновите событие и повторите попытку."
  }
} satisfies Record<Exclude<Language, "en">, Record<EventPresentationError, string>>;

export const eventsTranslations: Record<Language, EventsCopy> = {
  en,
  az: { ...az, errors: localizedErrors.az },
  tr: { ...tr, errors: localizedErrors.tr },
  ru: { ...ru, errors: localizedErrors.ru }
};

const localeByLanguage: Record<Language, string> = {
  en: "en-US",
  az: "az-AZ",
  tr: "tr-TR",
  ru: "ru-RU"
};

function normalizeErrorCode(value: string | null | undefined): EventPresentationError {
  const normalized = (value || "generic").replace(/^events\.error\./, "") as EventPresentationError;
  return normalized in errorsEn ? normalized : "generic";
}

export function useEventsI18n() {
  const { language } = useLanguage();
  const copy = eventsTranslations[language];
  const locale = localeByLanguage[language];

  return {
    language,
    locale,
    copy,
    statusLabel: (status: EventPresentationStatus) => copy.status[status],
    errorLabel: (error: string | null | undefined) => copy.errors[normalizeErrorCode(error)],
    formatDateTime: (value: string) => new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value)),
    formatCurrency: (amount: number, currency: string) => new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }).format(amount)
  };
}
