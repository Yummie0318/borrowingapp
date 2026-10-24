export function fmtDuration(h: number) {
  if (h < 24) return `${h} ${h === 1 ? "hour" : "hours"}`;
  const d = Math.floor(h / 24);
  const r = h % 24;
  const days = `${d} ${d === 1 ? "day" : "days"}`;
  return r ? `${days} ${r} ${r === 1 ? "hour" : "hours"}` : days;
}

// What a student may choose, up to the item's maximum.
export function durationOptions(maxHours: number): { value: number; label: string }[] {
  const out: { value: number; label: string }[] = [];
  if (maxHours < 24) {
    for (let h = 1; h <= maxHours; h++) out.push({ value: h, label: fmtDuration(h) });
    return out;
  }
  const days = Math.min(60, Math.floor(maxHours / 24));
  for (let d = 1; d <= days; d++) out.push({ value: d * 24, label: fmtDuration(d * 24) });
  if (maxHours % 24 !== 0 && maxHours <= 60 * 24) out.push({ value: maxHours, label: fmtDuration(maxHours) });
  return out;
}
