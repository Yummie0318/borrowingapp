import type { LoanRow } from "@/lib/types";
import type { WaitInfo } from "@/lib/queries";
import { dueLabel, fmtDate, fmtTime, isOverdue } from "@/lib/format";
import { fmtDuration } from "@/lib/duration";
import { StatusPill } from "./StatusPill";

function Stamp({ top, big, small, tone }: { top: string; big: string; small?: string; tone: "amber" | "red" }) {
  return (
    <div
      className={`stamp-in absolute right-4 top-2 -rotate-3 rounded border-2 bg-surface px-3 py-1 text-center font-display ${
        tone === "red" ? "border-alert text-alert" : "border-stamp text-stamp"
      }`}
    >
      <span className="block text-xs leading-4">{top}</span>
      <span className="block text-lg font-bold leading-5">{big}</span>
      {small && <span className="block text-xs leading-4">{small}</span>}
    </div>
  );
}

export function LoanSlip({ loan, wait, children }: { loan: LoanRow; wait?: WaitInfo; children?: React.ReactNode }) {
  const late = loan.status === "borrowed" && isOverdue(loan.due_at);
  const hours = loan.loan_hours ?? loan.loan_days * 24;
    const stamped = (loan.status === "approved" && !!loan.pickup_by) || (loan.status === "borrowed" && !!loan.due_at);
  return (
    <article className="slip overflow-hidden">
      <header className="slip-head flex items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold leading-tight">{loan.item_name}</h3>
          <p className="text-xs text-ink/60">{loan.item_code} · {loan.category}</p>
        </div>
        <StatusPill status={late ? "overdue" : loan.status} />
      </header>

            <div className={`ruled relative px-4 pb-3 pt-2 text-sm ${stamped ? "min-h-[4.25rem] pr-28" : ""}`}>
        {loan.status === "waitlisted" && (
          <>
            <p>{wait ? `You are number ${wait.position} in line.` : "You are in line for this item."}</p>
            {wait && <p className="text-ink/70">Expected around {fmtDate(wait.estimate)}</p>}
            <p className="text-ink/60">You will get a message when it is your turn.</p>
          </>
        )}
        {loan.status === "requested" && <p>Sent {fmtDate(loan.requested_at)}. Staff will review it soon.</p>}
        {loan.status === "approved" && (
          <>
            <p>Bring your school ID to the borrowing desk.</p>
            <p className="text-ink/70">You can keep it for {fmtDuration(hours)}.</p>
          </>
        )}
        {loan.status === "borrowed" && (
          <>
            <p>Picked up {fmtDate(loan.borrowed_at)} for {fmtDuration(hours)}</p>
            <p className={late ? "font-medium text-alert" : "text-ink/70"}>{dueLabel(loan.due_at)}</p>
          </>
        )}
        {loan.status === "returned" && (
          <p>Returned {fmtDate(loan.returned_at)}{loan.return_condition === "damaged" ? " with damage" : ""}</p>
        )}
        {loan.status === "declined" && <p>Reason: {loan.decision_note}</p>}
        {loan.status === "cancelled" && <p>You cancelled this request.</p>}
        {loan.status === "expired" && <p>The pickup time passed, so it was released.</p>}
        {loan.note && <p className="text-ink/60">Your note: {loan.note}</p>}

        {loan.status === "approved" && loan.pickup_by && (
          <Stamp top="Pick up by" big={fmtTime(loan.pickup_by)} small={fmtDate(loan.pickup_by)} tone="amber" />
        )}
        {loan.status === "borrowed" && loan.due_at && (
          <Stamp key={String(loan.due_at)} top="Due" big={fmtDate(loan.due_at)} tone={late ? "red" : "amber"} />
        )}
      </div>
      {children && <footer className="flex flex-wrap items-center gap-2 border-t border-line bg-paper px-4 py-2.5">{children}</footer>}
    </article>
  );
}
