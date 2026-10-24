"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { sql } from "./db";
import { createSession, destroySession, requireUser } from "./session";
import { msg } from "./templates";
import { notify, logEvent } from "./notify";
import { MAX_ACTIVE, NO_SHOW_LIMIT, LATE_LIMIT, MAX_EXTENSIONS } from "./config";
import { noShowInfo, waitInfo, lateInfo } from "./queries";
import { promoteNext, releaseItem } from "./queue";
import { pickupDeadline } from "./schedule";
import { fmtDuration } from "./duration";
import { fmtDate } from "./format";

const enc = encodeURIComponent;
const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const done = () => revalidatePath("/", "layout");

// Staff pages an action may return to. Anything else falls back to the dashboard.
const STAFF_PAGES = ["/staff", "/staff/requests", "/staff/pickups", "/staff/loans"];
const backTo = (f: FormData) => {
  const v = text(f, "redirect_to");
  return STAFF_PAGES.includes(v) ? v : "/staff";
};

type LoanCtx = {
  id: number; status: string; user_id: number; item_id: number;
  item_name: string; hours: number; full_name: string;
};
async function loanCtx(id: number): Promise<LoanCtx | undefined> {
  const r = await sql`
    select l.id, l.status, l.user_id, l.item_id, i.name as item_name,
           coalesce(l.loan_hours, c.loan_days * 24) as hours, u.full_name
    from loans l join items i on i.id = l.item_id
    join categories c on c.id = i.category_id join users u on u.id = l.user_id
    where l.id = ${id}`;
  return r[0] as unknown as LoanCtx | undefined;
}

/* ---------- Sign in and out ---------- */

export async function login(formData: FormData) {
  const schoolId = text(formData, "school_id").toUpperCase();
  const password = String(formData.get("password") ?? "");
  const rows = await sql`select id, full_name, role, password_hash from users where upper(school_id) = ${schoolId} limit 1`;
  const u = rows[0];
  if (!u || !(await bcrypt.compare(password, u.password_hash))) redirect("/login?error=1");
  await createSession({ uid: u.id, role: u.role, name: u.full_name });
  redirect(u.role === "student" ? "/" : "/staff");
}

export async function logout() {
  destroySession();
  redirect("/login");
}

/* ---------- Student actions ---------- */

export async function requestItem(formData: FormData) {
  const me = await requireUser(["student"]);
  const itemId = Number(formData.get("item_id"));
  const hours = Math.round(Number(formData.get("hours")));
  const note = text(formData, "note").slice(0, 200) || null;

  const [check, itemRows, strikes] = await Promise.all([
    sql`select
          (select count(*)::int from loans where user_id = ${me.uid} and status in ('waitlisted','requested','approved','borrowed')) as active,
          exists (select 1 from loans where user_id = ${me.uid} and status = 'borrowed' and due_at < now()) as late,
          exists (select 1 from loans where user_id = ${me.uid} and item_id = ${itemId} and status in ('waitlisted','requested','approved','borrowed')) as dup`,
    sql`select i.id, i.name, i.status, coalesce(i.max_loan_hours, c.loan_days * 24) as max_hours,
               case i.approval when 'required' then true when 'none' then false else c.requires_approval end as needs_approval
        from items i join categories c on c.id = i.category_id where i.id = ${itemId}`,
    noShowInfo(me.uid),
  ]);
  const it = itemRows[0];
  const lateRec = await lateInfo(me.uid);
  if (!it) redirect(`/catalog?error=${enc("That item no longer exists.")}`);
  if (check[0].dup) redirect(`/catalog?error=${enc("You already have this item or are waiting for it.")}`);
  if (check[0].active >= MAX_ACTIVE)
    redirect(`/catalog?error=${enc(`You can have up to ${MAX_ACTIVE} items (including waitlisted ones) at a time. Return or cancel one first.`)}`);
  if (check[0].late) redirect(`/catalog?error=${enc("You have an overdue item. Return it before borrowing again.")}`);
  if (strikes.until)
    redirect(`/catalog?error=${enc(`Borrowing is paused until ${fmtDate(strikes.until)} because ${NO_SHOW_LIMIT} reservations were not picked up.`)}`);
    if (lateRec.until)
    redirect(`/catalog?error=${enc(`Borrowing is paused until ${fmtDate(lateRec.until)} because of ${LATE_LIMIT} late returns.`)}`);
  if (!(hours >= 1 && hours <= Number(it.max_hours)))
    redirect(`/catalog?error=${enc(`This item can be kept for up to ${fmtDuration(Number(it.max_hours))}. Choose a shorter time.`)}`);
  if (!["available", "reserved", "borrowed"].includes(it.status))
    redirect(`/catalog?error=${enc("That item is not available right now.")}`);

  // Free item: take it atomically so only one student can win it.
  let held: unknown[] = [];
  if (it.status === "available") {
    held = await sql`update items set status = 'reserved' where id = ${itemId} and status = 'available' returning id`;
  }

  if (held.length) {
    const needs = it.needs_approval as boolean;
    const kind = needs ? "requested" : "approved";
    const pickupBy = needs ? null : pickupDeadline();
    const m = needs
      ? msg.requested(me.name, it.name)
      : msg.autoApproved(me.name, it.name, fmtDuration(hours), pickupBy as Date);
    const nowIso = new Date().toISOString();

    await sql`
      with l as (
        insert into loans (item_id, user_id, status, note, loan_hours, decided_at, pickup_by, review_since)
        values (${itemId}, ${me.uid}, ${kind}, ${note}, ${hours},
                ${needs ? null : nowIso}::timestamptz, ${pickupBy ? pickupBy.toISOString() : null}::timestamptz,
                ${needs ? nowIso : null}::timestamptz)
        returning id),
      e as (
        insert into loan_events (loan_id, actor_id, event)
        select id, ${me.uid}::int, ${needs ? "requested" : "auto-approved"}::text from l)
      insert into notifications (user_id, kind, title, body, loan_id)
      select ${me.uid}::int, ${kind}::text, ${m.title}::text, ${m.body}::text, id from l`;

    done();
    redirect(`/?msg=${enc(needs ? "Request sent. We will message you when it is reviewed." : "Item reserved. Pick it up before the deadline shown on your loan.")}`);
  }

  // Item is in use (or was just taken): join the waitlist.
  // The unique index makes a double-click harmless: the second insert does nothing.
  const ins = await sql`
    insert into loans (item_id, user_id, status, note, loan_hours)
    values (${itemId}, ${me.uid}, 'waitlisted', ${note}, ${hours})
    on conflict (user_id, item_id) where status in ('waitlisted','requested','approved','borrowed') do nothing
    returning id`;
  if (!ins.length) redirect(`/catalog?error=${enc("You already have this item or are waiting for it.")}`);
  const loanId = ins[0].id as number;
  await logEvent(loanId, me.uid, "joined waitlist");
  await promoteNext(itemId); // covers the rare case where the item freed up a moment ago

  const now = (await sql`select status from loans where id = ${loanId}`)[0].status as string;
  if (now !== "waitlisted") {
    done();
    redirect(`/?msg=${enc("Good news, the item was free and is now reserved for you.")}`);
  }
  const info = (await waitInfo(me.uid)).get(loanId);
  await notify(me.uid, "waitlisted", msg.waitlisted(me.name, it.name, info?.position ?? 1, info?.estimate ?? new Date()), loanId);
  done();
  redirect(`/?msg=${enc(`You are number ${info?.position ?? 1} in line. We will message you when it is your turn.`)}`);
}

export async function cancelRequest(formData: FormData) {
  const me = await requireUser(["student"]);
  const id = Number(formData.get("loan_id"));
  const ctx = await loanCtx(id);
  if (ctx && ctx.user_id === me.uid && ["waitlisted", "requested", "approved"].includes(ctx.status)) {
    const heldItem = ctx.status !== "waitlisted";
    await sql`update loans set status = 'cancelled' where id = ${id}`;
    await logEvent(id, me.uid, "cancelled");
    await notify(me.uid, "cancelled", msg.cancelled(ctx.full_name, ctx.item_name), id);
    if (heldItem) await releaseItem(ctx.item_id);
  }
  done();
  redirect(`/?msg=${enc("Cancelled. The item was passed on to the next student if someone was waiting.")}`);
}

export async function extendLoan(formData: FormData) {
  const me = await requireUser(["student"]);
  const id = Number(formData.get("loan_id"));
  const hours = Math.round(Number(formData.get("hours")));
  const fail = (m: string): never => redirect(`/?error=${enc(m)}`);

  const r = await sql`
    select l.id, l.status, l.due_at, l.extensions, i.name as item_name, u.full_name,
      coalesce(i.max_loan_hours, c.loan_days * 24) as max_hours,
      case i.approval when 'required' then true when 'none' then false else c.requires_approval end as needs_approval,
      exists (select 1 from loans w where w.item_id = l.item_id and w.status = 'waitlisted') as queued
    from loans l join items i on i.id = l.item_id join categories c on c.id = i.category_id
    join users u on u.id = l.user_id
    where l.id = ${id} and l.user_id = ${me.uid}`;
  const l = r[0];
  if (!l || l.status !== "borrowed") return fail("That loan can no longer be extended.");
  if (new Date(l.due_at).getTime() < Date.now()) return fail("This item is already overdue. Please return it to the desk.");
  if (Number(l.extensions) >= MAX_EXTENSIONS) return fail("This loan was already extended.");
  if (l.queued) return fail("Other students are waiting for this item, so it cannot be extended.");
  if (l.needs_approval) return fail("This item needs staff approval to extend. Please ask the borrowing desk.");
  if (!(hours >= 1 && hours <= Number(l.max_hours)))
    return fail(`You can extend by up to ${fmtDuration(Number(l.max_hours))}.`);

  // Every rule is checked again inside the update, so a student cannot slip past it by timing.
  const u = await sql`
    update loans set due_at = due_at + make_interval(hours => ${hours}::int), extensions = extensions + 1,
      reminded_due_at = null, reminded_soon_at = null, last_overdue_notice_at = null
    where id = ${id} and user_id = ${me.uid} and status = 'borrowed' and due_at > now()
      and extensions < ${MAX_EXTENSIONS}::int
      and not exists (select 1 from loans w where w.item_id = loans.item_id and w.status = 'waitlisted')
    returning id, due_at`;
  if (!u.length) return fail("This loan could not be extended. Someone may have just joined the waitlist.");

  await logEvent(id, me.uid, `extended by ${fmtDuration(hours)}`);
  await notify(me.uid, "extended", msg.extended(l.full_name, l.item_name, u[0].due_at), id);
  done();
  redirect(`/?msg=${enc(`Extended. It is now due ${fmtDate(u[0].due_at)}.`)}`);
}

export async function markAllRead() {
  const me = await requireUser();
  await sql`update notifications set read_at = now() where user_id = ${me.uid} and read_at is null`;
  done();
}

/* ---------- Staff desk actions ---------- */

export async function decide(formData: FormData) {
  const me = await requireUser(["staff", "admin"]);
  const id = Number(formData.get("loan_id"));
  const approve = text(formData, "decision") === "approve";
  const reason = text(formData, "reason");
    const back = backTo(formData);
  const ctx = await loanCtx(id);
  if (!ctx || ctx.status !== "requested") redirect(`${back}?error=${enc("That request was already handled.")}`);
  if (!approve && !reason) redirect(`${back}?error=${enc("Add a short reason so the student knows why it was declined.")}`);

  if (approve) {
    const pickupBy = pickupDeadline();
    const m = msg.approved(ctx.full_name, ctx.item_name, fmtDuration(Number(ctx.hours)), pickupBy, reason);
    await sql`
      with u as (
        update loans set status = 'approved', decided_at = now(), handled_by = ${me.uid},
          decision_note = ${reason || null}, pickup_by = ${pickupBy.toISOString()}::timestamptz
        where id = ${id} and status = 'requested' returning id),
      e as (
        insert into loan_events (loan_id, actor_id, event) select id, ${me.uid}::int, 'approved'::text from u)
      insert into notifications (user_id, kind, title, body, loan_id)
      select ${ctx.user_id}::int, 'approved'::text, ${m.title}::text, ${m.body}::text, id from u`;
  } else {
    const m = msg.declined(ctx.full_name, ctx.item_name, reason);
    await sql`
      with u as (
        update loans set status = 'declined', decided_at = now(), handled_by = ${me.uid}, decision_note = ${reason}
        where id = ${id} and status = 'requested' returning id),
      e as (
        insert into loan_events (loan_id, actor_id, event) select id, ${me.uid}::int, 'declined'::text from u)
      insert into notifications (user_id, kind, title, body, loan_id)
      select ${ctx.user_id}::int, 'declined'::text, ${m.title}::text, ${m.body}::text, id from u`;
    await releaseItem(ctx.item_id);
  }
  done();
  redirect(`${back}?msg=${enc(approve ? "Approved. The student was messaged with the pickup deadline." : "Declined. The student was messaged.")}`);
}

export async function checkout(formData: FormData) {
  const me = await requireUser(["staff", "admin"]);
  const id = Number(formData.get("loan_id"));
    const back = backTo(formData);
  const ctx = await loanCtx(id);
  if (!ctx || ctx.status !== "approved") redirect(`${back}?error=${enc("That loan is not ready for pickup.")}`);

  const due = new Date(Date.now() + Number(ctx.hours) * 3_600_000);
  const m = msg.pickedUp(ctx.full_name, ctx.item_name, due);

  await sql`
    with u as (
      update loans set status = 'borrowed', borrowed_at = now(), due_at = ${due.toISOString()}::timestamptz, handled_by = ${me.uid}
      where id = ${id} and status = 'approved' returning id),
    i as (
      update items set status = 'borrowed' where id = ${ctx.item_id} and exists (select 1 from u)),
    e as (
      insert into loan_events (loan_id, actor_id, event) select id, ${me.uid}::int, 'checked out'::text from u)
    insert into notifications (user_id, kind, title, body, loan_id)
    select ${ctx.user_id}::int, 'picked_up'::text, ${m.title}::text, ${m.body}::text, id from u`;

  done();
  redirect(`${back}?msg=${enc("Checked out. The due date was sent to the student.")}`);
}
