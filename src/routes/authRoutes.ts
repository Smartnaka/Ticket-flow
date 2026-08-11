import { Request, Response, Router } from 'express';
import { db } from '../db/database';
import { AuthService } from '../services/auth';
import { EmailService } from '../services/email';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  const { email, password, name, phone, role } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  const existingUser = db.getUserByEmail(email);
  if (existingUser) {
    return res.status(409).json({ error: 'A user with this email address already exists.' });
  }

  const userRole = role === 'ORGANIZER' ? 'ORGANIZER' : 'CUSTOMER';
  const passwordHash = AuthService.hashPassword(password);

  const user = db.createUser(
    {
      email,
      name,
      phone: phone || '',
      role: userRole,
    },
    passwordHash,
  );

  const token = AuthService.generateToken(user);

  db.addAuditLog({
    actor_id: user.id,
    actor_role: user.role,
    action: 'USER_REGISTERED',
    entity_type: 'USER',
    entity_id: user.id,
    details_json: JSON.stringify({ email: user.email, role: user.role }),
  });

  await EmailService.sendWelcomeEmail(user.email, { name: user.name, role: user.role });

  res.status(201).json({ token, user });
});

// POST /api/auth/login
router.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = db.getUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const passwordHash = db.userPasswords.get(user.id);
  if (!passwordHash || !AuthService.comparePassword(password, passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  if (user.is_suspended) {
    return res.status(403).json({ error: 'Your account has been suspended. Please contact platform admin.' });
  }

  const token = AuthService.generateToken(user);

  db.addAuditLog({
    actor_id: user.id,
    actor_role: user.role,
    action: 'USER_LOGIN',
    entity_type: 'USER',
    entity_id: user.id,
    details_json: JSON.stringify({ email: user.email }),
  });

  res.json({ token, user });
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  const user = db.getUserByEmail(email);
  if (user) {
    const resetToken = db.createPasswordResetToken(user.id);
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;

    await EmailService.sendPasswordResetEmail(user.email, {
      name: user.name,
      resetUrl,
      token: resetToken,
    });

    db.addAuditLog({
      actor_id: user.id,
      actor_role: user.role,
      action: 'PASSWORD_RESET_REQUESTED',
      entity_type: 'USER',
      entity_id: user.id,
      details_json: JSON.stringify({ email: user.email }),
    });
  }

  // Always return success to prevent email enumeration attacks
  res.json({
    message: 'If an account exists with that email address, password reset instructions have been sent.',
  });
});

// POST /api/auth/reset-password
router.post('/reset-password', (req: Request, res: Response) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'Reset token and new password are required.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  const userId = db.verifyPasswordResetToken(token);
  if (!userId) {
    return res.status(400).json({ error: 'Invalid or expired password reset token.' });
  }

  const newHash = AuthService.hashPassword(password);
  const success = db.resetUserPassword(token, newHash);

  if (!success) {
    return res.status(400).json({ error: 'Failed to reset password.' });
  }

  const user = db.getUserById(userId);
  if (user) {
    db.addAuditLog({
      actor_id: user.id,
      actor_role: user.role,
      action: 'PASSWORD_RESET_SUCCESSFUL',
      entity_type: 'USER',
      entity_id: user.id,
      details_json: JSON.stringify({ email: user.email }),
    });
  }

  res.json({ message: 'Password has been successfully reset. You may now log in.' });
});

// GET /api/auth/me
router.get('/me', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  const user = AuthService.getUserFromToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }

  let organizerProfile = undefined;
  if (user.role === 'ORGANIZER') {
    for (const org of db.organizers.values()) {
      if (org.user_id === user.id) {
        organizerProfile = org;
        break;
      }
    }
  }

  res.json({ user, organizerProfile });
});

export default router;
