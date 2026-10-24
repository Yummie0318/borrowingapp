// Every automatic message the student receives lives here. Edit the wording freely.
import { fmtDate, fmtDateTime } from "./format";
import { NO_SHOW_DAYS, NO_SHOW_LIMIT, STALE_REQUEST_HOURS, GRACE_MINUTES, LATE_LIMIT, LATE_DAYS, LATE_PAUSE_DAYS } from "./config";
import { fmtMoney } from "./money";

type Msg = { title: string; body: string };
type D = Date | string;
const first = (name: string) => name.trim().split(" ")[0];

export const msg = {
  requested: (name: string, item: string): Msg => ({
    title: "Request received",
    body: `Hi ${first(name)}, we got your request for "${item}". A staff member will review it and you will get a message as soon as it is decided.`,
  }),

  autoApproved: (name: string, item: string, duration: string, pickupBy: D): Msg => ({
    title: "Reserved for you",
    body: `Hi ${first(name)}, "${item}" is set aside for you. Pick it up at the borrowing desk by ${fmtDateTime(pickupBy)} and bring your school ID. You can keep it for ${duration}. If you cannot make it, cancel the request so the next student gets a turn.`,
  }),

  approved: (name: string, item: string, duration: string, pickupBy: D, note?: string | null): Msg => ({
    title: "Request approved",
    body:
      `Good news, ${first(name)}! Your request for "${item}" was approved. Pick it up at the borrowing desk by ${fmtDateTime(pickupBy)} and bring your school ID. You can keep it for ${duration}. If it is not picked up in time, the reservation is released.` +
      (note ? ` Note from staff: ${note}` : ""),
  }),

  declined: (name: string, item: string, reason: string): Msg => ({
    title: "Request declined",
    body: `Hi ${first(name)}, we could not approve your request for "${item}". Reason: ${reason}. You can request a different item, or ask the borrowing desk if you have questions.`,
  }),

  cancelled: (name: string, item: string): Msg => ({
    title: "Request cancelled",
    body: `Hi ${first(name)}, your request for "${item}" was cancelled and the item is available to others again.`,
  }),

  waitlisted: (name: string, item: string, position: number, estimate: D): Msg => ({
    title: "You are on the waitlist",
    body: `Hi ${first(name)}, "${item}" is in use right now, so you are number ${position} in line. We expect it to be your turn around ${fmtDate(estimate)}. We will message you the moment it is ready.`,
  }),

  turnReady: (name: string, item: string, duration: string, pickupBy: D): Msg => ({
    title: "It is your turn",
    body: `Hi ${first(name)}, "${item}" is free and reserved for you. Pick it up by ${fmtDateTime(pickupBy)} with your school ID. You can keep it for ${duration}. If you miss the pickup time, the next student in line gets it.`,
  }),

  turnNeedsApproval: (name: string, item: string): Msg => ({
    title: "It is your turn",
    body: `Hi ${first(name)}, "${item}" is free and held for you. Your request is now waiting for staff approval, and you will get a message once it is decided.`,
  }),

  expired: (name: string, item: string): Msg => ({
    title: "Reservation expired",
    body: `Hi ${first(name)}, "${item}" was not picked up in time, so it was released for the next student. You can request it again. Missing ${NO_SHOW_LIMIT} pickups within ${NO_SHOW_DAYS} days pauses borrowing for a while.`,
  }),

  pickedUp: (name: string, item: string, due: D): Msg => ({
    title: "Item checked out",
    body: `Hi ${first(name)}, you borrowed "${item}". Please return it to the borrowing desk by ${fmtDateTime(due)}. We will remind you before it is due.`,
  }),

  dueSoon: (name: string, item: string, due: D): Msg => ({
    title: "Due soon",
    body: `Hi ${first(name)}, "${item}" is due on ${fmtDateTime(due)}. Please return it on time so the next student can use it.`,
  }),

  overdue: (name: string, item: string, due: D): Msg => ({
    title: "Overdue item",
    body: `Hi ${first(name)}, "${item}" was due on ${fmtDateTime(due)}. Please return it to the borrowing desk today. You cannot borrow new items until it is returned.`,
  }),

  returned: (name: string, item: string): Msg => ({
    title: "Return confirmed",
    body: `Thank you, ${first(name)}! "${item}" is back at the desk. You are free to borrow again.`,
  }),

  damaged: (name: string, item: string): Msg => ({
    title: "Damage reported",
    body: `Hi ${first(name)}, "${item}" came back with damage. A teacher will contact you about the next steps. Your return has been recorded.`,
  }),

  requestTimedOut: (name: string, item: string): Msg => ({
    title: "Request closed",
    body: `Hi ${first(name)}, your request for "${item}" was not reviewed within ${STALE_REQUEST_HOURS} hours, so it was closed and the item was released. You can request it again, or ask the borrowing desk if it is urgent.`,
  }),

  itemOutOfService: (name: string, item: string): Msg => ({
    title: "Item temporarily unavailable",
    body: `Hi ${first(name)}, "${item}" needs checking or repair, so it cannot be lent right now. You keep your place in line and we will message you when it is back. You can leave the waitlist any time from My loans.`,
  }),

  waitlistClosed: (name: string, item: string): Msg => ({
    title: "Waitlist closed",
    body: `Hi ${first(name)}, "${item}" can no longer be lent (it is lost or cannot be repaired), so your place in line was removed. You can browse the catalog for something similar.`,
  }),

    extended: (name: string, item: string, due: D): Msg => ({
    title: "Loan extended",
    body: `Hi ${first(name)}, your loan of "${item}" was extended. It is now due on ${fmtDateTime(due)}.`,
  }),

  returnedLate: (name: string, item: string): Msg => ({
    title: "Return confirmed (late)",
    body: `Thank you, ${first(name)}. "${item}" is back at the desk, but it was returned late. Returning late ${LATE_LIMIT} times within ${LATE_DAYS} days pauses borrowing for ${LATE_PAUSE_DAYS} days. Returns within ${GRACE_MINUTES} minutes of the due time are not counted.`,
  }),

  lostItem: (name: string, item: string, cost: number | null): Msg => ({
    title: "Item marked as lost",
    body: `Hi ${first(name)}, "${item}" was marked as lost. ${cost === null ? "" : `The replacement cost on record is ${fmtMoney(cost)}. `}A teacher will contact you about the next steps.`,
  }),
};
