import { sql } from "./db";
import { msg } from "./templates";
import { notify, logEvent } from "./notify";
import { releaseItem } from "./queue";
import { runReminders } from "./reminders";
import { STALE_REQUEST_HOURS } from "./config";

let last = 0;

// Releases reservations nobody picked up in time, closes requests staff never reviewed,
// hands items to the next student in line, and sends due/overdue reminders.
// Pages call it (at most every 30 seconds per server) and the daily cron calls it with force = true.
export async function runMaintenance(force = false) {
  if (!force && Date.now() - last < 30_000) return;
  last = Date.now();

  const expired = await sql`
    update loans l set status = 'expired'
    from items i, users u
    where l.status = 'approved' and l.pickup_by < now() and i.id = l.item_id and u.id = l.user_id
    returning l.id, l.user_id, l.item_id, i.name as item_name, u.full_name`;

  for (const e of expired) {
    await logEvent(e.id, null, "pickup time missed, reservation released");
    await notify(e.user_id, "expired", msg.expired(e.full_name, e.item_name), e.id);
    await releaseItem(e.item_id);
  }

  // Requests waiting for staff longer than STALE_REQUEST_HOURS are closed so items are not locked forever.
  const stale = await sql`
    update loans l set status = 'expired'
    from items i, users u
    where l.status = 'requested'
      and coalesce(l.review_since, l.requested_at) < now() - make_interval(hours => ${STALE_REQUEST_HOURS}::int)
      and i.id = l.item_id and u.id = l.user_id
    returning l.id, l.user_id, l.item_id, i.name as item_name, u.full_name`;

  for (const s of stale) {
    await logEvent(s.id, null, `request not reviewed within ${STALE_REQUEST_HOURS} hours, closed`);
    await notify(s.user_id, "expired", msg.requestTimedOut(s.full_name, s.item_name), s.id);
    await releaseItem(s.item_id);
  }

  const reminders = await runReminders();
  return { expired: expired.length, stale: stale.length, ...reminders };
}