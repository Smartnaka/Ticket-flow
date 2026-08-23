import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/database';
import { User, UserRole } from '../types';

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured.');
  return secret;
}

export interface AuthTokenPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export class AuthService {
  public static hashPassword(password: string): string {
    return bcrypt.hashSync(password, 10);
  }

  public static comparePassword(password: string, hash: string): boolean {
    return bcrypt.compareSync(password, hash);
  }

  public static generateToken(user: User): string {
    const payload: AuthTokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
    return jwt.sign(payload, jwtSecret(), { expiresIn: '7d' });
  }

  public static verifyToken(token: string): AuthTokenPayload | null {
    try {
      return jwt.verify(token, jwtSecret()) as AuthTokenPayload;
    } catch {
      return null;
    }
  }

  public static getUserFromToken(token: string): User | null {
    const payload = this.verifyToken(token);
    if (!payload) return null;
    const user = db.getUserById(payload.userId);
    if (!user || user.is_suspended) return null;
    return user;
  }
}
