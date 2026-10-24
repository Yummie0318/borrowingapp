"use client";

import { useCallback, useEffect, useState } from "react";;
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { Icon } from "./Icon";
import { Tooltip } from "./Tooltip";
import { useDismiss } from "./useDismiss";

function titleFor(path: string) {
  if (path === "/staff") return "Dashboard";
  if (path.startsWith("/staff/requests")) return "Needs a decision";
  if (path.startsWith("/staff/pickups")) return "Ready for pickup";
  if (path.startsWith("/staff/loans")) return "Out on loan";
    if (path.startsWith("/staff/users")) return "Users";
  if (path.startsWith("/staff/items/")) return "Item";
  if (path.startsWith("/staff/items")) return "Inventory";
  return "BorrowDesk";
}

function UserMenu({ name, role, logoutAction }: { name: string; role: string; logoutAction: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);
  return (
    <div ref={ref} className="relative">
      <Tooltip label="Account" disabled={open}>
        <button
          onClick={() => setOpen(!open)}
          aria-label="Account menu"
          aria-expanded={open}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-forest text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          {name.charAt(0)}
        </button>
      </Tooltip>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-60 rounded-2xl border border-line bg-surface p-2 shadow-xl">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="text-xs capitalize text-ink/60">{role}</p>
          </div>
          <form action={logoutAction} className="border-t border-line pt-1">
            <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink/80 transition-colors hover:bg-ink/5">
              <Icon name="logout" size={18} /> Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export function AdminShell({
  name, role, logoutAction, counts, children,
}: {
  name: string; role: string; logoutAction: () => Promise<void>;
  counts: { requested: number; approved: number; borrowed: number; overdue: number };
  children: React.ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  // keep the sidebar numbers fresh while staff leave the page open
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 30000);
    return () => clearInterval(t);
  }, [router]);

  return (
    <div className="flex min-h-screen">
      <Sidebar open={open} onClose={close} counts={counts} role={role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-surface/75 px-4 backdrop-blur-xl md:px-8">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="btn-icon -ml-2 md:hidden"><Icon name="menu" /></button>
          <p className="font-display text-base font-semibold">{titleFor(path)}</p>
          <div className="ml-auto flex items-center gap-1.5">
            <ThemeSwitcher />
            <UserMenu name={name} role={role} logoutAction={logoutAction} />
          </div>
        </header>
                <main className="flex-1 px-3 py-4 sm:px-4 md:px-10 md:py-8">
                    <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
