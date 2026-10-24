import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { sql } from "@/lib/db";
import { updateItem, setItemCondition, deleteItem } from "@/lib/inventory-actions";
import { Notice } from "@/components/Notice";
import { StatusPill } from "@/components/StatusPill";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { fmtDuration } from "@/lib/duration";
import { fmtMoney } from "@/lib/money";
import { RuleFields } from "@/components/RuleFields";

type D = Date | string | null;
type Item = {
  id: number; code: string; name: string; description: string | null; status: string;
  category_id: number; category: string; damage_reason: string | null; repairable: boolean | null;
  damaged_at: D; repair_notes: string | null; unit_cost: string | null;
  max_loan_hours: number | null; approval: string; loan_days: number; requires_approval: boolean;
};
type QRow = { id: number; status: string; full_name: string; loan_hours: number | null; pickup_by: D; due_at: D };
type Loan = { id: number; status: string; full_name: string; borrowed_at: D; due_at: D; returned_at: D; return_condition: string | null };
type Ev = { id: number; event: string; actor: string | null; created_at: D };

const repText = (r: boolean | null) => (r === true ? "Repairable" : r === false ? "Not repairable" : "Not assessed yet");

function Hidden({ id, op }: { id: number; op: string }) {
  return (<><input type="hidden" name="item_id" value={id} /><input type="hidden" name="op" value={op} /></>);
}

export default async function ItemDetail({
  params, searchParams,
}: {
  params: { id: string };
  searchParams: { msg?: string; error?: string };
}) {
  await requireUser(["staff", "admin"]);
  const id = Number(params.id);
  if (!Number.isInteger(id)) notFound();

  const [itemRows, cats, loanRows, eventRows, queueRows] = await Promise.all([
    sql`select i.id, i.code, i.name, i.description, i.status, i.category_id, c.name as category,
               i.damage_reason, i.repairable, i.damaged_at, i.repair_notes,
               i.max_loan_hours, i.approval, i.unit_cost, c.loan_days, c.requires_approval
        from items i join categories c on c.id = i.category_id where i.id = ${id}`,
    sql`select id, name from categories order by name`,
    sql`select l.id, l.status, u.full_name, l.borrowed_at, l.due_at, l.returned_at, l.return_condition
        from loans l join users u on u.id = l.user_id where l.item_id = ${id}
        order by l.requested_at desc limit 30`,
    sql`select e.id, e.event, u.full_name as actor, e.created_at
        from item_events e left join users u on u.id = e.actor_id
        where e.item_id = ${id} order by e.created_at desc limit 50`,
    sql`select l.id, l.status, u.full_name, l.loan_hours, l.pickup_by, l.due_at
        from loans l join users u on u.id = l.user_id
        where l.item_id = ${id} and l.status in ('borrowed','approved','requested','waitlisted')
        order by (l.status = 'waitlisted'), l.requested_at, l.id`,
  ]);
  const item = itemRows[0] as unknown as Item | undefined;
  if (!item) notFound();
  const loans = loanRows as unknown as Loan[];
  const events = eventRows as unknown as Ev[];
  const queue = queueRows as unknown as QRow[];
  let place = 0;
  const inUse = ["reserved", "borrowed"].includes(item.status);
  const hasDamage = ["damaged", "under_repair", "retired"].includes(item.status);

  return (
    <>
      <Notice msg={searchParams.msg} error={searchParams.error} />
      <Link href="/staff/items" className="text-sm text-accent-ink underline">&larr; Back to inventory</Link>
      <div className="mb-4 mt-2 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold">{item.name}</h1>
        <StatusPill status={item.status} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Details */}
        <section className="panel p-4">
          <h2 className="mb-3 text-base font-semibold">Details</h2>
          <form action={updateItem} className="space-y-2.5">
            <input type="hidden" name="item_id" value={item.id} />
            <div className="grid grid-cols-3 gap-2.5">
              <label><span className="label">Code</span><input name="code" defaultValue={item.code} className="field" required /></label>
              <label className="col-span-2"><span className="label">Name</span><input name="name" defaultValue={item.name} className="field" required /></label>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <label>
                <span className="label">Category</span>
                <select name="category_id" defaultValue={item.category_id} className="field">
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label>
                <span className="label">Unit cost</span>
                <input name="unit_cost" type="number" inputMode="decimal" min="0" step="0.01" defaultValue={item.unit_cost ?? ""} className="field" placeholder="0.00" />
              </label>
            </div>
            <label className="block"><span className="label">Description</span><textarea name="description" defaultValue={item.description ?? ""} rows={2} className="field" /></label>
            <div className="space-y-2.5 rounded-xl border border-line p-3">
              <p className="text-sm font-medium">Borrowing rules</p>
              <RuleFields maxHours={item.max_loan_hours} approval={item.approval} />
              <p className="text-xs text-ink/60">
                Category default: up to {fmtDuration(item.loan_days * 24)}, {item.requires_approval ? "staff approval needed" : "no approval needed"}.
              </p>
            </div>
            <button className="btn">Save details</button>
          </form>
        </section>

        {/* Condition */}
        <section className="panel p-4">
          <h2 className="mb-3 text-base font-semibold">Condition</h2>

          {hasDamage && (
            <dl className="mb-3 space-y-1.5 rounded-md border border-alert/20 bg-alert-bg/60 p-3 text-sm">
              <div><dt className="text-xs text-ink/60">What is wrong</dt><dd className="font-medium">{item.damage_reason ?? "Not recorded"}</dd></div>
              <div><dt className="text-xs text-ink/60">Can it be repaired?</dt><dd className="font-medium">{repText(item.repairable)}</dd></div>
              <div><dt className="text-xs text-ink/60">Unit cost</dt><dd className="font-medium">{fmtMoney(item.unit_cost)}</dd></div>
              {item.repair_notes && <div><dt className="text-xs text-ink/60">Repair notes</dt><dd>{item.repair_notes}</dd></div>}
              {item.damaged_at && <div><dt className="text-xs text-ink/60">Reported</dt><dd>{fmtDate(item.damaged_at)}</dd></div>}
            </dl>
          )}

          {inUse && (
            <p className="text-sm text-ink/70">
              This item is {item.status === "borrowed" ? "out on loan" : "reserved for a student"}. Record its return from{" "}
              <Link href="/staff/loans" className="text-accent-ink underline">Out on loan</Link> and report any damage there.
            </p>
          )}

          {item.status === "available" && (
            <div className="space-y-3">
              <form action={setItemCondition} className="space-y-2.5 rounded-md border border-line p-3">
                <Hidden id={item.id} op="report" />
                <p className="text-sm font-medium">Report damage</p>
                <label className="block"><span className="label">What is wrong with it?</span><textarea name="reason" required rows={2} className="field" placeholder="Cracked screen, missing pages..." /></label>
                <div className="grid grid-cols-2 gap-2.5">
                  <label className="block">
                    <span className="label">Can it be repaired?</span>
                    <select name="repairable" defaultValue="unsure" className="field">
                      <option value="unsure">Not sure yet</option>
                      <option value="yes">Repairable</option>
                      <option value="no">Not repairable</option>
                    </select>
                  </label>
                  <label className="block"><span className="label">Notes (optional)</span><input name="notes" className="field" placeholder="Who fixes it, cost..." /></label>
                </div>
                <button className="btn-danger">Take out of circulation</button>
              </form>
              <form action={setItemCondition}>
                <Hidden id={item.id} op="lost" />
                <button className="btn-quiet">Mark as lost</button>
              </form>
            </div>
          )}

          {item.status === "damaged" && (
            <form action={setItemCondition} className="space-y-2.5">
              <Hidden id={item.id} op="assess" />
              <p className="text-sm text-ink/70">Reported damaged, not assessed yet.</p>
              <label className="block">
                <span className="label">After checking, can it be repaired?</span>
                <select name="repairable" defaultValue="" required className="field">
                  <option value="" disabled>Choose one</option>
                  <option value="yes">Repairable (send for repair)</option>
                  <option value="no">Not repairable (retire it)</option>
                </select>
              </label>
              <label className="block"><span className="label">Notes (optional)</span><input name="notes" className="field" /></label>
              <button className="btn">Save assessment</button>
            </form>
          )}

          {item.status === "under_repair" && (
            <form action={setItemCondition} className="space-y-2.5">
              <input type="hidden" name="item_id" value={item.id} />
              <label className="block"><span className="label">Notes (optional)</span><input name="notes" className="field" placeholder="Repaired by..., cost..." /></label>
              <div className="flex flex-wrap gap-2">
                <button name="op" value="repaired" className="btn">Repaired, put back in circulation</button>
                <button name="op" value="retire" className="btn-danger">Cannot be repaired</button>
              </div>
            </form>
          )}

          {(item.status === "retired" || item.status === "lost") && (
            <form action={setItemCondition} className="space-y-2.5">
              <Hidden id={item.id} op="restore" />
              <p className="text-sm text-ink/70">
                {item.status === "retired" ? "Retired and hidden from students." : "Marked as lost and hidden from students."}
              </p>
              <button className="btn-quiet">{item.status === "lost" ? "Found it, make available" : "Put back in circulation"}</button>
            </form>
          )}
        </section>
      </div>

      {/* Queue, only when someone is holding or waiting */}
      {queue.length > 0 && (
        <section className="mt-4">
          <h2 className="mb-2 text-base font-semibold">Borrowing queue <span className="text-sm font-normal text-ink/60">({queue.length})</span></h2>
          <ul className="panel max-h-56 divide-y divide-line overflow-y-auto">
            {queue.map((q) => {
              const waiting = q.status === "waitlisted";
              if (waiting) place += 1;
              return (
                <li key={q.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{waiting ? `#${place} ` : ""}{q.full_name}</p>
                    <p className="text-xs text-ink/60">
                      {q.status === "borrowed" && `Due ${fmtDateTime(q.due_at)}`}
                      {q.status === "approved" && `Pick up by ${fmtDateTime(q.pickup_by)}`}
                      {q.status === "requested" && "Waiting for staff approval"}
                      {waiting && `Wants it for ${fmtDuration(q.loan_hours ?? item.loan_days * 24)}`}
                    </p>
                  </div>
                  <StatusPill status={q.status} />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-base font-semibold">Condition history <span className="text-sm font-normal text-ink/60">({events.length})</span></h2>
          {events.length === 0 ? <p className="panel px-3 py-3 text-sm text-ink/60">No condition changes yet.</p> : (
            <ul className="panel max-h-72 divide-y divide-line overflow-y-auto">
              {events.map((e) => (
                <li key={e.id} className="px-3 py-2 text-sm">
                  <p className="leading-snug">{e.event}</p>
                  <p className="text-xs text-ink/60">{fmtDateTime(e.created_at)}{e.actor ? `, ${e.actor}` : ""}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold">Recent loans <span className="text-sm font-normal text-ink/60">({loans.length})</span></h2>
          {loans.length === 0 ? <p className="panel px-3 py-3 text-sm text-ink/60">Nobody has borrowed this yet.</p> : (
            <ul className="panel max-h-72 divide-y divide-line overflow-y-auto">
              {loans.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{l.full_name}</p>
                    <p className="text-xs text-ink/60">
                      {l.borrowed_at ? `Borrowed ${fmtDate(l.borrowed_at)}` : "Not picked up"}
                      {l.returned_at ? `, returned ${fmtDate(l.returned_at)}${l.return_condition === "damaged" ? " damaged" : ""}` : ""}
                    </p>
                  </div>
                  <StatusPill status={l.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {!inUse && loans.length === 0 && (
        <form action={deleteItem} className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <input type="hidden" name="item_id" value={item.id} />
          <p className="text-sm text-ink/70">Added by mistake? Items never borrowed can be deleted.</p>
          <button className="btn-danger">Delete this item</button>
        </form>
      )}
    </>
  );
}