export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';

// live = real models | demo-fallback = server-side backup | demo = /demo prefix | static = built-in sample data
export type ApiSource = 'live' | 'demo' | 'demo-fallback' | 'static';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY;

async function request(url: string, init: RequestInit, timeoutMs: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const headers = new Headers(init.headers);
  if (ADMIN_KEY) headers.set('X-API-Key', ADMIN_KEY); // only needed when the server sets ADMIN_API_KEY
  try {
    return await fetch(url, { ...init, headers, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function call<T>(prefix: string, path: string, init: RequestInit, timeoutMs: number) {
  const res = await request(`${API_BASE}${prefix}${path}`, init, timeoutMs);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()).detail;
      if (Array.isArray(body)) {
        detail = body.map((e: { loc?: unknown[]; msg?: string }) => `${(e.loc ?? []).slice(1).join('.')}: ${(e.msg ?? '').replace('Value error, ', '')}`).join('; ');
      } else if (body) {
        detail = String(body);
      }
    } catch {}
    throw new ApiError(res.status, detail);
  }
  const header = res.headers.get('X-Data-Source');
  const source = (prefix ? 'demo' : header ?? 'live') as ApiSource;
  const data = res.status === 204 ? (null as T) : ((await res.json()) as T);
  return { data, source };
}

/** Calls the live API; if it is unreachable or fails server-side, reroutes to the same path under /demo. */
export async function apiFetch<T>(path: string, init: RequestInit = {}, timeoutMs = 6000) {
  try {
    return await call<T>('', path, init, timeoutMs);
  } catch (err) {
    if (err instanceof ApiError && err.status >= 400 && err.status < 500) throw err; // bad input: do not reroute
    return await call<T>('/demo', path, init, timeoutMs);
  }
}
