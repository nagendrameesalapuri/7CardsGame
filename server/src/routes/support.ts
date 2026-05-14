import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { SupportTicket } from '../models/SupportTicket';

const router = Router();

// POST /api/support — user submits a ticket
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { category, subject, message } = req.body;
    if (!subject?.trim() || !message?.trim()) {
      return res.status(400).json({ error: 'Subject and message are required' });
    }
    const ticket = await SupportTicket.create({
      userId:   req.user!.id,
      username: req.user!.username,
      category: category ?? 'other',
      subject:  subject.trim().slice(0, 120),
      message:  message.trim().slice(0, 2000),
    });
    res.status(201).json({ ticket });
  } catch {
    res.status(500).json({ error: 'Failed to submit ticket' });
  }
});

// GET /api/support/mine — user's own tickets
router.get('/mine', requireAuth, async (req: Request, res: Response) => {
  try {
    const tickets = await SupportTicket.find({ userId: req.user!.id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    res.json({ tickets });
  } catch {
    res.status(500).json({ error: 'Failed to load tickets' });
  }
});

export default router;
