// server.js — FlappyBorgy Leaderboard (Express + Telegram WebApp + Supabase)
// package.json doit contenir: { "type": "module" }

import express from "express";
import cors from "cors";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

/*
  IMPORTANT SUPABASE
  ------------------
  Tu dois avoir 2 tables :

  1) scores  (all-time, comme avant)
     create table public.scores (
       user_id   text      not null,
       name      text      not null,
       best      integer   not null,
       mode      text      not null, -- 'normal' | 'hard'
       updated_at timestamptz not null default now(),
       primary key (user_id, mode)
     );

  2) scores_periodic  (semaine + mois)
     create table public.scores_periodic (
       user_id     text      not null,
       name        text      not null,
       best        integer   not null,
       mode        text      not null, -- 'normal' | 'hard'
       period_type text      not null, -- 'week' | 'month'
       period_key  text      not null, -- ex: '2025-W09' ou '2025-03'
       updated_at  timestamptz not null default now(),
       primary key (user_id, mode, period_type, period_key)
     );
*/

/* ---------- ENV ---------- */
const PORT = process.env.PORT || 8080;
const BOT_TOKEN = process.env.BOT_TOKEN;                         // token BotFather
const SUPABASE_URL = process.env.SUPABASE_URL;                   // https://xxxx.supabase.co
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE; // clé service_role

if (!BOT_TOKEN) throw new Error("BOT_TOKEN manquant");
if (!SUPABASE_URL) throw new Error("SUPABASE_URL manquant");
if (!SUPABASE_SERVICE_ROLE) throw new Error("SUPABASE_SERVICE_ROLE manquant");

/* ---------- Supabase (serveur) ---------- */
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/* ---------- App, Anti-cache & CORS ---------- */
const app = express();
app.set("trust proxy", 1);

// Anti-cache (évite les 304 / réponses vides sur certains fetch)
app.set("etag", false);
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

// Autorise localhost + tes sous-domaines Render (front & api)
const ALLOWED_ORIGINS_RE = [
  /^https?:\/\/localhost(?::\d+)?$/i,
  /^https:\/\/flappyborgy.*\.onrender\.com$/i,                 // front
  /^https:\/\/rickprimec137-flappyborgyv15\.onrender\.com$/i,  // api
];

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl/Postman
      const ok = ALLOWED_ORIGINS_RE.some((re) => re.test(origin));
      return cb(ok ? null : new Error("CORS not allowed"), ok);
    },
    methods: ["GET", "POST", "OPTIONS"],
    // ⚠️ Ne pas fixer allowedHeaders: laisser cors gérer automatiquement
    credentials: false,
  })
);
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
    return JSON.parse(obj.user || "{}"); // "user" est du JSON dans initData
  } catch {
    return null;
  }
}

function sanitizeName(s) {
  if (!s) return "Player";
  return String(s)
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .slice(0, 32);
}

function normMode(m) {
  return typeof m === "string" && m.toLowerCase() === "hard" ? "hard" : "normal";
}

/* ---- Périodes (semaine / mois) ---- */
function currentWeekKey() {
  const d = new Date();
  const year = d.getUTCFullYear();

  const start = new Date(Date.UTC(year, 0, 1));
  const dayOfYear = Math.floor((d - start) / 86400000) + 1;
  const week = Math.ceil(dayOfYear / 7); // approx ISO

  return `${year}-W${String(week).padStart(2, "0")}`;
}

function currentMonthKey() {
  const d = new Date();
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

// Met à jour les scores semaine + mois dans scores_periodic
async function upsertPeriodicScore({ uid, name, val, mode }) {
  const now = new Date().toISOString();

  const periods = [
    { type: "week",  key: currentWeekKey()  },
    { type: "month", key: currentMonthKey() },
  ];

  for (const p of periods) {
    try {
      const { data: row, error: selErr } = await supabase
        .from("scores_periodic")
        .select("best")
        .eq("user_id", uid)
        .eq("mode", mode)
        .eq("period_type", p.type)
        .eq("period_key", p.key)
        .maybeSingle();

      if (selErr) {
        console.error("[DB] periodic select error", selErr);
        continue;
      }

      if (!row) {
        const { error: insErr } = await supabase.from("scores_periodic").insert({
          user_id: uid,
          name,
          best: val,
          mode,
          period_type: p.type,
          period_key: p.key,
          updated_at: now,
        });
        if (insErr) console.error("[DB] periodic insert error", insErr);
      } else if (val > row.best) {
        const { error: updErr } = await supabase
          .from("scores_periodic")
          .update({ best: val, name, updated_at: now })
          .eq("user_id", uid)
          .eq("mode", mode)
          .eq("period_type", p.type)
          .eq("period_key", p.key);
        if (updErr) console.error("[DB] periodic update error", updErr);
      } else {
        // on rafraîchit quand même le name/updated_at
        const { error: updNameErr } = await supabase
          .from("scores_periodic")
          .update({ name, updated_at: now })
          .eq("user_id", uid)
          .eq("mode", mode)
          .eq("period_type", p.type)
          .eq("period_key", p.key);
        if (updNameErr) console.error("[DB] periodic update name warn", updNameErr);
      }
    } catch (e) {
      console.error("[DB] periodic upsert exception", e);
    }
  }
}

/* ---------- Routes ---------- */

// Health & root
app.get("/", (_req, res) =>
  res.json({ ok: true, service: "flappyborgy-leaderboard" })
);
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// POST /api/score  { score:number, initData:string, mode?: "hard"|"normal" }
app.post("/api/score", async (req, res) => {
  try {
    const { score, initData, mode: modeRaw } = req.body || {};
    if (typeof score !== "number" || !Number.isFinite(score) || score < 0) {
      return res.status(400).json({ ok: false, error: "score invalide" });
    }
    const mode = normMode(modeRaw);

    const user = verifyInitData(initData, BOT_TOKEN);
    if (!user || !user.id) {
      return res.status(401).json({ ok: false, error: "initData invalide" });
    }

    const uid = String(user.id);
    const name =
      (user.username && "@" + user.username) ||
      sanitizeName(
        [user.first_name, user.last_name].filter(Boolean).join(" ")
      ) ||
      "Player";

    const val = Math.floor(score);
    const nowIso = new Date().toISOString();

    // --- TABLE scores (all-time) ---
    const { data: row, error: selErr } = await supabase
      .from("scores")
      .select("best")
      .eq("user_id", uid)
      .eq("mode", mode)
      .maybeSingle();

    if (selErr) {
      console.error("[DB] select error", selErr);
      return res.status(500).json({ ok: false, error: "db select" });
    }

    if (!row) {
      const { error: insErr } = await supabase.from("scores").insert({
        user_id: uid,
        name,
        best: val,
        mode, // enum public.game_mode ('normal'|'hard')
        updated_at: nowIso,
      });
      if (insErr) {
        console.error("[DB] insert error", insErr);
        return res.status(500).json({ ok: false, error: "db insert" });
      }
      console.log(`[SCORE][NEW] uid=${uid} mode=${mode} best=${val}`);
    } else if (val > row.best) {
      const { error: updErr } = await supabase
        .from("scores")
        .update({ best: val, name, updated_at: nowIso })
        .eq("user_id", uid)
        .eq("mode", mode);
      if (updErr) {
        console.error("[DB] update error", updErr);
        return res.status(500).json({ ok: false, error: "db update" });
      }
      console.log(`[SCORE][UPD] uid=${uid} mode=${mode} best=${val}`);
    } else {
      // rafraîchir name/updated_at (optionnel)
      const { error: updNameErr } = await supabase
        .from("scores")
        .update({ name, updated_at: nowIso })
        .eq("user_id", uid)
        .eq("mode", mode);
      if (updNameErr) console.warn("[DB] update name warn", updNameErr);
      console.log(`[SCORE][KEEP] uid=${uid} mode=${mode} best stays`);
    }

    // --- TABLE scores_periodic (week + month) ---
    await upsertPeriodicScore({ uid, name, val, mode });

    return res.json({ ok: true });
  } catch (e) {
    console.error("POST /api/score error", e);
    return res.status(500).json({ ok: false, error: "server" });
  }
});

// GET /api/leaderboard?limit=10&page=1&mode=hard|normal&scope=all|week|month
app.get("/api/leaderboard", async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const page  = Math.max(1, Number(req.query.page) || 1);
    const mode  = normMode(req.query.mode); // défaut: normal
    const scope = (req.query.scope || "all").toLowerCase();      // all | week | month

    const from = (page - 1) * limit;
    const to   = from + limit - 1;

    let query;
    if (scope === "week" || scope === "month") {
      const period_type = scope;
      const period_key  = scope === "week" ? currentWeekKey() : currentMonthKey();

      query = supabase
        .from("scores_periodic")
        .select("user_id,name,best,updated_at,mode", { count: "exact" })
        .eq("mode", mode)
        .eq("period_type", period_type)
        .eq("period_key", period_key)
        .order("best", { ascending: false })
        .order("updated_at", { ascending: true })
        .range(from, to);
    } else {
      // all-time
      query = supabase
        .from("scores")
        .select("user_id,name,best,updated_at,mode", { count: "exact" })
        .eq("mode", mode)
        .order("best", { ascending: false })
        .order("updated_at", { ascending: true })
        .range(from, to);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("[DB] leaderboard error", error);
      return res.status(500).json({ ok: false, error: "db" });
    }

    const total = count ?? 0;
    const pageSize = limit;
    const pageCount =
      pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;

    res.json({
      ok: true,
      list: data || [],
      page,
      pageSize,
      total,
      pageCount,
      scope,
    });
  } catch (e) {
    console.error("GET /api/leaderboard error", e);
    res.status(500).json({ ok: false, error: "server" });
  }
});

// GET /api/me?initData=...&mode=hard|normal   (all-time, comme avant)
app.get("/api/me", async (req, res) => {
  try {
    const user = verifyInitData(req.query.initData, BOT_TOKEN);
    if (!user || !user.id) {
      return res.status(401).json({ ok: false, error: "initData invalide" });
    }
    const uid = String(user.id);
    const mode = normMode(req.query.mode);

    const { data, error } = await supabase
      .from("scores")
      .select("user_id,name,best,updated_at,mode")
      .eq("user_id", uid)
      .eq("mode", mode)
      .maybeSingle();

    if (error) {
      console.error("[DB] me error", error);
      return res.status(500).json({ ok: false, error: "db" });
    }

    res.json({ ok: true, me: data || null });
  } catch (e) {
    console.error("GET /api/me error", e);
    res.status(500).json({ ok: false, error: "server" });
  }
});

/* ---------- Start ---------- */
app.listen(PORT, () => {
  console.log("Leaderboard server (Supabase) on port", PORT);
});
