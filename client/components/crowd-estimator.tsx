'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SourceBadge } from '@/components/source-badge';
import { apiFetch, type ApiSource } from '@/lib/api';

interface Analysis {
  count: number;
  level: 'Safe' | 'Warning' | 'Critical';
  thresholds: { warn: number; crit: number };
  density: {
    people_per_megapixel: number;
    peak_cell_people: number;
    hotspot_x: number;
    hotspot_y: number;
    people_per_m2?: number;
    density_band?: string;
  };
  image_size: { width: number; height: number };
  overlay_image: string;
  density_map_image: string;
  source: string;
}

interface ThresholdInfo {
  warn: number;
  crit: number;
  source: string;
  suggested: { warn: number; crit: number; basis: string } | null;
}

const LEVEL_STYLE: Record<string, string> = {
  Safe: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
  Warning: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  Critical: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
};

/** Upload a photo -> CSRNet count, crowd density, risk level and a density heat-map (POST /analyze-image). */
export function CrowdEstimator() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [warn, setWarn] = useState('100');
  const [crit, setCrit] = useState('200');
  const [area, setArea] = useState('');
  const [info, setInfo] = useState<ThresholdInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<Analysis | null>(null);
  const [source, setSource] = useState<ApiSource>('static');

  useEffect(() => {
    apiFetch<ThresholdInfo>('/thresholds')
      .then((r) => {
        setInfo(r.data);
        setWarn(String(r.data.warn));
        setCrit(String(r.data.crit));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const w = Number(warn);
  const c = Number(crit);
  const thresholdsValid = w > 0 && c > w;

  async function analyze() {
    if (!file || !thresholdsValid) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const form = new FormData();
      form.append('image', file);
      form.append('warn', String(w));
      form.append('crit', String(c));
      if (Number(area) > 0) form.append('area_m2', area);
      const r = await apiFetch<Analysis>('/analyze-image', { method: 'POST', body: form }, 90000);
      setResult(r.data);
      setSource(r.source);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  async function saveDefault() {
    if (!thresholdsValid) return;
    try {
      const r = await apiFetch<ThresholdInfo>('/thresholds', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warn: w, crit: c }),
      });
      setInfo(r.data);
      setNotice(`Saved: Warning at ${r.data.warn}, Critical at ${r.data.crit} people (used by the API, alerts and dashboard).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save thresholds');
    }
  }

  return (
    <Card className="bg-white/50 dark:bg-card/50 backdrop-blur-sm border border-white/60 dark:border-white/10 rounded-2xl p-6 mb-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Analyse a crowd photo</h2>
          <p className="text-sm text-foreground/60">
            CSRNet returns a density map; its sum is the head count. Upload any photo to see the count, density, risk level and heat-map.
          </p>
        </div>
        {result && <SourceBadge source={source} />}
      </div>

      <div className="grid md:grid-cols-[1fr_auto] gap-6 mt-4">
        <div className="flex flex-col gap-3">
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
          <div className="flex items-end gap-3 flex-wrap">
            <label className="text-xs text-foreground/60">
              Warning at (people)
              <input type="number" min={1} value={warn} onChange={(e) => setWarn(e.target.value)} className="block w-28 mt-1 rounded-md border border-border bg-white dark:bg-card px-2 py-1 text-sm" />
            </label>
            <label className="text-xs text-foreground/60">
              Critical at (people)
              <input type="number" min={1} value={crit} onChange={(e) => setCrit(e.target.value)} className="block w-28 mt-1 rounded-md border border-border bg-white dark:bg-card px-2 py-1 text-sm" />
            </label>
            <label className="text-xs text-foreground/60">
              Area in photo (m², optional)
              <input type="number" min={1} value={area} placeholder="e.g. 120" onChange={(e) => setArea(e.target.value)} className="block w-32 mt-1 rounded-md border border-border bg-white dark:bg-card px-2 py-1 text-sm" />
            </label>
            <Button onClick={analyze} disabled={!file || busy || !thresholdsValid}>
              {busy ? 'Analysing…' : 'Analyse'}
            </Button>
            <Button variant="outline" onClick={saveDefault} disabled={!thresholdsValid} title="Store as the server-wide default">
              Save thresholds as default
            </Button>
          </div>
          {!thresholdsValid && <p className="text-xs text-red-600 dark:text-red-400">Critical must be larger than Warning (both above 0).</p>}
          <p className="text-xs text-foreground/50">
            Thresholds are set by you, not learned from data
            {info ? ` (currently ${info.warn} / ${info.crit}, from ${info.source})` : ''}.
            {info?.suggested && (
              <>
                {' '}
                Data-based suggestion: <button className="underline" onClick={() => { setWarn(String(info.suggested!.warn)); setCrit(String(info.suggested!.crit)); }}>{info.suggested.warn} / {info.suggested.crit}</button> ({info.suggested.basis}).
              </>
            )}
          </p>
        </div>
        {preview && !result && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="selected" className="max-h-40 rounded-lg border border-border" />
        )}
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400 mt-3">{error}</p>}
      {notice && <p className="text-sm text-green-700 dark:text-green-300 mt-3">{notice}</p>}

      {result && (
        <div className="mt-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-foreground/60">People counted</p>
              <p className="text-4xl font-bold text-primary">{Math.round(result.count).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-foreground/60">Risk level</p>
              <span className={`inline-block mt-1 px-3 py-1 rounded-full border text-lg font-semibold ${LEVEL_STYLE[result.level]}`}>{result.level}</span>
              <p className="text-xs text-foreground/50 mt-1">Safe &lt; {result.thresholds.warn} · Warning &lt; {result.thresholds.crit} · Critical ≥ {result.thresholds.crit}</p>
            </div>
            <div>
              <p className="text-sm text-foreground/60">Crowd density</p>
              <p className="text-2xl font-bold text-secondary">{result.density.people_per_megapixel.toLocaleString()}</p>
              <p className="text-xs text-foreground/50">people per megapixel of the photo</p>
              {result.density.people_per_m2 != null && (
                <p className="text-xs text-foreground/70 mt-1">
                  {result.density.people_per_m2} people/m² — <b>{result.density.density_band}</b>
                </p>
              )}
            </div>
            <div>
              <p className="text-sm text-foreground/60">Busiest spot</p>
              <p className="text-2xl font-bold text-orange-500">
                {Math.round(result.density.hotspot_x * 100)}% / {Math.round(result.density.hotspot_y * 100)}%
              </p>
              <p className="text-xs text-foreground/50">peak density: % from left / % from top</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mt-5">
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Heat-map over the photo</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result.overlay_image} alt="density overlay" className="w-full rounded-lg border border-border" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Density map (model output)</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result.density_map_image} alt="density map" className="w-full rounded-lg border border-border" />
              <p className="text-xs text-foreground/50 mt-2">
                Red = most people per area, blue = none. The count is the sum of the whole map ({result.image_size.width}×{result.image_size.height} px analysed).
              </p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
