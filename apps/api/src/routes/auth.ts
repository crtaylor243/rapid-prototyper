import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { findUserByEmail } from '../services/userService';
import { config } from '../config';
import { logInfo, logError } from '../logger';

const router = Router();

router.post('/login', async (req, res) => {
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

    res
      .cookie('rp_session', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.env === 'production',
        maxAge: 60 * 60 * 1000
      })
      .json({ message: 'Login successful', email: user.email });
  } catch (error) {
    logError('Login attempt failed', { email, error });
    res.status(500).json({ message: 'Unexpected login error' });
  }
});

export default router;
