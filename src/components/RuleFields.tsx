// Borrowing rules for one item: longest time it can be borrowed, and whether staff must approve.
export function RuleFields({ maxHours = null, approval = "inherit" }: { maxHours?: number | null; approval?: string }) {
  const inDays = maxHours !== null && maxHours % 24 === 0;
  const value = maxHours === null ? "" : inDays ? maxHours / 24 : maxHours;
  return (
    <>
      <label className="block">
        <span className="label">Longest it can be borrowed</span>
        <div className="flex gap-2">
          <input name="max_value" type="number" min={1} max={1440} defaultValue={value} placeholder="Category default" className="field" />
          <select name="max_unit" defaultValue={maxHours !== null && !inDays ? "hours" : "days"} aria-label="Unit" className="field w-28">
            <option value="hours">hours</option>
            <option value="days">days</option>
          </select>
        </div>
        <span className="mt-1 block text-xs text-ink/60">Leave empty to use the category&apos;s limit.</span>
      </label>
      <label className="block">
        <span className="label">Staff approval</span>
        <select name="approval" defaultValue={approval} className="field">
          <option value="inherit">Follow the category</option>
          <option value="required">Always require approval</option>
          <option value="none">No approval needed</option>
        </select>
      </label>
    </>
  );
}
