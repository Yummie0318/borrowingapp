// Change the currency code here and every price in the app follows.
const CURRENCY = "PHP";

export function fmtMoney(v: number | string | null | undefined) {
  if (v === null || v === undefined || v === "") return "-";
  const n = Number(v);
  if (!Number.isFinite(n)) return "-";
  return new Intl.NumberFormat("en", { style: "currency", currency: CURRENCY }).format(n);
}