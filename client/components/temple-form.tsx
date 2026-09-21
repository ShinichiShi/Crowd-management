'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Temple } from '@/lib/temples';

type Values = Record<string, string>;

const num = (v: string) => (v.trim() === '' ? null : Number(v));
const str = (v: string) => (v.trim() === '' ? null : v.trim());

export function templeToValues(t?: Temple | null): Values {
  const g = (v: unknown) => (v === null || v === undefined ? '' : String(v));
  return {
    name: g(t?.name), deity: g(t?.deity), city: g(t?.city), state: g(t?.state), address: g(t?.address),
    latitude: g(t?.latitude), longitude: g(t?.longitude), capacity: g(t?.capacity), area_m2: g(t?.area_m2),
    warn: g(t?.warn), crit: g(t?.crit), opening_time: g(t?.opening_time), closing_time: g(t?.closing_time),
    contact_name: g(t?.contact_name), contact_phone: g(t?.contact_phone), contact_email: g(t?.contact_email), notes: g(t?.notes),
  };
}

export function valuesToPayload(v: Values) {
  return {
    name: v.name.trim(), deity: str(v.deity), city: str(v.city), state: str(v.state), address: str(v.address),
    latitude: num(v.latitude), longitude: num(v.longitude), capacity: Number(v.capacity), area_m2: num(v.area_m2),
    warn: num(v.warn), crit: num(v.crit), opening_time: str(v.opening_time), closing_time: str(v.closing_time),
    contact_name: str(v.contact_name), contact_phone: str(v.contact_phone), contact_email: str(v.contact_email), notes: str(v.notes),
  };
}

const INPUT = 'block w-full mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground/40';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-foreground/70">
      {label}
      {children}
      {hint && <span className="block mt-1 font-normal text-foreground/50">{hint}</span>}
    </label>
  );
}

export function TempleForm({
  initial, submitLabel, onSubmit, onCancel,
}: {
  initial?: Temple | null;
  submitLabel: string;
  onSubmit: (payload: ReturnType<typeof valuesToPayload>) => Promise<void>;
  onCancel?: () => void;
}) {
  const [v, setV] = useState<Values>(templeToValues(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });
  const cap = Number(v.capacity);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(valuesToPayload(v));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-3">Identity</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Temple name *"><input required minLength={2} className={INPUT} value={v.name} onChange={set('name')} placeholder="Somnath Temple" /></Field>
          <Field label="Presiding deity"><input className={INPUT} value={v.deity} onChange={set('deity')} placeholder="Shiva" /></Field>
          <Field label="City"><input className={INPUT} value={v.city} onChange={set('city')} placeholder="Veraval" /></Field>
          <Field label="State"><input className={INPUT} value={v.state} onChange={set('state')} placeholder="Gujarat" /></Field>
          <div className="sm:col-span-2"><Field label="Address"><input className={INPUT} value={v.address} onChange={set('address')} /></Field></div>
          <Field label="Latitude"><input type="number" step="any" min={-90} max={90} className={INPUT} value={v.latitude} onChange={set('latitude')} /></Field>
          <Field label="Longitude"><input type="number" step="any" min={-180} max={180} className={INPUT} value={v.longitude} onChange={set('longitude')} /></Field>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-foreground mb-3">Capacity &amp; alert thresholds</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Field label="Safe capacity (people) *" hint="Most people who can be present safely at once">
            <input required type="number" min={1} className={INPUT} value={v.capacity} onChange={set('capacity')} />
          </Field>
          <Field label="Total area (m², optional)"><input type="number" min={1} className={INPUT} value={v.area_m2} onChange={set('area_m2')} /></Field>
          <Field label="Warning at (people)" hint={cap > 0 ? `empty = ${Math.round(0.7 * cap)} (70 %)` : 'empty = 70 % of capacity'}>
            <input type="number" min={1} className={INPUT} value={v.warn} onChange={set('warn')} />
          </Field>
          <Field label="Critical at (people)" hint={cap > 0 ? `empty = ${Math.round(0.9 * cap)} (90 %)` : 'empty = 90 % of capacity'}>
            <input type="number" min={1} className={INPUT} value={v.crit} onChange={set('crit')} />
          </Field>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-foreground mb-3">Timings &amp; contact</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Opens"><input type="time" className={INPUT} value={v.opening_time} onChange={set('opening_time')} /></Field>
          <Field label="Closes"><input type="time" className={INPUT} value={v.closing_time} onChange={set('closing_time')} /></Field>
          <span className="hidden lg:block" />
          <Field label="Control-room contact"><input className={INPUT} value={v.contact_name} onChange={set('contact_name')} /></Field>
          <Field label="Phone"><input type="tel" className={INPUT} value={v.contact_phone} onChange={set('contact_phone')} /></Field>
          <Field label="Email"><input type="email" className={INPUT} value={v.contact_email} onChange={set('contact_email')} /></Field>
          <div className="sm:col-span-2 lg:col-span-3">
            <Field label="Notes"><textarea rows={2} className={INPUT} value={v.notes} onChange={set('notes')} placeholder="Entry queues, festival days, evacuation routes…" /></Field>
          </div>
        </div>
      </section>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={busy}>{busy ? 'Saving…' : submitLabel}</Button>
        {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
      </div>
    </form>
  );
}
