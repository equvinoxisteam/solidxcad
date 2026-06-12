import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { Job } from '../models/Job.js';
import { grantCredits } from '../services/credits.js';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/stats', async (req, res) => {
  const [users, jobs, proUsers] = await Promise.all([
    User.countDocuments(),
    Job.countDocuments(),
    User.countDocuments({ plan: 'pro' }),
  ]);
  res.json({ users, jobs, proUsers });
});

router.get('/users', async (req, res) => {
  const users = await User.find().select('-passwordHash').sort({ createdAt: -1 }).limit(100);
  res.json({ users });
});

router.post('/users/:id/credits', async (req, res) => {
  const amount = Number(req.body.amount);
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Positive amount required' });

  const balance = await grantCredits(req.params.id, amount, 'admin_grant', { by: req.user.email });
  res.json({ ok: true, balance });
});

export default router;
