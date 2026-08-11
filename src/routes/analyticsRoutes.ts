import { Request, Response, Router } from 'express';
import { db } from '../db/database';
import { AuthService } from '../services/auth';

const router = Router();

// GET /api/analytics/organizer
router.get('/organizer', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

  const user = AuthService.getUserFromToken(authHeader.replace('Bearer ', ''));
  if (!user || (user.role !== 'ORGANIZER' && user.role !== 'ADMIN')) {
    return res.status(403).json({ error: 'Organizer permission required' });
  }

  const organizerProfile = Array.from(db.organizers.values()).find((o) => o.user_id === user.id);
  const organizerId = organizerProfile ? organizerProfile.id : 'org_profile_001';

  const analytics = db.getOrganizerAnalytics(organizerId);
  res.json(analytics);
});

// GET /api/analytics/admin
router.get('/admin', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

  const user = AuthService.getUserFromToken(authHeader.replace('Bearer ', ''));
  if (!user || user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin permission required' });
  }

  const analytics = db.getPlatformAnalytics();
  res.json(analytics);
});

// GET /api/audit-logs
router.get('/audit-logs', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

  const user = AuthService.getUserFromToken(authHeader.replace('Bearer ', ''));
  if (!user || user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin permission required' });
  }

  res.json(db.auditLogs);
});

// GET /api/webhook-logs
router.get('/webhook-logs', (req: Request, res: Response) => {
  res.json(Array.from(db.webhookEvents.values()));
});

// GET /api/sent-emails
router.get('/sent-emails', (req: Request, res: Response) => {
  res.json(db.sentEmails);
});

export default router;
