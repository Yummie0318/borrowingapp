"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";

const tabs: { href: string; label: string; icon: IconName; exact: boolean }[] = [
  { href: "/", label: "My loans", icon: "book", exact: true },
  { href: "/catalog", label: "Browse", icon: "search", exact: false },
  { href: "/notifications", label: "Messages", icon: "bell", exact: false },
];

export function StudentNav({ unread }: { unread: number }) {
  const path = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-3">
        {tabs.map((t) => {
          const active = t.exact ? path === t.href : path.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors ${active ? "text-accent-ink" : "text-ink/60"}`}
              >
                {active && <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-forest" />}
                <span className="relative">
                  <Icon name={t.icon} />
                  {t.href === "/notifications" && unread > 0 && (
                    <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-alert px-1 text-[10px] font-semibold text-white">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}