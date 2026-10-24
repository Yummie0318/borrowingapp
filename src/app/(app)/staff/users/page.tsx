import Link from "next/link";
import { requireUser } from "@/lib/session";
import { sql } from "@/lib/db";
import { createUser, updateUser, resetPassword, deleteUser } from "@/lib/user-actions";
import { MAX_ADMINS } from "@/lib/limits";
import { fmtDate } from "@/lib/format";
import { Notice } from "@/components/Notice";
import { Modal } from "@/components/Modal";
import { ModalButton } from "@/components/ModalButton";
import { Icon } from "@/components/Icon";

type U = { id: number; school_id: string; full_name: string; role: string; grade_section: string | null; created_at: Date | string };

const chips = [["", "All"], ["student", "Students"], ["staff", "Staff"], ["admin", "Admins"]] as const;
const roleCls: Record<string, string> = {
  admin: "bg-forest text-white",
  staff: "bg-mint text-accent-ink",
  student: "bg-paper text-ink/70 border border-line",
};

export default async function Users({
  searchParams,
}: {
  searchParams: { q?: string; role?: string; msg?: string; error?: string };
}) {
  const me = await requireUser(["admin"]);
  const q = (searchParams.q ?? "").trim();
  const role = chips.some(([v]) => v === (searchParams.role ?? "")) ? searchParams.role ?? "" : "";

  const [rows, counts] = await Promise.all([
    sql`select id, school_id, full_name, role, grade_section, created_at from users
        where (${q}::text = '' or full_name ilike '%' || ${q} || '%' or school_id ilike '%' || ${q} || '%')
          and (${role}::text = '' or role = ${role})
        order by case role when 'admin' then 0 when 'staff' then 1 else 2 end, full_name`,
    sql`select role, count(*)::int as n from users group by role`,
  ]);
  const users = rows as unknown as U[];
  const n = (r: string) => Number(counts.find((c) => c.role === r)?.n ?? 0);
  const total = counts.reduce((a, c) => a + Number(c.n), 0);
  const adminFull = n("admin") >= MAX_ADMINS;

  const chipHref = (val: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (val) p.set("role", val);
    const s = p.toString();
    return s ? `/staff/users?${s}` : "/staff/users";
  };
  const countOf = (r: string) => (r === "" ? total : n(r));

  return (
    <>
      <Notice msg={searchParams.msg} error={searchParams.error} />
      <h1 className="mb-4 text-2xl font-bold md:mb-6 md:text-3xl">Users</h1>

      <dl className="panel mb-4 grid grid-cols-3 divide-x divide-line overflow-hidden md:mb-6">
        <div className="p-3 md:p-4">
          <dt className="text-xs text-ink/70 md:text-sm">Students</dt>
          <dd className="font-display text-lg font-bold leading-tight md:text-3xl">{n("student")}</dd>
        </div>
        <div className="p-3 md:p-4">
          <dt className="text-xs text-ink/70 md:text-sm">Staff</dt>
          <dd className="font-display text-lg font-bold leading-tight md:text-3xl">{n("staff")}</dd>
        </div>
        <div className="p-3 md:p-4">
          <dt className="text-xs text-ink/70 md:text-sm">Admins</dt>
          <dd className={`font-display text-lg font-bold leading-tight md:text-3xl ${adminFull ? "text-alert" : ""}`}>
            {n("admin")} <span className="text-sm font-normal text-ink/60">of {MAX_ADMINS}</span>
          </dd>
        </div>
      </dl>

      <div className="mb-4 flex items-center gap-2 md:mb-6">
        <form className="flex min-w-0 flex-1 gap-2" role="search">
          <input name="q" defaultValue={q} placeholder="Search name or ID" aria-label="Search users" className="field min-w-0 flex-1 sm:w-60 sm:flex-none" />
          {role && <input type="hidden" name="role" value={role} />}
          <button aria-label="Search" className="btn-quiet inline-flex items-center gap-2 !px-3 md:!px-4">
            <Icon name="search" size={16} /><span className="hidden sm:inline">Search</span>
          </button>
        </form>

        <Modal label="Add user" title="Add a new user">
          <form action={createUser} className="grid gap-3 sm:grid-cols-2">
            <label><span className="label">School ID</span><input name="school_id" className="field" placeholder="2024-0001" required autoComplete="off" /></label>
            <label>
              <span className="label">Role</span>
              <select name="role" className="field" defaultValue="student" required>
                <option value="student">Student</option>
                <option value="staff">Staff</option>
                <option value="admin" disabled={adminFull}>{adminFull ? `Admin (limit of ${MAX_ADMINS} reached)` : "Admin"}</option>
              </select>
            </label>
            <label className="sm:col-span-2"><span className="label">Full name</span><input name="full_name" className="field" required /></label>
            <label><span className="label">Grade &amp; section (students)</span><input name="grade_section" className="field" placeholder="Grade 10 - Rizal" /></label>
            <label>
              <span className="label">Temporary password</span>
              <input name="password" type="text" minLength={8} className="field" placeholder="At least 8 characters" required autoComplete="off" />
            </label>
            <div className="sm:col-span-2"><button className="btn w-full sm:w-auto">Add user</button></div>
          </form>
        </Modal>
      </div>

      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 md:mb-6 md:gap-2" aria-label="Filter by role">
        {chips.map(([val, label]) => (
          <Link
            key={val}
            href={chipHref(val)}
            aria-current={role === val ? "true" : undefined}
            className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs transition-colors md:px-3 md:py-1 md:text-sm ${role === val ? "border-forest bg-forest text-white" : "border-line bg-surface hover:bg-mint"}`}
          >
            {label} <span className={role === val ? "text-white/80" : "text-ink/50"}>{countOf(val)}</span>
          </Link>
        ))}
      </div>

      {users.length === 0 ? (
        <p className="panel p-6 text-center text-sm text-ink/70 md:p-8 md:text-base">No users match. Clear the search or add a new user.</p>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-paper text-xs text-ink/70 md:text-sm">
              <tr>
                <th className="hidden px-3 py-2 font-medium sm:table-cell md:px-4">ID</th>
                <th className="px-3 py-2 font-medium md:px-4">Name</th>
                <th className="hidden px-3 py-2 font-medium md:table-cell md:px-4">Grade &amp; section</th>
                <th className="px-3 py-2 font-medium md:px-4">Role</th>
                <th className="hidden px-3 py-2 font-medium lg:table-cell md:px-4">Added</th>
                <th className="px-3 py-2 md:px-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {users.map((u) => {
                const isAdmin = u.role === "admin";
                return (
                  <tr key={u.id} className="hover:bg-paper/70">
                    <td className="hidden px-3 py-2 font-medium sm:table-cell md:px-4 md:py-3">{u.school_id}</td>
                    <td className="px-3 py-2 md:px-4 md:py-3">
                      {u.full_name}
                      {u.id === me.uid && <span className="ml-1.5 text-xs text-ink/60">(you)</span>}
                      <p className="text-xs text-ink/60 sm:hidden">{u.school_id}{u.grade_section ? ` · ${u.grade_section}` : ""}</p>
                    </td>
                    <td className="hidden px-3 py-2 text-ink/70 md:table-cell md:px-4 md:py-3">{u.grade_section ?? "-"}</td>
                    <td className="px-3 py-2 md:px-4 md:py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${roleCls[u.role] ?? ""}`}>{u.role}</span>
                    </td>
                    <td className="hidden px-3 py-2 text-ink/70 lg:table-cell md:px-4 md:py-3">{fmtDate(u.created_at)}</td>
                    <td className="px-3 py-2 text-right md:px-4 md:py-3">
                      <ModalButton
                        label="Manage"
                        title={u.full_name}
                        subtitle={`${u.school_id} · ${u.role}`}
                        triggerClassName="btn-quiet max-md:!px-2.5 max-md:!py-1 max-md:text-xs"
                      >
                        <div className="space-y-4">
                          {/* Edit */}
                          <form action={updateUser} className="space-y-2.5">
                            <input type="hidden" name="user_id" value={u.id} />
                            <p className="text-sm font-medium">Edit details</p>
                            <div className="grid grid-cols-2 gap-2.5">
                              <label className="block"><span className="label">School ID</span><input name="school_id" defaultValue={u.school_id} className="field" required autoComplete="off" /></label>
                              {isAdmin ? (
                                <div><span className="label">Role</span><p className="py-2 text-sm text-ink/70">Admin (locked)</p></div>
                              ) : (
                                <label className="block">
                                  <span className="label">Role</span>
                                  <select name="role" defaultValue={u.role} className="field">
                                    <option value="student">Student</option>
                                    <option value="staff">Staff</option>
                                    <option value="admin" disabled={adminFull}>{adminFull ? "Admin (limit reached)" : "Admin"}</option>
                                  </select>
                                </label>
                              )}
                            </div>
                            <label className="block"><span className="label">Full name</span><input name="full_name" defaultValue={u.full_name} className="field" required /></label>
                            {!isAdmin && (
                              <label className="block"><span className="label">Grade &amp; section (students)</span><input name="grade_section" defaultValue={u.grade_section ?? ""} className="field" /></label>
                            )}
                            <button className="btn w-full">Save changes</button>
                          </form>

                          {/* Reset password */}
                          <form action={resetPassword} className="space-y-2.5 border-t border-line pt-4">
                            <input type="hidden" name="user_id" value={u.id} />
                            <p className="text-sm font-medium">Reset password</p>
                            <input name="password" type="text" minLength={8} required autoComplete="off" aria-label="New password" className="field" placeholder="New password (at least 8 characters)" />
                            <button className="btn-quiet w-full">Reset password</button>
                          </form>

                          {/* Delete */}
                          <div className="border-t border-line pt-4">
                            {isAdmin ? (
                              <p className="text-xs text-ink/60">Admins cannot be deleted.</p>
                            ) : (
                              <details>
                                <summary className="btn-danger cursor-pointer list-none text-center [&::-webkit-details-marker]:hidden">Delete user</summary>
                                <form action={deleteUser} className="mt-2 space-y-2">
                                  <input type="hidden" name="user_id" value={u.id} />
                                  <p className="text-xs text-ink/70">Delete {u.full_name}? This cannot be undone. Users with borrowing history cannot be deleted.</p>
                                  <button className="btn-danger w-full">Yes, delete</button>
                                </form>
                              </details>
                            )}
                          </div>
                        </div>
                      </ModalButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}