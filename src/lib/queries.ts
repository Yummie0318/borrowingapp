import { sql } from "./db";
import { NO_SHOW_DAYS, NO_SHOW_LIMIT, LATE_DAYS, LATE_LIMIT, LATE_PAUSE_DAYS } from "./config";
import type { LoanRow } from "./types";

export async function loansForUser(userId: number): Promise<LoanRow[]> {
  const rows = await sql`
    select l.id, l.status, l.note, l.decision_note, l.requested_at, l.due_at, l.borrowed_at,
           l.returned_at, l.pickup_by, l.loan_hours, l.return_condition,
           i.id as item_id, i.name as item_name, i.code as item_code,
           c.name as category, c.loan_days,
           u.id as user_id, u.full_name, u.school_id, u.grade_section
    from loans l
    join items i on i.id = l.item_id
    join categories c on c.id = i.category_id
    join users u on u.id = l.user_id
    where l.user_id = ${userId}
    order by l.requested_at desc`;
  return rows as unknown as LoanRow[];
}

export async function loansByStatus(status: string): Promise<LoanRow[]> {
  const rows = await sql`
    select l.id, l.status, l.note, l.decision_note, l.requested_at, l.due_at, l.borrowed_at,
           l.returned_at, l.pickup_by, l.loan_hours, l.return_condition,
           i.id as item_id, i.name as item_name, i.code as item_code,
           c.name as category, c.loan_days,
           u.id as user_id, u.full_name, u.school_id, u.grade_section
    from loans l
    join items i on i.id = l.item_id
    join categories c on c.id = i.category_id
    join users u on u.id = l.user_id
    where l.status = ${status}
    order by coalesce(l.due_at, l.pickup_by, l.requested_at) asc`;
  return rows as unknown as LoanRow[];
}

export async function unreadCount(userId: number): Promise<number> {
  const r = await sql`select count(*)::int as n from notifications where user_id = ${userId} and read_at is null`;
  return (r[0]?.n as number) ?? 0;
}

export type WaitInfo = { position: number; estimate: Date };

// Place in line and a rough "available around" date for each waitlisted loan of a student.
// Estimate = when the current holder is done + the time of everyone ahead (plus a day each for pickup).
export async function waitInfo(userId: number): Promise<Map<number, WaitInfo>> {
  const rows = await sql`
    select l.id,
      (select count(*)::int from loans w where w.item_id = l.item_id and w.status = 'waitlisted'
         and (w.requested_at, w.id) < (l.requested_at, l.id)) as ahead,
      (select coalesce(sum(w.loan_hours), 0)::int from loans w where w.item_id = l.item_id and w.status = 'waitlisted'
         and (w.requested_at, w.id) < (l.requested_at, l.id)) as ahead_hours,
      (select coalesce(h.due_at, coalesce(h.pickup_by, now() + interval '1 day') + make_interval(hours => coalesce(h.loan_hours, 24)))
         from loans h where h.item_id = l.item_id and h.status in ('requested','approved','borrowed') limit 1) as holder_end
    from loans l where l.user_id = ${userId} and l.status = 'waitlisted'`;
  const map = new Map<number, WaitInfo>();
  for (const r of rows) {
    const base = Math.max(r.holder_end ? new Date(r.holder_end).getTime() : 0, Date.now());
    map.set(r.id, {
      position: Number(r.ahead) + 1,
      estimate: new Date(base + (Number(r.ahead_hours) + Number(r.ahead) * 24) * 3_600_000),
    });
  }
  return map;
}

// Missed pickups in the last NO_SHOW_DAYS. At NO_SHOW_LIMIT, borrowing pauses until the oldest one ages out.
export async function noShowInfo(userId: number): Promise<{ count: number; until: Date | null }> {
  const rows = await sql`
    select pickup_by from loans
    where user_id = ${userId} and status = 'expired' and pickup_by > now() - make_interval(days => ${NO_SHOW_DAYS})
    order by pickup_by asc`;
  const count = rows.length;
  const until =
    count >= NO_SHOW_LIMIT
      ? new Date(new Date(rows[count - NO_SHOW_LIMIT].pickup_by).getTime() + NO_SHOW_DAYS * 86_400_000)
      : null;
  return { count, until };
}
// Late returns in the last LATE_DAYS. At LATE_LIMIT, borrowing pauses for LATE_PAUSE_DAYS after the latest one.
export async function lateInfo(userId: number): Promise<{ count: number; until: Date | null }> {
  const rows = await sql`
    select returned_at from loans
    where user_id = ${userId} and returned_late and returned_at > now() - make_interval(days => ${LATE_DAYS}::int)
    order by returned_at desc`;
  const count = rows.length;
  const until = count >= LATE_LIMIT ? new Date(new Date(rows[0].returned_at).getTime() + LATE_PAUSE_DAYS * 86_400_000) : null;
  return { count, until: until && until.getTime() > Date.now() ? until : null };
}

export type ExtendInfo = { extensions: number; maxHours: number; needsApproval: boolean; queued: boolean };

// What a student needs to know to extend each of their borrowed items.
export async function extendInfo(userId: number): Promise<Map<number, ExtendInfo>> {
  const rows = await sql`
    select l.id, l.extensions,
      coalesce(i.max_loan_hours, c.loan_days * 24) as max_hours,
      case i.approval when 'required' then true when 'none' then false else c.requires_approval end as needs_approval,
      exists (select 1 from loans w where w.item_id = l.item_id and w.status = 'waitlisted') as queued
    from loans l join items i on i.id = l.item_id join categories c on c.id = i.category_id
    where l.user_id = ${userId} and l.status = 'borrowed'`;
  const map = new Map<number, ExtendInfo>();
  for (const r of rows) {
    map.set(r.id, {
      extensions: Number(r.extensions),
      maxHours: Number(r.max_hours),
      needsApproval: Boolean(r.needs_approval),
      queued: Boolean(r.queued),
    });
  }
  return map;
}