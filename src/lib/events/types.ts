export type ClubStatus =
  | "pending_review"
  | "clarification_requested"
  | "approved"
  | "rejected"
  | "suspended"
  | "archived";

export type ClubRole = "club_owner" | "event_organizer" | "finance_manager" | "door_scanner";

export type EventStatus =
  | "draft"
  | "pending_review"
  | "published"
  | "sold_out"
  | "rejected"
  | "cancelled"
  | "completed"
  | "archived";

export type FeaturedStatus = "none" | "candidate" | "approved" | "expired";
export type FreeTicketMode = "automatic" | "organizer_approval";
export type ReservationStatus = "active" | "held_for_review" | "released" | "expired" | "cancelled";
export type TicketRequestStatus = "pending" | "submitted" | "approved" | "rejected" | "cancelled" | "expired";
export type PaymentMethod = "bank_transfer" | "cash" | "free";
export type PaymentStatus =
  | "not_required"
  | "pending"
  | "under_review"
  | "clarification_requested"
  | "approved"
  | "rejected"
  | "refunded";
export type TicketStatus = "pending" | "active" | "rejected" | "cancelled" | "refunded" | "checked_in" | "revoked" | "expired";

export type AdmissionResultCode =
  | "valid_ticket"
  | "already_checked_in"
  | "payment_pending"
  | "payment_under_review"
  | "reservation_expired"
  | "ticket_rejected"
  | "ticket_cancelled"
  | "ticket_refunded"
  | "no_ticket"
  | "event_cancelled"
  | "event_completed"
  | "wrong_university"
  | "invalid_qr"
  | "unauthorized_scanner";

export type EventDiscoveryItem = {
  id: string;
  slug: string;
  clubId: string;
  clubName: string;
  clubSlug: string;
  clubLogoUrl: string | null;
  title: string;
  description: string;
  coverImageUrl: string | null;
  location: string;
  venueDetails: string | null;
  startAt: string;
  endAt: string;
  timezone: string;
  ticketPrice: number;
  currency: string;
  isFree: boolean;
  capacity: number;
  availableSlots: number;
  ticketRequestDeadline: string;
  bankTransferEnabled: boolean;
  cashPaymentEnabled: boolean;
  freeTicketMode: FreeTicketMode;
  refundPolicy: string;
  ageRequirement: number | null;
  status: EventStatus;
  featuredStatus: FeaturedStatus;
  featuredUntil: string | null;
  publishedAt: string | null;
};

export type EventDetail = EventDiscoveryItem & {
  universityId: string;
  universityName: string;
  alreadyRequested: boolean;
  currentTicketId: string | null;
  currentTicketStatus: TicketStatus | null;
};

export type EventTicketView = {
  id: string;
  eventId: string;
  eventSlug: string;
  eventTitle: string;
  eventCoverImageUrl: string | null;
  clubName: string;
  location: string;
  startAt: string;
  endAt: string;
  reservationStatus: ReservationStatus;
  reservationExpiresAt: string | null;
  requestStatus: TicketRequestStatus;
  paymentMethod: PaymentMethod | null;
  paymentStatus: PaymentStatus;
  ticketStatus: TicketStatus;
  amount: number;
  currency: string;
  paymentReference: string | null;
  receiptAvailable: boolean;
  submittedPaymentAt: string | null;
  cashPaymentDeadline: string | null;
  clarificationMessage: string | null;
  refundRequiredAt: string | null;
  checkedInAt: string | null;
  createdAt: string;
  bankAccountName: string | null;
  iban: string | null;
  paymentInstructions: string | null;
};

export type ClubMembershipView = {
  id: string;
  userId: string;
  displayName: string;
  username: string | null;
  role: ClubRole;
  status: "invited" | "active" | "revoked" | "left" | "suspended";
  createdAt: string;
};

export type ClubEventSummary = EventDiscoveryItem & {
  requestCount: number;
  approvedCount: number;
  checkedInCount: number;
  iban: string | null;
  ibanAccountName: string | null;
  paymentInstructions: string | null;
};

export type ClubEventAttendee = {
  ticketId: string;
  displayName: string;
  username: string | null;
  reservationStatus: ReservationStatus;
  requestStatus: TicketRequestStatus;
  paymentMethod: PaymentMethod | null;
  paymentStatus: PaymentStatus;
  ticketStatus: TicketStatus;
  cashPaymentDeadline: string | null;
  checkedInAt: string | null;
  requestedAt: string;
};

export type EventScannerCandidate = {
  membershipId: string;
  userId: string;
  displayName: string;
  username: string | null;
  assigned: boolean;
};

export type ClubAuditEntry = {
  id: string;
  action: string;
  actorDisplayName: string | null;
  createdAt: string;
};

export type ClubEventOperations = {
  attendees: ClubEventAttendee[];
  scanners: EventScannerCandidate[];
  audit: ClubAuditEntry[];
};

export type ClubDashboard = {
  club: {
    id: string;
    universityId: string;
    name: string;
    slug: string;
    description: string;
    logoUrl: string | null;
    officialEmail: string;
    contactEmail: string;
    websiteUrl: string | null;
    instagramUrl: string | null;
    universityPageUrl: string | null;
    updatedAt: string;
    status: ClubStatus;
    rejectionReason: string | null;
    suspensionReason: string | null;
    clarificationMessage: string | null;
  };
  roles: ClubRole[];
  members: ClubMembershipView[];
  events: ClubEventSummary[];
  analytics: {
    totalRequests: number;
    activeReservations: number;
    paymentUnderReview: number;
    approvedTickets: number;
    rejectedRequests: number;
    expiredRequests: number;
    checkedInAttendees: number;
    remainingCapacity: number;
    checkInRate: number;
    conversionRate: number;
  };
};

export type ClubFinanceTicket = {
  id: string;
  eventId: string;
  eventTitle: string;
  studentDisplayName: string;
  studentUsername: string | null;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod | null;
  paymentStatus: PaymentStatus;
  reservationStatus: ReservationStatus;
  requestStatus: TicketRequestStatus;
  ticketStatus: TicketStatus;
  paymentReference: string | null;
  receiptAvailable: boolean;
  submittedPaymentAt: string | null;
  bankAccountName: string | null;
  iban: string | null;
  paymentInstructions: string | null;
  cashPaymentDeadline: string | null;
  clarificationMessage: string | null;
  refundRequiredAt: string | null;
};

export type ScannerAssignedEvent = {
  id: string;
  title: string;
  clubName: string;
  location: string;
  startAt: string;
  endAt: string;
  status: EventStatus;
  checkedInCount: number;
  approvedCount: number;
};

export type AdmissionPreview = {
  result: AdmissionResultCode;
  eventId: string;
  eventTitle: string;
  student: {
    id: string;
    displayName: string;
    username: string | null;
    avatarUrl: string | null;
    universityName: string | null;
  } | null;
  ticketId: string | null;
  checkedInAt: string | null;
  checkedInByName: string | null;
  confirmationToken: string | null;
};
