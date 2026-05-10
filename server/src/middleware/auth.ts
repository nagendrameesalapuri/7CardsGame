import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';

// Augment Express namespace so req.user is typed everywhere
declare global {
  namespace Express {
    interface User {
      id: string;
      username: string;
      isGuest: boolean;
    }
  }
}

export type AuthRequest = Request;

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    const user = await User.findById(decoded.userId).select('username isGuest');
    if (!user) return res.status(401).json({ error: 'User not found' });

    req.user = { id: user.id, username: user.username, isGuest: user.isGuest };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    req.user = { id: decoded.userId, username: '', isGuest: false };
  } catch { /* ignore */ }
  next();
}
