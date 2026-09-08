import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { BookingStatus, PaymentMethod } from "@brothers-sports-zone/shared-types";
import {
  adminCancelBooking,
  confirmBooking,
  fetchAllBookings,
  markRefunded,
  rejectBooking,
  statusLabel,
  type AdminBookingRow,
} from "../lib/adminBookingsData";
import { bdt, formatDhakaDate, formatSlotRange } from "../../../../lib/format";

const STATUSES: Array<BookingStatus | "all"> = [
  "all",
  "payment_submitted",
  "confirmed",
  "pending_payment",
  "cancelled",
  "rejected",
];

function RejectPrompt({ onConfirm, onCancel, busy }: { onConfirm: (reason: string) => void; onCancel: () => void; busy: boolean }) {
  const [reason, setReason] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        autoFocus
        placeholder="Rejection reason (required)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="text-input !min-h-[36px] !w-56 !py-1"
      />
      <button
        type="button"
        onClick={() => reason.trim() && onConfirm(reason.trim())}
        disabled={busy || !reason.trim()}
        className="micro-cap underline disabled:opacity-40"
      >
        Confirm reject
      </button>
      <button type="button" onClick={onCancel} className="micro-cap text-white/50 underline">
        Back
      </button>
    </div>
  );
}

export default function BookingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [bookings, setBookings] = useState<AdminBookingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const statusFilter = (searchParams.get("status") as BookingStatus | null) ?? "all";
  const methodFilter = (searchParams.get("method") as PaymentMethod | null) ?? "all";

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value === "all" || value === "") next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  }

  async function load() {
    try {
      setBookings(await fetchAllBookings());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load bookings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookings.filter((b) => {
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (methodFilter !== "all" && b.payment_method !== methodFilter) return false;
      const dates = (b.booking_items ?? []).map((i) => i.date);
      if (fromDate && !dates.some((d) => d >= fromDate)) return false;
      if (toDate && !dates.some((d) => d <= toDate)) return false;
      if (q) {
        const haystack = `${b.booking_code} ${b.users?.phone ?? ""} ${b.users?.name ?? ""} ${b.txn_id ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [bookings, statusFilter, methodFilter, fromDate, toDate, search]);

  async function act(id: string, fn: () => Promise<void>) {
    setBusyId(id);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusyId(null);
      setRejectingId(null);
      setCancellingId(null);
    }
  }

  const isQueueView = statusFilter === "payment_submitted";

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-4 text-white/60">Management</p>
          <h1 className="display-xl">{isQueueView ? "Payment queue" : "Bookings"}</h1>
        </div>
        {isQueueView && (
          <button
            type="button"
            onClick={() => setFilter("status", "all")}
            className="micro-cap text-white/60 underline"
          >
            Show all bookings
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="mt-8 flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="micro-cap block text-white/50">Search</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Code, phone, txn"
            className="text-input !min-h-[40px] !w-56 !py-1"
          />
        </label>
        <label className="block">
          <span className="micro-cap block text-white/50">Status</span>
          <select
            value={statusFilter}
            onChange={(e) => setFilter("status", e.target.value)}
            className="text-input !min-h-[40px] !w-44 !py-1 [color-scheme:dark]"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All statuses" : statusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="micro-cap block text-white/50">Method</span>
          <select
            value={methodFilter}
            onChange={(e) => setFilter("method", e.target.value)}
            className="text-input !min-h-[40px] !w-36 !py-1 [color-scheme:dark]"
          >
            {["all", "bkash", "nagad", "cash"].map((m) => (
              <option key={m} value={m}>
                {m === "all" ? "All methods" : m}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="micro-cap block text-white/50">Slot date from</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="text-input !min-h-[40px] !py-1 [color-scheme:dark]"
          />
        </label>
        <label className="block">
          <span className="micro-cap block text-white/50">Slot date to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="text-input !min-h-[40px] !py-1 [color-scheme:dark]"
          />
        </label>
      </div>

      {error && <p className="mt-6 text-white">{error}</p>}
      {loading && <p className="micro-cap mt-10 text-white/50">Loading</p>}

      {!loading && (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-left">
            <thead>
              <tr className="border-b border-hairline-on-dark">
                {["Booking", "User", "Slot dates", "Total", "Status", "Method", "Txn ID", "Actions"].map((h) => (
                  <th key={h} className="micro-cap pb-3 pr-4 font-normal text-white/50">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="caption py-6 text-white/50">
                    No bookings match.
                  </td>
                </tr>
              )}
              {filtered.map((b) => {
                const dates = [...new Set((b.booking_items ?? []).map((i) => i.date))].sort();
                const wasConfirmed = b.status === "confirmed";
                return (
                  <tr key={b.id} className="border-b border-hairline-on-dark align-top">
                    <td className="py-4 pr-4">
                      <span className="button-cap">{b.booking_code}</span>
                      {b.cancelled_by && <span className="caption block text-white/40">by {b.cancelled_by}</span>}
                      {b.refund_status && (
                        <span className="micro-cap block text-white/50">refund: {b.refund_status}</span>
                      )}
                    </td>
                    <td className="py-4 pr-4">
                      <span className="caption">{b.users?.name ?? "—"}</span>
                      <span className="caption block text-white/50">{b.users?.phone ?? ""}</span>
                    </td>
                    <td className="py-4 pr-4">
                      <span className="caption text-white/70">
                        {dates.map((d) => formatDhakaDate(d)).join(", ") || "—"}
                      </span>
                      <span className="caption block text-white/50">
                        {(b.booking_items ?? [])
                          .map((i) => (i.slots ? formatSlotRange(i.slots.label) : `#${i.slot_id}`))
                          .join(", ")}
                      </span>
                    </td>
                    <td className="py-4 pr-4">
                      <span className="caption">{bdt(b.total_amount)}</span>
                      <span className="caption block text-white/50">adv {bdt(b.advance_amount)}</span>
                    </td>
                    <td className="py-4 pr-4">
                      <span className="micro-cap">{statusLabel(b.status)}</span>
                      {b.status === "rejected" && b.rejection_reason && (
                        <span className="caption block text-white/50">{b.rejection_reason}</span>
                      )}
                    </td>
                    <td className="py-4 pr-4">
                      <span className="caption capitalize text-white/70">{b.payment_method ?? "—"}</span>
                    </td>
                    <td className="py-4 pr-4">
                      <span className="caption text-white/70">{b.txn_id ?? "—"}</span>
                      {b.txn_phone && <span className="caption block text-white/50">{b.txn_phone}</span>}
                    </td>
                    <td className="py-4 pr-4">
                      {busyId === b.id ? (
                        <span className="micro-cap text-white/50">Working</span>
                      ) : rejectingId === b.id ? (
                        <RejectPrompt
                          busy={busyId === b.id}
                          onConfirm={(reason) => void act(b.id, () => rejectBooking(b.id, reason))}
                          onCancel={() => setRejectingId(null)}
                        />
                      ) : cancellingId === b.id ? (
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => void act(b.id, () => adminCancelBooking(b.id, wasConfirmed))}
                            className="micro-cap underline"
                          >
                            Confirm cancel{wasConfirmed ? " (marks refund pending)" : ""}
                          </button>
                          <button
                            type="button"
                            onClick={() => setCancellingId(null)}
                            className="micro-cap text-white/50 underline"
                          >
                            Back
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {b.status === "payment_submitted" && (
                            <>
                              <button
                                type="button"
                                onClick={() => void act(b.id, () => confirmBooking(b.id))}
                                className="micro-cap underline"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setRejectingId(b.id)}
                                className="micro-cap text-white/60 underline"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {["pending_payment", "payment_submitted", "confirmed"].includes(b.status) && (
                            <button
                              type="button"
                              onClick={() => setCancellingId(b.id)}
                              className="micro-cap text-white/60 underline"
                            >
                              Cancel
                            </button>
                          )}
                          {b.status === "cancelled" && b.cancelled_by === "admin" && b.refund_status === "pending" && (
                            <button
                              type="button"
                              onClick={() => void act(b.id, () => markRefunded(b.id))}
                              className="micro-cap underline"
                            >
                              Mark refunded
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
