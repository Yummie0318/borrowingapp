const tz = "Asia/Manila";
type D = Date | string | null | undefined;

export const fmtDate = (d: D) =>
  d ? new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", timeZone: tz }) : "";

export const fmtDateTime = (d: D) =>
  d
    ? new Date(d).toLocaleString("en-PH", {
        month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz,
      })
    : "";

export const isOverdue = (d: D) => (d ? new Date(d).getTime() < Date.now() : false);

export function dueLabel(d: D) {
  if (!d) return "";
  const diff = new Date(d).getTime() - Date.now();
  const day = 86_400_000;
  if (diff < 0) {
    const n = Math.max(1, Math.ceil(-diff / day));
    return `${n} ${n === 1 ? "day" : "days"} late`;
  }
  if (diff < day) return "Due within a day";
  const n = Math.ceil(diff / day);
  return `${n} days left`;
}

export const fmtTime = (d: D) =>
  d ? new Date(d).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", timeZone: tz }) : "";
