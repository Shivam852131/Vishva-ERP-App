import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';

interface UseFetchResult<T> {
  data: T | undefined;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  setData: (data: T | undefined) => void;
}

const CACHE_TTL_MS = 60000; // 1 minute in-memory cache
const memoryCache = new Map<string, { data: any; timestamp: number }>();

export function useFetch<T = any>(
  path: string | null,
  opts: RequestInit = {},
): UseFetchResult<T> {
  const cachedEntry = path ? memoryCache.get(path) : undefined;
  const isFresh = cachedEntry ? (Date.now() - cachedEntry.timestamp < CACHE_TTL_MS) : false;

  const [data, setData] = useState<T | undefined>(cachedEntry?.data);
  const [loading, setLoading] = useState(!isFresh && !cachedEntry?.data);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);
  const mounted = useRef(true);
  const optsRef = useRef(opts);

  useEffect(() => {
    optsRef.current = opts;
  }, [opts]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!path) {
      setLoading(false);
      setError(null);
      setData(undefined);
      return;
    }

    const currentCached = memoryCache.get(path);
    if (!forceRefresh && currentCached && (Date.now() - currentCached.timestamp < CACHE_TTL_MS)) {
      setData(currentCached.data);
      setLoading(false);
      return;
    }

    if (!currentCached?.data) {
      setLoading(true);
    }
    setError(null);

    try {
      const res = await api<T>(path, optsRef.current);
      if (mounted.current) {
        memoryCache.set(path, { data: res, timestamp: Date.now() });
        setData(res);
      }
    } catch (e: any) {
      if (mounted.current) setError(e?.message || 'Something went wrong');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [path, trigger]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refresh = useCallback(() => {
    if (path) memoryCache.delete(path);
    setTrigger(t => t + 1);
  }, [path]);

  const updateData = useCallback((newData: T | undefined) => {
    if (path && newData !== undefined) {
      memoryCache.set(path, { data: newData, timestamp: Date.now() });
    }
    setData(newData);
  }, [path]);

  return { data, loading, error, refresh, setData: updateData };
}

export function clearFetchCache() {
  memoryCache.clear();
}

export function useMutate<T = any>(defaultPath?: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async (pathOrBody?: string | any, opts: RequestInit = {}): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      const path = typeof pathOrBody === 'string' ? pathOrBody : defaultPath;
      if (!path) throw new Error('API path is required');

      const requestOpts = typeof pathOrBody === 'string'
        ? opts
        : {
            method: 'POST',
            body: JSON.stringify(pathOrBody ?? {}),
            ...opts,
          };

      const res = await api<T>(path, requestOpts);
      return res;
    } catch (e: any) {
      const msg = e?.message || 'Request failed';
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [defaultPath]);

  return { mutate, loading, error };
}
