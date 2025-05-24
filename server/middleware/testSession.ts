import { Request, Response, NextFunction } from 'express';

/**
 * Temporary middleware to provide a test user session
 * This allows testing of functionality without a full authentication system
 */
export function addTestUser(req: Request, res: Response, next: NextFunction) {
  // Only add test user if no user is already in session
  if (!req.session.user) {
    // Add a test user to the session
    req.session.user = {
      id: 1,
      username: 'testuser',
      email: 'testuser@example.com'
    };
  }
  
  next();
}