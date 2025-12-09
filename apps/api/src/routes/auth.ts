import crypto from 'crypto';
import { Router, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { findUserByEmail, findUserById, updateLastLogin } from '../repositories/userRepository';
import { config } from '../config';
import { logInfo, logError } from '../logger';
import { csrfGuard, readSession } from '../security';

const router = Router();

const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: config.env === 'production',
  maxAge: 60 * 60 * 1000
};

const csrfCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: config.env === 'production',
  maxAge: 60 * 60 * 1000
};

function issueCsrfToken(res: Response) {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie(config.csrfCookieName, token, csrfCookieOptions);
  return token;
}

router.get('/csrf-token', (_req, res) => {
  const csrfToken = issueCsrfToken(res);
  res.json({ csrfToken });
});

router.get('/session', async (req, res) => {
  const session = readSession(req);

  if (!session) {
    return res.json({ user: null });
  }

  try {
    const user = await findUserById(session.sub);
    if (!user) {
      logInfo('Session references unknown user', { userId: session.sub });
      res.clearCookie(config.sessionCookieName, sessionCookieOptions);
      return res.json({ user: null });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        lastLoginAt: user.last_login_at ? user.last_login_at.toISOString() : null
      }
    });
  } catch (error) {
    logError('Failed to load session user', { error });
    res.status(500).json({ message: 'Unable to fetch session' });
  }
});

router.post('/login', csrfGuard, async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const user = await findUserByEmail(email);
    if (!user) {
      logInfo('Login failed for unknown user', { email });
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      logInfo('Login failed for user (bad password)', { email });
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const token = jwt.sign({ sub: user.id, email: user.email }, config.sessionSecret, {
      expiresIn: '1h'
    });

    await updateLastLogin(user.id);
    const freshCsrfToken = issueCsrfToken(res);

    res
      .cookie(config.sessionCookieName, token, sessionCookieOptions)
      .json({ message: 'Login successful', email: user.email, csrfToken: freshCsrfToken });
  } catch (error) {
    logError('Login attempt failed', { email, error });
    res.status(500).json({ message: 'Unexpected login error' });
  }
});

router.post('/logout', csrfGuard, (req, res) => {
  const csrfToken = issueCsrfToken(res);
  res
    .clearCookie(config.sessionCookieName, sessionCookieOptions)
    .json({ message: 'Logged out', csrfToken });
});

export default router;
