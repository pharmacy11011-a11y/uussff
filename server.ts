import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';
import { google } from 'googleapis';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  // Google OAuth Callback
  app.post('/api/google/token', async (req, res) => {
    const { code, redirectUri } = req.body;
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

    if (!clientId || !clientSecret) {
      console.error('Google OAuth Error: Missing credentials in environment variables');
      return res.status(500).json({ error: 'Google Client ID or Secret not configured in server environment' });
    }

    console.log('Attempting token exchange with Client ID:', clientId.substring(0, 10) + '...');
    console.log('Client Secret Length:', clientSecret.length);

    try {
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
      const { tokens } = await oauth2Client.getToken(code);
      res.json(tokens);
    } catch (error: any) {
      const googleError = error.response?.data || {};
      console.error('Google Token Exchange Error:', {
        status: error.response?.status,
        data: googleError,
        message: error.message
      });
      
      const errorMessage = googleError.error_description || googleError.error || error.message || 'Failed to exchange Google token';
      res.status(500).json({ 
        error: errorMessage,
        details: googleError
      });
    }
  });

  // Google Token Refresh
  app.post('/api/google/refresh', async (req, res) => {
    const { refreshToken } = req.body;
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: 'Google Client ID or Secret not configured' });
    }

    try {
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
      oauth2Client.setCredentials({ refresh_token: refreshToken });
      const { credentials } = await oauth2Client.refreshAccessToken();
      res.json(credentials);
    } catch (error: any) {
      const googleError = error.response?.data || {};
      console.error('Google Token Refresh Error:', {
        status: error.response?.status,
        data: googleError,
        message: error.message
      });
      
      const errorMessage = googleError.error_description || googleError.error || error.message || 'Failed to refresh Google token';
      res.status(500).json({ 
        error: errorMessage,
        details: googleError
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
