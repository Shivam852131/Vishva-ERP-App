import {
  APP_BACKEND_URL,
  APP_DEMO_FALLBACK,
  APP_RAZORPAY_KEY_ID,
  APP_USE_DEMO_API,
} from '@env';

export const BACKEND_URL = (APP_BACKEND_URL || '').replace(/\/$/, '');
export const USE_DEMO_API = !BACKEND_URL || APP_USE_DEMO_API === 'true';
export const DEMO_FALLBACK = APP_DEMO_FALLBACK !== 'false';
export const RAZORPAY_KEY_ID = APP_RAZORPAY_KEY_ID || 'rzp_test_placeholder';
export const SOCKET_URL = BACKEND_URL;
