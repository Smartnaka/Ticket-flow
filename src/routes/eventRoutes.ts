import { Request, Response, Router } from 'express';
import { db } from '../db/database';
import { AuthService } from '../services/auth';
import { Event, TicketType } from '../types';

const router = Router();

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

// GET /api/events (Public list with filtering & search)
router.get('/', (req: Request, res: Response) => {
  const { category, search, published } = req.query;
  const isPublishedOnly = published !== 'false';

  const eventsList = db.getAllEvents({
    publishedOnly: isPublishedOnly,
    category: category as string,
    search: search as string,
  });

  // Attach ticket types to each event
  const enriched = eventsList.map((e) => {
    const ttypes = Array.from(db.ticketTypes.values()).filter((tt) => tt.event_id === e.id);
    return { ...e, ticket_types: ttypes };
  });

  res.json(enriched);
});

// GET /api/events/:slug
router.get('/:slug', (req: Request, res: Response) => {
  const { slug } = req.params;
  let event = db.getEventBySlug(slug);
  if (!event) {
    event = db.getEventById(slug);
  }

  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  const ttypes = Array.from(db.ticketTypes.values()).filter((tt) => tt.event_id === event!.id && tt.is_active);

  const organizerProfile = Array.from(db.organizers.values()).find((o) => o.id === event!.organizer_id);

  res.json({
    ...event,
    ticket_types: ttypes,
    organizer: organizerProfile,
  });
});

// POST /api/events (Organizer creates event)
router.post('/', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  const user = AuthService.getUserFromToken(authHeader.replace('Bearer ', ''));
  if (!user || (user.role !== 'ORGANIZER' && user.role !== 'ADMIN')) {
    return res.status(403).json({ error: 'Organizer permission required' });
  }

  const {
    title,
    description,
    cover_image,
    location,
    venue,
    city,
    country,
    category,
    start_date,
    end_date,
    max_capacity,
    ticket_types,
  } = req.body;

  if (!title || !description || !venue || !location || !city || !country || !category || !start_date || !end_date || !Array.isArray(ticket_types) || !ticket_types.length) {
    return res.status(400).json({ error: 'title, description, location, venue, city, country, category, dates, and at least one ticket type are required' });
  }
  if (Number.isNaN(Date.parse(start_date)) || Number.isNaN(Date.parse(end_date)) || new Date(end_date) <= new Date(start_date)) return res.status(400).json({ error: 'Event dates must be valid and end_date must be after start_date' });
  if (ticket_types.some((tt: any) => !tt?.name || !Number.isFinite(Number(tt.price)) || Number(tt.price) < 0 || !Number.isInteger(Number(tt.quantity)) || Number(tt.quantity) < 1)) {
    return res.status(400).json({ error: 'Each ticket type requires a name, non-negative price, and positive integer quantity' });
  }

  let organizerProfile = Array.from(db.organizers.values()).find((o) => o.user_id === user.id);
  if (!organizerProfile) {
    organizerProfile = {
      id: `org_${user.id}`,
      user_id: user.id,
      organization_name: `${user.name} Events`,
      is_verified: true,
      created_at: new Date().toISOString(),
    };
    db.organizers.set(organizerProfile.id, organizerProfile);
  }

  let baseSlug = slugify(title);
  let slug = baseSlug;
  let counter = 1;
  while (db.getEventBySlug(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const newEvent: Event = {
    id: eventId,
    organizer_id: organizerProfile.id,
    organizer_name: organizerProfile.organization_name,
    title,
    slug,
    description,
    cover_image: cover_image || '',
    location, venue, city, country, category,
    start_date,
    end_date,
    status: 'PUBLISHED',
    is_published: true,
    ticket_sales_start: now,
    ticket_sales_end: start_date,
    max_capacity: max_capacity || 500,
    created_at: now,
    updated_at: now,
  };

  db.events.set(newEvent.id, newEvent);

  // Process ticket types
  const createdTicketTypes: TicketType[] = [];
  if (Array.isArray(ticket_types) && ticket_types.length > 0) {
    for (const tt of ticket_types) {
      const priceNaira = Number(tt.price);
      const priceKobo = Math.round(priceNaira * 100);

      const newTt: TicketType = {
        id: `tt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        event_id: eventId,
        name: tt.name || 'General Admission',
        description: tt.description || '',
        price_kobo: priceKobo,
        currency: 'NGN',
        quantity_available: Number(tt.quantity) || 100,
        quantity_reserved: 0,
        quantity_sold: 0,
        sales_start: now,
        sales_end: start_date,
        max_per_customer: Number(tt.max_per_customer) || 5,
        is_active: true,
        created_at: now,
        updated_at: now,
      };

      db.ticketTypes.set(newTt.id, newTt);
      createdTicketTypes.push(newTt);
    }
  }

  db.addAuditLog({
    actor_id: user.id,
    actor_role: user.role,
    action: 'EVENT_CREATED',
    entity_type: 'EVENT',
    entity_id: newEvent.id,
    details_json: JSON.stringify({ title: newEvent.title, slug: newEvent.slug }),
  });

  res.status(201).json({ ...newEvent, ticket_types: createdTicketTypes });
});

// PATCH /api/events/:id (Update Event)
router.patch('/:id', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  const user = AuthService.getUserFromToken(authHeader.replace('Bearer ', ''));
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const event = db.getEventById(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  const organizer = Array.from(db.organizers.values()).find((profile) => profile.user_id === user.id);
  if (user.role !== 'ADMIN' && event.organizer_id !== organizer?.id) return res.status(403).json({ error: 'You do not own this event' });

  const allowedFields = ['title', 'description', 'cover_image', 'location', 'venue', 'city', 'country', 'category', 'start_date', 'end_date', 'status', 'is_published', 'ticket_sales_start', 'ticket_sales_end', 'max_capacity'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowedFields.includes(key)));
  Object.assign(event, updates, { updated_at: new Date().toISOString() });
  db.events.set(event.id, event);

  db.addAuditLog({
    actor_id: user.id,
    actor_role: user.role,
    action: 'EVENT_UPDATED',
    entity_type: 'EVENT',
    entity_id: event.id,
    details_json: JSON.stringify(updates),
  });

  res.json(event);
});

export default router;
