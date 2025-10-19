// server.js
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// Sécurité de base + compression si tu veux (optionnel)
// const compression = require('compression');
// app.use(compression());

// Cache statique raisonnable (images/audio peuvent être long-cache; HTML/JS court)
app.use((req, res, next) => {
  // Types MIME explicites pour certains assets
  if (req.url.endsWith('.ogg')) {
    res.type('audio/ogg');
  } else if (req.url.endsWith('.mp3')) {
    res.type('audio/mpeg');
  } else if (req.url.endsWith('.png')) {
    res.type('image/png');
  }
  // Caching
  if (/\.(png|jpg|jpeg|gif|ogg|mp3|woff2?|ttf|eot)$/i.test(req.url)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (/\.(js|css)$/i.test(req.url)) {
    res.setHeader('Cache-Control', 'public, max-age=3600');
  } else {
    res.setHeader('Cache-Control', 'no-cache');
  }
  next();
});

// Sert /public
app.use(express.static(path.join(__dirname, 'public')));

// Santé simple (Render ping)
app.get('/healthz', (req, res) => res.status(200).send('ok'));

// Racine -> index.html
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Démarrage
app.listen(PORT, () => {
  console.log(`FlappyBorgy server on :${PORT}`);
  console.log('==> Your service is live ✅');
});
