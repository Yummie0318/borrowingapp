import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { loansForUser, noShowInfo, waitInfo, lateInfo, extendInfo } from "@/lib/queries";
import { runMaintenance } from "@/lib/maintenance";
import { cancelRequest, extendLoan } from "@/lib/actions";
import { MAX_ACTIVE, NO_SHOW_DAYS, NO_SHOW_LIMIT, LATE_DAYS, LATE_LIMIT, LATE_PAUSE_DAYS } from "@/lib/config";
import { LoanSlip } from "@/components/LoanSlip";
import { Notice } from "@/components/Notice";
import { StatusPill } from "@/components/StatusPill";
import { fmtDate, isOverdue } from "@/lib/format";
import { durationOptions, fmtDuration } from "@/lib/duration";
import type { LoanRow } from "@/lib/types";

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="mb-7 md:mb-10">
      <h2 className="text-lg font-semibold md:text-xl">{title}</h2>
      <p className="mb-3 text-sm text-ink/70">{hint}</p>
      <div className="grid gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3">{children}</div>
    </section>
  );
}

export default async function Home({ searchParams }: { searchParams: { msg?: string; error?: string } }) {
  const me = await requireUser();
  if (me.role !== "student") redirect("/staff");

  await runMaintenance(); // releases missed pickups before we show anything
  const [loans, wait, strikes, lates, ext] = await Promise.all([
    loansForUser(me.uid), waitInfo(me.uid), noShowInfo(me.uid), lateInfo(me.uid), extendInfo(me.uid),
  ]);

  const isLate = (l: LoanRow) => l.status === "borrowed" && isOverdue(l.due_at);
  const when = (l: LoanRow) => new Date(l.due_at ?? l.pickup_by ?? l.requested_at).getTime();
  const byWhen = (a: LoanRow, b: LoanRow) => when(a) - when(b);

  const action = loans.filter((l) => l.status === "approved" || isLate(l)).sort(byWhen);
  const borrowed = loans.filter((l) => l.status === "borrowed" && !isLate(l)).sort(byWhen);
  const waiting = loans.filter((l) => l.status === "waitlisted");
  const requests = loans.filter((l) => l.status === "requested");
  const activeCount = action.length + borrowed.length + waiting.length + requests.length;
  const history = loans.filter((l) => ["returned", "declined", "cancelled", "expired", "lost"].includes(l.status)).slice(0, 8);
  const room = MAX_ACTIVE - activeCount;

  function Footer({ l }: { l: LoanRow }) {
    if (["waitlisted", "requested", "approved"].includes(l.status)) {
      return (
        <form action={cancelRequest}>
          <input type="hidden" name="loan_id" value={l.id} />
          <button className="btn-quiet">{l.status === "waitlisted" ? "Leave waitlist" : "Cancel request"}</button>
        </form>
      );
    }
    if (isLate(l)) return <span className="text-xs font-medium text-alert">Overdue. Return it to the borrowing desk today.</span>;

    const e = ext.get(l.id);
    if (!e) return <span className="text-xs text-ink/60">Return it to the borrowing desk.</span>;
    if (e.extensions >= 1) return <span className="text-xs text-ink/60">Extended once. Return it to the borrowing desk.</span>;
    if (e.needsApproval) return <span className="text-xs text-ink/60">To extend, ask the borrowing desk.</span>;
    if (e.queued) return <span className="text-xs text-ink/60">Others are waiting, so this cannot be extended.</span>;

    const opts = durationOptions(e.maxHours);
    const original = l.loan_hours ?? l.loan_days * 24;
    const def = opts.filter((o) => o.value <= original).pop()?.value ?? opts[0]?.value;
    return (
      <form action={extendLoan} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="loan_id" value={l.id} />
        <select name="hours" defaultValue={def} aria-label="Extend by" className="field w-auto">
          {opts.map((o) => <option key={o.value} value={o.value}>+ {fmtDuration(o.value)}</option>)}
        </select>
        <button className="btn-quiet">Extend</button>
      </form>
    );
  }

  const slips = (list: LoanRow[]) =>
    list.map((l) => (
      <LoanSlip key={l.id} loan={l} wait={wait.get(l.id)}>
        <Footer l={l} />
      </LoanSlip>
    ));

  return (
    <>
      <Notice msg={searchParams.msg} error={searchParams.error} />
      {strikes.until ? (
        <Notice error={`Borrowing is paused until ${fmtDate(strikes.until)} because ${strikes.count} reservations were not picked up in the last ${NO_SHOW_DAYS} days.`} />
      ) : strikes.count === NO_SHOW_LIMIT - 1 ? (
        <Notice error={`Heads up: you missed ${strikes.count} pickups recently. Missing ${NO_SHOW_LIMIT} within ${NO_SHOW_DAYS} days pauses borrowing. Cancel reservations you cannot collect.`} />
      ) : null}
      {lates.until ? (
        <Notice error={`Borrowing is paused until ${fmtDate(lates.until)} because you returned ${lates.count} items late in the last ${LATE_DAYS} days.`} />
      ) : lates.count === LATE_LIMIT - 1 ? (
        <Notice error={`Heads up: you returned ${lates.count} items late recently. ${LATE_LIMIT} late returns within ${LATE_DAYS} days pauses borrowing for ${LATE_PAUSE_DAYS} days.`} />
      ) : null}

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 md:mb-8 md:gap-4">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Hi, {me.name.split(" ")[0]}</h1>
          <p className="mt-1 text-ink/70">
            {activeCount === 0 ? "You have nothing borrowed right now." : `You are using ${activeCount} of ${MAX_ACTIVE} slots, including waitlists.`}
          </p>
        </div>
        {room > 0 && <Link href="/catalog" className="btn">Browse items</Link>}
      </div>

      {activeCount === 0 ? (
        <div className="panel p-8 text-center">
          <p className="font-display text-lg font-semibold">Nothing here yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink/70">Find a book, ball or laptop in the catalog and request it. If it is in use, you can join the waitlist.</p>
          <Link href="/catalog" className="btn mt-4">Browse items</Link>
        </div>
      ) : (
        <>
          {action.length > 0 && (
            <Section title="Action needed" hint="Pick these up or bring them back as soon as you can.">{slips(action)}</Section>
          )}
          {borrowed.length > 0 && (
            <Section title="Borrowed" hint="Return these by the due date. You can extend once if nobody is waiting.">{slips(borrowed)}</Section>
          )}
          {requests.length > 0 && (
            <Section title="Waiting for approval" hint="Staff will review these soon.">{slips(requests)}</Section>
          )}
          {waiting.length > 0 && (
            <Section title="On the waitlist" hint="You will get a message when it is your turn.">{slips(waiting)}</Section>
          )}
        </>
      )}

      {history.length > 0 && (
        <section className="mt-8 md:mt-12">
          <h2 className="mb-3 text-lg font-semibold md:text-xl">Past loans</h2>
          <ul className="panel divide-y divide-line">
            {history.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm md:px-4 md:py-3">
                <span className="min-w-0 truncate font-medium">{l.item_name}</span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-ink/60">{fmtDate(l.returned_at ?? l.pickup_by ?? l.requested_at)}</span>
                  <StatusPill status={l.status} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}