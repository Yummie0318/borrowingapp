import { sql } from "@/lib/db";
import { GRACE_MINUTES } from "@/lib/config";

type Month = { label: string; full: string; n: number; late: number };
type Bar = { label: string; sub?: string; n: number };
type Align = "left" | "center" | "right";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first

const alignCls: Record<Align, string> = {
  left: "left-0",
  center: "left-1/2 -translate-x-1/2",
  right: "right-0",
};

// Shows on hover, keyboard focus, or tap (the parent must have class "group", be relative and tabIndex={0}).
function Tip({ align = "center", children }: { align?: Align; children: React.ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute bottom-full z-20 mb-2 w-max max-w-[14rem] rounded-lg bg-ink px-2.5 py-1.5 text-left text-xs leading-snug text-surface opacity-0 shadow-lg transition-opacity duration-100 group-hover:opacity-100 group-focus:opacity-100 ${alignCls[align]}`}
    >
      {children}
    </span>
  );
}

function Dot({ cls }: { cls: string }) {
  return <span className={`mr-1.5 inline-block h-2 w-2 rounded-sm align-middle ${cls}`} />;
}

function Card({ title, hint, children, className = "" }: { title: string; hint: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`panel p-4 md:p-5 ${className}`}>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mb-4 text-xs text-ink/60">{hint}</p>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-ink/60">{text}</p>;
}

function HBars({ rows, unit }: { rows: Bar[]; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <ul className="space-y-1">
      {rows.map((r) => (
        <li
          key={r.label + (r.sub ?? "")}
          tabIndex={0}
          aria-label={`${r.label}${r.sub ? ` (${r.sub})` : ""}: ${r.n} ${unit}`}
          className="group relative -mx-2 cursor-default rounded-md px-2 py-1.5 transition-colors hover:bg-ink/5 focus:bg-ink/5"
        >
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">
              {r.label}
              {r.sub && <span className="ml-1.5 text-xs text-ink/60">{r.sub}</span>}
            </span>
            <span className="shrink-0 font-medium">{r.n}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-line/60">
            <div className="h-full rounded-full bg-forest" style={{ width: `${(r.n / max) * 100}%` }} />
          </div>
          <Tip align="left">
            <span className="block font-semibold">{r.label}</span>
            {r.sub && <span className="block opacity-70">{r.sub}</span>}
            <span className="block">{r.n} {unit}</span>
          </Tip>
        </li>
      ))}
    </ul>
  );
}

export function InsightsSkeleton() {
  return (
    <div className="animate-pulse space-y-4" role="status" aria-label="Loading insights">
      <div className="h-20 rounded-xl bg-line/60" />
      <div className="h-60 rounded-xl bg-line/60" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-48 rounded-xl bg-line/60" />
        <div className="h-48 rounded-xl bg-line/60" />
        <div className="h-48 rounded-xl bg-line/60" />
      </div>
    </div>
  );
}

export async function Insights() {
  const [monthRows, topRows, catRows, dowRows, rateRows, peopleRows] = await Promise.all([
    sql`
      with m as (
        select generate_series(
          date_trunc('month', now() at time zone 'Asia/Manila') - interval '5 months',
          date_trunc('month', now() at time zone 'Asia/Manila'),
          interval '1 month') as month)
      select to_char(m.month, 'Mon') as label, to_char(m.month, 'Mon YYYY') as full,
        count(l.id)::int as n,
        count(l.id) filter (where
          (l.status in ('returned','lost') and l.returned_at > l.due_at + make_interval(mins => ${GRACE_MINUTES}::int))
          or (l.status = 'borrowed' and l.due_at + make_interval(mins => ${GRACE_MINUTES}::int) < now()))::int as late
      from m left join loans l
        on l.borrowed_at is not null
        and date_trunc('month', l.borrowed_at at time zone 'Asia/Manila') = m.month
      group by m.month order by m.month`,
    sql`
      select i.name, i.code, count(*)::int as n
      from loans l join items i on i.id = l.item_id
      where l.requested_at > now() - interval '90 days' and l.status <> 'cancelled'
      group by i.id order by n desc, i.name limit 5`,
    sql`
      select c.name, count(*)::int as n
      from loans l join items i on i.id = l.item_id join categories c on c.id = i.category_id
      where l.requested_at > now() - interval '90 days' and l.status <> 'cancelled'
      group by c.id order by n desc, c.name limit 6`,
    sql`
      select extract(dow from l.borrowed_at at time zone 'Asia/Manila')::int as dow, count(*)::int as n
      from loans l where l.borrowed_at > now() - interval '90 days' group by 1`,
    sql`
      select count(*)::int as total,
        count(*) filter (where returned_at <= due_at + make_interval(mins => ${GRACE_MINUTES}::int))::int as ontime
      from loans
      where status = 'returned' and due_at is not null and returned_at > now() - interval '90 days'`,
    sql`
      select count(distinct user_id)::int as n from loans
      where borrowed_at >= (date_trunc('month', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila')`,
  ]);

  const months: Month[] = monthRows.map((r) => ({
    label: String(r.label), full: String(r.full), n: Number(r.n), late: Number(r.late),
  }));
  const maxMonth = Math.max(1, ...months.map((m) => m.n));
  const cur = months[months.length - 1]?.n ?? 0;
  const prev = months[months.length - 2]?.n ?? 0;
  const delta = prev === 0 ? null : Math.round(((cur - prev) / prev) * 100);

  const total = Number(rateRows[0]?.total ?? 0);
  const ontime = Number(rateRows[0]?.ontime ?? 0);
  const rate = total === 0 ? null : Math.round((ontime / total) * 100);
  const people = Number(peopleRows[0]?.n ?? 0);

  const top: Bar[] = topRows.map((r) => ({ label: String(r.name), sub: String(r.code), n: Number(r.n) }));
  const cats: Bar[] = catRows.map((r) => ({ label: String(r.name), n: Number(r.n) }));
  const dow = new Array(7).fill(0) as number[];
  for (const r of dowRows) dow[Number(r.dow)] = Number(r.n);
  const maxDow = Math.max(1, ...dow);

  return (
    <div className="space-y-4">
      <dl className="panel grid grid-cols-3 divide-x divide-line overflow-hidden">
        <div className="p-3 md:p-4">
          <dt className="text-xs text-ink/70 md:text-sm">Check-outs this month</dt>
          <dd className="font-display text-2xl font-bold leading-tight md:text-3xl">{cur}</dd>
          <p className="text-xs text-ink/60">
            {delta === null ? `Last month: ${prev}` : delta === 0 ? "Same as last month" : `${delta > 0 ? "+" : ""}${delta}% vs last month`}
          </p>
        </div>
        <div className="p-3 md:p-4">
          <dt className="text-xs text-ink/70 md:text-sm">Returned on time</dt>
          <dd className={`font-display text-2xl font-bold leading-tight md:text-3xl ${rate !== null && rate < 80 ? "text-alert" : ""}`}>
            {rate === null ? "-" : `${rate}%`}
          </dd>
          <p className="text-xs text-ink/60">{rate === null ? "No returns yet" : `${ontime} of ${total}, last 90 days`}</p>
        </div>
        <div className="p-3 md:p-4">
          <dt className="text-xs text-ink/70 md:text-sm">Students borrowing</dt>
          <dd className="font-display text-2xl font-bold leading-tight md:text-3xl">{people}</dd>
          <p className="text-xs text-ink/60">this month</p>
        </div>
      </dl>

      <Card title="Check-outs per month" hint="Last 6 months. Red shows items that came back late or are still overdue.">
        {months.every((m) => m.n === 0) ? (
          <Empty text="No check-outs yet. This fills in as students borrow." />
        ) : (
          <>
            <ul className="flex items-end gap-1 md:gap-3">
              {months.map((m, i) => {
                const h = Math.round((m.n / maxMonth) * 85);
                const align: Align = i === 0 ? "left" : i === months.length - 1 ? "right" : "center";
                return (
                  <li
                    key={m.full}
                    tabIndex={0}
                    aria-label={`${m.full}: ${m.n} check-outs, ${m.n - m.late} on time, ${m.late} late`}
                    className="group relative flex min-w-0 flex-1 cursor-default flex-col items-center gap-1 rounded-md px-0.5 pt-1 transition-colors hover:bg-ink/5 focus:bg-ink/5"
                  >
                    <div className="flex h-40 w-full flex-col items-center justify-end">
                      <span className="mb-1 text-xs font-medium">{m.n}</span>
                      <div className="w-full max-w-12 overflow-hidden rounded-t-md" style={{ height: `${h}%`, minHeight: m.n > 0 ? 4 : 0 }}>
                        <div className="w-full bg-alert" style={{ height: `${m.n ? (m.late / m.n) * 100 : 0}%` }} />
                        <div className="w-full bg-forest" style={{ height: `${m.n ? ((m.n - m.late) / m.n) * 100 : 0}%` }} />
                      </div>
                    </div>
                    <span className="text-xs text-ink/60">{m.label}</span>
                    <Tip align={align}>
                      <span className="block font-semibold">{m.full}</span>
                      <span className="block">{m.n} {m.n === 1 ? "check-out" : "check-outs"}</span>
                      <span className="block"><Dot cls="bg-forest" />On time: {m.n - m.late}</span>
                      <span className="block"><Dot cls="bg-alert" />Late: {m.late}</span>
                    </Tip>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 flex gap-4 text-xs text-ink/60">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-forest" />On time</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-alert" />Late</span>
            </p>
          </>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Most requested items" hint="Last 90 days, including waitlists. Consider buying more copies of these.">
          {top.length === 0 ? <Empty text="No requests yet." /> : <HBars rows={top} unit="requests" />}
        </Card>

        <Card title="By category" hint="Requests in the last 90 days.">
          {cats.length === 0 ? <Empty text="No requests yet." /> : <HBars rows={cats} unit="requests" />}
        </Card>

        <Card title="Busiest days" hint="Check-outs by weekday, last 90 days.">
          {dow.every((n) => n === 0) ? (
            <Empty text="No check-outs yet." />
          ) : (
            <ul className="flex items-end gap-1">
              {WEEK_ORDER.map((d, i) => {
                const align: Align = i < 2 ? "left" : i > WEEK_ORDER.length - 3 ? "right" : "center";
                return (
                  <li
                    key={d}
                    tabIndex={0}
                    aria-label={`${FULL_DAYS[d]}: ${dow[d]} check-outs`}
                    className="group relative flex min-w-0 flex-1 cursor-default flex-col items-center gap-1 rounded-md px-0.5 pt-1 transition-colors hover:bg-ink/5 focus:bg-ink/5"
                  >
                    <div className="flex h-28 w-full flex-col items-center justify-end">
                      <span className="mb-1 text-xs font-medium">{dow[d]}</span>
                      <div
                        className={`w-full rounded-t ${dow[d] === maxDow ? "bg-forest" : "bg-forest/40"}`}
                        style={{ height: `${Math.round((dow[d] / maxDow) * 80)}%`, minHeight: dow[d] > 0 ? 4 : 0 }}
                      />
                    </div>
                    <span className="text-xs text-ink/60">{DAYS[d]}</span>
                    <Tip align={align}>
                      <span className="block font-semibold">{FULL_DAYS[d]}</span>
                      <span className="block">{dow[d]} {dow[d] === 1 ? "check-out" : "check-outs"}</span>
                    </Tip>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}