'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users, Accessibility, Languages, Phone, Heart, MapPin } from 'lucide-react';

const services = [
  {
    icon: Users,
    title: 'Elderly Priority Lanes',
    description: 'Dedicated pathways with reduced congestion for senior citizens',
    details: ['Separate entrance', 'Shaded waiting areas', 'Priority seating', 'Rest stations every 50m'],
    availability: 'Available Daily'
  },
  {
    icon: Accessibility,
    title: 'Differently-Abled Assistance',
    description: 'Comprehensive support for visitors with mobility challenges',
    details: ['12 wheelchair ramps', 'Accessible restrooms', 'Trained staff support', 'Priority lane access'],
    availability: '24/7 Support'
  },
  {
    icon: Languages,
    title: 'Multilingual Support',
    description: 'Communication assistance in multiple Indian and international languages',
    details: ['Hindi, English, Gujarati', 'Regional dialects', 'Translator services', 'Written guidance'],
    availability: 'Peak Hours +2'
  },
  {
    icon: Heart,
    title: 'Medical & Emergency',
    description: 'On-site medical facilities and emergency response teams',
    details: ['First aid stations', 'Emergency ambulances', 'Medical staff 24/7', 'Defibrillators'],
    availability: '24/7 Coverage'
  },
];

const emergencyContacts = [
  { name: 'Emergency Hotline', number: '+91-XXXX-XXXX-0911', responseTime: '2 minutes' },
  { name: 'Medical Station', number: '+91-XXXX-XXXX-0101', responseTime: '1 minute' },
  { name: 'Temple Administration', number: '+91-XXXX-XXXX-0001', responseTime: '5 minutes' },
  { name: 'Police Support', number: '+91-XXXX-XXXX-0100', responseTime: '3 minutes' },
];

const guidelines = [
  {
    category: 'For Elderly Visitors',
    tips: [
      'Use designated elderly lanes for shorter wait times',
      'Take advantage of rest areas with shaded seating',
      'Ask staff for walking assistance if needed',
      'Carry medications and water with you'
    ]
  },
  {
    category: 'For Differently-Abled Visitors',
    tips: [
      'Use wheelchair ramps at all entrances',
      'Request staff assistance at any time',
      'Accessible restrooms available throughout',
      'Reserved parking close to entrances'
    ]
  },
  {
    category: 'For Families with Children',
    tips: [
      'Child care areas with supervision available',
      'Lower water fountains and facilities',
      'Medical assistance readily available',
      'Designated family waiting areas'
    ]
  },
  {
    category: 'General Safety Tips',
    tips: [
      'Stay hydrated and avoid peak hours if possible',
      'Keep valuables secure',
      'Follow crowd management staff instructions',
      'Inform staff if you feel unwell'
    ]
  },
];

export default function AccessibilityPage() {
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
            <h1 className="text-2xl font-bold text-foreground">Accessibility & Safety</h1>
            <p className="text-sm text-foreground/60">Comprehensive support for all visitors</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Message */}
        <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 rounded-2xl p-8 mb-12">
          <h2 className="text-2xl font-bold text-foreground mb-4">Ensuring Safety & Dignity for All</h2>
          <p className="text-foreground/70 leading-relaxed max-w-3xl">
            At PilgrimSafe AI, we believe pilgrimage should be accessible and safe for everyone. Our comprehensive accessibility program ensures that elderly devotees, differently-abled visitors, and families receive the support they need for a meaningful spiritual experience.
          </p>
        </Card>

        {/* Services Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {services.map((service, idx) => (
            <Card key={idx} className="bg-white/50 dark:bg-card/50 backdrop-blur-sm border border-white/60 dark:border-white/10 rounded-2xl p-6 hover:shadow-lg transition-all">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <service.icon className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">{service.title}</h3>
                  <p className="text-sm text-foreground/60 mt-1">{service.description}</p>
                </div>
              </div>
              <div className="space-y-2 mb-4">
                {service.details.map((detail, didx) => (
                  <div key={didx} className="flex items-center gap-2 text-sm text-foreground/70">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                    {detail}
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t border-border">
                <span className="text-xs font-bold text-primary uppercase tracking-wide">{service.availability}</span>
              </div>
            </Card>
          ))}
        </div>

        {/* Emergency Contacts */}
        <Card className="bg-gradient-to-r from-red-50/50 to-orange-50/50 border border-red-200/50 rounded-2xl p-8 mb-12">
          <h2 className="text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
            <Phone className="w-6 h-6 text-red-600 dark:text-red-400" />
            Emergency Contacts & Support
          </h2>
          <p className="text-foreground/70 mb-6">Available 24/7 for immediate assistance</p>
          
          <div className="grid sm:grid-cols-2 gap-4">
            {emergencyContacts.map((contact, idx) => (
              <div key={idx} className="bg-white/60 dark:bg-card/60 rounded-xl p-4 border border-white/80 dark:border-white/10 backdrop-blur-sm">
                <p className="text-sm font-semibold text-foreground">{contact.name}</p>
                <p className="text-xl font-mono text-red-600 dark:text-red-400 font-bold mt-2">{contact.number}</p>
                <p className="text-xs text-foreground/60 mt-2">Response time: {contact.responseTime}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Guidelines */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-foreground mb-6">Visitor Guidelines</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {guidelines.map((guide, idx) => (
              <Card key={idx} className="bg-white/50 dark:bg-card/50 backdrop-blur-sm border border-white/60 dark:border-white/10 rounded-2xl p-6">
                <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  {guide.category}
                </h3>
                <ul className="space-y-3">
                  {guide.tips.map((tip, tidx) => (
                    <li key={tidx} className="flex gap-3 text-sm text-foreground/70">
                      <span className="text-primary font-bold mt-0.5">✓</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </div>

        {/* Facility Features */}
        <Card className="bg-white/50 dark:bg-card/50 backdrop-blur-sm border border-white/60 dark:border-white/10 rounded-2xl p-8 mb-12">
          <h2 className="text-2xl font-bold text-foreground mb-8">Facility Features & Infrastructure</h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: 'Ramps & Elevators',
                items: ['12 wheelchair ramps', '3 elevators', 'Zero-step entries', 'Handrails throughout']
              },
              {
                title: 'Restrooms & Water',
                items: ['Accessible toilets', 'Gender-specific facilities', 'Drinking water stations', 'Hand sanitizers']
              },
              {
                title: 'Rest & Comfort',
                items: ['200+ seating areas', 'Covered waiting zones', 'Air-conditioned shelters', 'Lost & found']
              },
              {
                title: 'Medical & First Aid',
                items: ['3 medical stations', '24/7 doctors', 'Ambulance service', 'Emergency kit access']
              },
              {
                title: 'Information & Wayfinding',
                items: ['Multi-language signs', 'Audio guidance', 'Staff assistance', 'Maps available']
              },
              {
                title: 'Safety & Security',
                items: ['CCTV coverage', 'Security personnel', 'Lost child assistance', '24/7 patrol']
              },
            ].map((facility, idx) => (
              <div key={idx} className="bg-gradient-to-br from-blue-50 to-emerald-50 rounded-xl p-4 border border-blue-100 dark:border-blue-900">
                <p className="font-semibold text-foreground mb-3">{facility.title}</p>
                <ul className="space-y-2">
                  {facility.items.map((item, iidx) => (
                    <li key={iidx} className="text-sm text-foreground/70 flex items-center gap-2">
                      <span className="text-emerald-500 font-bold">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>

        {/* Accessibility Standards */}
        <Card className="bg-gradient-to-br from-secondary/5 to-emerald-50/30 border border-secondary/20 rounded-2xl p-8 mb-12">
          <h2 className="text-2xl font-bold text-foreground mb-6">Accessibility Certifications & Standards</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { standard: 'WCAG 2.1', level: 'AA Compliant', description: 'Web accessibility standards' },
              { standard: 'UDHR Article 25', level: 'Compliant', description: 'Universal human rights' },
              { standard: 'India Accessibility Code', level: 'Certified', description: 'National standards' },
            ].map((cert, idx) => (
              <div key={idx} className="bg-white/60 dark:bg-card/60 rounded-xl p-4 border border-white/80 dark:border-white/10 text-center">
                <p className="font-bold text-primary text-sm">{cert.standard}</p>
                <p className="font-semibold text-foreground mt-2">{cert.level}</p>
                <p className="text-xs text-foreground/60 mt-1">{cert.description}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Feedback & Support */}
        <Card className="bg-gradient-to-r from-emerald-50 dark:from-emerald-950/30 to-blue-50 dark:to-blue-950/30 border border-emerald-200/50 rounded-2xl p-8 mb-12">
          <h2 className="text-2xl font-bold text-foreground mb-4">Your Feedback Matters</h2>
          <p className="text-foreground/70 mb-6">
            We continuously improve our accessibility features based on visitor feedback. If you have any suggestions or accessibility concerns during your visit, please don't hesitate to reach out to our support team.
          </p>
          <Button className="bg-primary hover:bg-primary/90 h-12 rounded-xl font-semibold">
            Share Feedback
          </Button>
        </Card>

        {/* Navigation */}
        <div className="grid md:grid-cols-3 gap-4">
          <Button asChild className="bg-primary hover:bg-primary/90 h-12 rounded-xl font-semibold">
            <Link href="/dashboard">Back to Dashboard →</Link>
          </Button>
          <Button asChild className="bg-secondary hover:bg-secondary/90 h-12 rounded-xl font-semibold text-white dark:text-secondary-foreground">
            <Link href="/temple-insights">Temple Insights →</Link>
          </Button>
          <Button asChild variant="outline" className="h-12 rounded-xl font-semibold">
            <Link href="/about">About & Research →</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
