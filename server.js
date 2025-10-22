import express from "express";
import cors from "cors";
import crypto from "crypto";
import Database from "better-sqlite3";

const PORT = process.env.PORT || 8080;
const BOT_TOKEN = process.env.BOT_TOKEN; // <-- mets le token de @BotFather

if (!BOT_TOKEN) { throw new Error("BOT_TOKEN manquant (env)"); }

const app = express();
app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: "512kb" }));

// DB
const db = new Database("scores.db");
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS scores (
    user_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    best INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  );
`);

// --- Vérif de la signature Telegram WebApp ---
function verifyInitData(initDataRaw, botToken) {
  if (!initDataRaw) return null;
  const url = new URLSearchParams(initDataRaw);
  const hash = url.get("hash");
  url.delete("hash");

  // data_check_string = lignes "key=value" triées par clé et jointes par "\n"
  const dataCheck = [...url.entries()]
    .map(([k,v]) => `${k}=${v}`)
    .sort()
    .join("\n");

  const secretKey = crypto.createHash("sha256")
    .update("WebAppData" + botToken)
    .digest();

  const hmac = crypto.createHmac("sha256", secretKey)
    .update(dataCheck)
    .digest("hex");

  if (hmac !== hash) return null;

  // ok → on peut lire l'objet user
  const unsafe = Object.fromEntries(new URLSearchParams(initDataRaw).entries());
  const userStr = unsafe.user || "{}";
  let user;
  try { user = JSON.parse(userStr); } catch { user = null; }
  return user;
}

// --- POST /api/score  { score, initData } ---
app.post("/api/score", (req, res) => {
  const { score, initData } = req.body || {};
  if (typeof score !== "number" || score < 0) {
    return res.status(400).json({ ok:false, error:"score invalide" });
  }

  const user = verifyInitData(initData, BOT_TOKEN);
  if (!user) return res.status(401).json({ ok:false, error:"initData invalide" });

  const name = (user.username && "@"+user.username) ||
               [user.first_name, user.last_name].filter(Boolean).join(" ") ||
               "Player";
  const now = Date.now();

  const row = db.prepare("SELECT best FROM scores WHERE user_id = ?").get(String(user.id));
  if (!row) {
    db.prepare("INSERT INTO scores (user_id, name, best, updated_at) VALUES (?, ?, ?, ?)")
      .run(String(user.id), name, Math.floor(score), now);
  } else if (score > row.best) {
    db.prepare("UPDATE scores SET best = ?, name = ?, updated_at = ? WHERE user_id = ?")
      .run(Math.floor(score), name, now, String(user.id));
  }
  return res.json({ ok:true });
});

// --- GET /api/leaderboard?limit=10 ---
app.get("/api/leaderboard", (req, res) => {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
  const rows = db.prepare("SELECT user_id, name, best FROM scores ORDER BY best DESC, updated_at ASC LIMIT ?").all(limit);
  res.json({ ok:true, list: rows });
});

// --- GET /api/me?initData=... ---
app.get("/api/me", (req, res) => {
  const user = verifyInitData(req.query.initData, BOT_TOKEN);
  if (!user) return res.status(401).json({ ok:false, error:"initData invalide" });
  const row = db.prepare("SELECT user_id, name, best FROM scores WHERE user_id = ?").get(String(user.id));
  res.json({ ok:true, me: row || null });
});

app.listen(PORT, () => console.log("Leaderboard server on", PORT));
