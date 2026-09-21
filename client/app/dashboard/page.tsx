'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertTriangle, TrendingUp, Users, Clock } from 'lucide-react';
import { useApi } from '@/lib/use-api';
import type { Temple } from '@/lib/temples';
import { SourceBadge } from '@/components/source-badge';
import { CrowdEstimator } from '@/components/crowd-estimator';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const fallbackCrowdData = [
  { time: '00:00', crowd: 2400, prediction: 2210 },
  { time: '04:00', crowd: 1398, prediction: 2290 },
  { time: '08:00', crowd: 9800, prediction: 2000 },
  { time: '12:00', crowd: 3908, prediction: 2108 },
  { time: '16:00', crowd: 4800, prediction: 2200 },
  { time: '20:00', crowd: 3800, prediction: 2100 },
  { time: '23:59', crowd: 4300, prediction: 2300 },
];

const fallbackTempleMetrics = [
  { name: 'Somnath', value: 35, color: '#EA6E3C' },
  { name: 'Dwarkadhish', value: 28, color: '#4C3A7F' },
  { name: 'Ramnath', value: 22, color: '#10B981' },
  { name: 'Shreenathji', value: 15, color: '#F59E0B' },
];

interface DashboardPayload {
  summary: { current_crowd: number; risk_level: string; next_hour_surge_percent: number; response_time_seconds: number; next_hour_forecast?: number; note?: string; last_updated?: string };
  crowd_data: typeof fallbackCrowdData;
  temple_metrics: typeof fallbackTempleMetrics;
}

export default function Dashboard() {
  const { data, source } = useApi<DashboardPayload>('/dashboard-data');
  const crowdData = data?.crowd_data ?? fallbackCrowdData;
  const { data: templeData } = useApi<{ temples: Temple[] }>('/temples');
  const realTemples = templeData?.temples ?? [];
  const withCounts = realTemples.filter((t) => t.current_count != null && t.current_count > 0);
  const templeMetrics = withCounts.length
    ? withCounts.map((t, i) => ({ name: t.name.replace(/ Temple$/, ''), value: Math.round(t.current_count as number), color: t.color ?? '#EA6E3C' }))
    : data?.temple_metrics ?? fallbackTempleMetrics;
  const statusRows = realTemples.length
    ? realTemples.map((t) => ({
        id: t.id,
        name: t.name,
        crowd: t.current_count != null ? Math.round(t.current_count).toLocaleString() : 'no data',
        risk: t.level === 'No data' ? 'Safe' : t.level,
        label: t.level,
        capacity: Math.min(100, t.occupancy_pct ?? 0),
      }))
    : [
        { id: 0, name: 'Somnath Temple', crowd: '8.2K', risk: 'Critical', label: 'Critical', capacity: 85 },
        { id: 0, name: 'Dwarkadhish Temple', crowd: '6.8K', risk: 'Warning', label: 'Warning', capacity: 68 },
        { id: 0, name: 'Ramnath Temple', crowd: '5.1K', risk: 'Safe', label: 'Safe', capacity: 51 },
        { id: 0, name: 'Shreenathji Temple', crowd: '4.4K', risk: 'Safe', label: 'Safe', capacity: 44 },
      ];
  const summary = data?.summary;
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-blue-50/30 dark:via-blue-950/20 to-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="sm">
              <Link href="/" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Live Monitoring Dashboard</h1>
              <p className="text-sm text-foreground/60">{summary?.note ?? 'Real-time crowd analysis & risk assessment'}</p>
            </div>
          </div>
          <SourceBadge source={source} />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="bg-white/50 dark:bg-card/50 backdrop-blur-sm border border-white/60 dark:border-white/10 rounded-2xl p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-foreground/60 mb-2">Current Crowd</p>
                <p className="text-3xl font-bold text-primary">{summary ? summary.current_crowd.toLocaleString() : '24.5K'}</p>
                <p className="text-xs text-foreground/50 mt-2">{summary?.last_updated ? `As of ${summary.last_updated.replace('T', ' ').slice(0, 16)}` : '+2.3% from last hour'}</p>
              </div>
              <Users className="w-10 h-10 text-primary/20" />
            </div>
          </Card>

          <Card className="bg-white/50 dark:bg-card/50 backdrop-blur-sm border border-white/60 dark:border-white/10 rounded-2xl p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-foreground/60 mb-2">Risk Index</p>
                <p className="text-3xl font-bold text-orange-500">{summary ? summary.risk_level : '⚠️ Warning'}</p>
                <p className="text-xs text-foreground/50 mt-2">{summary ? 'Safe <100 · Warning 100-200 · Critical ≥200' : 'Approaching threshold'}</p>
              </div>
              <AlertTriangle className="w-10 h-10 text-orange-500/20" />
            </div>
          </Card>

          <Card className="bg-white/50 dark:bg-card/50 backdrop-blur-sm border border-white/60 dark:border-white/10 rounded-2xl p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-foreground/60 mb-2">Next Hour Surge</p>
                <p className="text-3xl font-bold text-secondary">{summary ? `${summary.next_hour_surge_percent > 0 ? '+' : ''}${summary.next_hour_surge_percent}%` : '+15%'}</p>
                <p className="text-xs text-foreground/50 mt-2">{summary?.next_hour_forecast != null ? `LSTM forecast: ${summary.next_hour_forecast} people` : 'Predicted change'}</p>
              </div>
              <TrendingUp className="w-10 h-10 text-secondary/20" />
            </div>
          </Card>

          <Card className="bg-white/50 dark:bg-card/50 backdrop-blur-sm border border-white/60 dark:border-white/10 rounded-2xl p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-foreground/60 mb-2">Response Time</p>
                <p className="text-3xl font-bold text-emerald-500">{summary ? `${summary.response_time_seconds}s` : '0.24s'}</p>
                <p className="text-xs text-foreground/50 mt-2">Avg prediction speed</p>
              </div>
              <Clock className="w-10 h-10 text-emerald-500/20" />
            </div>
          </Card>
        </div>

        <CrowdEstimator />

        {/* Charts Section */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* Main Chart */}
          <Card className="lg:col-span-2 bg-white/50 dark:bg-card/50 backdrop-blur-sm border border-white/60 dark:border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-6">24-Hour Crowd Trend & Prediction</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={crowdData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="time" stroke="var(--muted-foreground)" style={{ fontSize: '12px' }} />
                <YAxis stroke="var(--muted-foreground)" style={{ fontSize: '12px' }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--card)', color: 'var(--foreground)', 
                    border: '1px solid var(--border)',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="crowd" 
                  stroke="#EA6E3C" 
                  strokeWidth={3}
                  dot={{ fill: '#EA6E3C', r: 4 }}
                  name="Actual Crowd"
                />
                <Line 
                  type="monotone" 
                  dataKey="prediction" 
                  stroke="var(--secondary)" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: 'var(--secondary)', r: 3 }}
                  name="AI Prediction"
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Risk Distribution */}
          <Card className="bg-white/50 dark:bg-card/50 backdrop-blur-sm border border-white/60 dark:border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-6">Risk Distribution by Temple</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={templeMetrics}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {templeMetrics.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Temple Status */}
        <Card className="bg-white/50 dark:bg-card/50 backdrop-blur-sm border border-white/60 dark:border-white/10 rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-foreground">Temple Status Overview</h2>
            <Link href="/temples" className="text-sm text-primary hover:underline">{realTemples.length ? 'Manage temples →' : 'Register your temples →'}</Link>
          </div>
          <div className="space-y-3">
            {statusRows.map((temple, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 bg-gradient-to-r from-white/20 dark:from-white/5 to-white/10 dark:to-white/5 rounded-xl border border-white/40 dark:border-white/10 hover:border-white/60 transition">
                <div className="flex-1">
                  <p className="font-semibold text-foreground">{temple.name}</p>
                  <p className="text-sm text-foreground/60">{temple.crowd} {realTemples.length ? 'people now' : 'devotees'}</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all ${
                        temple.risk === 'Critical' ? 'bg-red-500' :
                        temple.risk === 'Warning' ? 'bg-orange-500' :
                        'bg-emerald-500'
                      }`}
                      style={{ width: `${temple.capacity}%` }}
                    ></div>
                  </div>
                  <div className="w-20 text-right">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                      temple.risk === 'Critical' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' :
                      temple.risk === 'Warning' ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300' :
                      'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                    }`}>
                      {temple.label}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Navigation Links */}
        <div className="grid md:grid-cols-3 gap-4">
          <Button asChild className="bg-primary hover:bg-primary/90 h-12 rounded-xl font-semibold">
            <Link href="/analytics">View Analytics →</Link>
          </Button>
          <Button asChild className="bg-secondary hover:bg-secondary/90 h-12 rounded-xl font-semibold text-white dark:text-secondary-foreground">
            <Link href="/alerts">Risk Alerts →</Link>
          </Button>
          <Button asChild variant="outline" className="h-12 rounded-xl font-semibold">
            <Link href="/temple-insights">Temple Insights →</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
