import { Request, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { config } from './config';
import { logInfo } from './logger';

export interface SessionTokenPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

export function readSession(req: Request): SessionTokenPayload | null {
  const token = req.cookies?.[config.sessionCookieName];
  if (!token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, config.sessionSecret) as SessionTokenPayload;
    return payload;
  } catch (error) {
    logInfo('Invalid session token encountered', {
      path: req.path,
      error: error instanceof Error ? error.message : 'unknown'
    });
    return null;
  }
}

export const csrfGuard: RequestHandler = (req, res, next) => {
  const headerToken = req.get('x-csrf-token');
  const cookieToken = req.cookies?.[config.csrfCookieName];

  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    logInfo('Blocked request with invalid CSRF token', { path: req.path });
    return res.status(403).json({ message: 'Invalid CSRF token' });
  }

  return next();
};
