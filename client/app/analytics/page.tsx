'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Target, Zap } from 'lucide-react';
import { useApi } from '@/lib/use-api';
import { SourceBadge } from '@/components/source-badge';
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const fallbackHistoricalData = [
  { month: 'Jan', actual: 2400, predicted: 2210, accuracy: 92 },
  { month: 'Feb', actual: 3210, predicted: 2990, accuracy: 94 },
  { month: 'Mar', actual: 2290, predicted: 2000, accuracy: 88 },
  { month: 'Apr', actual: 2390, predicted: 2108, accuracy: 96 },
  { month: 'May', actual: 2490, predicted: 2200, accuracy: 95 },
  { month: 'Jun', actual: 2590, predicted: 2100, accuracy: 97 },
];

const fallbackFestivalData = [
  { festival: 'Diwali', 2022: 4500, 2023: 5200, 2024: 5800 },
  { festival: 'Navratri', 2022: 3800, 2023: 4200, 2024: 4900 },
  { festival: 'Holi', 2022: 3200, 2023: 3600, 2024: 4100 },
  { festival: 'Janmashtami', 2022: 2800, 2023: 3100, 2024: 3500 },
];

const fallbackAccuracyMetrics = [
  { metric: 'MAE (Mean Absolute Error)', value: '±245 people', description: 'Average prediction variance' },
  { metric: 'RMSE (Root Mean Squared Error)', value: '312', description: 'Standard deviation of errors' },
  { metric: 'Model Accuracy', value: '99.2%', description: 'Overall prediction success rate' },
  { metric: 'Peak Hour Accuracy', value: '97.8%', description: 'Accuracy during high traffic' },
];

interface AnalyticsPayload {
  historical_data: typeof fallbackHistoricalData;
  festival_data: typeof fallbackFestivalData;
  accuracy_metrics: typeof fallbackAccuracyMetrics;
}

export default function Analytics() {
  const { data, source } = useApi<AnalyticsPayload>('/analytics-data');
  const historicalData = data?.historical_data ?? fallbackHistoricalData;
  const festivalData = data?.festival_data ?? fallbackFestivalData;
  const accuracyMetrics = data?.accuracy_metrics ?? fallbackAccuracyMetrics;
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-purple-50/30 dark:via-purple-950/20 to-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link href="/" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">AI Prediction & Analytics</h1>
            <p className="text-sm text-foreground/60">Historical trends, model accuracy, and festival analysis</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Accuracy Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {accuracyMetrics.map((metric, idx) => (
            <Card key={idx} className="bg-white/50 dark:bg-card/50 backdrop-blur-sm border border-white/60 dark:border-white/10 rounded-2xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide">{metric.metric}</p>
                  <p className="text-2xl font-bold text-foreground mt-2">{metric.value}</p>
                  <p className="text-xs text-foreground/60 mt-1">{metric.description}</p>
                </div>
                <Target className="w-8 h-8 text-primary/20" />
              </div>
            </Card>
          ))}
        </div>

        {/* Historical Trends */}
        <Card className="bg-white/50 dark:bg-card/50 backdrop-blur-sm border border-white/60 dark:border-white/10 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-6">Historical Accuracy & Trends (6 Months)</h2>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={historicalData}>
              <defs>
                <linearGradient id="colorAccuracy" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" stroke="var(--muted-foreground)" style={{ fontSize: '12px' }} />
              <YAxis stroke="var(--muted-foreground)" style={{ fontSize: '12px' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'var(--card)', color: 'var(--foreground)', 
                  border: '1px solid var(--border)',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="actual" 
                stroke="#EA6E3C" 
                fill="#EA6E3C" 
                fillOpacity={0.1}
                name="Actual Crowd"
              />
              <Area 
                type="monotone" 
                dataKey="predicted" 
                stroke="var(--secondary)" 
                fill="#4C3A7F" 
                fillOpacity={0.1}
                name="AI Prediction"
              />
              <Area 
                type="monotone" 
                dataKey="accuracy" 
                stroke="#10B981" 
                fill="url(#colorAccuracy)"
                name="Accuracy %"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Festival Comparison */}
        <Card className="bg-white/50 dark:bg-card/50 backdrop-blur-sm border border-white/60 dark:border-white/10 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-6">Festival-Based Surge Comparison (3 Years)</h2>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={festivalData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="festival" stroke="var(--muted-foreground)" style={{ fontSize: '12px' }} />
              <YAxis stroke="var(--muted-foreground)" style={{ fontSize: '12px' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'var(--card)', color: 'var(--foreground)', 
                  border: '1px solid var(--border)',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Bar dataKey="2022" fill="#EA6E3C" name="2022" radius={[8, 8, 0, 0]} />
              <Bar dataKey="2023" fill="#4C3A7F" name="2023" radius={[8, 8, 0, 0]} />
              <Bar dataKey="2024" fill="#10B981" name="2024" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Model Insights */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">LSTM Architecture</h3>
                <p className="text-sm text-foreground/70 leading-relaxed">
                  Our hybrid CNN + LSTM model captures complex temporal patterns in crowd behavior, learning from seasonal variations, festival cycles, and real-time sensor data to provide accurate 24-hour predictions.
                </p>
              </div>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-secondary/5 to-secondary/10 border border-secondary/20 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-secondary/20 rounded-xl flex items-center justify-center">
                <Target className="w-6 h-6 text-secondary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">Continuous Learning</h3>
                <p className="text-sm text-foreground/70 leading-relaxed">
                  The model is retrained weekly with latest crowd patterns and outcomes, improving accuracy over time and adapting to changing pilgrimage behaviors and climate factors.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Training Metrics */}
        <Card className="bg-white/50 dark:bg-card/50 backdrop-blur-sm border border-white/60 dark:border-white/10 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-6">Model Performance Metrics</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-foreground mb-4">Training Efficiency</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-foreground/70">Training Speed</span>
                    <span className="text-sm font-semibold text-primary">94%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div className="h-2 bg-primary rounded-full" style={{ width: '94%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-foreground/70">Data Quality</span>
                    <span className="text-sm font-semibold text-secondary">98%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div className="h-2 bg-secondary rounded-full" style={{ width: '98%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-foreground/70">Model Stability</span>
                    <span className="text-sm font-semibold text-emerald-500">96%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div className="h-2 bg-emerald-500 rounded-full" style={{ width: '96%' }}></div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-foreground mb-4">Prediction Reliability</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-foreground/70">1-Hour Forecast</span>
                    <span className="text-sm font-semibold text-emerald-500">98.5%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div className="h-2 bg-emerald-500 rounded-full" style={{ width: '98.5%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-foreground/70">6-Hour Forecast</span>
                    <span className="text-sm font-semibold text-emerald-500">97.2%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div className="h-2 bg-emerald-500 rounded-full" style={{ width: '97.2%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-foreground/70">24-Hour Forecast</span>
                    <span className="text-sm font-semibold text-primary">94.8%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div className="h-2 bg-primary rounded-full" style={{ width: '94.8%' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Navigation */}
        <div className="grid md:grid-cols-3 gap-4">
          <Button asChild className="bg-primary hover:bg-primary/90 h-12 rounded-xl font-semibold">
            <Link href="/dashboard">Back to Dashboard →</Link>
          </Button>
          <Button asChild className="bg-secondary hover:bg-secondary/90 h-12 rounded-xl font-semibold text-white dark:text-secondary-foreground">
            <Link href="/alerts">View Alerts →</Link>
          </Button>
          <Button asChild variant="outline" className="h-12 rounded-xl font-semibold">
            <Link href="/about">Research Details →</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
