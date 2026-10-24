import { requireUser } from "@/lib/session";
import { sql } from "@/lib/db";
import { unreadCount } from "@/lib/queries";
import { logout } from "@/lib/actions";
import { NavLink } from "@/components/NavLink";
import { AdminShell } from "@/components/AdminShell";
import { StudentNav } from "@/components/StudentNav";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { UserMenu } from "@/components/UserMenu";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireUser();

  // Staff and admins: collapsible, resizable sidebar with a header.
  if (me.role !== "student") {
    const [c] = await sql`
      select
        count(*) filter (where status = 'requested')::int as requested,
        count(*) filter (where status = 'approved')::int as approved,
        count(*) filter (where status = 'borrowed')::int as borrowed,
        count(*) filter (where status = 'borrowed' and due_at < now())::int as overdue
      from loans`;
    const counts = {
      requested: Number(c.requested),
      approved: Number(c.approved),
      borrowed: Number(c.borrowed),
      overdue: Number(c.overdue),
    };
    return (
      <AdminShell name={me.name} role={me.role} logoutAction={logout} counts={counts}>
        {children}
      </AdminShell>
    );
  }

  // Students: slim top bar, plus a bottom tab bar on phones.
  const unread = await unreadCount(me.uid);
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-surface/75 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-x-6 px-3 sm:px-4">
          <span className="font-display text-lg font-bold text-accent-ink md:text-xl">BorrowDesk</span>
          <nav className="hidden flex-1 items-center gap-1 md:flex" aria-label="Main">
            <NavLink href="/">My loans</NavLink>
            <NavLink href="/catalog">Browse items</NavLink>
            <NavLink href="/notifications">
              Messages
              {unread > 0 && <span className="ml-1.5 rounded-full bg-alert px-1.5 py-0.5 text-xs text-white">{unread}</span>}
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <ThemeSwitcher />
            <UserMenu name={me.name} role={me.role} logoutAction={logout} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-3 pb-24 pt-5 sm:px-4 md:pb-10 md:pt-8">{children}</main>
      <StudentNav unread={unread} />
    </>
  );
}