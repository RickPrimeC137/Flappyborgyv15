// server.js — FlappyBorgy Leaderboard (Express + Telegram WebApp + Supabase)
// package.json doit contenir: { "type": "module" }

import express from "express";
import cors from "cors";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

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

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const hmac = crypto
    .createHmac("sha256", secretKey)
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
  return String(s).replace(/[\u0000-\u001F\u007F]/g, "").slice(0, 32);
}

function normMode(m) {
  return typeof m === "string" && m.toLowerCase() === "hard" ? "hard" : "normal";
}

// Jour "clé" en UTC (pour le daily challenge, commun à tout le monde)
function todayKeyUTC() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function resolveDayParam(qDay) {
  if (typeof qDay === "string") {
    const trimmed = qDay.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    if (trimmed.toLowerCase() === "today") return todayKeyUTC();
  }
  return todayKeyUTC();
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
      sanitizeName([user.first_name, user.last_name].filter(Boolean).join(" ")) ||
      "Player";
    const val = Math.floor(score);

    // Lecture (PK composite user_id + mode)
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
        // updated_at = default now()
      });
      if (insErr) {
        console.error("[DB] insert error", insErr);
        return res.status(500).json({ ok: false, error: "db insert" });
      }
      console.log(`[SCORE][NEW] uid=${uid} mode=${mode} best=${val}`);
    } else if (val > row.best) {
      const { error: updErr } = await supabase
        .from("scores")
        .update({ best: val, name, updated_at: new Date().toISOString() })
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
        .update({ name, updated_at: new Date().toISOString() })
        .eq("user_id", uid)
        .eq("mode", mode);
      if (updNameErr) console.warn("[DB] update name warn", updNameErr);
      console.log(`[SCORE][KEEP] uid=${uid} mode=${mode} best stays`);
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error("POST /api/score error", e);
    return res.status(500).json({ ok: false, error: "server" });
  }
});

/**
 * GET /api/leaderboard
 * ?limit=10
 * ?page=1
 * ?mode=hard|normal
 * ?period=global|week|month   (ou ?scope=all|week|month pour compat avec le front)
 */
app.get("/api/leaderboard", async (req, res) => {
  try {
    const limitRaw = Number(req.query.limit) || 10;
    const pageRaw = Number(req.query.page) || 1;

    const limit = Math.min(100, Math.max(1, limitRaw));
    const page = Math.max(1, pageRaw);

    const mode = normMode(req.query.mode);

    // Compat front: le jeu envoie "scope=all|week|month"
    const scopeRaw =
      typeof req.query.scope === "string" ? req.query.scope : undefined;

    const periodRaw =
      typeof scopeRaw === "string"
        ? scopeRaw
        : typeof req.query.period === "string"
        ? req.query.period
        : "global";

    const periodValues = ["global", "week", "month"];
    const period = periodValues.includes(periodRaw) ? periodRaw : "global";

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("scores")
      .select("user_id,name,best,updated_at,mode", { head: false })
      .eq("mode", mode);

    // Filtre temporel pour semaine / mois (sur updated_at)
    if (period !== "global") {
      const now = new Date();
      let fromDate;

      if (period === "week") {
        const d = new Date(now);
        d.setUTCDate(d.getUTCDate() - 7);
        fromDate = d.toISOString();
      } else if (period === "month") {
        const d = new Date(now);
        d.setUTCMonth(d.getUTCMonth() - 1);
        fromDate = d.toISOString();
      }

      if (fromDate) {
        query = query.gte("updated_at", fromDate);
      }
    }

    const { data, error } = await query
      .order("best", { ascending: false })
      .order("updated_at", { ascending: true })
      .range(from, to);

    if (error) {
      console.error("[DB] leaderboard error", error);
      return res.status(500).json({ ok: false, error: "db" });
    }

    res.json({ ok: true, list: data || [] });
  } catch (e) {
    console.error("GET /api/leaderboard error", e);
    res.status(500).json({ ok: false, error: "server" });
  }
});

/* ---------- DAILY CHALLENGE ---------- */
/**
 * Table Supabase attendue :
 *   create table public.daily_scores (
 *     id         bigserial primary key,
 *     day        date      not null,
 *     user_id    text      not null,
 *     name       text      not null,
 *     best       integer   not null,
 *     updated_at timestamptz not null default now()
 *   );
 *   create unique index daily_scores_day_user_idx
 *     on public.daily_scores(day, user_id);
 *
 * RLS : pas obligatoire ici car on utilise service_role.
 */

// POST /api/daily_score { score:number, initData:string }
app.post("/api/daily_score", async (req, res) => {
  try {
    const { score, initData } = req.body || {};
    if (typeof score !== "number" || !Number.isFinite(score) || score < 0) {
      return res.status(400).json({ ok: false, error: "score invalide" });
    }

    const user = verifyInitData(initData, BOT_TOKEN);
    if (!user || !user.id) {
      return res.status(401).json({ ok: false, error: "initData invalide" });
    }

    const uid = String(user.id);
    const name =
      (user.username && "@" + user.username) ||
      sanitizeName([user.first_name, user.last_name].filter(Boolean).join(" ")) ||
      "Player";
    const val = Math.floor(score);
    const dayKey = todayKeyUTC();

    // 1) upsert du meilleur score du jour pour ce user
    const { data: row, error: selErr } = await supabase
      .from("daily_scores")
      .select("best")
      .eq("user_id", uid)
      .eq("day", dayKey)
      .maybeSingle();

    if (selErr) {
      console.error("[DB][daily] select error", selErr);
      return res.status(500).json({ ok: false, error: "db select" });
    }

    if (!row) {
      const { error: insErr } = await supabase.from("daily_scores").insert({
        user_id: uid,
        name,
        day: dayKey,
        best: val,
        // updated_at par défaut
      });
      if (insErr) {
        console.error("[DB][daily] insert error", insErr);
        return res.status(500).json({ ok: false, error: "db insert" });
      }
      console.log(`[DAILY][NEW] uid=${uid} day=${dayKey} best=${val}`);
    } else if (val > row.best) {
      const { error: updErr } = await supabase
        .from("daily_scores")
        .update({ best: val, name, updated_at: new Date().toISOString() })
        .eq("user_id", uid)
        .eq("day", dayKey);
      if (updErr) {
        console.error("[DB][daily] update error", updErr);
        return res.status(500).json({ ok: false, error: "db update" });
      }
      console.log(`[DAILY][UPD] uid=${uid} day=${dayKey} best=${val}`);
    } else {
      const { error: updNameErr } = await supabase
        .from("daily_scores")
        .update({ name, updated_at: new Date().toISOString() })
        .eq("user_id", uid)
        .eq("day", dayKey);
      if (updNameErr) console.warn("[DB][daily] update name warn", updNameErr);
      console.log(`[DAILY][KEEP] uid=${uid} day=${dayKey} best stays`);
    }

    // 2) On regarde qui est #1 du jour pour signaler au front
    const { data: topList, error: topErr } = await supabase
      .from("daily_scores")
      .select("user_id,name,best")
      .eq("day", dayKey)
      .order("best", { ascending: false })
      .order("updated_at", { ascending: true })
      .limit(1);

    if (topErr) {
      console.error("[DB][daily] top error", topErr);
      // on ne bloque pas, on renvoie juste ok sans info bonus
      return res.json({ ok: true, day: dayKey });
    }

    let isTop = false;
    let topScore = null;
    let topUserName = null;
    if (Array.isArray(topList) && topList.length > 0) {
      const top = topList[0];
      isTop = top.user_id === uid;
      topScore = top.best;
      topUserName = top.name;
    }

    return res.json({
      ok: true,
      day: dayKey,
      isTop,
      topScore,
      topUserName,
    });
  } catch (e) {
    console.error("POST /api/daily_score error", e);
    return res.status(500).json({ ok: false, error: "server" });
  }
});

/**
 * GET /api/daily_leaderboard
 * ?limit=10
 * ?page=1
 * ?day=YYYY-MM-DD | today (optionnel, défaut = today UTC)
 */
app.get("/api/daily_leaderboard", async (req, res) => {
  try {
    const limitRaw = Number(req.query.limit) || 10;
    const pageRaw = Number(req.query.page) || 1;

    const limit = Math.min(100, Math.max(1, limitRaw));
    const page = Math.max(1, pageRaw);

    const dayKey = resolveDayParam(req.query.day);

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error } = await supabase
      .from("daily_scores")
      .select("user_id,name,best,day,updated_at", { head: false })
      .eq("day", dayKey)
      .order("best", { ascending: false })
      .order("updated_at", { ascending: true })
      .range(from, to);

    if (error) {
      console.error("[DB][daily] leaderboard error", error);
      return res.status(500).json({ ok: false, error: "db" });
    }

    res.json({ ok: true, day: dayKey, list: data || [] });
  } catch (e) {
    console.error("GET /api/daily_leaderboard error", e);
    res.status(500).json({ ok: false, error: "server" });
  }
});

// GET /api/daily_me?initData=...&day=YYYY-MM-DD|today
app.get("/api/daily_me", async (req, res) => {
  try {
    const user = verifyInitData(req.query.initData, BOT_TOKEN);
    if (!user || !user.id) {
      return res.status(401).json({ ok: false, error: "initData invalide" });
    }
    const uid = String(user.id);
    const dayKey = resolveDayParam(req.query.day);

    const { data, error } = await supabase
      .from("daily_scores")
      .select("user_id,name,best,day,updated_at")
      .eq("user_id", uid)
      .eq("day", dayKey)
      .maybeSingle();

    if (error) {
      console.error("[DB][daily] me error", error);
      return res.status(500).json({ ok: false, error: "db" });
    }

    res.json({ ok: true, day: dayKey, me: data || null });
  } catch (e) {
    console.error("GET /api/daily_me error", e);
    res.status(500).json({ ok: false, error: "server" });
  }
});

/**
 * GET /api/me?initData=...&mode=hard|normal
 * (leaderboard classique, pas daily)
 */
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
