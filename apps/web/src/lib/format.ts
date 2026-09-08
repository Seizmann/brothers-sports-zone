/** Shared formatting + Asia/Dhaka date helpers. */

export function bdt(amount: number | string): string {
  const n = Number(amount);
  return `BDT ${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

/** Today's date in Asia/Dhaka as YYYY-MM-DD. */
export function dhakaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** A Dhaka-calendar date shifted by `days` from today, as YYYY-MM-DD. */
export function dhakaDateShifted(days: number): string {
  const [y, m, d] = dhakaToday().split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Normalize common Bangladeshi phone inputs to 01XXXXXXXXX. */
export function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("880")) digits = digits.slice(3);
  if (digits.length === 10 && digits.startsWith("1")) digits = "0" + digits;
  return digits;
}

export function isValidPhone(phone: string): boolean {
  return /^01[0-9]{9}$/.test(phone);
}

/** Long format for receipts/headings, e.g. "Thu, 10 Sep 2026". */
export function formatDhakaDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
