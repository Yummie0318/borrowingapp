import { requireUser } from "@/lib/session";
import { sql } from "@/lib/db";
import { loansByStatus } from "@/lib/queries";
import { runMaintenance } from "@/lib/maintenance";
import { returnLoan, markLoanLost } from "@/lib/inventory-actions";
import { LOST_REVIEW_DAYS } from "@/lib/config";
import { fmtMoney } from "@/lib/money";
import { Notice } from "@/components/Notice";
import { StatusPill } from "@/components/StatusPill";
import { ModalButton } from "@/components/ModalButton";
import { fmtDate, dueLabel, isOverdue } from "@/lib/format";

type LostRow = {
  id: number; item_name: string; item_code: string; full_name: string;
  grade_section: string | null; returned_at: Date | string | null; amount_owed: string | null;
};

export default async function OutOnLoan({ searchParams }: { searchParams: { msg?: string; error?: string } }) {
  await requireUser(["staff", "admin"]);
  await runMaintenance();
  const [rows, lostRows] = await Promise.all([
    loansByStatus("borrowed"),
    sql`select l.id, i.name as item_name, i.code as item_code, u.full_name, u.grade_section, l.returned_at, l.amount_owed
        from loans l join items i on i.id = l.item_id join users u on u.id = l.user_id
        where l.status = 'lost' order by l.returned_at desc limit 50`,
  ]);
  const lost = lostRows as unknown as LostRow[];
  const owedTotal = lost.reduce((a, l) => a + Number(l.amount_owed ?? 0), 0);

  return (
    <>
      <Notice msg={searchParams.msg} error={searchParams.error} />
      <h1 className="mb-1 text-2xl font-bold md:text-3xl">Out on loan</h1>
      <p className="mb-4 text-sm text-ink/70 md:mb-6 md:text-base">Overdue items are listed first.</p>

      {rows.length === 0 ? (
        <p className="panel px-4 py-5 text-sm text-ink/60">Nothing here right now.</p>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase text-ink/60">
              <tr>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Status</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((l) => {
                const o = isOverdue(l.due_at);
                const veryLate = o && !!l.due_at && Date.now() - new Date(l.due_at).getTime() > LOST_REVIEW_DAYS * 86_400_000;
                return (
                  <tr key={l.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium">{l.item_name}</p>
                      <p className="text-xs text-ink/60">{l.item_code}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p>{l.full_name}</p>
                      {l.grade_section && <p className="text-xs text-ink/60">{l.grade_section}</p>}
                    </td>
                    <td className={`px-4 py-3 ${o ? "font-medium text-alert" : ""}`}>
                      {fmtDate(l.due_at)}
                      <span className="block text-xs font-normal">{dueLabel(l.due_at)}</span>
                      {veryLate && <span className="block text-xs font-normal">{LOST_REVIEW_DAYS}+ days late, consider marking lost</span>}
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell"><StatusPill status={o ? "overdue" : "borrowed"} /></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-start gap-2">
                        <form action={returnLoan}>
                          <input type="hidden" name="loan_id" value={l.id} />
                          <input type="hidden" name="redirect_to" value="/staff/loans" />
                          <input type="hidden" name="condition" value="good" />
                          <button className="btn-quiet">Returned OK</button>
                        </form>

                        <ModalButton label="Returned damaged" title="Returned damaged" subtitle={`${l.item_name} · ${l.full_name}`} triggerClassName="btn-danger">
                          <form action={returnLoan} className="space-y-3">
                            <input type="hidden" name="loan_id" value={l.id} />
                            <input type="hidden" name="redirect_to" value="/staff/loans" />
                            <input type="hidden" name="condition" value="damaged" />
                            <label className="block">
                              <span className="label">What is wrong with it?</span>
                              <textarea name="reason" required rows={2} className="field" placeholder="Cracked screen, torn cover..." />
                            </label>
                            <label className="block">
                              <span className="label">Can it be repaired?</span>
                              <select name="repairable" className="field" defaultValue="unsure">
                                <option value="unsure">Not sure yet</option>
                                <option value="yes">Repairable</option>
                                <option value="no">Not repairable</option>
                              </select>
                            </label>
                            <button className="btn-danger w-full">Record damaged return</button>
                          </form>
                        </ModalButton>

                        <ModalButton label="Mark lost" title="Mark as lost" subtitle={`${l.item_name} · ${l.full_name}`} triggerClassName="btn-quiet">
                          <form action={markLoanLost} className="space-y-3">
                            <input type="hidden" name="loan_id" value={l.id} />
                            <input type="hidden" name="redirect_to" value="/staff/loans" />
                            <p className="text-sm text-ink/70">
                              The item is marked lost and the student is messaged. Its unit cost is recorded as the amount owed. Anyone waiting in line is told it is no longer available.
                            </p>
                            <label className="block">
                              <span className="label">Note (optional)</span>
                              <input name="reason" className="field" placeholder="Student says it was stolen..." />
                            </label>
                            <button className="btn-danger w-full">Mark as lost</button>
                          </form>
                        </ModalButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {lost.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-1 text-lg font-semibold md:text-xl">
            Lost items, amount owed <span className="text-base font-normal text-ink/60">({lost.length})</span>
          </h2>
          <p className="mb-3 text-sm text-ink/70">Total on record: <span className="font-medium text-alert">{fmtMoney(owedTotal)}</span>. This is a record only, payments are not tracked.</p>
          <div className="panel overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs uppercase text-ink/60">
                <tr>
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Marked lost</th>
                  <th className="px-4 py-3 text-right font-medium">Owed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {lost.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{l.item_name}</p>
                      <p className="text-xs text-ink/60">{l.item_code}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p>{l.full_name}</p>
                      {l.grade_section && <p className="text-xs text-ink/60">{l.grade_section}</p>}
                    </td>
                    <td className="px-4 py-3 text-ink/70">{fmtDate(l.returned_at)}</td>
                    <td className="px-4 py-3 text-right font-medium">{fmtMoney(l.amount_owed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}