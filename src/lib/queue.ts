import { sql } from "./db";
import { msg } from "./templates";
import { notify, logEvent } from "./notify";
import { pickupDeadline } from "./schedule";
import { fmtDuration } from "./duration";
import { NO_SHOW_DAYS, NO_SHOW_LIMIT, LATE_DAYS, LATE_LIMIT, LATE_PAUSE_DAYS } from "./config";

// When an item becomes free, the student who has waited longest gets it.
// Students who are overdue or paused for no-shows are skipped (they keep their place in line).
// Call this after any change that puts an item back to "available".
export async function promoteNext(itemId: number): Promise<void> {
  const rows = await sql`
    select l.id, l.user_id, u.full_name, i.name as item_name,
           coalesce(l.loan_hours, c.loan_days * 24) as hours,
           case i.approval when 'required' then true when 'none' then false else c.requires_approval end as needs_approval
    from loans l
    join items i on i.id = l.item_id
    join categories c on c.id = i.category_id
    join users u on u.id = l.user_id
    where l.item_id = ${itemId} and l.status = 'waitlisted' and i.status = 'available'
      and not exists (
        select 1 from loans o where o.user_id = l.user_id and o.status = 'borrowed' and o.due_at < now())
      and (select count(*) from loans x
             where x.user_id = l.user_id and x.status = 'expired'
               and x.pickup_by > now() - make_interval(days => ${NO_SHOW_DAYS}::int)) < ${NO_SHOW_LIMIT}::int
      and not exists (
        select 1 from (
          select count(*) as n, max(x.returned_at) as last_at from loans x
          where x.user_id = l.user_id and x.returned_late
            and x.returned_at > now() - make_interval(days => ${LATE_DAYS}::int)) s
        where s.n >= ${LATE_LIMIT}::int and s.last_at + make_interval(days => ${LATE_PAUSE_DAYS}::int) > now())
    order by l.requested_at, l.id
    limit 1`;
  const next = rows[0];
  if (!next) return;

  const held = await sql`update items set status = 'reserved' where id = ${itemId} and status = 'available' returning id`;
  if (!held.length) return; // someone else got there first

  if (next.needs_approval) {
    await sql`update loans set status = 'requested', review_since = now() where id = ${next.id}`;
    await notify(next.user_id, "turn", msg.turnNeedsApproval(next.full_name, next.item_name), next.id);
    await logEvent(next.id, null, "moved up from waitlist, awaiting approval");
  } else {
    const pickupBy = pickupDeadline();
    await sql`update loans set status = 'approved', decided_at = now(), pickup_by = ${pickupBy.toISOString()}::timestamptz where id = ${next.id}`;
    await notify(next.user_id, "turn", msg.turnReady(next.full_name, next.item_name, fmtDuration(next.hours), pickupBy), next.id);
    await logEvent(next.id, null, "moved up from waitlist, ready for pickup");
  }
}

// Free an item that was held for a student, then offer it to the next in line.
export async function releaseItem(itemId: number): Promise<void> {
  await sql`update items set status = 'available' where id = ${itemId} and status = 'reserved'`;
  await promoteNext(itemId);
}

// Call after an item's status changes (return, damage report, repair, retire, lost, restore).
// available: offer it to the next student.
// retired / lost: close the waitlist, nobody will ever get it.
// damaged / under_repair: tell the waitlist once; they keep their place.
export async function afterItemChange(itemId: number, status: string, prevStatus?: string): Promise<void> {
  if (status === "available") return promoteNext(itemId);

  const closing = status === "retired" || status === "lost";
  const pausing = status === "damaged" || status === "under_repair";
  if (!closing && !pausing) return;
  if (pausing && (prevStatus === "damaged" || prevStatus === "under_repair")) return; // already told them

  const waiting = await sql`
    select l.id, l.user_id, u.full_name, i.name as item_name
    from loans l join items i on i.id = l.item_id join users u on u.id = l.user_id
    where l.item_id = ${itemId} and l.status = 'waitlisted'
    order by l.requested_at, l.id`;

  for (const w of waiting) {
    if (closing) {
      const r = await sql`update loans set status = 'cancelled' where id = ${w.id} and status = 'waitlisted' returning id`;
      if (!r.length) continue;
      await logEvent(w.id, null, "waitlist closed, item can no longer be lent");
      await notify(w.user_id, "cancelled", msg.waitlistClosed(w.full_name, w.item_name), w.id);
    } else {
      await notify(w.user_id, "waitlisted", msg.itemOutOfService(w.full_name, w.item_name), w.id);
    }
  }
}