'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Map, Users, TrendingUp, Calendar } from 'lucide-react';
import { useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const templeData: Record<string, any> = {
  somnath: {
    name: 'Somnath Temple',
    location: 'Gujarat',
    capacity: 10000,
    current: 8200,
    peakVisitors: 45000,
    avgDailyVisitors: 12000,
    operatingHours: '04:00 - 22:00',
    accessibility: 95,
    stats: [
      { day: 'Mon', visitors: 8500 },
      { day: 'Tue', visitors: 9200 },
      { day: 'Wed', visitors: 8800 },
      { day: 'Thu', visitors: 10200 },
      { day: 'Fri', visitors: 12500 },
      { day: 'Sat', visitors: 18300 },
      { day: 'Sun', visitors: 22100 },
    ],
    festival: [
      { festival: 'Diwali', 2022: 35000, 2023: 38000, 2024: 41000 },
      { festival: 'Navratri', 2022: 28000, 2023: 31000, 2024: 34000 },
      { festival: 'Holi', 2022: 22000, 2023: 25000, 2024: 28000 },
    ]
  },
  dwarkadhish: {
    name: 'Dwarkadhish Temple',
    location: 'Gujarat',
    capacity: 8000,
    current: 5400,
    peakVisitors: 35000,
    avgDailyVisitors: 9500,
    operatingHours: '05:30 - 21:00',
    accessibility: 92,
    stats: [
      { day: 'Mon', visitors: 7200 },
      { day: 'Tue', visitors: 7800 },
      { day: 'Wed', visitors: 7400 },
      { day: 'Thu', visitors: 8200 },
      { day: 'Fri', visitors: 9800 },
      { day: 'Sat', visitors: 15200 },
      { day: 'Sun', visitors: 18500 },
    ],
    festival: [
      { festival: 'Diwali', 2022: 28000, 2023: 31000, 2024: 34000 },
      { festival: 'Navratri', 2022: 22000, 2023: 25000, 2024: 28000 },
      { festival: 'Janmashtami', 2022: 32000, 2023: 35000, 2024: 38000 },
    ]
  }
};

const accessibilityFeatures = [
  { feature: 'Elderly Priority Lanes', status: '✓ Active', description: 'Dedicated pathways for senior citizens' },
  { feature: 'Wheelchair Accessibility', status: '✓ Available', description: '12 ramps, 4 accessible facilities' },
  { feature: 'Medical Stations', status: '✓ Staffed', description: '3 stations with 15 medical personnel' },
  { feature: 'Rest Areas', status: '✓ Available', description: 'Shaded areas with seating for 200+' },
];

export default function TempleInsightsPage() {
  const [selectedTemple, setSelectedTemple] = useState<'somnath' | 'dwarkadhish'>('somnath');
  const temple = templeData[selectedTemple];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-emerald-50/30 dark:via-emerald-950/20 to-background">
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
            <h1 className="text-2xl font-bold text-foreground">Temple Insights</h1>
            <p className="text-sm text-foreground/60">Crowd statistics, footfall heatmaps, and festival impact analysis</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Temple Selector */}
        <div className="flex gap-3 mb-8">
          {['somnath', 'dwarkadhish'].map((key) => (
            <button
              key={key}
              onClick={() => setSelectedTemple(key as 'somnath' | 'dwarkadhish')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                selectedTemple === key
                  ? 'bg-primary text-white shadow-lg'
                  : 'bg-white dark:bg-card border border-border text-foreground hover:border-primary'
              }`}
            >
              {templeData[key].name}
            </button>
          ))}
        </div>

        {/* Temple Overview */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-white/50 dark:bg-card/50 backdrop-blur-sm border border-white/60 dark:border-white/10 rounded-2xl p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-foreground/60 mb-2">Current Visitors</p>
                <p className="text-3xl font-bold text-primary">{temple.current.toLocaleString()}</p>
                <p className="text-xs text-foreground/50 mt-2">Capacity: {Math.round(temple.current / temple.capacity * 100)}%</p>
              </div>
              <Users className="w-10 h-10 text-primary/20" />
            </div>
          </Card>

          <Card className="bg-white/50 dark:bg-card/50 backdrop-blur-sm border border-white/60 dark:border-white/10 rounded-2xl p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-foreground/60 mb-2">Daily Average</p>
                <p className="text-3xl font-bold text-secondary">{temple.avgDailyVisitors.toLocaleString()}</p>
                <p className="text-xs text-foreground/50 mt-2">Peak: {temple.peakVisitors.toLocaleString()}</p>
              </div>
              <TrendingUp className="w-10 h-10 text-secondary/20" />
            </div>
          </Card>

          <Card className="bg-white/50 dark:bg-card/50 backdrop-blur-sm border border-white/60 dark:border-white/10 rounded-2xl p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-foreground/60 mb-2">Accessibility Score</p>
                <p className="text-3xl font-bold text-emerald-500">{temple.accessibility}%</p>
                <p className="text-xs text-foreground/50 mt-2">Excellent facilities</p>
              </div>
              <Map className="w-10 h-10 text-emerald-500/20" />
            </div>
          </Card>
        </div>

        {/* Weekly Footfall */}
        <Card className="bg-white/50 dark:bg-card/50 backdrop-blur-sm border border-white/60 dark:border-white/10 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-6">Weekly Footfall Pattern</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={temple.stats}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" stroke="var(--muted-foreground)" style={{ fontSize: '12px' }} />
              <YAxis stroke="var(--muted-foreground)" style={{ fontSize: '12px' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'var(--card)', color: 'var(--foreground)', 
                  border: '1px solid var(--border)',
                  borderRadius: '8px'
                }}
              />
              <Bar dataKey="visitors" fill="#EA6E3C" name="Visitors" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Festival Comparison */}
        <Card className="bg-white/50 dark:bg-card/50 backdrop-blur-sm border border-white/60 dark:border-white/10 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-6">Festival Surge Impact (3 Years)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={temple.festival}>
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
              <Line type="monotone" dataKey="2022" stroke="#EA6E3C" strokeWidth={2} name="2022" />
              <Line type="monotone" dataKey="2023" stroke="var(--secondary)" strokeWidth={2} name="2023" />
              <Line type="monotone" dataKey="2024" stroke="#10B981" strokeWidth={2} name="2024" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Accessibility & Safety */}
        <Card className="bg-white/50 dark:bg-card/50 backdrop-blur-sm border border-white/60 dark:border-white/10 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-6">Accessibility & Safety Features</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {accessibilityFeatures.map((item, idx) => (
              <div key={idx} className="p-4 bg-gradient-to-r from-emerald-50 dark:from-emerald-950/30 to-blue-50 dark:to-blue-950/30 rounded-xl border border-emerald-100 dark:border-emerald-900">
                <div className="flex items-start justify-between mb-2">
                  <p className="font-semibold text-foreground">{item.feature}</p>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">{item.status}</span>
                </div>
                <p className="text-sm text-foreground/70">{item.description}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Operating Hours & Details */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-6">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Operating Schedule
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-foreground/70">Daily Operating Hours</p>
                <p className="text-lg font-bold text-primary">{temple.operatingHours}</p>
              </div>
              <div>
                <p className="text-sm text-foreground/70">Capacity Limit</p>
                <p className="text-lg font-bold text-primary">{temple.capacity.toLocaleString()} devotees</p>
              </div>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-secondary/5 to-secondary/10 border border-secondary/20 rounded-2xl p-6">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Map className="w-5 h-5 text-secondary" />
              Location & Contact
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-foreground/70">Location</p>
                <p className="text-lg font-bold text-secondary">{temple.location}</p>
              </div>
              <div>
                <p className="text-sm text-foreground/70">Administrative Contact</p>
                <p className="text-lg font-bold text-secondary">+91-XXXX-XXXX-0001</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Heatmap Section */}
        <Card className="bg-white/50 dark:bg-card/50 backdrop-blur-sm border border-white/60 dark:border-white/10 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-6">Crowd Density Heatmap</h2>
          <div className="bg-gradient-to-br from-blue-100 dark:from-blue-900/30 via-green-100 dark:via-green-950/30 to-red-100 rounded-xl p-1 h-96 flex items-center justify-center relative overflow-hidden">
            <svg className="w-full h-full absolute inset-0" viewBox="0 0 400 300">
              {/* Temple layout representation */}
              <rect x="50" y="30" width="300" height="240" fill="none" stroke="var(--secondary)" strokeWidth="2" />
              {/* Entry point */}
              <rect x="50" y="260" width="60" height="20" fill="#10B981" opacity="0.6" />
              {/* Main prayer area */}
              <circle cx="200" cy="120" r="80" fill="#EA6E3C" opacity="0.7" />
              {/* Secondary areas */}
              <rect x="70" y="160" width="60" height="60" fill="#F59E0B" opacity="0.6" />
              <rect x="270" y="160" width="60" height="60" fill="#F59E0B" opacity="0.6" />
              {/* Safe zones */}
              <rect x="70" y="240" width="60" height="20" fill="#10B981" opacity="0.4" />
              <rect x="270" y="240" width="60" height="20" fill="#10B981" opacity="0.4" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-center z-10">
              <div>
                <p className="text-sm font-semibold text-foreground/80">Real-time Heatmap Visualization</p>
                <p className="text-xs text-foreground/60 mt-1">Hot zones indicate higher crowd density</p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-emerald-500 rounded"></div>
              <span className="text-xs text-foreground/70">Safe</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-amber-500 rounded"></div>
              <span className="text-xs text-foreground/70">Moderate</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-500 rounded"></div>
              <span className="text-xs text-foreground/70">High</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span className="text-xs text-foreground/70">Critical</span>
            </div>
          </div>
        </Card>

        {/* Navigation */}
        <div className="grid md:grid-cols-3 gap-4">
          <Button asChild className="bg-primary hover:bg-primary/90 h-12 rounded-xl font-semibold">
            <Link href="/dashboard">Back to Dashboard →</Link>
          </Button>
          <Button asChild className="bg-secondary hover:bg-secondary/90 h-12 rounded-xl font-semibold text-white dark:text-secondary-foreground">
            <Link href="/accessibility">Safety & Accessibility →</Link>
          </Button>
          <Button asChild variant="outline" className="h-12 rounded-xl font-semibold">
            <Link href="/about">Research Details →</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
