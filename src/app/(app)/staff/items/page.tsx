import Link from "next/link";
import { requireUser } from "@/lib/session";
import { sql } from "@/lib/db";
import { addCategory, updateCategory, deleteCategory, addItem } from "@/lib/inventory-actions";
import { fmtDuration } from "@/lib/duration";
import { fmtMoney } from "@/lib/money";
import { Notice } from "@/components/Notice";
import { StatusPill } from "@/components/StatusPill";
import { RuleFields } from "@/components/RuleFields";
import { Modal } from "@/components/Modal";
import { Icon } from "@/components/Icon";

type Row = {
  id: number; code: string; name: string; status: string; category: string;
  damage_reason: string | null; repairable: boolean | null;
  max_hours: number; needs_approval: boolean; queue_n: number; unit_cost: string | null;
};
type Cat = { id: number; name: string; loan_days: number; requires_approval: boolean; items: number };

const chips = [
  ["", "All"], ["available", "Available"], ["inuse", "On loan"],
  ["attention", "Needs attention"], ["retired", "Not repairable"], ["lost", "Lost"],
] as const;

const repText = (r: boolean | null) => (r === true ? "Repairable" : r === false ? "Not repairable" : "Not assessed yet");

export default async function Inventory({
  searchParams,
}: {
  searchParams: { tab?: string; q?: string; cat?: string; status?: string; msg?: string; error?: string };
}) {
  await requireUser(["staff", "admin"]);
  const tab = searchParams.tab === "categories" ? "categories" : "items";
  const q = (searchParams.q ?? "").trim();
  const cat = Number(searchParams.cat) || 0;
  const st = chips.some(([v]) => v === (searchParams.status ?? "")) ? searchParams.status ?? "" : "";

  const [cats, rows, counts, worth] = await Promise.all([
    sql`select c.id, c.name, c.loan_days, c.requires_approval,
               (select count(*)::int from items i where i.category_id = c.id) as items
        from categories c order by c.name`,
    tab === "items"
      ? sql`
        select * from (
          select i.id, i.code, i.name, i.status, i.category_id, c.name as category, i.damage_reason, i.repairable, i.unit_cost,
            coalesce(i.max_loan_hours, c.loan_days * 24) as max_hours,
            case i.approval when 'required' then true when 'none' then false else c.requires_approval end as needs_approval,
            (select count(*)::int from loans w where w.item_id = i.id and w.status = 'waitlisted') as queue_n,
            case i.status when 'reserved' then 'inuse' when 'borrowed' then 'inuse'
              when 'damaged' then 'attention' when 'under_repair' then 'attention' else i.status end as grp
          from items i join categories c on c.id = i.category_id) t
        where (${q}::text = '' or t.name ilike '%' || ${q} || '%' or t.code ilike '%' || ${q} || '%')
          and (${cat}::int = 0 or t.category_id = ${cat})
          and (${st}::text = '' or t.grp = ${st})
        order by t.category, t.code`
      : Promise.resolve([]),
    sql`select case status when 'reserved' then 'inuse' when 'borrowed' then 'inuse'
          when 'damaged' then 'attention' when 'under_repair' then 'attention' else status end as grp,
        count(*)::int as n from items group by 1`,
    sql`select coalesce(sum(unit_cost), 0)::float8 as total,
          coalesce(sum(unit_cost) filter (where status in ('retired','lost')), 0)::float8 as written_off,
          count(*) filter (where unit_cost is null)::int as missing
        from items`,
  ]);
  const categories = cats as unknown as Cat[];
  const items = rows as unknown as Row[];
  const countOf = (g: string) => (g === "" ? counts.reduce((a, r) => a + Number(r.n), 0) : Number(counts.find((r) => r.grp === g)?.n ?? 0));
  const v = worth[0];

  const chipHref = (val: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (cat) p.set("cat", String(cat));
    if (val) p.set("status", val);
    const s = p.toString();
    return s ? `/staff/items?${s}` : "/staff/items";
  };

  return (
    <>
      <Notice msg={searchParams.msg} error={searchParams.error} />
      <h1 className="mb-4 text-2xl font-bold md:mb-6 md:text-3xl">Inventory</h1>

      <div className="mb-4 flex gap-1 border-b border-line md:mb-6" role="tablist">
        {[["items", `Items (${countOf("")})`], ["categories", `Categories (${categories.length})`]].map(([k, label]) => (
          <Link
            key={k}
            href={k === "items" ? "/staff/items" : "/staff/items?tab=categories"}
            role="tab"
            aria-selected={tab === k}
            className={`-mb-px border-b-2 px-3 py-1.5 text-sm font-medium md:px-4 md:py-2 ${tab === k ? "border-forest text-accent-ink" : "border-transparent text-ink/70 hover:text-ink"}`}
          >
            {label}
          </Link>
        ))}
      </div>

      {tab === "items" ? (
        <>
          <dl className="panel mb-4 grid grid-cols-3 divide-x divide-line overflow-hidden md:mb-6">
            <div className="p-3 md:p-4">
              <dt className="text-xs text-ink/70 md:text-sm">Total value</dt>
              <dd className="font-display text-lg font-bold leading-tight md:text-3xl">{fmtMoney(v.total)}</dd>
            </div>
            <div className="p-3 md:p-4">
              <dt className="text-xs text-ink/70 md:text-sm">Lost / not repairable</dt>
              <dd className={`font-display text-lg font-bold leading-tight md:text-3xl ${Number(v.written_off) > 0 ? "text-alert" : ""}`}>{fmtMoney(v.written_off)}</dd>
            </div>
            <div className="p-3 md:p-4">
              <dt className="text-xs text-ink/70 md:text-sm">No cost set</dt>
              <dd className="font-display text-lg font-bold leading-tight md:text-3xl">{Number(v.missing)}</dd>
            </div>
          </dl>

          <div className="mb-4 flex items-center gap-2 md:mb-6">
            <form className="flex min-w-0 flex-1 gap-2" role="search">
              <input name="q" defaultValue={q} placeholder="Search name or code" aria-label="Search items" className="field min-w-0 flex-1 sm:w-60 sm:flex-none" />
              <select name="cat" defaultValue={cat || ""} aria-label="Category" className="field w-28 sm:w-48">
                <option value="">All categories</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {st && <input type="hidden" name="status" value={st} />}
              <button aria-label="Search" className="btn-quiet inline-flex items-center gap-2 !px-3 md:!px-4">
                <Icon name="search" size={16} /><span className="hidden sm:inline">Search</span>
              </button>
            </form>

            <Modal label="Add item" title="Add a new item">
              <form action={addItem} className="grid gap-3 sm:grid-cols-2">
                <label><span className="label">Code</span><input name="code" className="field" placeholder="BK-010" required /></label>
                <label>
                  <span className="label">Category</span>
                  <select name="category_id" className="field" required>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
                <label className="sm:col-span-2"><span className="label">Name</span><input name="name" className="field" required /></label>
                <label>
                  <span className="label">Unit cost (optional)</span>
                  <input name="unit_cost" type="number" inputMode="decimal" min="0" step="0.01" className="field" placeholder="0.00" />
                </label>
                <label><span className="label">Description (optional)</span><input name="description" className="field" /></label>
                <div className="space-y-3 rounded-xl border border-line p-3 sm:col-span-2">
                  <p className="text-sm font-medium">Borrowing rules</p>
                  <RuleFields />
                </div>
                <div className="sm:col-span-2"><button className="btn w-full sm:w-auto">Add item</button></div>
              </form>
            </Modal>
          </div>

          <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 md:mb-6 md:gap-2" aria-label="Filter by status">
            {chips.map(([val, label]) => (
              <Link
                key={val}
                href={chipHref(val)}
                aria-current={st === val ? "true" : undefined}
                className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs transition-colors md:px-3 md:py-1 md:text-sm ${st === val ? "border-forest bg-forest text-white" : "border-line bg-surface hover:bg-mint"}`}
              >
                {label} <span className={st === val ? "text-white/80" : "text-ink/50"}>{countOf(val)}</span>
              </Link>
            ))}
          </div>

          {items.length === 0 ? (
            <p className="panel p-6 text-center text-sm text-ink/70 md:p-8 md:text-base">No items match. Clear the filters or add a new item.</p>
          ) : (
            <div className="panel overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-paper text-xs text-ink/70 md:text-sm">
                  <tr>
                    <th className="hidden px-3 py-2 font-medium sm:table-cell md:px-4">Code</th>
                    <th className="px-3 py-2 font-medium md:px-4">Item</th>
                    <th className="hidden px-3 py-2 font-medium md:table-cell md:px-4">Category</th>
                    <th className="hidden px-3 py-2 font-medium sm:table-cell md:px-4">Unit cost</th>
                    <th className="hidden px-3 py-2 font-medium lg:table-cell md:px-4">Borrowing rule</th>
                    <th className="px-3 py-2 font-medium md:px-4">Status</th>
                    <th className="px-3 py-2 md:px-4" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {items.map((it) => (
                    <tr key={it.id} className="hover:bg-paper/70">
                      <td className="hidden px-3 py-2 font-medium sm:table-cell md:px-4 md:py-3">{it.code}</td>
                      <td className="px-3 py-2 md:px-4 md:py-3">
                        {it.name}
                        <p className="text-xs text-ink/60 sm:hidden">{it.code} · {fmtMoney(it.unit_cost)}</p>
                        {it.damage_reason && (
                          <p className="max-w-[14rem] truncate text-xs text-alert sm:max-w-xs md:mt-0.5" title={it.damage_reason}>
                            {it.damage_reason} ({repText(it.repairable).toLowerCase()})
                          </p>
                        )}
                      </td>
                      <td className="hidden px-3 py-2 text-ink/70 md:table-cell md:px-4 md:py-3">{it.category}</td>
                      <td className="hidden px-3 py-2 text-ink/70 sm:table-cell md:px-4 md:py-3">{fmtMoney(it.unit_cost)}</td>
                      <td className="hidden px-3 py-2 text-ink/70 lg:table-cell md:px-4 md:py-3">
                        Up to {fmtDuration(Number(it.max_hours))}
                        <span className="block text-xs">{it.needs_approval ? "Staff approval" : "No approval"}</span>
                      </td>
                      <td className="px-3 py-2 md:px-4 md:py-3">
                        <StatusPill status={it.status} />
                        {Number(it.queue_n) > 0 && <span className="mt-0.5 block text-xs text-ink/60">{it.queue_n} waiting</span>}
                      </td>
                      <td className="px-3 py-2 text-right md:px-4 md:py-3">
                        <Link href={`/staff/items/${it.id}`} className="btn-quiet max-md:!px-2.5 max-md:!py-1 max-md:text-xs">Manage</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <>
          <form action={addCategory} className="panel mb-4 flex flex-wrap items-end gap-3 p-3 md:mb-6 md:p-4">
            <label className="min-w-[12rem] flex-1"><span className="label">New category</span><input name="name" className="field" placeholder="e.g. Musical instruments" required /></label>
            <label className="w-32"><span className="label">Longest (days)</span><input name="loan_days" type="number" min={1} max={60} defaultValue={3} className="field" /></label>
            <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="requires_approval" className="h-4 w-4 accent-forest" />Needs approval</label>
            <button className="btn">Add category</button>
          </form>

          <ul className="panel divide-y divide-line">
            {categories.map((c) => (
              <li key={c.id} className="flex flex-wrap items-end gap-3 p-3 md:p-4">
                <form action={updateCategory} className="flex flex-1 flex-wrap items-end gap-3">
                  <input type="hidden" name="id" value={c.id} />
                  <label className="min-w-[10rem] flex-1"><span className="label">Name</span><input name="name" defaultValue={c.name} className="field" required /></label>
                  <label className="w-32"><span className="label">Longest (days)</span><input name="loan_days" type="number" min={1} max={60} defaultValue={c.loan_days} className="field" /></label>
                  <label className="flex items-center gap-2 pb-2 text-sm">
                    <input type="checkbox" name="requires_approval" defaultChecked={c.requires_approval} className="h-4 w-4 accent-forest" />Needs approval
                  </label>
                  <button className="btn-quiet">Save</button>
                </form>
                <div className="pb-1 text-sm text-ink/60">
                  {c.items > 0 ? (
                    <Link href={`/staff/items?cat=${c.id}`} className="underline">{c.items} {c.items === 1 ? "item" : "items"}</Link>
                  ) : (
                    <form action={deleteCategory}>
                      <input type="hidden" name="id" value={c.id} />
                      <button className="btn-danger">Delete</button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}