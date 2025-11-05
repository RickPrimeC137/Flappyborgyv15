// server.js — FlappyBorgy Leaderboard (Express + Telegram WebApp + Supabase)
// package.json doit contenir: { "type": "module" }

import express from "express";
import cors from "cors";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

/* ---------- ENV ---------- */
const PORT = process.env.PORT || 8080;
const BOT_TOKEN = process.env.BOT_TOKEN;                      // token BotFather (OBLIGATOIRE)
const SUPABASE_URL = process.env.SUPABASE_URL;                // https://xxxx.supabase.co
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE; // clé service_role (secrète)

if (!BOT_TOKEN) throw new Error("BOT_TOKEN manquant");
if (!SUPABASE_URL) throw new Error("SUPABASE_URL manquant");
if (!SUPABASE_SERVICE_ROLE) throw new Error("SUPABASE_SERVICE_ROLE manquant");

/* ---------- Supabase (côté serveur) ---------- */
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/* ---------- App & CORS ---------- */
const app = express();
app.set("trust proxy", 1);

const ALLOWED_ORIGINS = [
  "https://flappyborgyv15-1.onrender.com",
  "https://flappyborgyv15.onrender.com",
  "http://localhost:3000",
  "http://localhost:5173",
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    cb(null, ALLOWED_ORIGINS.includes(origin));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  credentials: false,
  optionsSuccessStatus: 204,
}));

app.options("*", cors());
app.use(express.json({ limit: "512kb" }));

/* ---------- Helpers ---------- */
// Vérification officielle Telegram WebApp
function verifyInitData(initDataRaw, botToken) {
  if (!initDataRaw) return null;

  const url = new URLSearchParams(initDataRaw);
  const hash = url.get("hash");
  url.delete("hash");

  const dataCheck = [...url.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  const hmac = crypto.createHmac("sha256", secretKey)
    .update(dataCheck)
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

// Normalise le mode (accepte mode:"hard"|"normal" ou isHard:true|false)
function parseMode(rawMode, isHardFlag) {
  const s = (rawMode ?? (isHardFlag ? "hard" : "")).toString().toLowerCase();
  return s === "hard" ? "hard" : "normal";
}

/* ---------- Routes API ---------- */

// POST /api/score  { score:number, initData:string, mode?: "hard"|"normal", isHard?: boolean }
app.post("/api/score", async (req, res) => {
  try {
    const { score, initData, mode, isHard } = req.body || {};
    if (typeof score !== "number" || !Number.isFinite(score) || score < 0) {
      return res.status(400).json({ ok: false, error: "score invalide" });
    }
    const user = verifyInitData(initData, BOT_TOKEN);
    if (!user || !user.id) {
      return res.status(401).json({ ok: false, error: "initData invalide" });
    }

    const gameMode = parseMode(mode, isHard); // "hard" ou "normal"
    const uid = String(user.id);
    const name =
      (user.username && "@" + user.username) ||
      sanitizeName([user.first_name, user.last_name].filter(Boolean).join(" ")) ||
      "Player";
    const val = Math.floor(score);

    // Log utile (pas de données sensibles)
    console.log("[score]", { uid, mode: gameMode, score: val });

    // Sélection de la ligne spécifique à (user_id, mode)
    const { data: row, error: selErr } = await supabase
      .from("scores")
      .select("best")
      .eq("user_id", uid)
      .eq("mode", gameMode)
      .maybeSingle();

    if (selErr) {
      console.error("select error", selErr);
      return res.status(500).json({ ok: false, error: "db select" });
    }

    if (!row) {
      // INSERT avec la colonne mode
      const { error: insErr } = await supabase.from("scores").insert({
        user_id: uid,
        name,
        best: val,
        mode: gameMode,
        // updated_at: default now()
      });
      if (insErr) {
        console.error("insert error", insErr);
        return res.status(500).json({ ok: false, error: "db insert" });
      }
    } else if (val > row.best) {
      // UPDATE scoped sur (user_id, mode)
      const { error: updErr } = await supabase
        .from("scores")
        .update({ best: val, name, updated_at: new Date().toISOString() })
        .eq("user_id", uid)
        .eq("mode", gameMode);
      if (updErr) {
        console.error("update error", updErr);
        return res.status(500).json({ ok: false, error: "db update" });
      }
    } else {
      // Met à jour le nom / updated_at même si pas de meilleur score (optionnel)
      const { error: updNameErr } = await supabase
        .from("scores")
        .update({ name, updated_at: new Date().toISOString() })
        .eq("user_id", uid)
        .eq("mode", gameMode);
      if (updNameErr) {
        console.error("update name error", updNameErr);
      }
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error("POST /api/score error", e);
    return res.status(500).json({ ok: false, error: "server" });
  }
});

// GET /api/leaderboard?limit=10&mode=hard
// (accepte aussi ?isHard=true si jamais)
app.get("/api/leaderboard", async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const gameMode = parseMode(req.query.mode, req.query.isHard === "true");

    const { data, error } = await supabase
      .from("scores")
      .select("user_id,name,best,updated_at,mode")
      .eq("mode", gameMode)
      .order("best", { ascending: false })
      .order("updated_at", { ascending: true })
      .limit(limit);

    if (error) {
      console.error("leaderboard error", error);
      return res.status(500).json({ ok: false, error: "db" });
    }

    res.json({ ok: true, list: data || [] });
  } catch (e) {
    console.error("GET /api/leaderboard error", e);
    res.status(500).json({ ok: false, error: "server" });
  }
});

// GET /api/me?initData=...&mode=hard (mode facultatif, sinon "normal")
app.get("/api/me", async (req, res) => {
  try {
    const user = verifyInitData(req.query.initData, BOT_TOKEN);
    if (!user || !user.id) {
      return res.status(401).json({ ok: false, error: "initData invalide" });
    }
    const gameMode = parseMode(req.query.mode, req.query.isHard === "true");
    const uid = String(user.id);

    const { data, error } = await supabase
      .from("scores")
      .select("user_id,name,best,updated_at,mode")
      .eq("user_id", uid)
      .eq("mode", gameMode)
      .maybeSingle();

    if (error) {
      console.error("me error", error);
      return res.status(500).json({ ok: false, error: "db" });
    }

    res.json({ ok: true, me: data || null });
  } catch (e) {
    console.error("GET /api/me error", e);
    res.status(500).json({ ok: false, error: "server" });
  }
});

// Santé
app.get("/api/health", (_req, res) => res.json({ ok: true }));

/* ---------- Start ---------- */
app.listen(PORT, () => {
  console.log("Leaderboard server (Supabase) on port", PORT);
});
