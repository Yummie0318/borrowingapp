const map: Record<string, { label: string; cls: string }> = {
  waitlisted: { label: "On waitlist", cls: "bg-mint text-accent-ink" },
  requested: { label: "Waiting for review", cls: "bg-stamp-bg text-stamp" },
  approved: { label: "Ready for pickup", cls: "bg-mint text-accent-ink" },
  borrowed: { label: "Borrowed", cls: "bg-forest text-white" },
  returned: { label: "Returned", cls: "bg-paper text-ink/70 border border-line" },
  declined: { label: "Declined", cls: "bg-alert-bg text-alert" },
  cancelled: { label: "Cancelled", cls: "bg-paper text-ink/70 border border-line" },
  expired: { label: "Expired", cls: "bg-alert-bg text-alert" },
  overdue: { label: "Overdue", cls: "bg-alert text-white" },
  available: { label: "Available", cls: "bg-mint text-accent-ink" },
  reserved: { label: "Reserved", cls: "bg-stamp-bg text-stamp" },
  damaged: { label: "Needs assessment", cls: "bg-alert-bg text-alert" },
  under_repair: { label: "Under repair", cls: "bg-stamp-bg text-stamp" },
  retired: { label: "Not repairable", cls: "bg-ink text-paper" },
  lost: { label: "Lost", cls: "bg-alert-bg text-alert" },
};

export function StatusPill({ status }: { status: string }) {
  const s = map[status] ?? { label: status, cls: "bg-paper" };
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}
