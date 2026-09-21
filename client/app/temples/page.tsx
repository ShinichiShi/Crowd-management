'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Building2, Camera, MapPin, Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TempleForm } from '@/components/temple-form';
import { SourceBadge } from '@/components/source-badge';
import { useApi } from '@/lib/use-api';
import { apiFetch } from '@/lib/api';
import { LEVEL_BAR, LEVEL_CHIP, timeAgo, type Temple } from '@/lib/temples';

export default function TemplesPage() {
  const router = useRouter();
  const { data, source, loading } = useApi<{ temples: Temple[] }>('/temples');
  const [adding, setAdding] = useState(false);
  const temples = data?.temples ?? [];

  async function create(payload: unknown) {
    const r = await apiFetch<Temple>('/temples', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    router.push(`/temples/${r.data.id}`);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-blue-50/30 to-background dark:via-blue-950/20">
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="sm">
              <Link href="/" className="gap-2"><ArrowLeft className="w-4 h-4" />Back</Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Temple Management</h1>
              <p className="text-sm text-foreground/60">Register temples, connect camera feeds, set capacity and alert levels</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <SourceBadge source={source} />
            <Button onClick={() => setAdding((a) => !a)} className="gap-2"><Plus className="w-4 h-4" />Register temple</Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {source === 'demo' || (source === 'static' && !loading) ? (
          <Card className="p-4 border border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-200 text-sm">
            The live API is not reachable, so temples cannot be loaded or saved. Start the backend (<code>uvicorn main:app --port 8000</code>).
          </Card>
        ) : null}

        {adding && (
          <Card className="bg-white/50 dark:bg-card/50 backdrop-blur-sm border border-white/60 dark:border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Register a temple</h2>
            <TempleForm submitLabel="Register &amp; add cameras" onSubmit={create} onCancel={() => setAdding(false)} />
          </Card>
        )}

        {!loading && temples.length === 0 && !adding && (
          <Card className="bg-white/50 dark:bg-card/50 border border-white/60 dark:border-white/10 rounded-2xl p-10 text-center">
            <Building2 className="w-10 h-10 mx-auto text-foreground/30 mb-3" />
            <p className="text-lg font-semibold text-foreground">No temples registered yet</p>
            <p className="text-sm text-foreground/60 mt-1 mb-4">Register a temple, then attach one or more camera feeds to start counting crowds.</p>
            <Button onClick={() => setAdding(true)}>Register your first temple</Button>
          </Card>
        )}

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {temples.map((t) => (
            <Link key={t.id} href={`/temples/${t.id}`}>
              <Card className="bg-white/50 dark:bg-card/50 backdrop-blur-sm border border-white/60 dark:border-white/10 rounded-2xl p-6 hover:shadow-lg transition h-full">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{t.name}</h3>
                    <p className="text-sm text-foreground/60 flex items-center gap-1 mt-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {[t.city, t.state].filter(Boolean).join(', ') || 'Location not set'}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full border text-xs font-semibold ${LEVEL_CHIP[t.level]}`}>{t.level}</span>
                </div>

                <div className="mt-5">
                  <div className="flex items-end justify-between">
                    <p className="text-3xl font-bold text-primary">{t.current_count != null ? Math.round(t.current_count).toLocaleString() : '—'}</p>
                    <p className="text-xs text-foreground/50">of {t.capacity.toLocaleString()} safe capacity</p>
                  </div>
                  <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 mt-2 overflow-hidden">
                    <div className={`h-full ${LEVEL_BAR[t.level]}`} style={{ width: `${Math.min(100, t.occupancy_pct ?? 0)}%` }} />
                  </div>
                  <p className="text-xs text-foreground/50 mt-1">{t.occupancy_pct != null ? `${t.occupancy_pct}% occupied` : 'Waiting for the first camera reading'}</p>
                </div>

                <div className="flex items-center justify-between text-xs text-foreground/60 mt-5">
                  <span className="flex items-center gap-1"><Camera className="w-3.5 h-3.5" />{t.cameras_online}/{t.cameras_total} cameras online</span>
                  <span>Updated {timeAgo(t.last_update)}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
