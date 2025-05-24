import { Router, Request, Response } from 'express';
import { oauthService } from '../services/oauthService';

const router = Router();

// Google OAuth callback
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;
    
    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state parameter' });
    }
    
    // Handle the OAuth callback
    const result = await oauthService.handleGmailOAuthCallback(code as string, state as string);
    
    // Redirect to a success page
    res.redirect(`/settings?accountAdded=true&email=${encodeURIComponent(result.email || '')}`);
  } catch (error) {
    console.error('Error handling OAuth callback:', error);
    res.redirect('/settings?error=oauth_failed');
  }
});

// Get OAuth URL for Gmail
router.post('/gmail/url', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // In a real app, userId would come from authenticated session
    const userId = 1;
    
    // Generate OAuth URL
    const authUrl = oauthService.getGmailOAuthUrl(userId, email);
    
    res.json({ authUrl });
  } catch (error) {
    console.error('Error generating OAuth URL:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;