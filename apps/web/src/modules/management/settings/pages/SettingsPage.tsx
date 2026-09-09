import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabase";
import type { Settings } from "@brothers-sports-zone/shared-types";
import { isValidPhone, normalizePhone } from "../../../../lib/format";

/** Site-wide commerce settings (singleton row): manual payment numbers the
 *  checkout shows, and the fixed advance amount the booking RPC charges. */
export default function SettingsPage() {
  const [bkash, setBkash] = useState("");
  const [nagad, setNagad] = useState("");
  const [advance, setAdvance] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [coords, setCoords] = useState("");
  const [facebook, setFacebook] = useState("");
  const [instagram, setInstagram] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data, error: e } = await supabase.from("settings").select("*").eq("id", 1).single();
      if (e) setError(e.message);
      else {
        const row = data as Settings;
        setBkash(row.bkash_number ?? "");
        setNagad(row.nagad_number ?? "");
        setAdvance(String(Number(row.advance_amount_fixed)));
        setPhone(row.contact_phone);
        setEmail(row.contact_email);
        setLocation(row.contact_location);
        setCoords(`${row.map_lat},${row.map_lng}`);
        setFacebook(row.facebook_url);
        setInstagram(row.instagram_url);
      }
      setLoading(false);
    })();
  }, []);

  function checkPhone(label: string, raw: string): string | null {
    const value = normalizePhone(raw);
    if (!value) return null; // empty clears the number; checkout hides the method
    if (!isValidPhone(value)) return `${label} must be an 11-digit Bangladeshi number (01XXXXXXXXX).`;
    return null;
  }

  /** "lat,lng" as pasted from Google Maps → finite numbers in range. */
  function parseCoords(raw: string): [number, number] | null {
    const [latRaw, lngRaw] = raw.split(",").map((part) => part.trim());
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (latRaw === undefined || lngRaw === undefined || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return [lat, lng];
  }

  /** Required, well-formed http(s) URL — the footer social links. */
  function checkUrl(label: string, raw: string): string | null {
    if (!raw) return `${label} is required.`;
    try {
      const url = new URL(raw);
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        return `${label} must start with https:// or http://.`;
      }
      return null;
    } catch {
      return `${label} must be a well-formed URL (e.g. https://example.com).`;
    }
  }

  async function save() {
    setError(null);
    setSaved(false);
    const phoneError = checkPhone("bKash number", bkash) ?? checkPhone("Nagad number", nagad);
    if (phoneError) return setError(phoneError);
    const numericAdvance = Number(advance);
    if (!advance.trim() || Number.isNaN(numericAdvance) || numericAdvance < 0) {
      return setError("Advance amount must be a non-negative number.");
    }
    const contactPhone = normalizePhone(phone);
    if (!contactPhone) return setError("Contact phone is required (11-digit Bangladeshi number, 01XXXXXXXXX).");
    if (!isValidPhone(contactPhone)) return setError("Contact phone must be an 11-digit Bangladeshi number (01XXXXXXXXX).");
    const contactEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) return setError("Contact email must be a valid email address.");
    const contactLocation = location.trim();
    if (!contactLocation) return setError("Contact location is required.");
    const map = parseCoords(coords);
    if (!map) return setError('Map coordinates must be two numbers as "lat,lng", lat between -90 and 90 and lng between -180 and 180.');
    const [mapLat, mapLng] = map;
    const facebookUrl = facebook.trim();
    const instagramUrl = instagram.trim();
    const urlError = checkUrl("Facebook URL", facebookUrl) ?? checkUrl("Instagram URL", instagramUrl);
    if (urlError) return setError(urlError);
    setBusy(true);
    const { error: e } = await supabase
      .from("settings")
      .update({
        bkash_number: bkash.trim() ? normalizePhone(bkash) : null,
        nagad_number: nagad.trim() ? normalizePhone(nagad) : null,
        advance_amount_fixed: numericAdvance,
        contact_phone: contactPhone,
        contact_email: contactEmail,
        contact_location: contactLocation,
        map_lat: mapLat,
        map_lng: mapLng,
        facebook_url: facebookUrl,
        instagram_url: instagramUrl,
      })
      .eq("id", 1);
    setBusy(false);
    if (e) return setError(e.message);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <p className="eyebrow mb-4 text-white/60">Management</p>
      <h1 className="display-xl">Settings</h1>

      {error && <p className="mt-6 text-white">{error}</p>}
      {loading && <p className="micro-cap mt-10 text-white/50">Loading</p>}

      {!loading && (
        <>
          <div className="mt-10 flex max-w-xl flex-col gap-5 rounded-sm border border-hairline-on-dark p-5">
            <label className="block">
              <span className="micro-cap block text-white/50">bKash number (Send Money)</span>
              <input
                type="tel"
                value={bkash}
                onChange={(e) => setBkash(e.target.value)}
                placeholder="01XXXXXXXXX"
                className="text-input !min-h-[40px] !py-1"
                aria-label="bKash number"
              />
            </label>
            <label className="block">
              <span className="micro-cap block text-white/50">Nagad number (Send Money)</span>
              <input
                type="tel"
                value={nagad}
                onChange={(e) => setNagad(e.target.value)}
                placeholder="01XXXXXXXXX"
                className="text-input !min-h-[40px] !py-1"
                aria-label="Nagad number"
              />
            </label>
            <p className="micro-cap text-white/50">
              Users send the advance to these numbers during checkout. Leave one empty to hide that payment method.
            </p>
            <label className="block">
              <span className="micro-cap block text-white/50">Advance amount (BDT)</span>
              <input
                type="number"
                min={0}
                value={advance}
                onChange={(e) => setAdvance(e.target.value)}
                className="text-input !min-h-[40px] !w-32 !py-1"
                aria-label="Advance amount in BDT"
              />
            </label>
            <p className="micro-cap text-white/50">
              Fixed amount paid online before arrival. If the booking total is smaller, the whole total is paid online.
            </p>
            <p className="micro-cap border-t border-hairline-on-dark pt-5 text-white/50">
              Contact info shown on the public contact page.
            </p>
            <label className="block">
              <span className="micro-cap block text-white/50">Contact phone</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                className="text-input !min-h-[40px] !py-1"
                aria-label="Contact phone"
              />
            </label>
            <label className="block">
              <span className="micro-cap block text-white/50">Contact email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="hello@example.com"
                className="text-input !min-h-[40px] !py-1"
                aria-label="Contact email"
              />
            </label>
            <label className="block">
              <span className="micro-cap block text-white/50">Contact location</span>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Area, thana, district"
                className="text-input !min-h-[40px] !py-1"
                aria-label="Contact location"
              />
            </label>
            <label className="block">
              <span className="micro-cap block text-white/50">Google Map coordinates</span>
              <input
                type="text"
                value={coords}
                onChange={(e) => setCoords(e.target.value)}
                placeholder="23.596549,89.843991"
                className="text-input !min-h-[40px] !py-1"
                aria-label="Google Map coordinates as latitude,longitude"
              />
            </label>
            <p className="micro-cap text-white/50">
              Paste the pin as "latitude,longitude" — right-click the spot in Google Maps and copy the first two numbers.
            </p>
            <p className="micro-cap border-t border-hairline-on-dark pt-5 text-white/50">
              Social links shown in the footer.
            </p>
            <label className="block">
              <span className="micro-cap block text-white/50">Facebook URL</span>
              <input
                type="url"
                value={facebook}
                onChange={(e) => setFacebook(e.target.value)}
                placeholder="https://www.facebook.com/..."
                className="text-input !min-h-[40px] !py-1"
                aria-label="Facebook URL"
              />
            </label>
            <label className="block">
              <span className="micro-cap block text-white/50">Instagram URL</span>
              <input
                type="url"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="https://www.instagram.com/..."
                className="text-input !min-h-[40px] !py-1"
                aria-label="Instagram URL"
              />
            </label>
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy}
              className="ghost-button button-cap !min-h-[40px] !w-fit !px-6 !py-2 disabled:opacity-40"
            >
              {busy ? "Saving" : saved ? "Saved" : "Save settings"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}