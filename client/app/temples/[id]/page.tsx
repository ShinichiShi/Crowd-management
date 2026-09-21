'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Camera as CameraIcon, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TempleForm } from '@/components/temple-form';
import { API_BASE, apiFetch } from '@/lib/api';
import { LEVEL_BAR, LEVEL_CHIP, SOURCE_INFO, timeAgo, type Camera, type SourceType, type Temple } from '@/lib/temples';

interface Readings { warn: number; crit: number; capacity: number; points: { ts: string; total: number }[] }
interface Integration { ingest_path: string; curl: string; ffmpeg_loop: string; python: string }

const INPUT = 'block w-full mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground/40';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

export default function TempleDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [temple, setTemple] = useState<Temple | null>(null);
  const [readings, setReadings] = useState<Readings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [addingCam, setAddingCam] = useState(false);
  const [busyCam, setBusyCam] = useState<number | null>(null);
  const [integration, setIntegration] = useState<{ cameraId: number; info: Integration } | null>(null);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    try {
      const [t, r] = await Promise.all([apiFetch<Temple>(`/temples/${id}`), apiFetch<Readings>(`/temples/${id}/readings?hours=24`)]);
      setTemple(t.data);
      setReadings(r.data);
      setTick((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the temple');
    }
  }, [id]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [load]);

  async function run(label: string, fn: () => Promise<unknown>, cameraId?: number) {
    setError(null);
    setNotice(null);
    if (cameraId) setBusyCam(cameraId);
    try {
      await fn();
      setNotice(label);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusyCam(null);
    }
  }

  if (error && !temple) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <Button asChild variant="outline" className="mt-4"><Link href="/temples">Back to temples</Link></Button>
      </div>
    );
  }
  if (!temple) return <div className="min-h-screen p-8 text-foreground/60">Loading…</div>;

  const cams = temple.cameras ?? [];
  const chart = (readings?.points ?? []).map((p) => ({ time: new Date(p.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), total: p.total }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-blue-50/30 to-background dark:via-blue-950/20">
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="sm"><Link href="/temples" className="gap-2"><ArrowLeft className="w-4 h-4" />Temples</Link></Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{temple.name}</h1>
              <p className="text-sm text-foreground/60">{[temple.deity, temple.city, temple.state].filter(Boolean).join(' · ') || 'No location set'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full border text-sm font-semibold ${LEVEL_CHIP[temple.level]}`}>{temple.level}</span>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditing((e) => !e)}><Pencil className="w-4 h-4" />Edit</Button>
            <Button variant="outline" size="sm" className="gap-2 text-red-600 dark:text-red-400" onClick={() => {
              if (confirm(`Delete ${temple.name} with all its cameras and readings?`)) run('deleted', async () => { await apiFetch(`/temples/${id}`, { method: 'DELETE' }); router.push('/temples'); });
            }}><Trash2 className="w-4 h-4" />Delete</Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {error && <Card className="p-3 text-sm border border-red-200 bg-red-50 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">{error}</Card>}
        {notice && <Card className="p-3 text-sm border border-green-200 bg-green-50 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300">Done: {notice}</Card>}

        {editing && (
          <Card className="bg-white/50 dark:bg-card/50 border border-white/60 dark:border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Edit temple</h2>
            <TempleForm initial={temple} submitLabel="Save changes" onCancel={() => setEditing(false)} onSubmit={async (payload) => {
              await apiFetch(`/temples/${id}`, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(payload) });
              setEditing(false);
              setNotice('temple updated');
              await load();
            }} />
          </Card>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Kpi label="People now" value={temple.current_count != null ? Math.round(temple.current_count).toLocaleString() : '—'} sub={`sum of ${temple.cameras_online} online camera(s)`} tone="text-primary" />
          <Kpi label="Occupancy" value={temple.occupancy_pct != null ? `${temple.occupancy_pct}%` : '—'} sub={`of ${temple.capacity.toLocaleString()} safe capacity`} tone="text-secondary" />
          <Kpi label="Warning at" value={Math.round(temple.warn).toLocaleString()} sub="people" tone="text-amber-500" />
          <Kpi label="Critical at" value={Math.round(temple.crit).toLocaleString()} sub="people" tone="text-red-500" />
          <Kpi label="Cameras online" value={`${temple.cameras_online}/${temple.cameras_total}`} sub={`updated ${timeAgo(temple.last_update)}`} tone="text-emerald-500" />
        </div>

        <Card className="bg-white/50 dark:bg-card/50 backdrop-blur-sm border border-white/60 dark:border-white/10 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">People present — last 24 hours</h2>
          {chart.length === 0 ? (
            <p className="text-sm text-foreground/60 py-10 text-center">No readings yet. Add a camera below and press “Capture now”, or wait for the first automatic capture.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="time" stroke="var(--muted-foreground)" style={{ fontSize: 12 }} />
                <YAxis stroke="var(--muted-foreground)" style={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--card)', color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: 8 }} />
                <ReferenceLine y={temple.warn} stroke="#F59E0B" strokeDasharray="4 4" label={{ value: 'Warning', fill: '#F59E0B', fontSize: 11, position: 'insideTopLeft' }} />
                <ReferenceLine y={temple.crit} stroke="#EF4444" strokeDasharray="4 4" label={{ value: 'Critical', fill: '#EF4444', fontSize: 11, position: 'insideTopLeft' }} />
                <Area type="monotone" dataKey="total" stroke="#EA6E3C" fill="#EA6E3C" fillOpacity={0.25} strokeWidth={2} name="People" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2"><CameraIcon className="w-5 h-5" />Camera feeds</h2>
            <Button size="sm" className="gap-2" onClick={() => setAddingCam((a) => !a)}><Plus className="w-4 h-4" />Add camera</Button>
          </div>

          {addingCam && (
            <CameraForm onCancel={() => setAddingCam(false)} onSubmit={async (payload) => {
              const r = await apiFetch<Camera & { api_key: string }>(`/temples/${id}/cameras`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(payload) });
              setAddingCam(false);
              setNotice(`camera “${r.data.name}” added`);
              if (r.data.source_type === 'push') await showIntegration(r.data.id);
              await load();
            }} />
          )}

          {cams.length === 0 && !addingCam && (
            <Card className="bg-white/50 dark:bg-card/50 border border-white/60 dark:border-white/10 rounded-2xl p-8 text-center text-sm text-foreground/60">
              No cameras yet. Add an HTTP snapshot / MJPEG / RTSP feed for the server to pull, or a push camera that posts frames to a private URL.
            </Card>
          )}

          <div className="grid lg:grid-cols-2 gap-6">
            {cams.map((cam) => (
              <Card key={cam.id} className="bg-white/50 dark:bg-card/50 backdrop-blur-sm border border-white/60 dark:border-white/10 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{cam.name}</p>
                    <p className="text-xs text-foreground/50">{SOURCE_INFO[cam.source_type].label}</p>
                    {cam.url && <p className="text-xs text-foreground/50 break-all mt-1">{cam.url}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`px-2.5 py-0.5 rounded-full border text-xs font-semibold ${LEVEL_CHIP[cam.latest?.level ?? 'No data']}`}>{cam.latest?.level ?? 'No data'}</span>
                    <span className={`text-xs ${cam.online ? 'text-green-600 dark:text-green-400' : cam.last_status === 'error' ? 'text-red-600 dark:text-red-400' : 'text-foreground/50'}`}>
                      {!cam.enabled ? 'disabled' : cam.online ? 'online' : cam.last_status === 'error' ? 'error' : 'no recent data'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-[1fr_auto] gap-4 mt-4 items-center">
                  <div>
                    <p className="text-3xl font-bold text-primary">{cam.latest ? Math.round(cam.latest.count).toLocaleString() : '—'}</p>
                    <p className="text-xs text-foreground/50">
                      people · {timeAgo(cam.latest?.ts ?? null)}
                      {cam.zone_capacity ? ` · zone capacity ${cam.zone_capacity}` : ''}
                      {cam.latest?.people_per_m2 ? ` · ${cam.latest.people_per_m2}/m²` : ''}
                    </p>
                    {cam.last_error && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{cam.last_error}</p>}
                    {cam.source_type !== 'push' && <p className="text-xs text-foreground/50 mt-1">Auto-capture every {cam.interval_seconds}s</p>}
                  </div>
                  {cam.has_frame && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`${API_BASE}/cameras/${cam.id}/latest.jpg?t=${tick}`} alt="latest annotated frame" className="h-24 rounded-lg border border-border" />
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
                  {cam.source_type !== 'push' && (
                    <>
                      <Button size="sm" disabled={busyCam === cam.id} className="gap-1" onClick={() => run('frame captured', () => apiFetch(`/cameras/${cam.id}/capture`, { method: 'POST' }, 90000), cam.id)}>
                        <RefreshCw className={`w-3.5 h-3.5 ${busyCam === cam.id ? 'animate-spin' : ''}`} />Capture now
                      </Button>
                      <Button size="sm" variant="outline" disabled={busyCam === cam.id} onClick={() => run('feed test passed (nothing saved)', () => apiFetch(`/cameras/${cam.id}/capture?store=false`, { method: 'POST' }, 90000), cam.id)}>Test feed</Button>
                    </>
                  )}
                  {cam.source_type === 'push' && <Button size="sm" variant="outline" onClick={() => showIntegration(cam.id)}>Show ingest URL</Button>}
                  <Button size="sm" variant="outline" onClick={() => run(cam.enabled ? 'camera disabled' : 'camera enabled', () => apiFetch(`/cameras/${cam.id}`, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ name: cam.name, source_type: cam.source_type, url: cam.url, area_m2: cam.area_m2, zone_capacity: cam.zone_capacity, interval_seconds: cam.interval_seconds, enabled: !cam.enabled }) }))}>
                    {cam.enabled ? 'Disable' : 'Enable'}
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600 dark:text-red-400" onClick={() => { if (confirm(`Remove camera “${cam.name}”?`)) run('camera removed', () => apiFetch(`/cameras/${cam.id}`, { method: 'DELETE' })); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {integration?.cameraId === cam.id && <IntegrationPanel info={integration.info} onClose={() => setIntegration(null)} />}
              </Card>
            ))}
          </div>
        </div>

        <Card className="bg-white/50 dark:bg-card/50 border border-white/60 dark:border-white/10 rounded-2xl p-6 text-sm text-foreground/70 space-y-2">
          <h3 className="font-semibold text-foreground">How camera integration works</h3>
          <p><b>Pull:</b> the server grabs a frame from the camera URL every interval, counts people with CSRNet, stores the reading and updates this page, the dashboard and alerts.</p>
          <p><b>Push:</b> for cameras the server cannot reach (behind NAT, edge boxes), the device POSTs a JPEG to its private ingest URL — see “Show ingest URL”.</p>
          <p>The temple total is the sum of the latest reading of every online camera, so give each camera a <i>different</i> part of the temple. A camera with a “zone capacity” is judged against its own zone (70 % / 90 %); otherwise against the temple’s Warning / Critical values. A camera with no reading for 15 minutes counts as offline.</p>
        </Card>
      </div>
    </div>
  );

  async function showIntegration(cameraId: number) {
    const r = await apiFetch<Integration>(`/cameras/${cameraId}/integration`);
    setIntegration({ cameraId, info: r.data });
  }
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: string }) {
  return (
    <Card className="bg-white/50 dark:bg-card/50 backdrop-blur-sm border border-white/60 dark:border-white/10 rounded-2xl p-5">
      <p className="text-sm text-foreground/60">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${tone}`}>{value}</p>
      <p className="text-xs text-foreground/50 mt-1">{sub}</p>
    </Card>
  );
}

function IntegrationPanel({ info, onClose }: { info: Integration; onClose: () => void }) {
  const base = API_BASE;
  const fill = (s: string) => s.replaceAll('$API_BASE', base).replace("API_BASE + '", `'${base}`);
  return (
    <div className="mt-4 rounded-lg border border-border bg-muted/40 p-4 text-xs space-y-3">
      <div className="flex justify-between"><b className="text-foreground">Push frames to this camera</b><button className="underline" onClick={onClose}>close</button></div>
      <p className="text-foreground/70">Keep this URL private — it is the camera’s credential.</p>
      <Snippet title="curl" text={fill(info.curl)} />
      <Snippet title="ffmpeg (RTSP camera → every 30 s)" text={fill(info.ffmpeg_loop)} />
      <Snippet title="Python" text={fill(info.python)} />
    </div>
  );
}

function Snippet({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <p className="text-foreground/60 mb-1">{title}</p>
      <pre className="overflow-x-auto rounded bg-background border border-border p-2 whitespace-pre-wrap break-all">{text}</pre>
    </div>
  );
}

function CameraForm({ onSubmit, onCancel }: { onSubmit: (p: unknown) => Promise<void>; onCancel: () => void }) {
  const [type, setType] = useState<SourceType>('snapshot');
  const [v, setV] = useState({ name: '', url: '', area_m2: '', zone_capacity: '', interval_seconds: '60' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  const info = SOURCE_INFO[type];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        name: v.name.trim(), source_type: type, url: type === 'push' ? null : v.url.trim(),
        area_m2: v.area_m2 ? Number(v.area_m2) : null, zone_capacity: v.zone_capacity ? Number(v.zone_capacity) : null,
        interval_seconds: Number(v.interval_seconds) || 60, enabled: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the camera');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="bg-white/50 dark:bg-card/50 border border-white/60 dark:border-white/10 rounded-2xl p-6 mb-6">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="text-xs font-medium text-foreground/70">Camera name *
            <input required minLength={2} className={INPUT} value={v.name} onChange={set('name')} placeholder="Main gate" />
          </label>
          <label className="text-xs font-medium text-foreground/70">Feed type
            <select className={INPUT} value={type} onChange={(e) => setType(e.target.value as SourceType)}>
              {(Object.keys(SOURCE_INFO) as SourceType[]).map((k) => <option key={k} value={k}>{SOURCE_INFO[k].label}</option>)}
            </select>
          </label>
          {type !== 'push' && (
            <label className="text-xs font-medium text-foreground/70 sm:col-span-2">Feed URL / path *
              <input required className={INPUT} value={v.url} onChange={set('url')} placeholder={info.placeholder} />
            </label>
          )}
          <label className="text-xs font-medium text-foreground/70">Area in view (m², optional)
            <input type="number" min={1} className={INPUT} value={v.area_m2} onChange={set('area_m2')} placeholder="enables people/m²" />
          </label>
          <label className="text-xs font-medium text-foreground/70">Zone capacity (people, optional)
            <input type="number" min={1} className={INPUT} value={v.zone_capacity} onChange={set('zone_capacity')} placeholder="judge this camera on its own zone" />
          </label>
          {type !== 'push' && (
            <label className="text-xs font-medium text-foreground/70">Capture every (seconds)
              <input type="number" min={5} max={3600} className={INPUT} value={v.interval_seconds} onChange={set('interval_seconds')} />
            </label>
          )}
        </div>
        <p className="text-xs text-foreground/60">{info.help}</p>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex gap-3">
          <Button type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add camera'}</Button>
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}
