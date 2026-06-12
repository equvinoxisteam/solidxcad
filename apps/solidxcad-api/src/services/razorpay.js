import Razorpay from 'razorpay';
import crypto from 'crypto';
import { config } from '../config.js';

let instance = null;

function getRazorpay() {
  if (!config.razorpay.keyId || !config.razorpay.keySecret) {
    throw new Error('Razorpay is not configured');
  }
  if (!instance) {
    instance = new Razorpay({
      key_id: config.razorpay.keyId,
      key_secret: config.razorpay.keySecret,
    });
  }
  return instance;
}

export async function createProOrder(userId, amountUsd = config.razorpay.proAmountUsd) {
  const razorpay = getRazorpay();
  const amountCents = Math.round(amountUsd * 100);

  const order = await razorpay.orders.create({
    amount: amountCents,
    currency: 'USD',
    receipt: `pro_${userId}_${Date.now()}`,
    notes: { userId: userId.toString(), plan: 'pro' },
  });

  return order;
}

export function verifyPaymentSignature({ orderId, paymentId, signature }) {
  const body = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac('sha256', config.razorpay.keySecret)
    .update(body)
    .digest('hex');
  return expected === signature;
}

export function getPublicKey() {
  return config.razorpay.keyId;
}
