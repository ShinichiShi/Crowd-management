'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Shield, BarChart3, AlertTriangle, Users, Zap, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function Home() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-blue-50 dark:via-blue-950/30 to-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center text-white font-bold">
              🙏
            </div>
            <span className="text-xl font-bold text-foreground">PilgrimSafe</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-sm text-foreground/70 hover:text-primary transition">Features</Link>
            <Link href="/dashboard" className="text-sm text-foreground/70 hover:text-primary transition">Dashboard</Link>
            <Link href="/temples" className="text-sm text-foreground/70 hover:text-primary transition">Temples</Link>
            <Link href="/analytics" className="text-sm text-foreground/70 hover:text-primary transition">Analytics</Link>
            <Link href="/about" className="text-sm text-foreground/70 hover:text-primary transition">About</Link>
          </div>

          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard">View Live Dashboard</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/alerts">Get Started</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-block px-4 py-2 bg-primary/10 rounded-full border border-primary/20 mb-6">
              <span className="text-sm font-semibold text-primary">🚀 AI-Powered Safety</span>
            </div>
            
            <h1 className="text-5xl sm:text-6xl font-bold text-foreground mb-6 text-balance leading-tight">
              Smart Crowd Monitoring for Sacred Spaces
            </h1>
            
            <p className="text-xl text-foreground/70 mb-8 text-balance leading-relaxed">
              PilgrimSafe AI uses advanced machine learning to predict crowd surges, manage risk, and ensure the safety of devotees at India's most sacred pilgrimage centers.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button asChild size="lg" className="bg-primary hover:bg-primary/90">
                <Link href="/dashboard" className="gap-2">
                  View Live Dashboard <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/about">Learn More</Link>
              </Button>
            </div>

            <div className="flex items-center gap-8 mt-12 pt-8 border-t border-border">
              <div>
                <p className="text-3xl font-bold text-primary">50K+</p>
                <p className="text-sm text-foreground/60">Daily Predictions</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-primary">15</p>
                <p className="text-sm text-foreground/60">Active Temples</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-primary">99.2%</p>
                <p className="text-sm text-foreground/60">Accuracy Rate</p>
              </div>
            </div>
          </div>

          {/* Dashboard Preview Card */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-3xl blur-3xl"></div>
            <Card className="relative bg-white/50 dark:bg-card/50 backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-2xl p-6 shadow-2xl">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-primary">Live Crowd Density</span>
                  <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                </div>
                <div className="h-32 bg-gradient-to-r from-blue-100 dark:from-blue-900/30 to-purple-100 rounded-xl relative overflow-hidden">
                  <div className="absolute inset-0 opacity-50">
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                      <rect x="10" y="20" width="15" height="15" fill="#EA6E3C" opacity="0.8" />
                      <rect x="30" y="15" width="20" height="20" fill="#EA6E3C" opacity="0.6" />
                      <rect x="55" y="25" width="18" height="18" fill="#10B981" opacity="0.5" />
                      <rect x="75" y="30" width="15" height="15" fill="#10B981" opacity="0.7" />
                    </svg>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-foreground">24.5K</p>
                      <p className="text-xs text-foreground/60">Current Crowd</p>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 dark:bg-blue-950/40 rounded-xl p-3 border border-blue-100 dark:border-blue-900">
                    <p className="text-xs text-foreground/60">Risk Level</p>
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">⚠️ Warning</p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-3 border border-green-100 dark:border-green-900">
                    <p className="text-xs text-foreground/60">Alerts</p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">3 Active</p>
                  </div>
                </div>

                <div className="text-xs text-foreground/50">Last updated: 2 seconds ago</div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-foreground mb-4">Powerful Features</h2>
          <p className="text-lg text-foreground/70">Everything you need to manage crowd safety effectively</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: Eye,
              title: 'Real-Time Monitoring',
              description: 'Live crowd density visualization with heatmap tracking'
            },
            {
              icon: BarChart3,
              title: 'AI Prediction',
              description: 'LSTM-based forecasting of crowd surges up to 24 hours ahead'
            },
            {
              icon: AlertTriangle,
              title: 'Smart Alerts',
              description: 'Automated risk notifications with escalation levels'
            },
            {
              icon: Shield,
              title: 'Safety Protocols',
              description: 'Elderly and differently-abled assistance management'
            },
            {
              icon: Users,
              title: 'Accessibility',
              description: 'Multilingual support and priority lane management'
            },
            {
              icon: Zap,
              title: 'Performance',
              description: '99.2% accuracy with sub-second response times'
            }
          ].map((feature, idx) => (
            <Card key={idx} className="bg-white/40 backdrop-blur-sm border border-white/60 dark:border-white/10 rounded-2xl p-6 hover:shadow-lg transition-all duration-300 hover:bg-white/60">
              <feature.icon className="w-10 h-10 text-primary mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-foreground/70 text-sm leading-relaxed">{feature.description}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 rounded-2xl p-12 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">Ready to Enhance Safety?</h2>
          <p className="text-foreground/70 mb-8 max-w-2xl mx-auto">
            Integrate PilgrimSafe AI with your temple infrastructure and start protecting your devotees today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-primary hover:bg-primary/90">
              <Link href="/dashboard">Predict Crowd Risk</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/about">View Research</Link>
            </Button>
          </div>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-border mt-20 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-foreground/60 text-sm">
          <p>© 2024 PilgrimSafe AI. Dedicated to pilgrimage safety and smart city technology.</p>
        </div>
      </footer>
    </div>
  );
}
