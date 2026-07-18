import assert from "node:assert/strict";

import {
  availableEventSlots,
  formatReservationClock,
  reservationSecondsRemaining,
  ticketConsumesCapacity,
  type CapacityTicketState
} from "../src/lib/events/domain";

const now = Date.parse("2026-07-18T12:00:00.000Z");

const active: CapacityTicketState = {
  reservationStatus: "active",
  reservationExpiresAt: "2026-07-18T12:30:00.000Z",
  ticketStatus: "pending"
};
const expired: CapacityTicketState = {
  reservationStatus: "active",
  reservationExpiresAt: "2026-07-18T11:59:59.000Z",
  ticketStatus: "pending"
};
const held: CapacityTicketState = {
  reservationStatus: "held_for_review",
  reservationExpiresAt: null,
  ticketStatus: "pending"
};
const approved: CapacityTicketState = {
  reservationStatus: "active",
  reservationExpiresAt: null,
  ticketStatus: "active"
};
const released: CapacityTicketState = {
  reservationStatus: "released",
  reservationExpiresAt: null,
  ticketStatus: "rejected"
};

assert.equal(ticketConsumesCapacity(active, now), true, "active unexpired reservations consume a slot");
assert.equal(ticketConsumesCapacity(expired, now), false, "expired active reservations immediately release a slot");
assert.equal(ticketConsumesCapacity(held, now), true, "held-for-review reservations consume a slot without a timer");
assert.equal(ticketConsumesCapacity(approved, now), true, "approved tickets consume a slot");
assert.equal(ticketConsumesCapacity(released, now), false, "released/rejected tickets do not consume a slot");
assert.equal(availableEventSlots(4, [active, expired, held, approved, released], now), 1);
assert.equal(availableEventSlots(1, [active, held], now), 0, "availability never becomes negative");
assert.equal(reservationSecondsRemaining("2026-07-18T12:30:00.000Z", now), 1800);
assert.equal(reservationSecondsRemaining("2026-07-18T11:59:59.000Z", now), 0);
assert.equal(formatReservationClock(1782), "29:42");

console.log("Events domain tests passed");

