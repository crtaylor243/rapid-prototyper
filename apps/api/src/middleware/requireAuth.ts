import { RequestHandler } from 'express';
import { readSession } from '../security';
import { findUserById } from '../repositories/userRepository';
import { logError, logInfo } from '../logger';

export const requireAuth: RequestHandler = async (req, res, next) => {
  try {
    const session = readSession(req);
    if (!session) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const user = await findUserById(session.sub);
    if (!user) {
      logInfo('Session references unknown user during auth guard', { userId: session.sub });
      return res.status(401).json({ message: 'Authentication required' });
    }

    req.user = user;
    return next();
  } catch (error) {
    logError('Failed to authorize request', { error });
    return res.status(500).json({ message: 'Unable to authorize request' });
  }
};
