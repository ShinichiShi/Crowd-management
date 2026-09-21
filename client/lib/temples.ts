export type Level = 'Safe' | 'Warning' | 'Critical' | 'No data';
export type SourceType = 'snapshot' | 'mjpeg' | 'stream' | 'push' | 'file' | 'demo';

export interface Latest {
  ts: string;
  count: number;
  level: Level;
  source: string;
  people_per_m2?: number | null;
}

export interface Camera {
  id: number;
  temple_id: number;
  name: string;
  source_type: SourceType;
  url: string | null;
  area_m2: number | null;
  zone_capacity: number | null;
  interval_seconds: number;
  enabled: boolean;
  last_polled_at: string | null;
  last_status: string | null;
  last_error: string | null;
  latest: Latest | null;
  online: boolean;
  has_frame: boolean;
}

export interface Temple {
  id: number;
  name: string;
  deity: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  capacity: number;
  area_m2: number | null;
  warn: number;
  crit: number;
  opening_time: string | null;
  closing_time: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  notes: string | null;
  current_count: number | null;
  occupancy_pct: number | null;
  level: Level;
  cameras_total: number;
  cameras_online: number;
  last_update: string | null;
  color?: string;
  cameras?: Camera[];
}

export const LEVEL_CHIP: Record<string, string> = {
  Safe: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800',
  Warning: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800',
  Critical: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800',
  'No data': 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
};

export const LEVEL_BAR: Record<string, string> = {
  Safe: 'bg-green-500',
  Warning: 'bg-amber-500',
  Critical: 'bg-red-500',
  'No data': 'bg-gray-400',
};

export const SOURCE_INFO: Record<SourceType, { label: string; help: string; placeholder: string }> = {
  snapshot: {
    label: 'HTTP snapshot (pull)',
    help: 'The server fetches one JPEG from this URL every interval. Works with most IP cameras (e.g. http://192.168.1.20/snapshot.jpg).',
    placeholder: 'http://192.168.1.20/snapshot.jpg',
  },
  mjpeg: {
    label: 'MJPEG stream (pull)',
    help: 'The server opens the motion-JPEG stream, takes one frame and closes it.',
    placeholder: 'http://192.168.1.20:8080/video',
  },
  stream: {
    label: 'RTSP / RTMP / HLS / webcam (pull, needs OpenCV)',
    help: 'Any stream OpenCV can open. Credentials in the URL are stored server-side and never shown again. A number such as 0 uses a webcam attached to the server.',
    placeholder: 'rtsp://user:pass@192.168.1.20:554/stream1',
  },
  push: {
    label: 'Push (camera / edge device sends frames)',
    help: 'No URL. After saving you get a private ingest URL; your camera, an ffmpeg loop or an edge script POSTs frames to it.',
    placeholder: '',
  },
  demo: {
    label: 'Demo feed (replays ShanghaiTech test images)',
    help: 'No hardware needed: the server replays test images through the real CSRNet pipeline on a daily crowd pattern. URL = pattern name (somnath, dwarka, rameswaram, nathdwara or leave empty).',
    placeholder: 'somnath',
  },
  file: {
    label: 'Video / image file on the server (demo)',
    help: 'For demos: a recorded video is replayed as if live. Only works if the server is started with ALLOW_FILE_CAMERAS=1.',
    placeholder: '/data/recordings/gate.mp4',
  },
};

export function timeAgo(iso: string | null): string {
  if (!iso) return 'never';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.round(s)}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}
