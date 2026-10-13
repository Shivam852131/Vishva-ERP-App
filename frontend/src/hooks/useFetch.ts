import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';

interface UseFetchResult<T> {
  data: T | undefined;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  setData: (data: T | undefined) => void;
}

export function useFetch<T = any>(
  path: string | null,
  opts: RequestInit = {},
): UseFetchResult<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
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

  const fetchData = useCallback(async () => {
    if (!path) {
      setLoading(false);
      setError(null);
      setData(undefined);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api<T>(path, optsRef.current);
      if (mounted.current) setData(res);
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
    setTrigger(t => t + 1);
  }, []);

  return { data, loading, error, refresh, setData };
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
