import { requireUser } from "@/lib/session";
import { loansByStatus } from "@/lib/queries";
import { runMaintenance } from "@/lib/maintenance";
import { checkout } from "@/lib/actions";
import { Notice } from "@/components/Notice";
import { fmtDateTime } from "@/lib/format";
import { fmtDuration } from "@/lib/duration";

export default async function Pickups({ searchParams }: { searchParams: { msg?: string; error?: string } }) {
  await requireUser(["staff", "admin"]);
  await runMaintenance();
  const rows = await loansByStatus("approved");

  return (
    <>
      <Notice msg={searchParams.msg} error={searchParams.error} />
      <h1 className="mb-1 text-2xl font-bold md:text-3xl">Ready for pickup</h1>
      <p className="mb-4 text-sm text-ink/70 md:mb-6 md:text-base">
        Check the student&apos;s school ID, then check out the item. Missed pickups are released automatically.
      </p>

      {rows.length === 0 ? (
        <p className="panel px-4 py-4 text-sm text-ink/60">Nothing here right now.</p>
      ) : (
        <ul className="panel divide-y divide-line">
          {rows.map((l) => (
            <li key={l.id} className="flex items-center gap-3 px-3 py-3 md:px-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{l.item_name} <span className="text-xs font-normal text-ink/60">{l.item_code}</span></p>
                <p className="truncate text-sm text-ink/70">{l.full_name}{l.grade_section ? `, ${l.grade_section}` : ""}</p>
                <p className="mt-0.5 text-xs text-ink/60">
                  Pick up by {fmtDateTime(l.pickup_by)} · keep for {fmtDuration(l.loan_hours ?? l.loan_days * 24)}
                </p>
              </div>
              <form action={checkout}>
                <input type="hidden" name="loan_id" value={l.id} />
                <input type="hidden" name="redirect_to" value="/staff/pickups" />
                <button className="btn">Check out</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}