'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertTriangle, AlertCircle, CheckCircle, Clock, Phone } from 'lucide-react';
import { useState } from 'react';
import { useApi } from '@/lib/use-api';
import { SourceBadge } from '@/components/source-badge';

const fallbackAlerts = [
  {
    id: 1,
    temple: 'Somnath Temple',
    severity: 'Critical',
    type: 'Crowd Surge',
    message: 'Predicted surge of 35% in next 2 hours. Current capacity at 85%.',
    timestamp: '2024-02-26 14:32:15',
    escalation: 'Level 3',
    response: 'Medical team mobilized. Barrier reinforcement initiated.',
    status: 'Active'
  },
  {
    id: 2,
    temple: 'Dwarkadhish Temple',
    severity: 'Warning',
    type: 'Capacity Alert',
    message: 'Approaching maximum capacity. 68% of current limit reached.',
    timestamp: '2024-02-26 14:28:43',
    escalation: 'Level 2',
    response: 'Additional staff deployed to entrance.',
    status: 'Active'
  },
  {
    id: 3,
    temple: 'Ramnath Temple',
    severity: 'Safe',
    type: 'Routine Monitor',
    message: 'Crowd density within normal parameters. All systems nominal.',
    timestamp: '2024-02-26 14:25:20',
    escalation: 'Level 1',
    response: 'Standard monitoring continues.',
    status: 'Monitoring'
  },
  {
    id: 4,
    temple: 'Somnath Temple',
    severity: 'Warning',
    type: 'Medical Response',
    message: 'Medical station reports increased footfall. Additional medics requested.',
    timestamp: '2024-02-26 14:22:10',
    escalation: 'Level 2',
    response: 'EMT unit 2 redirected to medical station.',
    status: 'Active'
  },
  {
    id: 5,
    temple: 'Dwarkadhish Temple',
    severity: 'Safe',
    type: 'Accessibility Alert',
    message: 'Elderly assistance queue slightly elevated but manageable.',
    timestamp: '2024-02-26 14:18:05',
    escalation: 'Level 1',
    response: 'Monitoring elderly lane occupancy.',
    status: 'Monitoring'
  },
];

type AlertItem = (typeof fallbackAlerts)[number];

export default function AlertsPage() {
  const { data, source } = useApi<{ alerts: AlertItem[] }>('/alerts-data');
  const alerts = data?.alerts ?? fallbackAlerts;
  const criticalCount = alerts.filter((a) => a.severity === 'Critical').length;
  const [selectedAlert, setSelectedAlert] = useState<number | null>(null);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'Critical': return 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800';
      case 'Warning': return 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800';
      default: return 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'Critical': return <AlertTriangle className="w-5 h-5" />;
      case 'Warning': return <AlertCircle className="w-5 h-5" />;
      default: return <CheckCircle className="w-5 h-5" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-red-50/20 dark:via-red-950/20 to-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link href="/" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">Risk Alert Center</h1>
            <p className="text-sm text-foreground/60">Active alerts and emergency escalation monitoring</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-red-600 dark:text-red-400 font-medium mr-4">{criticalCount} Critical</span>
            <SourceBadge source={source} />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
          <Card className="bg-red-50 border border-red-200 dark:border-red-800 rounded-2xl p-4">
            <p className="text-xs text-red-600 dark:text-red-400 font-semibold mb-1">CRITICAL ALERTS</p>
            <p className="text-3xl font-bold text-red-700 dark:text-red-300">2</p>
          </Card>
          <Card className="bg-orange-50 border border-orange-200 dark:border-orange-800 rounded-2xl p-4">
            <p className="text-xs text-orange-600 dark:text-orange-400 font-semibold mb-1">WARNINGS</p>
            <p className="text-3xl font-bold text-orange-700 dark:text-orange-300">2</p>
          </Card>
          <Card className="bg-emerald-50 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4">
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mb-1">SAFE STATUS</p>
            <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">1</p>
          </Card>
          <Card className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
            <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-1">RESPONSE TIME</p>
            <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">2.3s</p>
          </Card>
        </div>

        {/* Emergency Contacts */}
        <Card className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 dark:border-red-800 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Phone className="w-5 h-5 text-red-600 dark:text-red-400" />
            Emergency Escalation Contacts
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { role: 'Temple Management', contact: '+91-XXXX-XXXX-1001', response: '5 min' },
              { role: 'Medical Response', contact: '+91-XXXX-XXXX-1002', response: '2 min' },
              { role: 'Police Control Room', contact: '+91-XXXX-XXXX-1003', response: '3 min' }
            ].map((contact, idx) => (
              <div key={idx} className="bg-white/60 dark:bg-card/60 rounded-xl p-4 border border-white/80 dark:border-white/10">
                <p className="text-sm font-semibold text-foreground">{contact.role}</p>
                <p className="text-lg font-mono text-primary font-bold mt-2">{contact.contact}</p>
                <p className="text-xs text-foreground/60 mt-2">Avg response: {contact.response}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Active Alerts */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Active Alerts Log</h2>
          
          {alerts.map((alert) => (
            <Card 
              key={alert.id}
              onClick={() => setSelectedAlert(selectedAlert === alert.id ? null : alert.id)}
              className={`bg-white/50 dark:bg-card/50 backdrop-blur-sm border border-white/60 dark:border-white/10 rounded-2xl p-6 cursor-pointer transition-all hover:bg-white/70 ${
                alert.status === 'Active' ? 'border-l-4' : 'border-l-4'
              } ${
                alert.severity === 'Critical' ? 'border-l-red-500' :
                alert.severity === 'Warning' ? 'border-l-orange-500' :
                'border-l-emerald-500'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className={`p-2 rounded-lg ${getSeverityColor(alert.severity)}`}>
                    {getSeverityIcon(alert.severity)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-foreground">{alert.temple}</h3>
                      <span className={`text-xs font-bold px-3 py-1 rounded-full border ${getSeverityColor(alert.severity)}`}>
                        {alert.severity}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/70 font-medium">{alert.type}</p>
                    <p className="text-sm text-foreground/60 mt-1">{alert.message}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 text-xs text-foreground/50 mb-2">
                    <Clock className="w-3 h-3" />
                    {alert.timestamp}
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                    alert.status === 'Active' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                  }`}>
                    {alert.status}
                  </span>
                </div>
              </div>

              {selectedAlert === alert.id && (
                <div className="mt-6 pt-6 border-t border-border space-y-4 animate-in fade-in duration-300">
                  <div>
                    <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">Escalation Level</p>
                    <p className="text-lg font-bold text-foreground">{alert.escalation}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">Response Status</p>
                    <p className="text-sm text-foreground/70">{alert.response}</p>
                  </div>
                  <div className="flex gap-3">
                    <Button size="sm" className="bg-primary hover:bg-primary/90 text-white">
                      Acknowledge
                    </Button>
                    <Button size="sm" variant="outline">
                      View Details
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>

        {/* Notification Logs */}
        <Card className="bg-white/50 dark:bg-card/50 backdrop-blur-sm border border-white/60 dark:border-white/10 rounded-2xl p-6 mt-8">
          <h2 className="text-lg font-semibold text-foreground mb-6">Automated Notification Log</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {[
              { time: '14:35:22', event: 'SMS sent to Temple Management - Critical alert escalated', status: 'Sent' },
              { time: '14:34:10', event: 'Email notification to authorities - Crowd surge warning', status: 'Sent' },
              { time: '14:32:45', event: 'In-app alert triggered - Medical team mobilization', status: 'Delivered' },
              { time: '14:31:30', event: 'System alert generated - Capacity threshold reached', status: 'Logged' },
              { time: '14:30:15', event: 'Prediction update - Risk index recalculated', status: 'Processed' },
            ].map((log, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gradient-to-r from-white/20 dark:from-white/5 to-white/10 dark:to-white/5 rounded-lg border border-white/40 dark:border-white/10 text-sm">
                <div>
                  <span className="text-foreground/60 font-mono text-xs">{log.time}</span>
                  <p className="text-foreground mt-1">{log.event}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded ${
                  log.status === 'Sent' || log.status === 'Delivered' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' :
                  log.status === 'Processed' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' :
                  'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}>
                  {log.status}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Navigation */}
        <div className="grid md:grid-cols-3 gap-4 mt-8">
          <Button asChild className="bg-primary hover:bg-primary/90 h-12 rounded-xl font-semibold">
            <Link href="/dashboard">Back to Dashboard →</Link>
          </Button>
          <Button asChild className="bg-secondary hover:bg-secondary/90 h-12 rounded-xl font-semibold text-white dark:text-secondary-foreground">
            <Link href="/temple-insights">Temple Insights →</Link>
          </Button>
          <Button asChild variant="outline" className="h-12 rounded-xl font-semibold">
            <Link href="/accessibility">Safety & Accessibility →</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
