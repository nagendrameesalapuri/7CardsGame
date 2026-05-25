import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Admin token required' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { role?: string; userId?: string };

    // Static admin password token (no userId, just role: 'admin')
    if (decoded.role === 'admin' && !decoded.userId) return next();

    // User JWT — accept if the user has isAdmin: true in the DB
    if (decoded.userId) {
      const user = await User.findById(decoded.userId).select('isAdmin').lean();
      if (user?.isAdmin) return next();
    }

    return res.status(403).json({ error: 'Forbidden' });
  } catch {
    res.status(401).json({ error: 'Invalid or expired admin token' });
  }
}
