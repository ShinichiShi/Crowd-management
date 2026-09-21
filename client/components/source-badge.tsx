import type { ApiSource } from '@/lib/api';

const STYLE: Record<ApiSource, { dot: string; text: string; label: string }> = {
  live: { dot: 'bg-green-500 animate-pulse', text: 'text-green-600 dark:text-green-400', label: 'Live' },
  demo: { dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', label: 'Demo backup' },
  'demo-fallback': { dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', label: 'Demo backup (models offline)' },
  static: { dot: 'bg-gray-400', text: 'text-gray-500', label: 'Offline sample data' },
};

export function SourceBadge({ source }: { source: ApiSource }) {
  const s = STYLE[source];
  return (
    <div className="flex items-center gap-3" title={`data source: ${source}`}>
      <div className={`w-3 h-3 rounded-full ${s.dot}`}></div>
      <span className={`text-sm font-medium ${s.text}`}>{s.label}</span>
    </div>
  );
}
