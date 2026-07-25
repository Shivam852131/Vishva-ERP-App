import {
  APP_BACKEND_URL,
  APP_RAZORPAY_KEY_ID,
} from '@env';

export const BACKEND_URL = (APP_BACKEND_URL || '').replace(/\/$/, '');
export const BASE_URL = BACKEND_URL;

export const USE_DEMO_API = false;
export const DEMO_FALLBACK = false;

export const RAZORPAY_KEY_ID = APP_RAZORPAY_KEY_ID || 'rzp_test_placeholder';
export const SOCKET_URL = BACKEND_URL;
