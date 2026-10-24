import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/session";
import { sql } from "@/lib/db";
import { loansByStatus } from "@/lib/queries";
import { runMaintenance } from "@/lib/maintenance";
import { checkout } from "@/lib/actions";
import { Notice } from "@/components/Notice";
import { Insights, InsightsSkeleton } from "@/components/Insights";
import { fmtDate, fmtDateTime, dueLabel, isOverdue } from "@/lib/format";
import { fmtDuration } from "@/lib/duration";
import type { LoanRow } from "@/lib/types";

const SHOW = 5;

function Column({ title, count, href, children }: { title: string; count: number; href: string; children: React.ReactNode }) {
  return (
    <section className="panel flex min-w-0 flex-col">
      <div className="flex items-baseline justify-between gap-3 border-b border-line px-3 py-3 md:px-4">
        <h2 className="text-base font-semibold md:text-lg">
          {title} <span className="text-sm font-normal text-ink/60">({count})</span>
        </h2>
        {count > 0 && <Link href={href} className="shrink-0 text-sm text-accent-ink underline">View all</Link>}
      </div>
      {count === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-ink/60">Nothing here right now.</p>
      ) : (
        <ul className="divide-y divide-line">{children}</ul>
      )}
      {count > SHOW && <p className="mt-auto border-t border-line px-4 py-2 text-xs text-ink/60">Showing {SHOW} of {count}.</p>}
    </section>
  );
}

function Who({ l, children }: { l: LoanRow; children?: React.ReactNode }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="truncate font-medium">{l.item_name} <span className="text-xs font-normal text-ink/60">{l.item_code}</span></p>
      <p className="truncate text-sm text-ink/70">{l.full_name}{l.grade_section ? `, ${l.grade_section}` : ""}</p>
      {children && <p className="mt-0.5 truncate text-xs text-ink/60">{children}</p>}
    </div>
  );
}

export default async function Dashboard({ searchParams }: { searchParams: { msg?: string; error?: string } }) {
  await requireUser(["staff", "admin"]);
  await runMaintenance(); // releases missed pickups and promotes the waitlist before we show the queues

  const [requested, approved, borrowed, inv, waiting] = await Promise.all([
    loansByStatus("requested"),
    loansByStatus("approved"),
    loansByStatus("borrowed"),
    sql`select status, count(*)::int as n from items group by status`,
    sql`select count(*)::int as n from loans where status = 'waitlisted'`,
  ]);
  const late = borrowed.filter((l) => isOverdue(l.due_at));
  const n = (s: string) => Number(inv.find((r) => r.status === s)?.n ?? 0);
  const total = inv.reduce((a, r) => a + Number(r.n), 0);
  const attention = n("damaged") + n("under_repair");

  const stats = [
    { label: "Available items", value: n("available"), sub: `of ${total} in inventory`, href: "/staff/items?status=available", bad: false },
    { label: "Out on loan", value: borrowed.length, sub: `${approved.length} to pick up, ${Number(waiting[0].n)} waiting`, href: "/staff/loans", bad: false },
    { label: "Overdue", value: late.length, sub: late.length ? "follow up with students" : "all on time", href: "/staff/loans", bad: late.length > 0 },
    { label: "Needs attention", value: attention, sub: "damaged or in repair", href: "/staff/items?status=attention", bad: attention > 0 },
  ];

  return (
    <>
      <Notice msg={searchParams.msg} error={searchParams.error} />
      <h1 className="mb-1 text-2xl font-bold md:text-3xl">Dashboard</h1>
      <p className="mb-4 text-sm text-ink/70 md:mb-6 md:text-base">What needs doing right now.</p>

      <dl className="panel mb-6 grid grid-cols-2 gap-px overflow-hidden bg-line md:mb-8 md:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="block bg-surface p-3 transition-colors hover:bg-mint md:p-4">
            <dt className="text-xs text-ink/70 md:text-sm">{s.label}</dt>
            <dd className={`font-display text-2xl font-bold leading-tight md:text-3xl ${s.bad ? "text-alert" : ""}`}>{s.value}</dd>
            <p className="text-xs text-ink/60">{s.sub}</p>
          </Link>
        ))}
      </dl>

      {/* The three queues: stacked on small screens, side by side from xl up */}
      <div className="mb-6 grid gap-4 md:mb-8 xl:grid-cols-3">
        <Column title="Needs a decision" count={requested.length} href="/staff/requests">
          {requested.slice(0, SHOW).map((l) => (
            <li key={l.id} className="flex items-center gap-3 px-3 py-3 md:px-4">
              <Who l={l}>For {fmtDuration(l.loan_hours ?? l.loan_days * 24)}</Who>
              <Link href="/staff/requests" className="btn !px-3">Review</Link>
            </li>
          ))}
        </Column>

        <Column title="Ready for pickup" count={approved.length} href="/staff/pickups">
          {approved.slice(0, SHOW).map((l) => (
            <li key={l.id} className="flex items-center gap-3 px-3 py-3 md:px-4">
              <Who l={l}>Pick up by {fmtDateTime(l.pickup_by)}</Who>
              <form action={checkout}>
                <input type="hidden" name="loan_id" value={l.id} />
                <button className="btn !px-3">Check out</button>
              </form>
            </li>
          ))}
        </Column>

        <Column title="Out on loan" count={borrowed.length} href="/staff/loans">
          {borrowed.slice(0, SHOW).map((l) => {
            const o = isOverdue(l.due_at);
            return (
              <li key={l.id} className="flex items-center gap-3 px-3 py-3 md:px-4">
                <Who l={l}>
                  <span className={o ? "font-medium text-alert" : ""}>Due {fmtDate(l.due_at)}, {dueLabel(l.due_at)}</span>
                </Who>
                <Link href="/staff/loans" className="btn-quiet !px-3">Manage</Link>
              </li>
            );
          })}
        </Column>
      </div>

      <h2 className="mb-3 mt-10 text-xl font-semibold md:text-2xl">Insights</h2>
      <Suspense fallback={<InsightsSkeleton />}>
        <Insights />
      </Suspense>
    </>
  );
}