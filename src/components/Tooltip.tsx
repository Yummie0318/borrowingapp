// Small tooltip that shows on hover and keyboard focus. Wrap any button or link.
export function Tooltip({
  label, side = "bottom", disabled = false, className = "", children,
}: {
  label: string; side?: "bottom" | "right"; disabled?: boolean; className?: string; children: React.ReactNode;
}) {
  if (disabled) return <span className={`inline-flex ${className}`}>{children}</span>;
  const pos = side === "right" ? "left-full top-1/2 ml-3 -translate-y-1/2" : "left-1/2 top-full mt-2 -translate-x-1/2";
  return (
    <span className={`group/tip relative inline-flex ${className}`}>
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-[70] whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs font-medium text-paper opacity-0 shadow-lg transition-opacity delay-100 duration-150 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 ${pos}`}
      >
        {label}
      </span>
    </span>
  );
}
