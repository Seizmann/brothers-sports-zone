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

/** A calendar date shifted by `days` from the given YYYY-MM-DD date. */
export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** A Dhaka-calendar date shifted by `days` from today, as YYYY-MM-DD. */
export function dhakaDateShifted(days: number): string {
  return shiftDate(dhakaToday(), days);
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

/** 24-hour "HH:MM" as 12-hour with AM/PM, e.g. "06:00" → "6:00 AM". */
export function formatTime12(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return hhmm;
  const h24 = Number(m[1]);
  const h12 = h24 % 12 || 12;
  return `${h12}:${m[2]} ${h24 >= 12 ? "PM" : "AM"}`;
}

/** Slot label "06:00 – 07:30" in 12-hour form: "6:00 – 7:30 AM" when both
 *  ends share a meridiem, "10:30 PM – 12:00 AM" when the range crosses one.
 *  Input that is not an HH:MM range is returned unchanged. */
export function formatSlotRange(label: string): string {
  const m = /^(\d{1,2}:\d{2})\s*[–—-]\s*(\d{1,2}:\d{2})$/.exec(label.trim());
  if (!m) return label;
  const start = formatTime12(m[1]);
  const end = formatTime12(m[2]);
  if (start.slice(-2) === end.slice(-2)) {
    return `${start.slice(0, -3)} – ${end}`;
  }
  return `${start} – ${end}`;
}
