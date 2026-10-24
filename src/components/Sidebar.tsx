"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "./Icon";
import { Tooltip } from "./Tooltip";

const MIN = 208, MAX = 360, DEFAULT = 248, RAIL = 68;

type Counts = { requested: number; approved: number; borrowed: number; overdue: number };
type NavItem = { href: string; label: string; icon: IconName; exact: boolean; badge?: "requested" | "approved" | "borrowed"; adminOnly?: boolean };

const links: NavItem[] = [
  { href: "/staff", label: "Dashboard", icon: "dashboard", exact: true },
  { href: "/staff/requests", label: "Needs a decision", icon: "inbox", exact: false, badge: "requested" },
  { href: "/staff/pickups", label: "Ready for pickup", icon: "pickup", exact: false, badge: "approved" },
  { href: "/staff/loans", label: "Out on loan", icon: "clock", exact: false, badge: "borrowed" },
  { href: "/staff/items", label: "Inventory", icon: "inventory", exact: false },
    { href: "/staff/users", label: "Users", icon: "users", exact: false, adminOnly: true },
];

export function Sidebar({ open, onClose, counts, role }: { open: boolean; onClose: () => void; counts: Counts; role: string }) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(DEFAULT);
  const [dragging, setDragging] = useState(false);
  const widthRef = useRef(DEFAULT);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("bd_sidebar") === "1");
      const w = Number(localStorage.getItem("bd_sidebar_w"));
      if (w >= MIN && w <= MAX) { setWidth(w); widthRef.current = w; }
    } catch {}
  }, []);
  useEffect(() => onClose(), [path]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} };
  const setW = (w: number) => { const c = Math.min(MAX, Math.max(MIN, w)); widthRef.current = c; setWidth(c); };

  function toggle() { const n = !collapsed; setCollapsed(n); save("bd_sidebar", n ? "1" : "0"); }

  function startDrag(e: React.PointerEvent) {
    e.preventDefault();
    const startX = e.clientX, startW = widthRef.current;
    setDragging(true);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    const move = (ev: PointerEvent) => setW(startW + ev.clientX - startX);
    const up = () => {
      setDragging(false);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      save("bd_sidebar_w", String(widthRef.current));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }
  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      setW(widthRef.current + (e.key === "ArrowRight" ? 16 : -16));
      save("bd_sidebar_w", String(widthRef.current));
    }
  }
  function reset() { setW(DEFAULT); save("bd_sidebar_w", String(DEFAULT)); }

  const hide = collapsed ? "md:hidden" : "";
  const center = collapsed ? "md:justify-center md:px-0" : "";

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={onClose} aria-hidden="true" />}

      <aside
        aria-label="Sidebar"
        style={{ "--sbw": `${collapsed ? RAIL : width}px` } as React.CSSProperties}
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-line bg-surface transition-transform duration-200 md:sticky md:top-0 md:h-screen md:w-[var(--sbw)] md:shrink-0 md:translate-x-0 ${
          dragging ? "" : "md:transition-[width]"
        } ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className={`flex h-14 items-center gap-2 px-3 ${collapsed ? "md:flex-col md:justify-center" : ""}`}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-forest font-display text-base font-bold text-white">B</span>
          <span className={`flex-1 font-display text-lg font-bold ${hide}`}>BorrowDesk</span>
          <button onClick={onClose} aria-label="Close menu" className="btn-icon md:hidden"><Icon name="close" /></button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2" aria-label="Admin">
          {links.filter((l) => !l.adminOnly || role === "admin").map((l) => {
            const active = l.exact ? path === l.href : path.startsWith(l.href);
            const count = l.badge ? counts[l.badge] : 0;
            const badgeCls =
              l.badge === "requested" || (l.badge === "borrowed" && counts.overdue > 0)
                ? "bg-alert text-white"
                : "bg-forest text-white";
            const shown = count > 99 ? "99+" : count;

            return (
              <Tooltip key={l.href} label={count ? `${l.label} (${count})` : l.label} side="right" disabled={!collapsed} className="flex w-full">
                <Link
                  href={l.href}
                  aria-label={l.label}
                  aria-current={active ? "page" : undefined}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${center} ${
                    active ? "bg-mint text-accent-ink" : "text-ink/70 hover:bg-ink/5 hover:text-ink"
                  }`}
                >
                  <span className="relative flex shrink-0">
                    <Icon name={l.icon} />
                    {count > 0 && (
                      <span className={`absolute -right-2 -top-2 hidden h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold ${badgeCls} ${collapsed ? "md:flex" : ""}`}>
                        {shown}
                      </span>
                    )}
                  </span>
                  <span className={hide}>{l.label}</span>
                  {count > 0 && (
                    <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${badgeCls} ${hide}`}>{shown}</span>
                  )}
                </Link>
              </Tooltip>
            );
          })}


        </nav>

        <div className="hidden border-t border-line p-3 md:block">
          <Tooltip label={collapsed ? "Expand sidebar" : "Collapse sidebar"} side="right" disabled={!collapsed} className="flex w-full">
            <button
              onClick={toggle}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink ${center}`}
            >
              <Icon name="panel" />
              <span className={hide}>Collapse</span>
            </button>
          </Tooltip>
        </div>

        {!collapsed && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar. Use left and right arrow keys, or double-click to reset."
            aria-valuenow={width}
            aria-valuemin={MIN}
            aria-valuemax={MAX}
            tabIndex={0}
            onPointerDown={startDrag}
            onDoubleClick={reset}
            onKeyDown={onKey}
            className="absolute inset-y-0 -right-1.5 z-10 hidden w-3 cursor-col-resize md:block"
          >
            <span className={`mx-auto block h-full w-0.5 transition-colors ${dragging ? "bg-forest" : "bg-transparent hover:bg-forest/40"}`} />
          </div>
        )}
      </aside>
    </>
  );
}
