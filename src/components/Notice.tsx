import { Icon } from "./Icon";

export function Notice({ msg, error }: { msg?: string; error?: string }) {
  if (!msg && !error) return null;
  const bad = Boolean(error);
  return (
    <p
      role={bad ? "alert" : "status"}
      className={`mb-4 flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm md:mb-6 md:px-4 md:py-3 ${
        bad ? "border-alert/30 bg-alert-bg text-alert" : "border-forest/20 bg-mint text-accent-ink"
      }`}
    >
      <span className="mt-0.5"><Icon name={bad ? "close" : "check"} size={16} /></span>
      <span className="min-w-0">{error ?? msg}</span>
    </p>
  );
}