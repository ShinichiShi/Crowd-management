'use client';

import { useEffect, useState } from 'react';
import { apiFetch, type ApiSource } from '@/lib/api';

/** GETs `path` (live -> /demo reroute). If both fail, data stays null and the page keeps its built-in sample data. */
export function useApi<T>(path: string) {
  const [state, setState] = useState<{ data: T | null; source: ApiSource; loading: boolean }>({
    data: null,
    source: 'static',
    loading: true,
  });

  useEffect(() => {
    let alive = true;
    apiFetch<T>(path)
      .then((r) => alive && setState({ data: r.data, source: r.source, loading: false }))
      .catch(() => alive && setState({ data: null, source: 'static', loading: false }));
    return () => {
      alive = false;
    };
  }, [path]);

  return state;
}
