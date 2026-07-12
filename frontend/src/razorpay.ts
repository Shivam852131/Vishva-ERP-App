import { Linking, Platform } from 'react-native';
import { RAZORPAY_KEY_ID as ENV_RAZORPAY_KEY_ID } from '@/src/config/env';

export const RAZORPAY_KEY_ID = ENV_RAZORPAY_KEY_ID;

export type RazorpayOrderResponse = {
  id?: string;
  order_id?: string;
  razorpay_order_id?: string;
  amount?: number;
  currency?: string;
  key?: string;
  key_id?: string;
  name?: string;
  description?: string;
  receipt?: string;
  url?: string;
  payment_url?: string;
  short_url?: string;
  demo?: boolean;
};

export type RazorpayPaymentResult = {
  razorpay_payment_id?: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
  openedExternal?: boolean;
  demo?: boolean;
};

type CheckoutInput = {
  order: RazorpayOrderResponse;
  name: string;
  description: string;
  prefill?: { name?: string; email?: string; contact?: string };
  themeColor?: string;
};

type RazorpayCheckoutInstance = {
  open: () => void;
  on: (event: 'payment.failed', cb: (response: any) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayCheckoutInstance;
  }
}

export function getRazorpayOrderId(order?: RazorpayOrderResponse | null) {
  return order?.razorpay_order_id || order?.order_id || order?.id || '';
}

function getPaymentUrl(order: RazorpayOrderResponse) {
  return order.payment_url || order.short_url || order.url || '';
}

function loadRazorpayScript() {
  return new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      reject(new Error('Razorpay web checkout is available only in a browser.'));
      return;
    }

    if (window.Razorpay) {
      resolve();
      return;
    }

    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Unable to load Razorpay checkout.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Unable to load Razorpay checkout.'));
    document.body.appendChild(script);
  });
}

export async function openRazorpayCheckout({
  order,
  name,
  description,
  prefill,
  themeColor = '#059669',
}: CheckoutInput): Promise<RazorpayPaymentResult> {
  if (order.demo) {
    await new Promise(resolve => setTimeout(resolve, 700));
    return {
      razorpay_payment_id: `pay_demo_${Date.now()}`,
      razorpay_order_id: getRazorpayOrderId(order),
      razorpay_signature: 'demo_signature',
      demo: true,
    };
  }

  const orderId = getRazorpayOrderId(order);
  const paymentUrl = getPaymentUrl(order);

  if (Platform.OS !== 'web') {
    if (paymentUrl) {
      await Linking.openURL(paymentUrl);
      return { openedExternal: true, razorpay_order_id: orderId };
    }
    throw new Error('Mobile checkout needs a backend payment link or native Razorpay SDK integration.');
  }

  if (!orderId) {
    if (paymentUrl) {
      await Linking.openURL(paymentUrl);
      return { openedExternal: true };
    }
    throw new Error('Backend did not return a Razorpay order id.');
  }

  await loadRazorpayScript();

  return new Promise((resolve, reject) => {
    if (!window.Razorpay) {
      reject(new Error('Razorpay checkout is not available.'));
      return;
    }

    const checkout = new window.Razorpay({
      key: order.key_id || order.key || RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: order.currency || 'INR',
      name,
      description,
      order_id: orderId,
      prefill,
      theme: { color: themeColor },
      modal: {
        ondismiss: () => reject(new Error('Payment cancelled.')),
      },
      handler: (response: RazorpayPaymentResult) => resolve(response),
    });

    checkout.on('payment.failed', (response: any) => {
      reject(new Error(response?.error?.description || 'Razorpay payment failed.'));
    });

    checkout.open();
  });
}
