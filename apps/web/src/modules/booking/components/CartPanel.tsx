import type { Slot, SlotLock } from "@brothers-sports-zone/shared-types";
import { bdt, formatDhakaDate, formatSlotRange } from "../../../lib/format";

interface CartPanelProps {
  items: Array<{ lock: SlotLock; slot: Slot }>;
  total: number;
  now: number;
  onRemove: (lock: SlotLock) => void;
}

/** Live list of the user's held slots — the cart is the set of active locks. */
export function CartPanel({ items, total, now, onRemove }: CartPanelProps) {
  if (items.length === 0) {
    return (
      <p className="caption text-white/50">
        No slots held yet. Select an available slot — it will be held for five minutes while you check out.
      </p>
    );
  }

  const sorted = [...items].sort(
    (a, b) => a.lock.date.localeCompare(b.lock.date) || a.slot.slot_number - b.slot.slot_number,
  );

  return (
    <div>
      <ul className="flex flex-col">
        {sorted.map(({ lock, slot }) => {
          const secondsLeft = Math.max(0, Math.floor((new Date(lock.expires_at).getTime() - now) / 1000));
          return (
            <li key={lock.id} className="flex items-center justify-between gap-3 border-b border-hairline-on-dark py-3">
              <div>
                <p className="button-cap">{formatDhakaDate(lock.date)}</p>
                <p className="caption text-white/60">
                  {formatSlotRange(slot.label)} · {bdt(slot.price)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="micro-cap text-white/50">
                  {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(lock)}
                  className="micro-cap text-white/60 underline hover:text-white"
                >
                  Remove
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex items-center justify-between">
        <span className="button-cap">Total</span>
        <span className="display-lg !text-2xl">{bdt(total)}</span>
      </div>
    </div>
  );
}
