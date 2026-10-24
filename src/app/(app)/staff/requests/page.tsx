import { requireUser } from "@/lib/session";
import { loansByStatus } from "@/lib/queries";
import { runMaintenance } from "@/lib/maintenance";
import { decide } from "@/lib/actions";
import { STALE_REQUEST_HOURS } from "@/lib/config";
import { Notice } from "@/components/Notice";
import { fmtDuration } from "@/lib/duration";

export default async function Requests({ searchParams }: { searchParams: { msg?: string; error?: string } }) {
  await requireUser(["staff", "admin"]);
  await runMaintenance();
  const rows = await loansByStatus("requested");

  return (
    <>
      <Notice msg={searchParams.msg} error={searchParams.error} />
      <h1 className="mb-1 text-2xl font-bold md:text-3xl">Needs a decision</h1>
      <p className="mb-4 text-sm text-ink/70 md:mb-6 md:text-base">
        Approve to set a pickup deadline, or decline with a reason. Requests not reviewed in {STALE_REQUEST_HOURS} hours close automatically.
      </p>

      {rows.length === 0 ? (
        <p className="panel px-4 py-4 text-sm text-ink/60">Nothing here right now.</p>
      ) : (
        <ul className="panel divide-y divide-line">
          {rows.map((l) => (
            <li key={l.id} className="flex flex-col gap-3 px-3 py-3 md:px-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
              <div className="min-w-0">
                <p className="font-medium">{l.item_name} <span className="text-xs font-normal text-ink/60">{l.item_code}</span></p>
                <p className="text-sm text-ink/70">
                  {l.full_name}{l.grade_section ? `, ${l.grade_section}` : ""} · for {fmtDuration(l.loan_hours ?? l.loan_days * 24)}
                </p>
                {l.note && <p className="mt-0.5 text-sm text-ink/60">&ldquo;{l.note}&rdquo;</p>}
              </div>
              <form action={decide} className="flex flex-wrap items-center gap-2 lg:shrink-0">
                <input type="hidden" name="loan_id" value={l.id} />
                <input type="hidden" name="redirect_to" value="/staff/requests" />
                <input name="reason" placeholder="Note or reason" aria-label="Note or reason" className="field min-w-0 basis-full sm:flex-1 sm:basis-0 lg:w-52 lg:flex-none" />
                <button name="decision" value="approve" className="btn flex-1 sm:flex-none">Approve</button>
                <button name="decision" value="decline" className="btn-danger flex-1 sm:flex-none">Decline</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}