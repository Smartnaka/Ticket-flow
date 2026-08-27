import { Request, Response, Router } from 'express';
import { db } from '../db/database';
import { AuthService } from '../services/auth';
import { TicketService } from '../services/ticket';

const router = Router();

// GET /api/my-tickets
router.get('/my-tickets', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  const user = AuthService.getUserFromToken(authHeader.replace('Bearer ', ''));
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const customerId = user.id;
  const customerEmail = user.email;

  const allTickets = Array.from(db.tickets.values());
  const userTickets = allTickets.filter((t) => (customerId && t.customer_id === customerId) || (customerEmail && t.customer_email.toLowerCase() === customerEmail.toLowerCase()));

  userTickets.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  res.json(userTickets);
});

// GET /api/tickets/:id
router.get('/:id', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const user = authHeader && AuthService.getUserFromToken(authHeader.replace('Bearer ', ''));
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const ticket = db.tickets.get(req.params.id);
  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }
  const organizer = Array.from(db.organizers.values()).find((profile) => profile.user_id === user.id);
  if (user.role !== 'ADMIN' && ticket.customer_id !== user.id && ticket.event_id !== undefined && organizer?.id !== db.getEventById(ticket.event_id)?.organizer_id) return res.status(403).json({ error: 'Permission denied' });
  res.json(ticket);
});

// POST /api/tickets/validate (Organizer scan validation endpoint)
router.post('/validate', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

  const user = AuthService.getUserFromToken(authHeader.replace('Bearer ', ''));
  if (!user || (user.role !== 'ORGANIZER' && user.role !== 'ADMIN')) {
    return res.status(403).json({ error: 'Organizer permission required' });
  }

  const { ticket_data } = req.body;
  if (!ticket_data) {
    return res.status(400).json({ error: 'ticket_data is required' });
  }

  const organizerProfile = Array.from(db.organizers.values()).find((o) => o.user_id === user.id);
  const organizerId = organizerProfile ? organizerProfile.id : user.id;

  const scanResult = await TicketService.validateAndScanTicket(ticket_data, organizerId, user.id);

  if (!scanResult.success) {
    return res.status(400).json(scanResult);
  }

  res.json(scanResult);
});

export default router;
