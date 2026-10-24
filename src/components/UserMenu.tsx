"use client";

import { useCallback, useState } from "react";
import { Icon } from "./Icon";
import { Tooltip } from "./Tooltip";
import { useDismiss } from "./useDismiss";

export function UserMenu({ name, role, logoutAction }: { name: string; role: string; logoutAction: () => Promise<void> }) {
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
          {name.trim().charAt(0).toUpperCase()}
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