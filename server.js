// server.js
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// Cache statique (images très longues, JS/CSS 1h)
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  lastModified: true,
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    // Les PNG et les polices peuvent être mis en cache très longtemps
    if (/\.(png|jpg|jpeg|gif|webp|ogg|mp3|wav)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

// Route / -> index.html (utile quand un index n'est pas servi par défaut)
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint de santé (Render, fly.io, etc.)
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

// Démarrage
app.listen(PORT, () => {
  console.log(`FlappyBorgy server on :${PORT}\n==> http://localhost:${PORT}`);
});
