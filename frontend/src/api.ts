import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '@/src/config/env';

export { BASE_URL };
const PAYMENT_PATHS = ['/fees/pay', '/payments/verify', '/subscription/create-order'];

type ApiError = Error & { status?: number };

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

const TOKEN_KEY = 'campus_erp_token';
const USER_KEY = 'campus_erp_user';

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}
export async function setAuth(token: string, user: any) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}
export async function getUser(): Promise<any | null> {
  const raw = await AsyncStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    await AsyncStorage.removeItem(USER_KEY);
    return null;
  }
}
export async function clearAuth() {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}

function normalizePath(path: string): string {
  const clean = path.startsWith('/api/') ? path.slice(4) : path;
  return clean.startsWith('/') ? clean : `/${clean}`;
}

async function parseResponse(res: Response) {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function api<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const normalized = normalizePath(path);

  const token = await getToken();
  const headers: any = { ...(opts.headers as any) };
  if (opts.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${BASE_URL}/api${normalized}`, { ...opts, headers, signal: controller.signal });
    clearTimeout(timeoutId);
    const payload = await parseResponse(res);
    if (!res.ok) {
      const detail = payload && typeof payload === 'object' && 'detail' in payload
        ? (payload as { detail?: unknown }).detail
        : undefined;
      const msg = detail
        ? (typeof detail === 'string' ? detail : JSON.stringify(detail))
        : (typeof payload === 'string' ? payload : `HTTP ${res.status}`);
      const httpError: ApiError = new Error(msg);
      httpError.status = res.status;
      throw httpError;
    }
    return payload as T;
  } catch (error) {
    clearTimeout(timeoutId);
    const status = (error as ApiError)?.status;
    if (status === 401) {
      onUnauthorized?.();
    }
    throw error;
  }
}

export function apiUrl(path: string): string {
  const normalized = normalizePath(path);
  return BASE_URL ? `${BASE_URL}/api${normalized}` : `/api${normalized}`;
}
