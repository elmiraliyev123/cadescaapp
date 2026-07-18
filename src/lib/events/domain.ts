import type { ReservationStatus, TicketStatus } from "@/lib/events/types";

export type CapacityTicketState = {
  reservationStatus: ReservationStatus;
  reservationExpiresAt: string | null;
  ticketStatus: TicketStatus;
};

export function ticketConsumesCapacity(ticket: CapacityTicketState, now = Date.now()) {
  if (ticket.ticketStatus === "active" || ticket.ticketStatus === "checked_in") return true;
  if (ticket.reservationStatus === "held_for_review") return true;
  return (
    ticket.reservationStatus === "active" &&
    Boolean(ticket.reservationExpiresAt) &&
    new Date(ticket.reservationExpiresAt!).getTime() > now
  );
}

export function availableEventSlots(capacity: number, tickets: CapacityTicketState[], now = Date.now()) {
  if (!Number.isInteger(capacity) || capacity < 0) throw new Error("invalid_capacity");
  const consumed = tickets.reduce((count, ticket) => count + (ticketConsumesCapacity(ticket, now) ? 1 : 0), 0);
  return Math.max(0, capacity - consumed);
}

export function reservationSecondsRemaining(expiresAt: string | null, serverNow: string | number | Date) {
  if (!expiresAt) return 0;
  const expires = new Date(expiresAt).getTime();
  const now = new Date(serverNow).getTime();
  if (!Number.isFinite(expires) || !Number.isFinite(now)) return 0;
  return Math.max(0, Math.ceil((expires - now) / 1000));
}

export function formatReservationClock(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60).toString().padStart(2, "0");
  const remainder = (safe % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

