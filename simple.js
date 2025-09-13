const express = require('express');
const cors = require('cors');
require('dotenv').config();

const PORT = process.env.PORT || 3000;
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Simple test route
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head><title>Duplicates Detector</title></head>
      <body>
        <h1>🔍 Shopify Duplicates Detector</h1>
        <p>App is running successfully!</p>
        <p>API Health: <a href="/api/health">/api/health</a></p>
        <p>Settings: <a href="/api/settings">/api/settings</a></p>
      </body>
    </html>
  `);
});

// Auth callback
app.get('/auth/callback', (req, res) => {
  res.send('Auth callback received!');
});

// API Routes
app.use('/api', require('./routes/api'));

// Start server (only if not in Vercel)
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`🚀 Simple Duplicates Detector running on port ${PORT}`);
  });
}

module.exports = app;