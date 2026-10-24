import Link from "next/link";
import { requireUser } from "@/lib/session";
import { sql } from "@/lib/db";
import { requestItem } from "@/lib/actions";
import { runMaintenance } from "@/lib/maintenance";
import { durationOptions, fmtDuration } from "@/lib/duration";
import { fmtDate } from "@/lib/format";
import { Notice } from "@/components/Notice";
import { StatusPill } from "@/components/StatusPill";
import { ModalButton } from "@/components/ModalButton";
import { Icon } from "@/components/Icon";

type Item = {
  id: number; code: string; name: string; description: string | null; status: string; category: string;
  max_hours: number; needs_approval: boolean; queue_n: number; queue_hours: number;
  holder_end: Date | string | null; mine: string | null;
};

const PAGE = 24;

function DurationPicker({ maxHours }: { maxHours: number }) {
  const opts = durationOptions(maxHours);
  if (opts.length <= 1) {
    return (<><input type="hidden" name="hours" value={opts[0]?.value ?? maxHours} /><p className="text-sm text-ink/70">Keep for {fmtDuration(opts[0]?.value ?? maxHours)}</p></>);
  }
  return (
    <label className="block">
      <span className="label">How long do you need it?</span>
      <select name="hours" defaultValue={opts[opts.length - 1].value} className="field">
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export default async function Catalog({
  searchParams,
}: {
  searchParams: { q?: string; cat?: string; avail?: string; n?: string; msg?: string; error?: string };
}) {
  const me = await requireUser();
  await runMaintenance();
  const q = (searchParams.q ?? "").trim();
  const cat = Number(searchParams.cat) || 0;
  const avail = searchParams.avail === "1";
  const lim = Math.min(240, Math.max(PAGE, Number(searchParams.n) || PAGE));

  const [cats, rows] = await Promise.all([
    sql`select id, name from categories order by name`,
    sql`
      select i.id, i.code, i.name, i.description, i.status, c.name as category,
        coalesce(i.max_loan_hours, c.loan_days * 24) as max_hours,
        case i.approval when 'required' then true when 'none' then false else c.requires_approval end as needs_approval,
        (select count(*)::int from loans w where w.item_id = i.id and w.status = 'waitlisted') as queue_n,
        (select coalesce(sum(w.loan_hours), 0)::int from loans w where w.item_id = i.id and w.status = 'waitlisted') as queue_hours,
        (select coalesce(h.due_at, coalesce(h.pickup_by, now() + interval '1 day') + make_interval(hours => coalesce(h.loan_hours, 24)))
           from loans h where h.item_id = i.id and h.status in ('requested','approved','borrowed') limit 1) as holder_end,
        (select l.status from loans l where l.item_id = i.id and l.user_id = ${me.uid}
           and l.status in ('waitlisted','requested','approved','borrowed') limit 1) as mine
      from items i join categories c on c.id = i.category_id
      where i.status not in ('retired', 'lost')
        and (${q}::text = '' or i.name ilike '%' || ${q} || '%' or i.code ilike '%' || ${q} || '%')
        and (${cat}::int = 0 or i.category_id = ${cat})
        and (${avail}::boolean = false or i.status = 'available')
      order by (i.status = 'available') desc, i.name
      limit ${lim + 1}::int`,
  ]);
  const all = rows as unknown as Item[];
  const more = all.length > lim;
  const items = all.slice(0, lim);
  const student = me.role === "student";

  const href = (o: { avail?: boolean; n?: number }) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (cat) p.set("cat", String(cat));
    if (o.avail ?? avail) p.set("avail", "1");
    if (o.n) p.set("n", String(o.n));
    const s = p.toString();
    return s ? `/catalog?${s}` : "/catalog";
  };

  return (
    <>
      <Notice msg={searchParams.msg} error={searchParams.error} />
      <h1 className="mb-4 text-2xl font-bold md:mb-6 md:text-3xl">Browse items</h1>

      <form className="mb-3 flex gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="Search by name or code" aria-label="Search items" className="field min-w-0 flex-1 sm:max-w-xs sm:flex-none" />
        <select name="cat" defaultValue={cat || ""} aria-label="Category" className="field w-32 sm:w-52">
          <option value="">All categories</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {avail && <input type="hidden" name="avail" value="1" />}
        <button aria-label="Search" className="btn-quiet inline-flex items-center gap-2 !px-3 md:!px-4">
          <Icon name="search" size={16} /><span className="hidden sm:inline">Search</span>
        </button>
      </form>

      <div className="mb-4 flex gap-1.5 md:mb-6 md:gap-2" aria-label="Filter">
        {[[false, "All"], [true, "Available now"]].map(([v, label]) => (
          <Link
            key={String(label)}
            href={href({ avail: v as boolean })}
            aria-current={avail === v ? "true" : undefined}
            className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs transition-colors md:text-sm ${avail === v ? "border-forest bg-forest text-white" : "border-line bg-surface hover:bg-mint"}`}
          >
            {label as string}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="panel p-6 text-center text-sm text-ink/70 md:p-8 md:text-base">No items match that search. Try a shorter word or choose all categories.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((it) => {
              const inUse = ["reserved", "borrowed"].includes(it.status);
              const estimate = it.holder_end
                ? new Date(Math.max(new Date(it.holder_end).getTime(), Date.now()) + (Number(it.queue_hours) + Number(it.queue_n) * 24) * 3_600_000)
                : null;
              const label = inUse ? "Join waitlist" : it.needs_approval ? "Request" : "Reserve";
              return (
                <article key={it.id} className="panel flex flex-col p-3 md:p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="text-base font-semibold leading-snug md:text-lg">{it.name}</h2>
                      <p className="text-xs text-ink/60">{it.code} · {it.category}</p>
                    </div>
                    <StatusPill status={it.status} />
                  </div>
                  {it.description && <p className="mt-2 line-clamp-2 text-sm text-ink/80">{it.description}</p>}
                  <p className="mt-2 text-xs text-ink/60">
                    Up to {fmtDuration(Number(it.max_hours))}. {it.needs_approval ? "Needs staff approval." : "Approved instantly."}
                  </p>

                  {student && (
                    <div className="mt-auto pt-3">
                      {it.mine ? (
                        <p className="rounded-lg bg-mint px-3 py-2 text-sm text-accent-ink">
                          {it.mine === "waitlisted" ? "You are on the waitlist for this item." : it.mine === "borrowed" ? "You have this item." : "This item is reserved for you."}
                        </p>
                      ) : it.status === "available" || inUse ? (
                        <>
                          {inUse && (
                            <p className="mb-2 text-xs text-ink/60">
                              In use{it.queue_n > 0 ? `, ${it.queue_n} waiting` : ""}.
                              {estimate ? ` You would get it around ${fmtDate(estimate)}.` : ""}
                            </p>
                          )}
                          <ModalButton label={label} title={it.name} subtitle={`${it.code} · ${it.category}`} triggerClassName="btn w-full">
                            <form action={requestItem} className="space-y-3">
                              <input type="hidden" name="item_id" value={it.id} />
                              <DurationPicker maxHours={Number(it.max_hours)} />
                              {it.needs_approval && (
                                <label className="block">
                                  <span className="label">What do you need it for?</span>
                                  <input name="note" maxLength={200} className="field" placeholder="Optional" />
                                </label>
                              )}
                              <button className="btn w-full">{inUse ? "Join waitlist" : it.needs_approval ? "Send request" : "Confirm reservation"}</button>
                            </form>
                          </ModalButton>
                        </>
                      ) : (
                        <p className="text-sm text-ink/60">Not available right now.</p>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {more && (
            <div className="mt-6 text-center">
              <Link href={href({ n: lim + PAGE })} className="btn-quiet">Show more</Link>
            </div>
          )}
        </>
      )}
    </>
  );
}