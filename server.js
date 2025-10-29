// server.js — FlappyBorgy Leaderboard (Express + Telegram WebApp + Supabase)
// package.json => { "type": "module" }

import express from "express";
import cors from "cors";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

/* ---------- Env ---------- */
const PORT   = process.env.PORT || 8080;
const BOT_TOKEN = process.env.BOT_TOKEN;                       // BotFather token (OBLIGATOIRE)
const SUPABASE_URL   = process.env.SUPABASE_URL;
const SUPABASE_ROLE  = process.env.SUPABASE_SERVICE_ROLE;

if (!BOT_TOKEN)       throw new Error("BOT_TOKEN manquant");
if (!SUPABASE_URL)    throw new Error("SUPABASE_URL manquant");
if (!SUPABASE_ROLE)   throw new Error("SUPABASE_SERVICE_ROLE manquant");

/* ---------- Supabase (server side) ---------- */
const sb = createClient(SUPABASE_URL, SUPABASE_ROLE, {
  auth: { persistSession: false },
});

/* ---------- App & CORS ---------- */
const app = express();
app.set("trust proxy", 1);

const ALLOWED_ORIGINS = [
  "https://flappyborgyv15-1.onrender.com", // ton site statique
  "https://flappyborgyv15.onrender.com",   // ancien éventuel
  "http://localhost:3000",
  "http://localhost:5173",
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);               // autorise curl/Postman
    cb(null, ALLOWED_ORIGINS.includes(origin));
  },
  methods: ["GET","POST","OPTIONS"],
  allowedHeaders: ["Content-Type"],
  credentials: false,
  optionsSuccessStatus: 204
}));
app.options("*", cors());
app.use(express.json({ limit: "512kb" }));

/* ---------- Helpers ---------- */
// Vérif officielle Telegram WebApp (HMAC SHA-256)
function verifyInitData(initDataRaw, botToken) {
  if (!initDataRaw) return null;

  const params = new URLSearchParams(initDataRaw);
  const hash = params.get("hash");
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");

  // secret_key = HMAC_SHA256(bot_token, key="WebAppData")
  const secretKey = crypto.createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  const hmac = crypto.createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (hmac !== hash) return null;

  try {
    const obj = Object.fromEntries(new URLSearchParams(initDataRaw).entries());
    return JSON.parse(obj.user || "{}");
  } catch {
    return null;
  }
}

function sanitizeName(s) {
  if (!s) return "Player";
  return String(s).replace(/[\u0000-\u001F\u007F]/g, "").slice(0, 32);
}

/* ---------- Routes API ---------- */

// POST /api/score  { score:number, initData:string }
app.post("/api/score", async (req, res) => {
  try {
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
    const val = Math.floor(score);

    // Récupère le best actuel
    const { data: row, error: selErr } = await sb
      .from("scores")
      .select("best")
      .eq("user_id", uid)
      .maybeSingle();

    if (selErr) throw selErr;

    if (!row) {
      // Insert si nouveau
      const { error: insErr } = await sb.from("scores").insert({
        user_id: uid, name, best: val, updated_at: new Date().toISOString()
      });
      if (insErr) throw insErr;
    } else if (val > (row.best ?? 0)) {
      // Met à jour si meilleur
      const { error: upErr } = await sb
        .from("scores")
        .update({ best: val, name, updated_at: new Date().toISOString() })
        .eq("user_id", uid);
      if (upErr) throw upErr;
    } else {
      // Met à jour le nom/date (optionnel)
      const { error: upNameErr } = await sb
        .from("scores")
        .update({ name, updated_at: new Date().toISOString() })
        .eq("user_id", uid);
      if (upNameErr) throw upNameErr;
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error("POST /api/score", e);
    return res.status(500).json({ ok: false, error: "server error" });
  }
});

// GET /api/leaderboard?limit=10
app.get("/api/leaderboard", async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const { data, error } = await sb
      .from("scores")
      .select("user_id,name,best")
      .order("best", { ascending: false })
      .order("updated_at", { ascending: true })
      .limit(limit);

    if (error) throw error;
    return res.json({ ok: true, list: data || [] });
  } catch (e) {
    console.error("GET /api/leaderboard", e);
    return res.status(500).json({ ok: false, list: [] });
  }
});

// GET /api/me?initData=...
app.get("/api/me", async (req, res) => {
  try {
    const user = verifyInitData(req.query.initData, BOT_TOKEN);
    if (!user || !user.id) {
      return res.status(401).json({ ok: false, error: "initData invalide" });
    }
    const uid = String(user.id);
    const { data, error } = await sb
      .from("scores")
      .select("user_id,name,best")
      .eq("user_id", uid)
      .maybeSingle();

    if (error) throw error;
    return res.json({ ok: true, me: data || null });
  } catch (e) {
    console.error("GET /api/me", e);
    return res.status(500).json({ ok: false, me: null });
  }
});

// Santé
app.get("/api/health", (_req, res) => res.json({ ok: true }));

/* ---------- Start ---------- */
app.listen(PORT, () => {
  console.log("Leaderboard server running on port", PORT);
});
