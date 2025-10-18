// Minimal Express server for Render (or any Node host)
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// 1) JSON (optionnel, ici pas utilisé)
app.use(express.json());

// 2) Servir le dossier public **sans** livrer automatiquement index.html
app.use(express.static(path.join(__dirname, 'public'), {
  index: false,
  extensions: false,
  maxAge: '1d'
}));

// 3) Route explicite pour "/" => public/index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 4) Healthcheck simple (facultatif)
app.get('/healthz', (req, res) => res.status(200).send('OK'));

// 5) Démarrage
app.listen(PORT, () => {
  console.log(`FlappyBorgy server on : ${PORT}`);
  console.log(`=> Your service is live 🚀`);
});
