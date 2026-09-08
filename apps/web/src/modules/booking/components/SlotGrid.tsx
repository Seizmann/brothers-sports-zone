import type { Period, Slot, SlotLock } from "@brothers-sports-zone/shared-types";
import { bdt } from "../../../lib/format";

const PERIOD_ORDER: Period[] = ["Morning", "Afternoon", "Evening", "Night"];

export type SlotState = "available" | "booked" | "blackout" | "mine" | "locked";

interface SlotGridProps {
  slots: Slot[];
  date: string;
  stateOf: (slotId: number) => SlotState;
  myLockFor: (slotId: number) => SlotLock | undefined;
  now: number;
  busySlotId: number | null;
  onSelect: (slot: Slot) => void;
  onRelease: (lock: SlotLock) => void;
}

function countdown(expiresAt: string, now: number): string {
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return "0:00";
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function Cell({
  slot,
  state,
  lock,
  now,
  busy,
  onSelect,
  onRelease,
}: {
  slot: Slot;
  state: SlotState;
  lock?: SlotLock;
  now: number;
  busy: boolean;
  onSelect: () => void;
  onRelease: () => void;
}) {
  const base = "min-h-[88px] rounded-sm border p-3 text-left transition-colors";
  const heldSeconds = lock ? countdown(lock.expires_at, now) : null;

  if (state === "mine") {
    return (
      <button
        type="button"
        onClick={onRelease}
        className={`${base} border-white bg-white text-black`}
        title="Click to release this slot"
      >
        <span className="caption block opacity-70">{slot.label}</span>
        <span className="button-cap mt-2 block">Held by you</span>
        <span className="micro-cap mt-1 block opacity-70">expires {heldSeconds} · tap to release</span>
      </button>
    );
  }
  if (state === "booked" || state === "blackout") {
    return (
      <div className={`${base} border-hairline-on-dark bg-canvas-night-soft text-white/40`}>
        <span className="caption block">{slot.label}</span>
        <span className="button-cap mt-2 block">{state === "booked" ? "Booked" : "Blackout"}</span>
      </div>
    );
  }
  if (state === "locked") {
    return (
      <div className={`${base} border-hairline-on-dark text-white/50`}>
        <span className="caption block">{slot.label}</span>
        <span className="button-cap mt-2 block">Locked</span>
        <span className="micro-cap mt-1 block opacity-70">another player is holding this slot</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={busy}
      className={`${base} border-white text-white hover:bg-white hover:text-black disabled:opacity-50`}
    >
      <span className="caption block opacity-70">{slot.label}</span>
      <span className="button-cap mt-2 block">{busy ? "Holding" : "Available"}</span>
      <span className="micro-cap mt-1 block opacity-70">{slot.price > 0 ? bdt(slot.price) : "price TBD"}</span>
    </button>
  );
}

export function SlotGrid({ slots, date, stateOf, myLockFor, now, busySlotId, onSelect, onRelease }: SlotGridProps) {
  const groups = PERIOD_ORDER.map((period) => ({
    period,
    slots: slots.filter((s) => s.period === period),
  })).filter((g) => g.slots.length > 0);

  return (
    <div className="flex flex-col gap-10">
      {groups.map((group) => (
        <section key={group.period}>
          <h3 className="button-cap mb-4 text-white/60">
            {group.period} <span className="opacity-50">· {date}</span>
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {group.slots.map((slot) => (
              <Cell
                key={slot.id}
                slot={slot}
                state={stateOf(slot.id)}
                lock={myLockFor(slot.id)}
                now={now}
                busy={busySlotId === slot.id}
                onSelect={() => onSelect(slot)}
                onRelease={() => {
                  const lock = myLockFor(slot.id);
                  if (lock) onRelease(lock);
                }}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
