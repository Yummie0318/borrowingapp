import { DESK_CLOSE_HOUR } from "./config";

const OFFSET = 8 * 3_600_000; // Manila is UTC+8 with no daylight saving

// Pickup deadline for a reservation made now: today at closing time,
// or tomorrow if less than 30 minutes are left.
export function pickupDeadline(from = new Date()): Date {
  const local = new Date(from.getTime() + OFFSET);
  let t = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), DESK_CLOSE_HOUR) - OFFSET;
  if (t - from.getTime() < 30 * 60_000) t += 86_400_000;
  return new Date(t);
}
