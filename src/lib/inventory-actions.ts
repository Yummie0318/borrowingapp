"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "./db";
import { requireUser } from "./session";
import { msg } from "./templates";
import { afterItemChange } from "./queue";
import { GRACE_MINUTES } from "./config";
import { fmtMoney } from "./money";

const enc = encodeURIComponent;
const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const done = () => revalidatePath("/", "layout");

// Staff pages an action may return to. Anything else falls back to the dashboard.
const STAFF_PAGES = ["/staff", "/staff/requests", "/staff/pickups", "/staff/loans"];
const backTo = (f: FormData) => {
  const v = text(f, "redirect_to");
  return STAFF_PAGES.includes(v) ? v : "/staff";
};

const repText = (rep: string) =>
  rep === "yes" ? "Repairable." : rep === "no" ? "Not repairable." : "Not assessed yet.";

// Borrowing rules from the item forms: maximum time (hours or days) and approval setting.
function rules(f: FormData) {
  const v = Number(f.get("max_value"));
  const unit = text(f, "max_unit");
  const hours = Number.isFinite(v) && v > 0 ? Math.min(1440, Math.max(1, Math.round(unit === "hours" ? v : v * 24))) : null;
  const a = text(f, "approval");
  const approval = a === "required" || a === "none" ? a : "inherit";
  return { hours, approval };
}

// Unit cost from the item forms. Blank means "not set".
function parseCost(f: FormData): { cost: number | null; bad: boolean } {
  const raw = text(f, "unit_cost").replace(/,/g, "");
  if (!raw) return { cost: null, bad: false };
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 99999999) return { cost: null, bad: true };
  return { cost: Math.round(n * 100) / 100, bad: false };
}

/* ---------- Categories ---------- */

const catUrl = (k: "msg" | "error", v: string) => `/staff/items?tab=categories&${k}=${enc(v)}`;
const clampDays = (v: FormDataEntryValue | null) => Math.max(1, Math.min(60, Math.round(Number(v)) || 1));

export async function addCategory(formData: FormData) {
  await requireUser(["staff", "admin"]);
  const name = text(formData, "name");
  if (!name) redirect(catUrl("error", "Give the category a name."));
  const days = clampDays(formData.get("loan_days"));
  const approval = formData.get("requires_approval") === "on";

  const r = await sql`
    insert into categories (name, loan_days, requires_approval) values (${name}, ${days}, ${approval})
    on conflict (name) do nothing returning id`;
  if (!r.length) redirect(catUrl("error", `A category named "${name}" already exists.`));
  done();
  redirect(catUrl("msg", `Category "${name}" added.`));
}

export async function updateCategory(formData: FormData) {
  await requireUser(["staff", "admin"]);
  const id = Number(formData.get("id"));
  const name = text(formData, "name");
  if (!name) redirect(catUrl("error", "A category needs a name."));
  const days = clampDays(formData.get("loan_days"));
  const approval = formData.get("requires_approval") === "on";

  const dup = await sql`select 1 from categories where lower(name) = lower(${name}) and id <> ${id}`;
  if (dup.length) redirect(catUrl("error", `Another category is already named "${name}".`));
  await sql`update categories set name = ${name}, loan_days = ${days}, requires_approval = ${approval} where id = ${id}`;
  done();
  redirect(catUrl("msg", "Category saved. Items without their own rules follow it from now on."));
}

export async function deleteCategory(formData: FormData) {
  await requireUser(["staff", "admin"]);
  const id = Number(formData.get("id"));
  const r = await sql`
    delete from categories c where c.id = ${id}
    and not exists (select 1 from items i where i.category_id = c.id) returning c.id`;
  if (!r.length) redirect(catUrl("error", "This category still has items. Move or delete them first."));
  done();
  redirect(catUrl("msg", "Category deleted."));
}

/* ---------- Items ---------- */

export async function addItem(formData: FormData) {
  await requireUser(["staff", "admin"]);
  const code = text(formData, "code").toUpperCase();
  const name = text(formData, "name");
  const categoryId = Number(formData.get("category_id"));
  const description = text(formData, "description") || null;
  const { hours, approval } = rules(formData);
  const { cost, bad } = parseCost(formData);
  if (!code || !name || !categoryId) redirect(`/staff/items?error=${enc("Code, name and category are required.")}`);
  if (bad) redirect(`/staff/items?error=${enc("Unit cost must be a number of 0 or more.")}`);

  const r = await sql`
    insert into items (code, name, category_id, description, max_loan_hours, approval, unit_cost)
    values (${code}, ${name}, ${categoryId}, ${description}, ${hours}::int, ${approval}, ${cost}::numeric)
    on conflict (code) do nothing returning id`;
  if (!r.length) redirect(`/staff/items?error=${enc(`The code ${code} is already used.`)}`);
  done();
  redirect(`/staff/items?msg=${enc("Item added to the catalog.")}`);
}

export async function updateItem(formData: FormData) {
  await requireUser(["staff", "admin"]);
  const id = Number(formData.get("item_id"));
  const code = text(formData, "code").toUpperCase();
  const name = text(formData, "name");
  const categoryId = Number(formData.get("category_id"));
  const description = text(formData, "description") || null;
  const { hours, approval } = rules(formData);
  const { cost, bad } = parseCost(formData);
  const back = `/staff/items/${id}`;
  if (!code || !name || !categoryId) redirect(`${back}?error=${enc("Code, name and category are required.")}`);
  if (bad) redirect(`${back}?error=${enc("Unit cost must be a number of 0 or more.")}`);

  const dup = await sql`select 1 from items where code = ${code} and id <> ${id}`;
  if (dup.length) redirect(`${back}?error=${enc(`The code ${code} is already used by another item.`)}`);
  await sql`update items set code = ${code}, name = ${name}, category_id = ${categoryId}, description = ${description},
            max_loan_hours = ${hours}::int, approval = ${approval}, unit_cost = ${cost}::numeric where id = ${id}`;
  done();
  redirect(`${back}?msg=${enc("Item saved. New borrowing rules apply to future requests.")}`);
}

export async function deleteItem(formData: FormData) {
  await requireUser(["staff", "admin"]);
  const id = Number(formData.get("item_id"));
  const r = await sql`
    delete from items i where i.id = ${id}
    and i.status in ('available','damaged','under_repair','retired','lost')
    and not exists (select 1 from loans l where l.item_id = i.id) returning i.id`;
  if (!r.length) redirect(`/staff/items/${id}?error=${enc("Items with loan history cannot be deleted. Mark it as not repairable instead.")}`);
  done();
  redirect(`/staff/items?msg=${enc("Item deleted.")}`);
}

// One action for every condition change: report, assess, repaired, retire, restore, lost.
export async function setItemCondition(formData: FormData) {
  const me = await requireUser(["staff", "admin"]);
  const id = Number(formData.get("item_id"));
  const op = text(formData, "op");
  const reason = text(formData, "reason");
  const notes = text(formData, "notes");
  const rep = text(formData, "repairable"); // yes | no | unsure
  const back = `/staff/items/${id}`;

  const cur = (await sql`select status from items where id = ${id}`)[0];
  if (!cur) redirect("/staff/items");
  if (["reserved", "borrowed"].includes(cur.status))
    redirect(`${back}?error=${enc("This item is in use. Handle the loan from the dashboard first.")}`);

  let status: string = cur.status;
  let event = "";
  let repairable: boolean | null = null;
  let clear = false;

  if (op === "report") {
    if (!reason) redirect(`${back}?error=${enc("Describe what is wrong with the item.")}`);
    status = rep === "yes" ? "under_repair" : rep === "no" ? "retired" : "damaged";
    repairable = rep === "yes" ? true : rep === "no" ? false : null;
    event = `Reported damaged: ${reason}. ${repText(rep)}`;
  } else if (op === "assess") {
    if (rep !== "yes" && rep !== "no") redirect(`${back}?error=${enc("Choose repairable or not repairable.")}`);
    status = rep === "yes" ? "under_repair" : "retired";
    repairable = rep === "yes";
    event = `Assessed: ${repText(rep)}`;
  } else if (op === "repaired") {
    status = "available"; clear = true; event = "Repaired and back in circulation";
  } else if (op === "retire") {
    status = "retired"; repairable = false; event = "Retired as not repairable";
  } else if (op === "restore") {
    status = "available"; clear = true; event = "Put back in circulation";
  } else if (op === "lost") {
    status = "lost"; event = "Marked as lost";
  } else {
    redirect(back);
  }
  if (notes) event += `. Note: ${notes}`;

  if (op === "report") {
    await sql`update items set status = ${status}, damage_reason = ${reason}, repairable = ${repairable}::boolean,
              damaged_at = now(), repair_notes = ${notes || null} where id = ${id}`;
  } else if (clear) {
    await sql`update items set status = ${status}, damage_reason = null, repairable = null,
              damaged_at = null, repair_notes = null where id = ${id}`;
  } else if (op === "assess" || op === "retire") {
    await sql`update items set status = ${status}, repairable = ${repairable}::boolean,
              repair_notes = coalesce(${notes || null}, repair_notes) where id = ${id}`;
  } else {
    await sql`update items set status = ${status} where id = ${id}`;
  }
  await sql`insert into item_events (item_id, actor_id, event) values (${id}, ${me.uid}, ${event})`;

  await afterItemChange(id, status, cur.status);
  done();
  redirect(`${back}?msg=${enc("Item updated.")}`);
}
/* ---------- Return desk ---------- */

export async function returnLoan(formData: FormData) {
  const me = await requireUser(["staff", "admin"]);
  const id = Number(formData.get("loan_id"));
  const damaged = text(formData, "condition") === "damaged";
  const reason = text(formData, "reason");
  const rep = text(formData, "repairable");
  const back = backTo(formData);

  const r = await sql`
    select l.id, l.status, l.user_id, l.item_id, l.due_at, i.name as item_name, u.full_name
    from loans l join items i on i.id = l.item_id join users u on u.id = l.user_id where l.id = ${id}`;
  const ctx = r[0] as {
    status: string; user_id: number; item_id: number; due_at: Date | string | null; item_name: string; full_name: string;
  } | undefined;
  if (!ctx || ctx.status !== "borrowed") redirect(`${back}?error=${enc("That loan is not currently out.")}`);
  if (damaged && !reason) redirect(`${back}?error=${enc("Describe the damage so it can be tracked.")}`);

  // Late = returned more than GRACE_MINUTES after the due time.
  const late = !!ctx.due_at && new Date(ctx.due_at).getTime() + GRACE_MINUTES * 60_000 < Date.now();

  const m = damaged
    ? msg.damaged(ctx.full_name, ctx.item_name)
    : late
      ? msg.returnedLate(ctx.full_name, ctx.item_name)
      : msg.returned(ctx.full_name, ctx.item_name);
  const condition = damaged ? "damaged" : "good";
  const itemStatus = !damaged ? "available" : rep === "yes" ? "under_repair" : rep === "no" ? "retired" : "damaged";
  const repairable = !damaged ? null : rep === "yes" ? true : rep === "no" ? false : null;
  const itemEvent = damaged
    ? `Returned damaged by ${ctx.full_name}: ${reason}. ${repText(rep)}`
    : `Returned ${late ? "late" : "in good shape"} by ${ctx.full_name}`;

  await sql`
    with u as (
      update loans set status = 'returned', returned_at = now(), return_condition = ${condition}, handled_by = ${me.uid},
        returned_late = ${late}::boolean
      where id = ${id} and status = 'borrowed' returning id),
    i as (
      update items set status = ${itemStatus}, damage_reason = ${damaged ? reason : null},
        repairable = ${repairable}::boolean, damaged_at = ${damaged ? new Date().toISOString() : null}::timestamptz
      where id = ${ctx.item_id} and exists (select 1 from u)),
    ev as (
      insert into item_events (item_id, actor_id, event) select ${ctx.item_id}::int, ${me.uid}::int, ${itemEvent}::text from u),
    e as (
      insert into loan_events (loan_id, actor_id, event) select id, ${me.uid}::int, ${`returned (${condition}${late ? ", late" : ""})`}::text from u)
    insert into notifications (user_id, kind, title, body, loan_id)
    select ${ctx.user_id}::int, ${damaged ? "damaged" : "returned"}::text, ${m.title}::text, ${m.body}::text, id from u`;

  await afterItemChange(ctx.item_id, itemStatus, "borrowed");
  done();
  redirect(`${back}?msg=${enc(damaged ? "Return recorded. The item was flagged and its damage logged." : `Return recorded${late ? " as late" : ""}. The next student in line (if any) was notified.`)}`);
}

// An item that never came back: closes the loan, marks the item lost, records its unit cost as owed.
export async function markLoanLost(formData: FormData) {
  const me = await requireUser(["staff", "admin"]);
  const id = Number(formData.get("loan_id"));
  const reason = text(formData, "reason");
  const back = backTo(formData);

  const r = await sql`
    select l.id, l.status, l.user_id, l.item_id, i.name as item_name, i.unit_cost, u.full_name
    from loans l join items i on i.id = l.item_id join users u on u.id = l.user_id where l.id = ${id}`;
  const ctx = r[0] as {
    status: string; user_id: number; item_id: number; item_name: string; unit_cost: string | null; full_name: string;
  } | undefined;
  if (!ctx || ctx.status !== "borrowed") redirect(`${back}?error=${enc("That loan is not currently out.")}`);

  const cost = ctx.unit_cost === null ? null : Number(ctx.unit_cost);
  const m = msg.lostItem(ctx.full_name, ctx.item_name, cost);
  const note = reason ? `: ${reason}` : "";
  const itemEvent = `Marked lost while borrowed by ${ctx.full_name}${note}`;

  await sql`
    with u as (
      update loans set status = 'lost', returned_at = now(), handled_by = ${me.uid}, amount_owed = ${cost}::numeric
      where id = ${id} and status = 'borrowed' returning id),
    i as (
      update items set status = 'lost' where id = ${ctx.item_id} and exists (select 1 from u)),
    ev as (
      insert into item_events (item_id, actor_id, event) select ${ctx.item_id}::int, ${me.uid}::int, ${itemEvent}::text from u),
    e as (
      insert into loan_events (loan_id, actor_id, event) select id, ${me.uid}::int, ${`marked lost${note}`}::text from u)
    insert into notifications (user_id, kind, title, body, loan_id)
    select ${ctx.user_id}::int, 'lost'::text, ${m.title}::text, ${m.body}::text, id from u`;

  await afterItemChange(ctx.item_id, "lost", "borrowed");
  done();
  redirect(`${back}?msg=${enc(cost === null ? "Marked as lost. No unit cost is set on this item." : `Marked as lost. ${fmtMoney(cost)} recorded as owed.`)}`);
}