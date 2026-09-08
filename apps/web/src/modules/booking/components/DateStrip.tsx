import { dhakaDateShifted, dhakaToday, formatDhakaDate } from "../../../lib/format";

const SPAN_DAYS = 14;

interface DateStripProps {
  selected: string;
  onSelect: (date: string) => void;
  closedDates?: Set<string>;
}

/** Horizontal strip of the next 14 Dhaka days plus a free-form date picker
 *  (no booking-window limit per requirements). */
export function DateStrip({ selected, onSelect, closedDates }: DateStripProps) {
  const today = dhakaToday();
  const days = Array.from({ length: SPAN_DAYS }, (_, i) => dhakaDateShifted(i));

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {days.map((date) => {
          const isSelected = date === selected;
          const isClosed = closedDates?.has(date);
          const [y, m, d] = date.split("-").map(Number);
          const weekday = new Date(Date.UTC(y, m - 1, d))
            .toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })
            .toUpperCase();
          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelect(date)}
              aria-pressed={isSelected}
              className={`min-h-[64px] min-w-[76px] shrink-0 rounded-sm border px-3 py-2 text-left transition-colors ${
                isSelected
                  ? "border-white bg-white text-black"
                  : "border-hairline-on-dark text-white hover:border-white"
              }`}
            >
              <span className="micro-cap block opacity-70">{weekday}</span>
              <span className="display-lg !text-2xl leading-tight">{d}</span>
              <span className="micro-cap block opacity-70">
                {isClosed ? "CLOSED" : new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }).toUpperCase()}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <label htmlFor="booking-date" className="micro-cap text-white/60">
          Or pick a date
        </label>
        <input
          id="booking-date"
          type="date"
          min={today}
          value={selected}
          onChange={(e) => e.target.value && onSelect(e.target.value)}
          className="rounded-xs border border-hairline-on-dark bg-transparent px-3 py-2 text-white [color-scheme:dark]"
        />
        <span className="caption text-white/60">{formatDhakaDate(selected)}</span>
      </div>
    </div>
  );
}
