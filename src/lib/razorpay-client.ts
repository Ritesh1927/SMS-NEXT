// Client-side loader for Razorpay's hosted Checkout script. Injected lazily
// (only when a payment is actually attempted) rather than on every page.
let loadPromise: Promise<void> | null = null;

export function loadRazorpayScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Not in browser."));
  if ((window as unknown as { Razorpay?: unknown }).Razorpay) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Failed to load Razorpay checkout."));
    };
    document.body.appendChild(script);
  });
  return loadPromise;
}

export interface RazorpayOrderResponse {
  success: boolean;
  data: { orderId: string; amount: number; currency: string; keyId: string };
}

export interface RazorpayCheckoutResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open: () => void;
  on: (event: "payment.failed", handler: (response: { error?: { description?: string } }) => void) => void;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  handler: (response: RazorpayCheckoutResult) => void;
  prefill?: { name?: string; email?: string };
  theme?: { color?: string };
}

export function openRazorpayCheckout(options: RazorpayOptions): RazorpayInstance {
  const Ctor = (window as unknown as { Razorpay: new (opts: RazorpayOptions) => RazorpayInstance }).Razorpay;
  return new Ctor(options);
}
