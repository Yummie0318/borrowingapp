import { sql } from "./db";
import { msg } from "./templates";
import { notify } from "./notify";

// "Due soon" at 24 hours and 2 hours before, then a daily "overdue" message (the first one
// goes out as soon as the item is overdue). Each loan is claimed with an UPDATE first, so
// two servers running this at once never double-send.
export async function runReminders() {
  const [soon, soon2, late] = await Promise.all([
    sql`
      update loans l set reminded_due_at = now()
      from items i, users u
      where i.id = l.item_id and u.id = l.user_id
        and l.status = 'borrowed'
        and l.due_at > now() + interval '2 hours' and l.due_at <= now() + interval '1 day'
        and l.due_at - l.borrowed_at > interval '1 day'
        and l.reminded_due_at is null
      returning l.id, l.user_id, l.due_at, i.name as item_name, u.full_name`,
    sql`
      update loans l set reminded_soon_at = now(), reminded_due_at = coalesce(l.reminded_due_at, now())
      from items i, users u
      where i.id = l.item_id and u.id = l.user_id
        and l.status = 'borrowed'
        and l.due_at > now() and l.due_at <= now() + interval '2 hours'
        and l.due_at - l.borrowed_at > interval '2 hours'
        and l.reminded_soon_at is null
      returning l.id, l.user_id, l.due_at, i.name as item_name, u.full_name`,
    sql`
      update loans l set last_overdue_notice_at = now()
      from items i, users u
      where i.id = l.item_id and u.id = l.user_id
        and l.status = 'borrowed' and l.due_at < now()
        and (l.last_overdue_notice_at is null or l.last_overdue_notice_at < now() - interval '1 day')
      returning l.id, l.user_id, l.due_at, i.name as item_name, u.full_name`,
  ]);

  await Promise.all([
    ...soon.map((l) => notify(l.user_id, "due_soon", msg.dueSoon(l.full_name, l.item_name, l.due_at), l.id)),
    ...soon2.map((l) => notify(l.user_id, "due_soon", msg.dueSoon(l.full_name, l.item_name, l.due_at), l.id)),
    ...late.map((l) => notify(l.user_id, "overdue", msg.overdue(l.full_name, l.item_name, l.due_at), l.id)),
  ]);
  return { dueSoon: soon.length + soon2.length, overdue: late.length };
}