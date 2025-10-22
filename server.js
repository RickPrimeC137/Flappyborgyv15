// server.js  —  FlappyBorgy Leaderboard (Express + Telegram WebApp + better-sqlite3)
// Node ESM (package.json => { "type": "module" })

import express from "express";
import cors from "cors";
import crypto from "crypto";
import Database from "better-sqlite3";

/* ---------- Config env ---------- */
const PORT = process.env.PORT || 8080;
const BOT_TOKEN = process.env.BOT_TOKEN;                   // token BotFather (OBLIGATOIRE)
const DB_PATH   = process.env.DB_PATH || "./scores.db";    // disque persistant recommandé sur Render

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN manquant (variable d'environnement).");
}

/* ---------- App & CORS ---------- */
const app = express();

const ALLOWED_ORIGINS = [
  "https://flappyborgyv15.onrender.com",
  "http://localhost:3000",
  "http://localhost:5173"
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);                      // autorise curl/Postman
    cb(null, ALLOWED_ORIGINS.includes(origin));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  credentials: false,
  optionsSuccessStatus: 204
}));
app.options("*", cors());

app.use(express.json({ limit: "512kb" }));

/* ---------- DB ---------- */
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS scores (
    user_id    TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    best       INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  );
`);

/* ---------- Helpers ---------- */
// Vérif officielle Telegram WebApp (HMAC SHA-256)
function verifyInitData(initDataRaw, botToken) {
  if (!initDataRaw) return null;
  const url = new URLSearchParams(initDataRaw);
  const hash = url.get("hash");
  url.delete("hash");

  const dataCheck = [...url.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");

  const secretKey = crypto.createHash("sha256")
    .update("WebAppData" + botToken)
    .digest();

  const hmac = crypto.createHmac("sha256", secretKey)
    .update(dataCheck)
    .digest("hex");

  if (hmac !== hash) return null;

  // user est en JSON dans le champ "user"
  try {
    const obj = Object.fromEntries(new URLSearchParams(initDataRaw).entries());
    return JSON.parse(obj.user || "{}");
  } catch {
    return null;
  }
}

function sanitizeName(s) {
  if (!s) return "Player";
  // retire les contrôles, limite la longueur
  return String(s).replace(/[\u0000-\u001F\u007F]/g, "").slice(0, 32);
}

/* ---------- Routes API ---------- */

// POST /api/score  { score:number, initData:string }
app.post("/api/score", (req, res) => {
  const { score, initData } = req.body || {};
  if (typeof score !== "number" || !Number.isFinite(score) || score < 0) {
    return res.status(400).json({ ok: false, error: "score invalide" });
  }

  const user = verifyInitData(initData, BOT_TOKEN);
  if (!user || !user.id) {
    return res.status(401).json({ ok: false, error: "initData invalide" });
  }

  const name =
    (user.username && "@" + user.username) ||
    sanitizeName([user.first_name, user.last_name].filter(Boolean).join(" ")) ||
    "Player";

  const uid = String(user.id);
  const now = Date.now();
  const val = Math.floor(score);

  const row = db.prepare("SELECT best FROM scores WHERE user_id = ?").get(uid);
  if (!row) {
    db.prepare("INSERT INTO scores (user_id, name, best, updated_at) VALUES (?, ?, ?, ?)")
      .run(uid, name, val, now);
  } else if (val > row.best) {
    db.prepare("UPDATE scores SET best = ?, name = ?, updated_at = ? WHERE user_id = ?")
      .run(val, name, now, uid);
  } else {
    // met tout de même à jour le nom et la date (optionnel)
    db.prepare("UPDATE scores SET name = ?, updated_at = ? WHERE user_id = ?")
      .run(name, now, uid);
  }

  return res.json({ ok: true });
});

// GET /api/leaderboard?limit=10
app.get("/api/leaderboard", (req, res) => {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
  const rows = db.prepare(`
    SELECT user_id, name, best
    FROM scores
    ORDER BY best DESC, updated_at ASC
    LIMIT ?
  `).all(limit);
  res.json({ ok: true, list: rows });
});

// GET /api/me?initData=...
app.get("/api/me", (req, res) => {
  const user = verifyInitData(req.query.initData, BOT_TOKEN);
  if (!user || !user.id) {
    return res.status(401).json({ ok: false, error: "initData invalide" });
  }
  const uid = String(user.id);
  const row = db.prepare("SELECT user_id, name, best FROM scores WHERE user_id = ?").get(uid);
  res.json({ ok: true, me: row || null });
});

// Santé
app.get("/api/health", (_req, res) => res.json({ ok: true }));

/* ---------- Start ---------- */
app.listen(PORT, () => {
  console.log("Leaderboard server running on port", PORT);
  console.log("DB path:", DB_PATH);
});

/* ---------- Shutdown propre ---------- */
process.on("SIGTERM", () => {
  try { db.close(); } catch {}
  process.exit(0);
});
