import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { Payment } from '../models/Payment.js';
import { createProOrder, verifyPaymentSignature, getPublicKey } from '../services/razorpay.js';
import { displayCredits, grantCredits, isUnlimitedCredits } from '../services/credits.js';
import { config } from '../config.js';

const router = Router();

router.get('/config', requireAuth, (req, res) => {
  res.json({
    keyId: getPublicKey(),
    unlimitedCredits: isUnlimitedCredits(),
    plan: {
      name: 'Pro',
      amountUsd: config.razorpay.proAmountUsd,
      credits: isUnlimitedCredits() ? 'unlimited' : config.razorpay.proCredits,
    },
    freeCredits: isUnlimitedCredits() ? 'unlimited' : config.credits.freeSignup,
  });
});

router.post('/create-order', requireAuth, async (req, res) => {
  try {
    const order = await createProOrder(req.user._id);
    await Payment.create({
      userId: req.user._id,
      razorpayOrderId: order.id,
      amount: order.amount / 100,
      currency: order.currency,
      plan: 'pro',
      status: 'created',
      creditsGranted: config.razorpay.proCredits,
    });
    res.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: getPublicKey() });
  } catch (err) {
    console.error('[billing/create-order]', err);
    res.status(500).json({ error: err.message || 'Failed to create order' });
  }
});

router.post('/verify', requireAuth, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing payment fields' });
  }

  const valid = verifyPaymentSignature({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
  });
  if (!valid) return res.status(400).json({ error: 'Invalid payment signature' });

  const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id, userId: req.user._id });
  if (!payment) return res.status(404).json({ error: 'Order not found' });
  if (payment.status === 'paid') return res.json({ ok: true, alreadyProcessed: true });

  payment.status = 'paid';
  payment.razorpayPaymentId = razorpay_payment_id;
  await payment.save();

  await User.findByIdAndUpdate(req.user._id, { plan: 'pro' });
  await grantCredits(req.user._id, payment.creditsGranted, 'pro_plan_purchase', {
    orderId: razorpay_order_id,
  });

  const user = await User.findById(req.user._id);
  res.json({
    ok: true,
    plan: user.plan,
    credits: displayCredits(user.credits),
    unlimitedCredits: isUnlimitedCredits(),
  });
});

export default router;
