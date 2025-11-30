// FlappyBorgy — montagnes 1024x1536 (pipes light only + Telegram leaderboard)
// Domaine du jeu : https://flappyborgyv15.onrender.com
// API : https://rickprimec137-flappyborgyv15.onrender.com
// ⚠️ Mets ta vidéo dans /assets/intro.mp4

/* ================== Telegram WebApp ================== */
const TG = window.Telegram?.WebApp || null;
if (TG) { try { TG.ready(); TG.expand(); } catch {} }

/* ================== Constantes jeu ================== */
const GAME_W = 1024, GAME_H = 1536;

const PROFILE = {
  gravity: 1400,
  jump: -390,
  pipeSpeed: -220,
  gap: 260,
  spawnDelay: 2450
};

const PAD = 2;
const PIPE_BODY_W    = 0.92;
const PIPE_W_DISPLAY = 180;
const PLAYER_SCALE   = 0.14; // légèrement réduit pour bien caser tous les skins
const PIPE_HITBOX_W = 0.5; // 1 = largeur complète du sprite, 0.8 = plus serré

const BG_KEY       = "bg_mountains";
const BG_HARD_KEY  = "bg_volcano"; // assets/bg_volcano.png
const BG_XMAS_KEY  = "bg_noel";    // assets/bg_noel.png

const PLAYFIELD_TOP_PCT = 0.20;
const PLAYFIELD_BOT_PCT = 0.90;
const PIPE_RIM_MAX_PCT  = 0.65;

const PIPE_OVERSCAN = 160;
const JOINT_OVERLAP = 1;
const KILL_MARGIN   = 260;

// On n’utilise plus les bandes kill, on laisse les nuages faire les murs
const ENABLE_KILL_BANDS = false;

const ENABLE_BONUS = true;
const BONUS_EVERY = 20;
const BONUS_DURATION = 15000;

// Borgy coins
const BORGY_COINS_KEY = "flappy_borgy_coins_v1";
// Best local score (pour quêtes évolutives)
const LOCAL_BEST_KEY  = "flappy_borgy_bestscore_v1";

/* ===== Anim “portes” (Hard) ===== */
const HARD_DOOR_AMPLITUDE_PX = 70;
const HARD_DOOR_HALF_PERIOD  = 900;

/* ===== Nuages bande haut/bas ===== */
const CLOUD_TOP_HEIGHT_PCT    = 0.11; // ~11% de la hauteur en haut
const CLOUD_BOTTOM_HEIGHT_PCT = 0.22; // ~22% de la hauteur en bas (plus large)
const CLOUD_EXTRA_SCALE_X     = 1.25; // un peu plus large que l’écran pour éviter les trous sur les côtés
// Décalage vers le bas de la hitbox du nuage du bas (en pixels)
const BOTTOM_CLOUD_HITBOX_OFFSET_PX = 40; // ajuste la valeur comme tu veux

/* ===== Popup bienvenue (flag) ===== */
const WELCOME_POPUP_KEY = "flappy_borgy_welcome_seen_v1"; // (stockage si besoin)
let welcomeShownThisSession = false; // flag session

/* ===== Mode Noël ===== */
const XMAS_MODE_KEY = "flappy_borgy_xmas_mode_v1";

/* ================== Langues EN / FR ================== */
const LANG_STORAGE_KEY = "flappy_borgy_lang_v1";
const SUPPORTED_LANGS  = ["fr", "en"];

const I18N = {
  fr: {
    MENU_PLAY: "Jouer",
    MENU_LEADERBOARD: "Leaderboard",
    MENU_QUESTS: "Quêtes 🔥",
    MENU_SHOP: "Borgy Coins Shop",
    MENU_VOTE: "🗳️ Voter pour Borgy",
    MENU_BUY:  "Buy Borgy",
    MENU_HARD_ON:  "Mode Hard : ON",
    MENU_HARD_OFF: "Mode Hard : OFF",

    WELCOME_TITLE: "Bienvenue dans le jeu Flappy-Borgy !!!",
    WELCOME_L1: "L'objectif est de passer entre les tuyaux pour faire des points\net battre le record ;",
    WELCOME_L2: "- Utilise la touche espace ou le clic de la souris si tu es sur Telegram PC.\n  Si tu es sur mobile, un pouce suffit mais je te conseille les deux ;)",
    WELCOME_L3: "- Récupère des Borgy Coins pour acheter des skins.",
    WELCOME_L4: "- Des quêtes évolutives et journalières sont disponibles\n  (elles s'adaptent le lendemain en fonction de ton score).",
    WELCOME_L5: "- Le logo bonus vert apparaît de temps en temps et double le score\n  pendant un temps limité.",
    WELCOME_L6: "- Attention au robot vert qui sort des tuyaux.",
    WELCOME_L7: "- Si tu es bouillant, essaye le mode Hard : clique sur le bouton\n  Mode Hard ON/OFF, puis sur Jouer (les Borgy Coins sont doublés\n  dans ce mode).",
    WELCOME_END: "Voilà, fais-toi plaisir et LFG BORGY <3\n\nFait par un fan dévoué corps et âme à la team BORGY <3",
    WELCOME_OK:  "OK, c'est parti !",

    LANG_BTN_FR: "FR",
    LANG_BTN_EN: "EN",

    // HUD / Infos
    HUD_SCORE: "Score :",
    HUD_COINS: "Borgy Coins :",
    FOOTER_TIP: "Tap/Espace pour sauter — évite les tuyaux",

    // Quêtes
    QUESTS_TITLE: "Quêtes du jour",
    QUESTS_HARD_HINT: "(Récompenses x2 en Hard)",
    QUESTS_REWARD_LABEL: "Récompense :",
    QUESTS_TOTAL_COINS: "Total Borgy Coins :",

    // ⚡ Daily challenge
    DAILY_TITLE: "Défi du jour",
    DAILY_BEST: "Meilleur score aujourd'hui :",
    DAILY_REWARD: "Récompense : 500 Borgy Coins (1x/jour)",
    DAILY_DONE: "Récompense déjà obtenue aujourd'hui ✅",

    // Shop
    SHOP_TITLE: "Borgy Coins Shop",
    SHOP_CURRENT_COINS: "Tu as actuellement :",
    SHOP_CHOOSE_SKIN: "Choisis ton skin Borgy :",
    SHOP_BTN_BUY: "Acheter",
    SHOP_BTN_SELECTED: "Sélectionné",
    SHOP_BTN_USE: "Utiliser",
    SHOP_NOT_ENOUGH_COINS: "Pas assez de Borgy Coins !",
    SHOP_PRICE_FREE: "Gratuit",
    SHOP_PERK_GOLD: "Borgy Coins x5",
    SHOP_PERK_EMERALD: "Bonus SwissBorg x3",
    SHOP_PERK_DIAMOND: "1 vie supplémentaire",

    // Commun
    COMMON_CLOSE: "Fermer",

    // Leaderboard
    LEADERBOARD_TITLE: "Leaderboard",
    LEADERBOARD_TITLE_HARD: "Leaderboard (Hard)",
    LEADERBOARD_SCOPE_GLOBAL: "Global",
    LEADERBOARD_SCOPE_WEEK: "Semaine",
    LEADERBOARD_SCOPE_MONTH: "Mois",
    LEADERBOARD_PAGE_LABEL: "Page",

    // Game Over
    GAME_OVER_TITLE: "Game Over",
    GAME_OVER_SCORE: "Score :",
    GAME_OVER_SHARE: "Partager mon score",
    GAME_OVER_REPLAY: "Rejouer",
    GAME_OVER_MENU: "Menu principal",

    // Partage
    SHARE_TITLE: "Partager ton score",
    SHARE_HINT: "Choisis une plateforme ou copie le texte :",
    SHARE_COPY: "Copier le texte",
    SHARE_COPIED: "Copié !",
    SHARE_CLOSE: "Fermer",

    // Réanimation
    REVIVE_TEXT: "Réanimation !"
  },
  en: {
    MENU_PLAY: "Play",
    MENU_LEADERBOARD: "Leaderboard",
    MENU_QUESTS: "Quests 🔥",
    MENU_SHOP: "Borgy Coins Shop",
    MENU_VOTE: "🗳️ Vote for Borgy",
    MENU_BUY:  "Buy Borgy",
    MENU_HARD_ON:  "Hard Mode : ON",
    MENU_HARD_OFF: "Hard Mode : OFF",

    WELCOME_TITLE: "Welcome to Flappy-Borgy !!!",
    WELCOME_L1: "The goal is to fly between the pipes to score points\nand beat the high score;",
    WELCOME_L2: "- Use SPACE or mouse click if you're on Telegram PC.\n  On mobile, one thumb is enough but two are safer ;)",
    WELCOME_L3: "- Collect Borgy Coins to buy skins.",
    WELCOME_L4: "- You have daily and evolving quests\n  (they adapt the next day depending on your score).",
    WELCOME_L5: "- The green bonus logo appears sometimes and doubles your score\n  for a limited time.",
    WELCOME_L6: "- Beware of the green robot coming out of the pipes.",
    WELCOME_L7: "- If you're a degen, try Hard mode: toggle Hard Mode ON/OFF,\n  then press Play (Borgy Coins are doubled in this mode).",
    WELCOME_END: "Enjoy and LFG BORGY <3\n\nMade by a fan fully dedicated to the BORGY team <3",
    WELCOME_OK:  "OK, let's go!",

    LANG_BTN_FR: "FR",
    LANG_BTN_EN: "EN",

    // HUD / Infos
    HUD_SCORE: "Score:",
    HUD_COINS: "Borgy Coins:",
    FOOTER_TIP: "Tap/Space to jump — avoid the pipes",

    // Quêtes
    QUESTS_TITLE: "Daily quests",
    QUESTS_HARD_HINT: "(Rewards x2 in Hard)",
    QUESTS_REWARD_LABEL: "Reward:",
    QUESTS_TOTAL_COINS: "Total Borgy Coins:",

    // ⚡ Daily challenge
    DAILY_TITLE: "Daily challenge",
    DAILY_BEST: "Best score today:",
    DAILY_REWARD: "Reward: 500 Borgy Coins (once per day)",
    DAILY_DONE: "Reward already claimed today ✅",

    // Shop
    SHOP_TITLE: "Borgy Coins Shop",
    SHOP_CURRENT_COINS: "You currently have:",
    SHOP_CHOOSE_SKIN: "Choose your Borgy skin:",
    SHOP_BTN_BUY: "Buy",
    SHOP_BTN_SELECTED: "Selected",
    SHOP_BTN_USE: "Use",
    SHOP_NOT_ENOUGH_COINS: "Not enough Borgy Coins!",
    SHOP_PRICE_FREE: "Free",
    SHOP_PERK_GOLD: "Borgy Coins x5",
    SHOP_PERK_EMERALD: "SwissBorg bonus x3",
    SHOP_PERK_DIAMOND: "1 extra life",

    // Common
    COMMON_CLOSE: "Close",

    // Leaderboard
    LEADERBOARD_TITLE: "Leaderboard",
    LEADERBOARD_TITLE_HARD: "Leaderboard (Hard)",
    LEADERBOARD_SCOPE_GLOBAL: "Global",
    LEADERBOARD_SCOPE_WEEK: "Week",
    LEADERBOARD_SCOPE_MONTH: "Month",
    LEADERBOARD_PAGE_LABEL: "Page",

    // Game Over
    GAME_OVER_TITLE: "Game Over",
    GAME_OVER_SCORE: "Score:",
    GAME_OVER_SHARE: "Share my score",
    GAME_OVER_REPLAY: "Play again",
    GAME_OVER_MENU: "Main menu",

    // Share
    SHARE_TITLE: "Share your score",
    SHARE_HINT: "Pick a platform or copy the text:",
    SHARE_COPY: "Copy text",
    SHARE_COPIED: "Copied!",
    SHARE_CLOSE: "Close",

    // Revive
    REVIVE_TEXT: "Revive!"
  }
};

function loadLang(){
  try{
    const v = localStorage.getItem(LANG_STORAGE_KEY);
    if (SUPPORTED_LANGS.includes(v)) return v;
  }catch(e){}
  return "fr";
}

function saveLang(lang){
  try{ localStorage.setItem(LANG_STORAGE_KEY, lang); }catch(e){}
}

function currentLang(){
  if (!window._flappyLang){
    window._flappyLang = loadLang();
  }
  return window._flappyLang;
}

function setLang(lang){
  if (!SUPPORTED_LANGS.includes(lang)) return;
  window._flappyLang = lang;
  saveLang(lang);
}

function t(key){
  const lang = currentLang();
  return (I18N[lang] && I18N[lang][key]) || (I18N["fr"][key] || key);
}

/* ============ Musique ============ */
function ensureBgm(scene, opts = {}) {
  const gm = scene.game;
  if (!gm._bgmKeys) { gm._bgmKeys = ["bgm", "bgm_alt"]; gm._bgmIndex = 0; }

  let wantedKey = opts.forceKey
    ? opts.forceKey
    : gm._bgmKeys[gm._bgmIndex % gm._bgmKeys.length];

  if (!opts.forceKey) gm._bgmIndex = (gm._bgmIndex + 1) % gm._bgmKeys.length;

  if (gm._bgm && gm._bgm.key !== wantedKey) {
    try { gm._bgm.stop(); } catch {}
    try { gm._bgm.destroy(); } catch {}
    gm._bgm = null;
  }
  if (!gm._bgm || gm._bgm.destroyed === true) {
    gm._bgm = scene.sound.add(wantedKey, { loop: true, volume: 0.35 });
    if (gm._muted === true) gm._bgm.setMute(true);
  }

  const start = () => { if (!gm._bgm.isPlaying) gm._bgm.play(); };
  if (scene.sound.locked) {
    scene.input.once("pointerdown", start);
    scene.input.keyboard?.once("keydown-SPACE", start);
  } else start();

  scene.game.events.off(Phaser.Core.Events.BLUR);
  scene.game.events.off(Phaser.Core.Events.FOCUS);
  scene.game.events.on(Phaser.Core.Events.BLUR, () => gm._bgm?.pause());
  scene.game.events.on(Phaser.Core.Events.FOCUS, () => {
    if (!scene.sound.locked) gm._bgm?.resume();
  });
}

/* ======= Difficulté ======= */
const DIFF = {
  stepMs: 14000,
  speedDelta: -20,
  delayDelta: -150,
  minSpeed: -380,
  minDelay: 1250,
  cooldownMs: 265
};

const SPAWN_X_OFFSET = PIPE_W_DISPLAY * 0.6;

// distance horizontale minimale entre deux paires de tuyaux
const MIN_PAIR_DIST_PX = 360;

/* ================== LEADERBOARD ================== */
const API_BASE = "https://rickprimec137-flappyborgyv15.onrender.com";
function tgInitData(){ try { return TG?.initData || null; } catch { return null; } }

// Ajout du paramètre isHard => envoie mode: "hard" ou "normal"
async function postScore(score, isHard=false){
  const initData = tgInitData();
  if (!initData) return;
  try{
    await fetch(`${API_BASE}/api/score`, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ score, initData, mode: isHard ? "hard" : "normal" })
    });
  }catch(e){ console.warn("score post error", e); }
}

// VERSION PAGINÉE + SCOPE (global / semaine / mois)
async function fetchLeaderboard(limit = 10, isHard = false, page = 1, scope = "all") {
  try {
    const url =
      `${API_BASE}/api/leaderboard?limit=${limit}` +
      `&page=${page}` +
      `&scope=${encodeURIComponent(scope)}` +
      (isHard ? "&mode=hard" : "") +
      `&_=${Date.now()}`; // anti-cache

    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) { console.warn("lb status", r.status); return []; }
    const j = await r.json().catch(() => null);
    return j?.ok ? j.list : [];
  } catch (e) {
    console.warn("lb fetch error", e);
    return [];
  }
}

/* ================== Util best score ================== */
function loadLocalBestScore(){
  try{
    const raw = localStorage.getItem(LOCAL_BEST_KEY);
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }catch(e){ return 0; }
}
function saveLocalBestScore(score){
  try{
    const cur = loadLocalBestScore();
    if (score > cur) {
      localStorage.setItem(LOCAL_BEST_KEY, String(score|0));
    }
  }catch(e){}
}

/* ================== Quêtes & Coins ================== */
const QUEST_STORAGE_KEY = "flappy_borgy_quests_v1";

function todayKey(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

// Génère des quêtes du jour en fonction du meilleur score local
function generateDailyQuests(){
  const best = loadLocalBestScore() || 20;
  const day  = todayKey();

  const q1Target = Math.max(20, Math.round(best * 0.4));
  const q2Target = Math.max(q1Target + 30, Math.round(best * 1.1));
  const bonusCount = best < 80 ? 1 : (best < 150 ? 2 : 3);

  // Les titres restent en FR pour l’instant (texte de contenu, pas de l’UI)
  const quests = [
    {
      id: "score_q1_" + day,
      title: `Atteins ${q1Target} points`,
      type: "score",
      target: q1Target,
      progress: 0,
      done: false,
      reward: `+${q1Target} BorgyCoins`,
      coins: q1Target
    },
    {
      id: "score_q2_" + day,
      title: `Atteins ${q2Target} points`,
      type: "score",
      target: q2Target,
      progress: 0,
      done: false,
      reward: `+${q2Target} BorgyCoins`,
      coins: q2Target
    },
    {
      id: "bonus_q_" + day,
      title: `Ramasse ${bonusCount} bonus`,
      type: "bonus",
      target: bonusCount,
      progress: 0,
      done: false,
      reward: `+${bonusCount * 25} BorgyCoins`,
      coins: bonusCount * 25
    }
  ];

  return { dayKey: day, quests };
}

function loadQuests(){
  try{
    const raw = localStorage.getItem(QUEST_STORAGE_KEY);
    if (raw){
      const data = JSON.parse(raw);
      if (data && data.dayKey === todayKey() && Array.isArray(data.quests)){
        return data;
      }
    }
  }catch(e){}
  const base = generateDailyQuests();
  saveQuests(base);
  return base;
}
function saveQuests(data){
  try{ localStorage.setItem(QUEST_STORAGE_KEY, JSON.stringify(data)); }catch(e){}
}

function loadBorgyCoins(){
  try{
    const raw = localStorage.getItem(BORGY_COINS_KEY);
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }catch(e){ return 0; }
}
function saveBorgyCoins(n){
  try{ localStorage.setItem(BORGY_COINS_KEY, String(Math.max(0, n|0))); }catch(e){}
}

// Applique les récompenses des quêtes terminées
// Si Hard mode => récompense x2
function applyQuestCoins(data, isHardMode){
  let total = loadBorgyCoins();
  let changed = false;
  const mult = isHardMode ? 2 : 1;

  for(const q of data.quests){
    if (q.done && !q._rewardGiven && typeof q.coins === "number"){
      total += q.coins * mult;
      q._rewardGiven = true;
      changed = true;
    }
  }
  if (changed){
    saveQuests(data);
    saveBorgyCoins(total);
  }
  return total;
}

function updateQuestsFromEvent(evt, value){
  const data = loadQuests();
  let changed = false;
  for (const q of data.quests){
    if (q.done) continue;
    if (q.type === "score" && evt === "score") {
      const v = Math.max(q.progress, value);
      if (v !== q.progress){
        q.progress = v;
        if (q.progress >= q.target) q.done = true;
        changed = true;
      }
    }
    if (q.type === "bonus" && evt === "bonus") {
      q.progress += 1;
      if (q.progress >= q.target) q.done = true;
      changed = true;
    }
    if (q.type === "game"  && evt === "game")  {
      q.progress += 1;
      if (q.progress >= q.target) q.done = true;
      changed = true;
    }
  }
  if (changed) saveQuests(data);
  return changed;
}

/* ================== DAILY CHALLENGE (500 coins pour le meilleur score du jour) ================== */
const DAILY_CHALLENGE_KEY = "flappy_borgy_daily_challenge_v1";

function saveDailyChallenge(data){
  try {
    localStorage.setItem(DAILY_CHALLENGE_KEY, JSON.stringify(data));
  } catch (e) {}
}

function loadDailyChallenge(){
  const day = todayKey();
  try {
    const raw = localStorage.getItem(DAILY_CHALLENGE_KEY);
    if (raw){
      const data = JSON.parse(raw);
      if (data && data.dayKey === day){
        if (typeof data.bestScore !== "number" || !Number.isFinite(data.bestScore)){
          data.bestScore = 0;
        }
        data.rewardGiven = !!data.rewardGiven;
        return data;
      }
    }
  } catch (e) {}
  const fresh = { dayKey: day, bestScore: 0, rewardGiven: false };
  saveDailyChallenge(fresh);
  return fresh;
}

// Appelé en fin de partie : met à jour le best du jour et donne 500 coins une seule fois par jour
function updateDailyChallengeOnGameOver(score){
  const safeScore = Math.max(0, score | 0);
  let data = loadDailyChallenge();
  let gotReward = false;

  if (safeScore > (data.bestScore || 0)){
    data.bestScore = safeScore;

    if (!data.rewardGiven && safeScore > 0){
      data.rewardGiven = true;
      let coins = loadBorgyCoins();
      coins += 500; // 🎁 récompense fixe
      saveBorgyCoins(coins);
      saveDailyChallenge(data);
      return { gotReward: true, coinsAfter: coins, bestScore: data.bestScore };
    }
  }

  saveDailyChallenge(data);
  return { gotReward: false, coinsAfter: loadBorgyCoins(), bestScore: data.bestScore };
}

/* ================== SKINS ================== */
const SKINS_STORAGE_KEY = "flappy_borgy_skins_v1";

const SKINS_DEF = [
  { id: "borgy_default",  key: "borgy",           name: "Borgy Classique",  price: 0,    ownedByDefault: true  },
  { id: "borgy_knight",   key: "borgy_knight",    name: "Borgy Chevalier",  price: 1000, ownedByDefault: false },
  { id: "borgy_dragon",   key: "borgy_dragon",    name: "Borgy Dragon",     price: 1500, ownedByDefault: false },
  { id: "borgy_space",    key: "borgy_space",     name: "Borgy Astronaute", price: 2000, ownedByDefault: false },
  { id: "borgy_cyber",    key: "borgy_cyber",     name: "Borgy Cyber",      price: 2500, ownedByDefault: false },
  { id: "borgy_cowboy",   key: "borgy_cowboy",    name: "Borgy Cow-boy",    price: 3000, ownedByDefault: false },
  { id: "borgy_gold",     key: "borgy_gold",      name: "Borgy Gold",       price: 10000, ownedByDefault: false },
  { id: "borgy_emeraude", key: "borgy_emeraude",  name: "Borgy Émeraude",   price: 15000, ownedByDefault: false },
  { id: "borgy_diamant",  key: "borgy_diamant",   name: "Borgy Diamant",    price: 20000, ownedByDefault: false }
  // NB : le skin Noël "borgy_xmas" n'est PAS dans le shop, il est automatique en mode Noël
];

function loadSkinState(){
  try{
    const raw = localStorage.getItem(SKINS_STORAGE_KEY);
    if (raw){
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.skins) && data.skins.length){

        const existingIds = new Set(data.skins.map(s => s.id));
        SKINS_DEF.forEach(def => {
          if (!existingIds.has(def.id)) {
            data.skins.push({
              id: def.id,
              key: def.key,
              name: def.name,
              price: def.price,
              owned: !!def.ownedByDefault,
              selected: false
            });
          }
        });

        if (!data.selectedId || !data.skins.some(s => s.id === data.selectedId && s.owned)) {
          const fallback = data.skins.find(s => s.owned) || data.skins[0];
          if (fallback) {
            data.selectedId = fallback.id;
          }
        }
        data.skins.forEach(s => { s.selected = (s.id === data.selectedId); });

        saveSkinState(data);
        return data;
      }
    }
  }catch(e){}

  const skins = SKINS_DEF.map(s => ({
    id: s.id,
    key: s.key,
    name: s.name,
    price: s.price,
    owned: !!s.ownedByDefault,
    selected: false
  }));
  const selectedId = SKINS_DEF[0].id;
  const first = skins.find(s => s.id === selectedId);
  if (first) first.selected = true;
  const data = { skins, selectedId };
  saveSkinState(data);
  return data;
}

function saveSkinState(data){
  try {
    localStorage.setItem(SKINS_STORAGE_KEY, JSON.stringify(data));
  } catch(e){}
}

function getSelectedSkinKey(){
  const data = loadSkinState();
  const found = data.skins.find(s => s.id === data.selectedId && s.owned);
  if (found) return found.key;
  const def = SKINS_DEF[0];
  return def ? def.key : "borgy";
}

function selectSkin(id){
  const data = loadSkinState();
  const skin = data.skins.find(s => s.id === id && s.owned);
  if (!skin) return data;
  data.selectedId = id;
  data.skins.forEach(s => { s.selected = (s.id === id); });
  saveSkinState(data);
  return data;
}

// Essaie d'acheter un skin, renvoie { ok, reason, coinsLeft, data }
function tryBuySkin(id){
  const data = loadSkinState();
  const skin = data.skins.find(s => s.id === id);
  if (!skin) return { ok:false, reason:"unknown_skin", coinsLeft:loadBorgyCoins(), data };
  if (skin.owned){
    return { ok:true, reason:"already_owned", coinsLeft:loadBorgyCoins(), data };
  }
  const coins = loadBorgyCoins();
  if (coins < skin.price){
    return { ok:false, reason:"not_enough_coins", coinsLeft:coins, data };
  }
  const newCoins = coins - skin.price;
  saveBorgyCoins(newCoins);
  skin.owned = true;
  data.coinsSpent = (data.coinsSpent || 0) + skin.price;
  saveSkinState(data);
  return { ok:true, reason:"purchased", coinsLeft:newCoins, data };
}

// Retourne le rectangle utile (sans les marges transparentes) d'une image
function getVisibleBounds(img) {
  try {
    const w = img.width | 0;
    const h = img.height | 0;
    if (!w || !h) return null;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);

    const data = ctx.getImageData(0, 0, w, h).data;
    let minX = w, minY = h, maxX = -1, maxY = -1;
    const threshold = 10; // alpha > 10 = pixel visible

    for (let y = 0; y < h; y++) {
      let row = y * w * 4;
      for (let x = 0; x < w; x++) {
        const a = data[row + x * 4 + 3];
        if (a > threshold) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < minX || maxY < minY) return null;
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };

  } catch (e) {
    console.warn("getVisibleBounds error", e);
    return null;
  }
}

// Calcule un scale pour qu'un skin ait la même taille VISUELLE que le borgy de base
function computeSkinScale(textures, skinKey) {
  const baseKey = "borgy"; // borgy_ingame.png (sprite de référence)

  try {
    const baseTex = textures.get(baseKey);
    const curTex  = textures.get(skinKey);
    if (!baseTex || !curTex) return PLAYER_SCALE;

    const baseImg = baseTex.getSourceImage();
    const curImg  = curTex.getSourceImage();
    if (!baseImg || !curImg) return PLAYER_SCALE;

    const baseBounds = getVisibleBounds(baseImg);
    const curBounds  = getVisibleBounds(curImg);

    let ratio;
    if (baseBounds && curBounds) {
      ratio = (baseBounds.h || baseImg.height) / (curBounds.h || curImg.height);
    } else {
      ratio = baseImg.height / curImg.height;
    }

    let scale = PLAYER_SCALE * ratio;
    if (!Number.isFinite(scale)) scale = PLAYER_SCALE;

    scale = Phaser.Math.Clamp(scale, PLAYER_SCALE * 0.6, PLAYER_SCALE * 1.8);
    return scale;

  } catch (e) {
    console.warn("computeSkinScale error", e);
    return PLAYER_SCALE;
  }
}

/* ================== PRELOAD ================== */
class PreloadScene extends Phaser.Scene {
  constructor(){ super("preload"); }

  init(){
    const root = document.getElementById("game-root") || document.body;
    const vid = document.createElement("video");
    vid.src = "assets/intro.mp4";
    vid.autoplay = true; vid.loop = true; vid.muted = true; vid.playsInline = true;
    Object.assign(vid.style,{
      position:"absolute",left:"50%",top:"25%",transform:"translateX(-50%)",
      width:"62%",maxWidth:"520px",borderRadius:"14px",zIndex:"9999",pointerEvents:"none"
    });
    root.appendChild(vid); this._loadingVideoEl = vid;
  }

  preload(){
    const W = this.scale.width, H = this.scale.height;
    this.load.setPath("assets");

    // petite texture de flocon pour le mode Noël
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture("snow_flake", 8, 8);
    g.destroy();

    // Fonds
    this.load.image(BG_KEY,      "bg_mountains.png"); // <- PNG
    this.load.image(BG_HARD_KEY, "bg_volcano.png");
    this.load.image(BG_XMAS_KEY, "bg_noel.png");   // fond Noël

    // Nuages bande haut / bas
    this.load.image("cloud_top",    "cloud_top.png");
    this.load.image("cloud_bottom", "cloud_bottom.png");

    // Sprites & pipes
    this.load.image("borgy",       "borgy_ingame.png");
    this.load.image("pipe_top",    "pipe_light_top.png");
    this.load.image("pipe_bottom", "pipe_light_bottom.png");

    // Décorations de tuyaux pour le mode Noël
    this.load.image("pipe_bottom_snow", "pipe_bottom_snow.png");
    this.load.image("pipe_top_ice",     "pipe_top_ice.png");

    // Skins joueur
    this.load.image("borgy_knight",   "borgy_knight.png");
    this.load.image("borgy_dragon",   "borgy_dragon.png");
    this.load.image("borgy_space",    "borgy_space.png");
    this.load.image("borgy_cyber",    "borgy_cyber.png");
    this.load.image("borgy_cowboy",   "borgy_cowboy.png");
    this.load.image("borgy_gold",     "borgy_gold.png");
    this.load.image("borgy_emeraude", "borgy_emeraude.png");
    this.load.image("borgy_diamant",  "borgy_diamant.png");

    // Skin Noël
    this.load.image("borgy_xmas", "borgy_xmas.png");

    // Bonus visuels
    this.load.image("bonus_sb",   "sb_token_user.png");
    this.load.image("borgy_coin", "borgy_coin.png");

    // Robot SwissBorg (accroché aux tuyaux)
    this.load.image("sb_robot",      "sb_robot.png");
    this.load.image("sb_robot_xmas","sb_robot_xmas.png"); // version Noël

    // Audio normal
    this.load.audio("bgm", "bgm.mp3");
    this.load.audio("bgm_alt", "audio_a19c0824bd.mp3");
    // Audio HARD (au 1er tap)
    this.load.audio("bgm_hard", "turbulence-246380.mp3");

    // SFX
    this.load.audio("sfx_gameover", "flappy-borgy-game-over-C.wav");
    this.load.audio("sfx_score",    "flappy_borgy_wouf_chiot_0_2s.wav");
    this.load.audio("sfx_coin",     "jackpot_metal_realistic_0_5s.wav");

    // Barre de chargement
    const bgBar = this.add.rectangle(W/2, H*0.8, W*0.52, 12, 0x000000, 0.25).setOrigin(0.5);
    const fgBar = this.add.rectangle(W*0.24, H*0.8, 2, 12, 0x17a689).setOrigin(0,0.5);
    const pct   = this.add.text(W/2, H*0.8+26, "0%", {fontFamily:"monospace", fontSize:18, color:"#fff"}).setOrigin(0.5);
    this.load.on("progress", p => { fgBar.width = (W*0.52)*p; pct.setText(Math.round(p*100)+"%"); });
  }

  create(){
    if (this._loadingVideoEl) { this._loadingVideoEl.remove(); this._loadingVideoEl = null; }
    this.scene.start("menu");
  }
}

/* ================== MENU ================== */
class MenuScene extends Phaser.Scene {
  constructor(){ super("menu"); }

  create(){
    const W = this.scale.width, H = this.scale.height;
    const bg = this.add.image(W/2, H/2, BG_KEY).setDepth(-20);
    bg.setScale(Math.max(W/bg.width, H/bg.height)).setScrollFactor(0);

    ensureBgm(this);

    // --- init flag Noël depuis localStorage ---
    if (typeof this.game._xmasMode === "undefined") {
      try {
        this.game._xmasMode = JSON.parse(localStorage.getItem(XMAS_MODE_KEY) || "false");
      } catch {
        this.game._xmasMode = false;
      }
    }

    // Initialise la langue au démarrage
    currentLang();

    // === bouton langue EN/FR en haut à droite ===
    const langCode = currentLang(); // "fr" ou "en"
    const langLabel = (langCode === "fr") ? "EN" : "FR";

    const langBtn = this.add.text(
      W - 150,
      30,
      langLabel,
      {
        fontFamily: "monospace",
        fontSize: 26,
        color: "#ffffff",
        backgroundColor: "#0f766e",
        padding: { left: 10, right: 10, top: 4, bottom: 4 }
      }
    )
    .setOrigin(0.5)
    .setDepth(60)
    .setInteractive({ useHandCursor: true });

    langBtn.on("pointerdown", () => {
      const next = (currentLang() === "fr") ? "en" : "fr";
      setLang(next);
      this.scene.restart(); // recharge le menu dans la nouvelle langue
    });

    // --- bouton rond Noël en haut à gauche ---
    const xmasBtnRadius = 48;
    const xmasMargin = 32; // marge au bord de l’écran

    const xmasBtn = this.add.circle(
      xmasMargin + xmasBtnRadius,
      xmasMargin + xmasBtnRadius,
      xmasBtnRadius,
      this.game._xmasMode ? 0x15803d : 0x0f766e,
      0.96
    )
      .setDepth(60)
      .setInteractive({ useHandCursor: true });

    const xmasIcon = this.add.text(
      xmasBtn.x,
      xmasBtn.y,
      "🎄",
      {
        fontFamily: "monospace",
        fontSize: 40,
        color: "#ffffff"
      }
    )
      .setOrigin(0.5)
      .setDepth(61);

    const refreshXmasBtn = () => {
      xmasBtn.setFillStyle(this.game._xmasMode ? 0x15803d : 0x0f766e, 0.96);
      xmasIcon.setAlpha(this.game._xmasMode ? 1 : 0.8);
    };
    refreshXmasBtn();

    xmasBtn.on("pointerdown", () => {
      this.game._xmasMode = !this.game._xmasMode;
      localStorage.setItem(XMAS_MODE_KEY, JSON.stringify(this.game._xmasMode));
      refreshXmasBtn();
      this.tweens.add({
        targets: [xmasBtn, xmasIcon],
        scaleX: 1.1,
        scaleY: 1.1,
        yoyo: true,
        duration: 90
      });
    });

    const muteBtn = this.add.text(W - 60, 30, "🔊", { fontFamily:"monospace", fontSize:42, color:"#fff" })
      .setOrigin(0.5).setDepth(50).setInteractive({useHandCursor:true});
    if (typeof this.game._muted === "undefined") this.game._muted = false;
    else { muteBtn.setText(this.game._muted ? "🔇" : "🔊"); this.game._bgm?.setMute(this.game._muted); }
    muteBtn.on("pointerdown", () => {
      const s = this.game._bgm; const m = this.game._muted === true;
      s?.setMute(!m); this.game._muted = !m; muteBtn.setText(this.game._muted ? "🔇" : "🔊");
    });

    this.add.text(W/2, H*0.13, "FlappyBorgy", {
      fontFamily:"Georgia,serif",
      fontSize:64,
      color:"#0b4a44"
    }).setOrigin(0.5);

    const totalCoins = loadBorgyCoins();
    this.add.text(W/2, H*0.19, `${t("HUD_COINS")} ${totalCoins}`, {
      fontFamily:"monospace",
      fontSize:30,
      color:"#0b4a44"
    }).setOrigin(0.5);

    this.makeBtn(W/2, H*0.30, t("MENU_PLAY"),       () => this.scene.start("game"));

    // BOUTON LEADERBOARD → PAGINÉ + Scope
    this.makeBtn(W/2, H*0.38, t("MENU_LEADERBOARD"), () => {
      const isHard = this.game._hardMode === true;
      this.showLeaderboard(isHard);
    });

    this.makeBtn(W/2, H*0.46, t("MENU_QUESTS"),   () => this.showQuests());
    this.makeBtn(W/2, H*0.54, t("MENU_SHOP"), () => this.showShop());
    this.makeBtn(W/2, H*0.62, t("MENU_VOTE"), () => {
      const url = "https://lewk.com/vote/BorGY4ub2Fz4RLboGxnuxWdZts7EKhUTB624AFmfCgX";
      if (window.Telegram?.WebApp?.openLink) {
        window.Telegram.WebApp.openLink(url);
      } else {
        window.open(url, "_blank");
      }
    });
    this.makeBtn(W/2, H*0.70, t("MENU_BUY"), () => {
      const url = "https://borgysol.com/";
      if (window.Telegram?.WebApp?.openLink) {
        window.Telegram.WebApp.openLink(url);
      } else {
        window.open(url, "_blank");
      }
    });

    if (typeof this.game._hardMode === "undefined") {
      try { this.game._hardMode = JSON.parse(localStorage.getItem("flappy_borgy_hard") || "false"); }
      catch { this.game._hardMode = false; }
    }
    const hardBtn = this.makeBtn(
      W/2,
      H*0.78,
      this.game._hardMode ? t("MENU_HARD_ON") : t("MENU_HARD_OFF"),
      () => {
        this.game._hardMode = !this.game._hardMode;
        localStorage.setItem("flappy_borgy_hard", JSON.stringify(this.game._hardMode));
        hardBtn.setText(this.game._hardMode ? t("MENU_HARD_ON") : t("MENU_HARD_OFF"));
        hardBtn.setBackgroundColor(this.game._hardMode ? "#b91c1c" : "#12a38a");
      }
    );
    hardBtn.setBackgroundColor(this.game._hardMode ? "#b91c1c" : "#12a38a");

    this.add.text(W/2, H*0.92, t("FOOTER_TIP"),
      { fontFamily:"monospace", fontSize:22, color:"#0b4a44", align:"center" }).setOrigin(0.5);

    // Popup de bienvenue — 1 fois par session (et stockable si tu veux utiliser WELCOME_POPUP_KEY plus tard)
    if (!welcomeShownThisSession) {
      this.showWelcomePopup();
      welcomeShownThisSession = true;
    }
  }

  makeBtn(x,y,label,cb){
    const ttxt = this.add.text(x,y,label,{
      fontFamily:"monospace",
      fontSize:34,
      color:"#fff",
      backgroundColor:"#12a38a",
      padding:{left:18,right:18,top:10,bottom:10}
    })
      .setOrigin(0.5)
      .setInteractive({useHandCursor:true});
    ttxt.on("pointerover", ()=> ttxt.setBackgroundColor("#0f8e78"));
    ttxt.on("pointerout",  ()=> ttxt.setBackgroundColor("#12a38a"));
    ttxt.on("pointerdown", cb);
    return ttxt;
  }

  // LEADERBOARD paginé dans le menu
  showLeaderboard(isHard = false) {
    const W = this.scale.width;
    const H = this.scale.height;
    const depth = 500;

    const elements = [];
    const rows = [];
    let currentPage = 1;
    let currentScope = "all"; // "all" | "week" | "month"

    const panel = this.add
      .rectangle(W / 2, H * 0.5, W * 0.78, H * 0.6, 0x0a2a2f, 0.92)
      .setDepth(depth);
    elements.push(panel);

    const titleText = isHard ? t("LEADERBOARD_TITLE_HARD") : t("LEADERBOARD_TITLE");
    const title = this.add
      .text(W / 2, H * 0.18, titleText, {
        fontFamily: "Georgia,serif",
        fontSize: 60,
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setDepth(depth + 1);
    elements.push(title);

    const pageLabel = this.add
      .text(W / 2, H * 0.24, `${t("LEADERBOARD_PAGE_LABEL")} 1`, {
        fontFamily: "monospace",
        fontSize: 24,
        color: "#cffff1",
      })
      .setOrigin(0.5)
      .setDepth(depth + 1);
    elements.push(pageLabel);

    // Boutons scope : Global / Semaine / Mois
    const scopeY = H * 0.28;

    const btnGlobal = this.add.text(W * 0.30, scopeY, t("LEADERBOARD_SCOPE_GLOBAL"), {
      fontFamily: "monospace",
      fontSize: 24,
      color: "#fff",
      backgroundColor: "#0db187",
      padding: { left: 10, right: 10, top: 6, bottom: 6 },
    }).setOrigin(0.5).setDepth(depth + 1).setInteractive({ useHandCursor: true });
    elements.push(btnGlobal);

    const btnWeek = this.add.text(W * 0.50, scopeY, t("LEADERBOARD_SCOPE_WEEK"), {
      fontFamily: "monospace",
      fontSize: 24,
      color: "#fff",
      backgroundColor: "#0a4d8a",
      padding: { left: 10, right: 10, top: 6, bottom: 6 },
    }).setOrigin(0.5).setDepth(depth + 1).setInteractive({ useHandCursor: true });
    elements.push(btnWeek);

    const btnMonth = this.add.text(W * 0.70, scopeY, t("LEADERBOARD_SCOPE_MONTH"), {
      fontFamily: "monospace",
      fontSize: 24,
      color: "#fff",
      backgroundColor: "#0a4d8a",
      padding: { left: 10, right: 10, top: 6, bottom: 6 },
    }).setOrigin(0.5).setDepth(depth + 1).setInteractive({ useHandCursor: true });
    elements.push(btnMonth);

    const refreshScopeButtons = () => {
      const onColor  = "#0db187";
      const offColor = "#0a4d8a";

      btnGlobal.setBackgroundColor(currentScope === "all"   ? onColor : offColor);
      btnWeek.setBackgroundColor(  currentScope === "week"  ? onColor : offColor);
      btnMonth.setBackgroundColor( currentScope === "month" ? onColor : offColor);
    };
    refreshScopeButtons();

    const colX = W * 0.23;
    const startY = H * 0.34;
    const lineH = 56;

    const close = this.add
      .text(W / 2, H * 0.82, t("COMMON_CLOSE"), {
        fontFamily: "monospace",
        fontSize: 44,
        color: "#fff",
        backgroundColor: "#0db187",
        padding: { left: 22, right: 22, top: 8, bottom: 8 },
      })
      .setOrigin(0.5)
      .setDepth(depth + 1)
      .setInteractive({ useHandCursor: true });
    elements.push(close);

    const prevBtn = this.add
      .text(W * 0.28, H * 0.82, "◀", {
        fontFamily: "monospace",
        fontSize: 40,
        color: "#fff",
        backgroundColor: "#0a8ea1",
        padding: { left: 18, right: 18, top: 8, bottom: 8 },
      })
      .setOrigin(0.5)
      .setDepth(depth + 1)
      .setInteractive({ useHandCursor: true });
    elements.push(prevBtn);

    const nextBtn = this.add
      .text(W * 0.72, H * 0.82, "▶", {
        fontFamily: "monospace",
        fontSize: 40,
        color: "#fff",
        backgroundColor: "#0a8ea1",
        padding: { left: 18, right: 18, top: 8, bottom: 8 },
      })
      .setOrigin(0.5)
      .setDepth(depth + 1)
      .setInteractive({ useHandCursor: true });
    elements.push(nextBtn);

    const destroyAll = () => {
      rows.forEach((r) => {
        try { r.destroy(); } catch (e) {}
      });
      elements.forEach((el) => {
        try { el.destroy(); } catch (e) {}
      });
    };

    close.on("pointerdown", destroyAll);

    const refreshButtonsState = (listLength) => {
      if (currentPage <= 1) {
        prevBtn.disableInteractive();
        prevBtn.setAlpha(0.4);
      } else {
        prevBtn.setInteractive({ useHandCursor: true });
        prevBtn.setAlpha(1);
      }

      if (listLength < 10) {
        nextBtn.disableInteractive();
        nextBtn.setAlpha(0.4);
      } else {
        nextBtn.setInteractive({ useHandCursor: true });
        nextBtn.setAlpha(1);
      }
    };

    const loadPage = async (page) => {
      const list = await fetchLeaderboard(10, isHard, page, currentScope);

      rows.forEach((r) => {
        try { r.destroy(); } catch (e) {}
      });
      rows.length = 0;

      currentPage = page;
      pageLabel.setText(`${t("LEADERBOARD_PAGE_LABEL")} ${page}`);

      list.slice(0, 10).forEach((row, i) => {
        const y = startY + i * lineH;

        const rankTxt = this.add
          .text(
            colX,
            y,
            String((page - 1) * 10 + i + 1).padStart(2, "0") + ".",
            { fontFamily: "monospace", fontSize: 36, color: "#bff" }
          )
          .setDepth(depth + 1)
          .setOrigin(0, 0.5);

        const nameTxt = this.add
          .text(colX + 70, y, row.name || "Player", {
            fontFamily: "monospace",
            fontSize: 36,
            color: "#fff",
          })
          .setDepth(depth + 1)
          .setOrigin(0, 0.5);

        const scoreTxt = this.add
          .text(W * 0.72, y, String(row.best), {
            fontFamily: "monospace",
            fontSize: 36,
            color: "#cffff1",
          })
          .setDepth(depth + 1)
          .setOrigin(1, 0.5);

        rows.push(rankTxt, nameTxt, scoreTxt);
      });

      refreshButtonsState(list.length);
    };

    prevBtn.on("pointerdown", () => {
      if (currentPage > 1) loadPage(currentPage - 1);
    });

    nextBtn.on("pointerdown", () => {
      loadPage(currentPage + 1);
    });

    btnGlobal.on("pointerdown", () => {
      currentScope = "all";
      refreshScopeButtons();
      loadPage(1);
    });
    btnWeek.on("pointerdown", () => {
      currentScope = "week";
      refreshScopeButtons();
      loadPage(1);
    });
    btnMonth.on("pointerdown", () => {
      currentScope = "month";
      refreshScopeButtons();
      loadPage(1);
    });

    loadPage(1);
  }

  showQuests(){
    const data = loadQuests();
    const W = this.scale.width, H = this.scale.height; const depth = 700;

    const isHard = this.game._hardMode === true;
    const totalAfter = applyQuestCoins(data, isHard);

    const panel = this.add.rectangle(W/2, H*0.5, W*0.82, H*0.58, 0x062b35, 0.94).setDepth(depth);
    const title = this.add.text(W/2, H*0.26, t("QUESTS_TITLE"), { fontFamily:"Georgia,serif", fontSize:60, color:"#ffffff" })
      .setOrigin(0.5).setDepth(depth+1);
    this.add.text(W/2, H*0.30, isHard ? t("QUESTS_HARD_HINT") : "", {
      fontFamily:"monospace", fontSize:20, color:"#ffe9a6"
    }).setOrigin(0.5).setDepth(depth+1);

    const startY = H*0.34, lineH = 72;
    data.quests.forEach((q, i) => {
      const y = startY + i*lineH; const pct = Math.min(1, q.progress / q.target);
      this.add.text(W*0.14, y, q.title, { fontFamily:"monospace", fontSize:30, color:q.done ? "#b3ffcf" : "#fff" })
        .setOrigin(0,0.5).setDepth(depth+1);
      const barW=W*0.38, barX=W*0.54;
      this.add.rectangle(barX, y, barW, 12, 0xffffff, 0.15).setOrigin(0,0.5).setDepth(depth+1);
      this.add.rectangle(barX, y, barW*pct, 12, q.done ? 0x15b665 : 0x17a689, 1).setOrigin(0,0.5).setDepth(depth+1);
      this.add.text(W*0.93, y, `${Math.min(q.progress, q.target)}/${q.target}`, { fontFamily:"monospace", fontSize:24, color:"#fff" })
        .setOrigin(1,0.5).setDepth(depth+1);
      const rewardTxt = isHard ? `${q.reward} (x2)` : q.reward;
      this.add.text(W*0.14, y+28, `${t("QUESTS_REWARD_LABEL")} ${rewardTxt}`, { fontFamily:"monospace", fontSize:18, color:"#c3ede5" })
        .setOrigin(0,0.5).setDepth(depth+1);
    });

    // total coins un peu plus haut pour laisser la place au défi du jour
    this.add.text(W/2, H*0.66, `${t("QUESTS_TOTAL_COINS")} ${totalAfter} 🪙`, {
      fontFamily:"monospace", fontSize:26, color:"#cffff1"
    }).setOrigin(0.5).setDepth(depth+1);

    // 🔥 Daily challenge : affichage dans le popup Quêtes
    const daily = loadDailyChallenge();
    const bestToday = daily.bestScore || 0;
    this.add.text(W/2, H*0.72, `${t("DAILY_BEST")} ${bestToday}`, {
      fontFamily:"monospace", fontSize:22, color:"#e5f2ff"
    }).setOrigin(0.5).setDepth(depth+1);

    const rewardStr = daily.rewardGiven ? t("DAILY_DONE") : t("DAILY_REWARD");
    this.add.text(W/2, H*0.76, rewardStr, {
      fontFamily:"monospace", fontSize:18, color:"#d1fae5"
    }).setOrigin(0.5).setDepth(depth+1);

    const close = this.add.text(W/2, H*0.78, t("COMMON_CLOSE"), { fontFamily:"monospace", fontSize:40, color:"#fff",
      backgroundColor:"#0db187", padding:{left:26,right:26,top:10,bottom:10} })
      .setOrigin(0.5).setDepth(depth+1).setInteractive({useHandCursor:true});
    const destroyAll = () => [panel, title, close, ...this.children.list.filter(o => o.depth>=depth && !o.input)]
      .forEach(o => o?.destroy());
    close.on("pointerdown", destroyAll);
  }

  // SHOP avec bouton Fermer
  showShop(){
    const W = this.scale.width;
    const H = this.scale.height;
    const depth = 650;

    // On crédite d’abord les récompenses de quêtes, au cas où
    try {
      const dataQ = loadQuests();
      const isHard = this.game._hardMode === true;
      applyQuestCoins(dataQ, isHard);
    } catch (e) {
      console.warn("Quest reward error in shop:", e);
    }

    const elements = [];

    const overlay = this.add.rectangle(W/2, H/2, W, H, 0x000000, 0.45)
      .setDepth(depth)
      .setInteractive();
    elements.push(overlay);

    const panel = this.add.rectangle(W/2, H*0.5, W*0.8, H*0.55, 0x05252f, 0.96)
      .setDepth(depth+1);
    elements.push(panel);

    const title = this.add.text(W/2, H*0.26, t("SHOP_TITLE"), {
      fontFamily: "Georgia,serif",
      fontSize: 54,
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(depth+2);
    elements.push(title);

    const coinsText = this.add.text(W*0.5, H*0.33, "", {
      fontFamily: "monospace",
      fontSize: 30,
      color: "#cffff1",
      align: "center"
    }).setOrigin(0.5).setDepth(depth+2);
    elements.push(coinsText);

    const infoText = this.add.text(W*0.5, H*0.38, t("SHOP_CHOOSE_SKIN"), {
      fontFamily: "monospace",
      fontSize: 22,
      color: "#9be7ff",
      align: "center"
    }).setOrigin(0.5).setDepth(depth+2);
    elements.push(infoText);

    let skinState = loadSkinState();
    const buttonsById = {};
    const startY = H * 0.42;
    const lineH  = 64;

    const refreshCoinsText = () => {
      const coinsNow = loadBorgyCoins() || 0;
      coinsText.setText(`${t("SHOP_CURRENT_COINS")} ${coinsNow} 🪙`);
    };

    const refreshButtons = () => {
      try {
        skinState = loadSkinState();
        refreshCoinsText();
        if (!skinState || !Array.isArray(skinState.skins)) return;

        skinState.skins.forEach(skin => {
          const btn = buttonsById[skin.id];
          if (!btn) return;
          if (!skin.owned) {
            btn.setText(t("SHOP_BTN_BUY"));
            btn.setBackgroundColor("#b45309");
          } else if (skinState.selectedId === skin.id) {
            btn.setText(t("SHOP_BTN_SELECTED"));
            btn.setBackgroundColor("#15803d");
          } else {
            btn.setText(t("SHOP_BTN_USE"));
            btn.setBackgroundColor("#0db187");
          }
        });
      } catch (e) {
        console.warn("refreshButtons error:", e);
      }
    };

    if (skinState && Array.isArray(skinState.skins)) {
      skinState.skins.forEach((skin, i) => {
        const y = startY + i * lineH;
        const priceStr = skin.price === 0 ? t("SHOP_PRICE_FREE") : `${skin.price} 🪙`;

        const nameTxt = this.add.text(W*0.16, y, skin.name, {
          fontFamily: "monospace",
          fontSize: 26,
          color: "#ffffff"
        }).setOrigin(0, 0.5).setDepth(depth+2);
        elements.push(nameTxt);

        const priceTxt = this.add.text(W*0.60, y, priceStr, {
          fontFamily: "monospace",
          fontSize: 22,
          color: "#ffedd5"
        }).setOrigin(1, 0.5).setDepth(depth+2);
        elements.push(priceTxt);

        const btn = this.add.text(W*0.62, y, "...", {
          fontFamily: "monospace",
          fontSize: 22,
          color: "#ffffff",
          backgroundColor: "#b45309",
          padding: { left: 14, right: 14, top: 6, bottom: 6 }
        }).setOrigin(0, 0.5).setDepth(depth+2).setInteractive({ useHandCursor: true });
        elements.push(btn);

        buttonsById[skin.id] = btn;

        btn.on("pointerdown", () => {
          try {
            const state = loadSkinState();
            if (!state || !Array.isArray(state.skins)) return;
            const s = state.skins.find(ss => ss.id === skin.id);
            if (!s) return;

            if (!s.owned) {
              const res = tryBuySkin(skin.id);
              if (!res.ok && res.reason === "not_enough_coins") {
                const warn = this.add.text(W*0.5, H*0.64, t("SHOP_NOT_ENOUGH_COINS"), {
                  fontFamily: "monospace",
                  fontSize: 22,
                  color: "#ffb4b4",
                  backgroundColor: "#7f1d1d",
                  padding: { left: 16, right: 16, top: 6, bottom: 6 }
                }).setOrigin(0.5).setDepth(depth+3);
                elements.push(warn);
                this.tweens.add({
                  targets: warn,
                  alpha: 0,
                  duration: 1200,
                  delay: 900,
                  onComplete: () => { try { warn.destroy(); } catch(e){} }
                });
                return;
              }
              selectSkin(skin.id);
            } else {
              selectSkin(skin.id);
            }

            refreshButtons();
          } catch (e) {
            console.warn("click skin error:", e);
          }
        });

        let noteLabel = "";
        if (skin.id === "borgy_gold") {
          noteLabel = t("SHOP_PERK_GOLD");
        } else if (skin.id === "borgy_emeraude") {
          noteLabel = t("SHOP_PERK_EMERALD");
        } else if (skin.id === "borgy_diamant") {
          noteLabel = t("SHOP_PERK_DIAMOND");
        }

        if (noteLabel) {
          const noteTxt = this.add.text(
            W * 0.16,
            y + 22,
            noteLabel,
            {
              fontFamily: "monospace",
              fontSize: 18,
              color: "#e5f2ff"
            }
          ).setOrigin(0, 0.5).setDepth(depth+2);
          elements.push(noteTxt);
        }
      });
    }

    refreshButtons();

    const close = this.add.text(W/2, H*0.82, t("COMMON_CLOSE"), {
      fontFamily: "monospace",
      fontSize: 40,
      color: "#fff",
      backgroundColor: "#0db187",
      padding: { left: 26, right: 26, top: 10, bottom: 10 }
    }).setOrigin(0.5).setDepth(depth+2).setInteractive({ useHandCursor: true });
    elements.push(close);

    const destroyAll = () => {
      elements.forEach(el => { try { el.destroy(); } catch(e){} });
    };

    close.on("pointerdown", destroyAll);
    overlay.on("pointerdown", destroyAll);
  }

  // === Popup de bienvenue centré & lisible ===
  showWelcomePopup(){
    const W = this.scale.width;
    const H = this.scale.height;
    const depthOverlay = 880;
    const depthPanel   = 890;

    const displayWidth  = this.scale.displaySize ? this.scale.displaySize.width  : (window.innerWidth  || W);
    const displayHeight = this.scale.displaySize ? this.scale.displaySize.height : (window.innerHeight || H);
    const isMobileLike  = displayWidth < 800 || displayHeight > displayWidth;

    const panelWidth  = isMobileLike ? W * 0.90 : W * 0.80;
    const panelHeight = isMobileLike ? H * 0.82 : H * 0.72;

    const titleFontSize  = isMobileLike ? 36 : 40;
    const bodyFontSize   = isMobileLike ? 20 : 22;
    const endFontSize    = isMobileLike ? 20 : 22;
    const buttonFontSize = isMobileLike ? 28 : 30;

    const contentWidth = panelWidth * 0.78;
    const contentLeft  = W/2 - contentWidth/2;

    const iconSize = isMobileLike ? W * 0.07 : W * 0.06;
    const iconX    = contentLeft - iconSize * 0.6;

    const elements = [];

    const overlay = this.add.rectangle(W/2, H/2, W, H, 0x000000, 0.55)
      .setDepth(depthOverlay)
      .setInteractive();
    elements.push(overlay);

    const panel = this.add.rectangle(W/2, H/2, panelWidth, panelHeight, 0x08313a, 0.96)
      .setDepth(depthPanel);
    elements.push(panel);

    // === bouton de langue sur la popup ===
    const popupLangLabel = (currentLang() === "fr")
      ? I18N.fr.LANG_BTN_EN
      : I18N.en.LANG_BTN_FR;

    const popupLangBtn = this.add.text(
      W/2,
      H/2 - panelHeight * 0.44,
      popupLangLabel,
      {
        fontFamily: "monospace",
        fontSize: 24,
        color: "#ffffff",
        backgroundColor: "#0f766e",
        padding: { left: 10, right: 10, top: 4, bottom: 4 }
      }
    )
    .setOrigin(0.5)
    .setDepth(depthPanel+2)
    .setInteractive({ useHandCursor: true });
    elements.push(popupLangBtn);

    popupLangBtn.on("pointerdown", () => {
      const next = (currentLang() === "fr") ? "en" : "fr";
      setLang(next);
      elements.forEach(el => { try { el.destroy(); } catch(e){} });
      this.showWelcomePopup(); // recrée la popup dans la nouvelle langue
    });

    const title = this.add.text(
      W/2,
      H/2 - panelHeight * 0.38,
      t("WELCOME_TITLE"),
      {
        fontFamily: "Georgia,serif",
        fontSize: titleFontSize,
        color: "#ffffff",
        align: "center",
        wordWrap: { width: panelWidth * 0.9 }
      }
    ).setOrigin(0.5).setDepth(depthPanel+1);
    elements.push(title);

    let y = H/2 - panelHeight * 0.24;

    const mkBody = (text, extraSpace = 14) => {
      const ttxt = this.add.text(
        contentLeft,
        y,
        text,
        {
          fontFamily:"monospace",
          fontSize:bodyFontSize,
          color:"#e6fef9",
          align:"left",
          wordWrap:{ width: contentWidth }
        }
      ).setOrigin(0,0).setDepth(depthPanel+1);
      elements.push(ttxt);
      y += ttxt.height + extraSpace;
      return ttxt;
    };

    mkBody(t("WELCOME_L1"), 18);
    mkBody(t("WELCOME_L2"), 18);

    const txtCoins = mkBody(t("WELCOME_L3"), 18);
    const coinIcon = this.add.image(
      iconX,
      txtCoins.y + 6,
      "borgy_coin"
    ).setOrigin(0.5,0).setDepth(depthPanel+2);
    coinIcon.setDisplaySize(iconSize, iconSize);
    elements.push(coinIcon);

    mkBody(t("WELCOME_L4"), 18);

    const txtBonus = mkBody(t("WELCOME_L5"), 18);
    const bonusIcon = this.add.image(
      iconX,
      txtBonus.y + 10,
      "bonus_sb"
    ).setOrigin(0.5,0).setDepth(depthPanel+2);
    bonusIcon.setDisplaySize(iconSize * 0.9, iconSize * 0.9);
    elements.push(bonusIcon);

    const txtRobot = mkBody(t("WELCOME_L6"), 18);
    const robotIcon = this.add.image(
      iconX,
      txtRobot.y + 4,
      "sb_robot"
    ).setOrigin(0.5,0).setDepth(depthPanel+2);
    robotIcon.setDisplaySize(iconSize * 0.9, iconSize * 1.2);
    elements.push(robotIcon);

    mkBody(t("WELCOME_L7"), 10);

    const txtEnd = this.add.text(
      contentLeft,
      y + 10,
      t("WELCOME_END"),
      {
        fontFamily: "monospace",
        fontSize: endFontSize,
        color: "#f5fffb",
        align: "left",
        wordWrap: { width: contentWidth }
      }
    ).setOrigin(0,0).setDepth(depthPanel+1);
    elements.push(txtEnd);

    const buttonY = Math.min(
      H/2 + panelHeight * 0.34,
      txtEnd.y + txtEnd.height + 70
    );

    const okBtn = this.add.text(
      W/2,
      buttonY,
      t("WELCOME_OK"),
      {
        fontFamily:"monospace",
        fontSize:buttonFontSize,
        color:"#ffffff",
        backgroundColor:"#0db187",
        padding:{left:24,right:24,top:10,bottom:10}
      }
    ).setOrigin(0.5).setDepth(depthPanel+2).setInteractive({useHandCursor:true});
    elements.push(okBtn);

    const closePopup = () => {
      elements.forEach(el => { try { el.destroy(); } catch(e){} });
    };

    okBtn.on("pointerdown", closePopup);
    overlay.on("pointerdown", closePopup);
  }
}

/* ================== GAME ================== */
class GameScene extends Phaser.Scene {
  constructor(){ super("game"); }

  init(){
    this.started = false; this.isOver  = false;
    this.score = 0; this.pairsSpawned = 0;
    this.pipes = null; this.sensors = null;
    this.bonuses = null; this.borgyCoins = null;
    this.bots = null;
    this.pipeDecor = null;
    this.nextSpawnAt = Infinity; this.lastSpawnMs = -1;
    this.curSpeed = PROFILE.pipeSpeed; this.curDelay = PROFILE.spawnDelay;
    this.curGap   = PROFILE.gap;
    this.DEBUG = false; this.debugTxt = null;

    this.multiplierActive = false;
    this.multiplierUntil = 0;
    this.bonusFollower = null;

    this.borgyCoinCount = loadBorgyCoins();
    this.nextCoinAt = Phaser.Math.Between(3, 7);

    this._stormBaseTopTint = null;
    this._stormBaseBottomTint = null;

    this.skinIsGold = false;
    this.skinIsEmerald = false;
    this.skinIsDiamond = false;
    this.canRevive = false;
    this.isInvincible = false;

    this.pipePairs = [];
    this.scoreSpeedStep = 0;
    this.scoreGapStep = 0;

    this.isXmasMode = false;

    // flag pour annuler l'affichage du leaderboard si le joueur relance/quitte
    this._cancelLeaderboard = false;
  }

  create(){
    const W = this.scale.width, H = this.scale.height;

    const isHard  = this.game._hardMode === true;
    const isXmas  = this.game._xmasMode === true;

    this.isXmasMode = isXmas;

    // priorité : Noël > Hard > Normal
    let keyWanted;
    if (isXmas)      keyWanted = BG_XMAS_KEY;
    else if (isHard) keyWanted = BG_HARD_KEY;
    else             keyWanted = BG_KEY;

    const hasKey = this.textures.exists(keyWanted);
    const bg = this.add.image(W/2, H/2, hasKey ? keyWanted : BG_KEY).setDepth(-10);
    bg.setScale(Math.max(W/bg.width, H/bg.height)).setScrollFactor(0);
    this.cameras.main.roundPixels = true;

    // Effet de neige si mode Noël
    if (isXmas && this.textures.exists("snow_flake")) {
      const emitter = this.add.particles(0, 0, "snow_flake", {
        x: { min: 0, max: W },
        y: -10,
        lifespan: 4000,
        speedY: { min: 60, max: 120 },
        scale: { start: 0.7, end: 0.3 },
        quantity: 3,
        frequency: 120,
        angle: { min: 80, max: 100 }
      });

      emitter.setDepth(9);
    }

    // Nuages haut / bas (murs)
    {
      const topCloudHeight    = H * CLOUD_TOP_HEIGHT_PCT;
      const bottomCloudHeight = H * CLOUD_BOTTOM_HEIGHT_PCT;

      const topCloudVisualHeight    = topCloudHeight * 1.6;
      const bottomCloudVisualHeight = bottomCloudHeight * 1.8;

      const topCloudY = topCloudHeight - topCloudVisualHeight / 2;
      this.topCloud = this.add.image(
        W / 2,
        topCloudY,
        "cloud_top"
      ).setDepth(5);

      const topScaleX = (W * CLOUD_EXTRA_SCALE_X) / this.topCloud.width;
      const topScaleY = topCloudVisualHeight / this.topCloud.height;
      this.topCloud.setScale(topScaleX, topScaleY);

      const bottomCloudY = H - bottomCloudHeight + bottomCloudVisualHeight / 2;
      this.bottomCloud = this.add.image(
        W / 2,
        bottomCloudY,
        "cloud_bottom"
      ).setDepth(5);

      const bottomScaleX = (W * CLOUD_EXTRA_SCALE_X) / this.bottomCloud.width;
      const bottomScaleY = bottomCloudVisualHeight / this.bottomCloud.height;
      this.bottomCloud.setScale(bottomScaleX, bottomScaleY);

      this.physics.add.existing(this.topCloud, true);
      this.physics.add.existing(this.bottomCloud, true);

      this.topCloud.body.setSize(W * CLOUD_EXTRA_SCALE_X, topCloudHeight, true);
      this.topCloud.body.setOffset(-W * (CLOUD_EXTRA_SCALE_X - 1) / 2, 0);

      // Hitbox du nuage du bas : on la décale légèrement vers le bas
      this.bottomCloud.body.setSize(W * CLOUD_EXTRA_SCALE_X, bottomCloudHeight, true);
      this.bottomCloud.body.setOffset(
        -W * (CLOUD_EXTRA_SCALE_X - 1) / 2,
        BOTTOM_CLOUD_HITBOX_OFFSET_PX   // 🔥 descend le mur invisible
      );

      if (isHard) {
        this._stormBaseTopTint    = 0x4b5563;
        this._stormBaseBottomTint = 0x111827;

        this.topCloud.setTint(this._stormBaseTopTint);
        this.bottomCloud.setTint(this._stormBaseBottomTint);

        this.time.addEvent({
          delay: 4200,
          loop: true,
          callback: () => {
            if (this.isOver) return;
            if (Phaser.Math.Between(0, 100) < 30) {
              this._flashStormClouds();
            }
          }
        });
      }
    }

    if (isHard) {
      this.curSpeed = PROFILE.pipeSpeed - 60;
      this.curDelay = PROFILE.spawnDelay - 500;
      this.curGap   = Math.max(120, PROFILE.gap - 40);
    }

    this.pipes      = this.physics.add.group();
    this.sensors    = this.physics.add.group();
    this.bonuses    = this.physics.add.group();
    this.borgyCoins = this.physics.add.group();
    this.bots       = this.physics.add.group();
    this.pipeDecor  = this.physics.add.group();

    this.inputZone = this.add.zone(0,0,W,H).setOrigin(0,0).setInteractive();
    this.inputZone.on("pointerdown", () => this.onTap());
    this.input.keyboard.on("keydown-SPACE", () => this.onTap());

    this.scoreText = this.add.text(24, 18, `${t("HUD_SCORE")} 0`,
      { fontFamily:"monospace", fontSize:46, color:"#fff", stroke:"#0a3a38", strokeThickness:8 }).setDepth(20);

    this.borgyCoinText = this.add.text(W-24, 18, `🪙 ${this.borgyCoinCount}`, {
      fontFamily:"monospace", fontSize:36, color:"#fff", stroke:"#0a3a38", strokeThickness:6
    }).setOrigin(1,0).setDepth(20);

    if (this.DEBUG){
      this.debugTxt = this.add.text(16, 64, "", { fontFamily:"monospace", fontSize: 16, color: "#bff" }).setDepth(20);
    }

    // Sélection du skin + override Noël gratuit
    let skinKey = getSelectedSkinKey();
    if (isXmas && this.textures.exists("borgy_xmas")) {
      skinKey = "borgy_xmas"; // skin Noël utilisé uniquement en mode Noël, gratuit
    }

    this.skinIsGold = (skinKey === "borgy_gold");
    this.skinIsEmerald = (skinKey === "borgy_emeraude");
    this.skinIsDiamond = (skinKey === "borgy_diamant");
    this.canRevive = this.skinIsDiamond;

    const finalScale = computeSkinScale(this.textures, skinKey);

    function applyStandardBorgyHitbox(sprite, textures, skinKey) {
      try {
        if (!sprite || !sprite.body) return;

        const tex = textures.get(skinKey);
        if (!tex) return;
        const img = tex.getSourceImage?.();
        if (!img) return;

        const bounds = getVisibleBounds(img);
        if (!bounds) return;

        const s = sprite.scaleX || 1;

        const shrinkX    = 0.60;
        const shrinkY    = 0.60;
        const downFactor = 0.06;

        const visW = bounds.w * s;
        const visH = bounds.h * s;

        const boxW_world = visW * shrinkX;
        const boxH_world = visH * shrinkY;

        const boxX_world = (bounds.x * s) + (visW - boxW_world) / 2;
        const boxY_world = (bounds.y * s) + (visH - boxH_world) / 2 + visH * downFactor;

        const invScaleX = 1 / (sprite.scaleX || 1);
        const invScaleY = 1 / (sprite.scaleY || 1);

        const boxW_local = boxW_world * invScaleX;
        const boxH_local = boxH_world * invScaleY;
        const boxX_local = boxX_world * invScaleX;
        const boxY_local = boxY_world * invScaleY;

        sprite.body.setSize(boxW_local, boxH_local, false);
        sprite.body.setOffset(boxX_local, boxY_local);

      } catch (e) {
        console.warn("applyStandardBorgyHitbox error", e);
      }
    }

    // === création du joueur ===
    this.player = this.physics.add.sprite(
      W * 0.18,
      H * ((PLAYFIELD_TOP_PCT + PLAYFIELD_BOT_PCT) / 2),
      skinKey
    )
      .setScale(finalScale)
      .setDepth(10)
      .setCollideWorldBounds(true);

    // hitbox standard
    this.player.body.setAllowGravity(false);
    applyStandardBorgyHitbox(this.player, this.textures, skinKey);
    this.player.setGravityY(0);

    this.sfxGameOver = this.sound.add("sfx_gameover", { volume: 0.75 });
    this.sfxScore    = this.sound.add("sfx_score",    { volume: 0.6 });
    this.sfxCoin     = this.sound.add("sfx_coin",     { volume: 0.7 });

    this.physics.add.overlap(this.player, this.topCloud,    () => this.gameOver(), null, this);
    this.physics.add.overlap(this.player, this.bottomCloud, () => this.gameOver(), null, this);

    if (ENABLE_KILL_BANDS){
      const topBand = Math.round(H * PLAYFIELD_TOP_PCT);
      const botBand = Math.round(H * PLAYFIELD_BOT_PCT);
      this.killTop = this.add.rectangle(W/2, topBand/2, W, topBand, 0, 0).setDepth(0);
      this.physics.add.existing(this.killTop, true);
      this.killBottom = this.add.rectangle(W/2, (H + botBand)/2, W, H - botBand, 0, 0).setDepth(0);
      this.physics.add.existing(this.killBottom, true);
      this.physics.add.overlap(this.player, this.killTop,    () => this.gameOver(), null, this);
      this.physics.add.overlap(this.player, this.killBottom, () => this.gameOver(), null, this);
    }

    this.physics.add.overlap(this.player, this.pipes,   () => this.gameOver(), null, this);
    this.physics.add.overlap(this.player, this.sensors, (_p, sensor) => {
      if (this.isOver || !sensor.active || !sensor.isScore) return;
      sensor.isScore = false; sensor.destroy(); this.addScore(1);
    }, null, this);
    this.physics.add.overlap(this.player, this.bonuses, (_p, bonus) => {
      if (!bonus.active) return; bonus.destroy(); this.activateMultiplier(); updateQuestsFromEvent("bonus", 1);
    }, null, this);
    this.physics.add.overlap(
      this.player,
      this.borgyCoins,
      this.handleBorgyCoinOverlap,
      null,
      this
    );

    // Robot SwissBorg : collision létale
    this.physics.add.overlap(
      this.player,
      this.bots,
      () => this.gameOver(),
      null,
      this
    );

    this.time.addEvent({
      delay: DIFF.stepMs,
      loop: true,
      callback: () => {
        this.curSpeed = Math.max(DIFF.minSpeed, this.curSpeed + DIFF.speedDelta);
        this.curDelay = Math.max(DIFF.minDelay, this.curDelay + DIFF.delayDelta);
        if (this.started) {
          const effDelay = this._getSpawnDelay();
          this.nextSpawnAt = Math.max(this.time.now + effDelay, this.nextSpawnAt);
          this._forceVelocities();
        }
      }
    });
  }

  _forceVelocities(){
    this.pipes.children.iterate(p => { if (p?.body) p.body.setVelocityX(this.curSpeed); });
    this.sensors.children.iterate(s => { if (s?.body) s.body.setVelocityX(this.curSpeed); });
    this.bonuses.children.iterate(b => { if (b?.body) b.body.setVelocityX(this.curSpeed); });
    this.borgyCoins.children.iterate(c => { if (c?.body) c.body.setVelocityX(this.curSpeed); });
    this.bots.children.iterate(b => { if (b?.body) b.body.setVelocityX(this.curSpeed); });
    if (this.pipeDecor) {
      this.pipeDecor.children.iterate(d => { if (d?.body) d.body.setVelocityX(this.curSpeed); });
    }
  }

  _maybeSwitchToHardMusic(){
    if (this.game._hardMode === true) {
      ensureBgm(this, { forceKey: "bgm_hard" });
    }
  }

  _flashStormClouds(){
    if (!this.topCloud || !this.bottomCloud) return;

    const baseTop    = this._stormBaseTopTint    ?? this.topCloud.tintTopLeft;
    const baseBottom = this._stormBaseBottomTint ?? this.bottomCloud.tintTopLeft;

    this.topCloud.setTint(0xe5e7eb);
    this.bottomCloud.setTint(0x1f2937);

    this.cameras.main.flash(90, 210, 220, 240, false);

    this.time.delayedCall(120, () => {
      if (!this.topCloud || !this.bottomCloud) return;
      this.topCloud.setTint(baseTop);
      this.bottomCloud.setTint(baseBottom);
    });
  }

  // Retourne le délai effectif entre deux spawns en respectant la distance horizontale minimale
  _getSpawnDelay(){
    const base = this.curDelay;
    const speedAbs = Math.abs(this.curSpeed || PROFILE.pipeSpeed);
    if (speedAbs <= 0) return base;
    const minDelayFromDist = (MIN_PAIR_DIST_PX / speedAbs) * 1000;
    return Math.max(base, minDelayFromDist);
  }

  onTap(){
    if (this.isOver){
      this._cancelLeaderboard = true;
      this.scene.restart();
      return;
    }
    if (!this.started){
      this.started = true;
      this.player.body.setAllowGravity(true);
      this.player.setGravityY(PROFILE.gravity);

      this.spawnPair(false);
      this.lastSpawnMs  = this.time.now;
      this.nextSpawnAt  = this.time.now + this._getSpawnDelay();

      this._maybeSwitchToHardMusic();

      updateQuestsFromEvent("game", 1);
      try { TG?.expand?.(); } catch {}
    }
    if (this.player.active) this.player.setVelocityY(PROFILE.jump);
  }

  update(){
    if (this.isOver) return;

    const vy = this.player.body.velocity.y;
    this.player.setAngle(vy < -40 ? -16 : (vy > 140 ? 20 : 0));

    if (this.started && this.time.now >= this.nextSpawnAt){
      if (this.lastSpawnMs < 0 || (this.time.now - this.lastSpawnMs) >= DIFF.cooldownMs){
        this.spawnPair(false);
        this.lastSpawnMs = this.time.now;
      }
      this.nextSpawnAt = this.time.now + this._getSpawnDelay();
    }

    if (this.started) this._forceVelocities();

    this.pipes.children.iterate(p => { if (p && p.active && (p.x + p.displayWidth*0.5 < -KILL_MARGIN)) p.destroy(); });
    this.sensors.children.iterate(s => { if (s && s.active && s.x < -KILL_MARGIN) s.destroy(); });
    this.bonuses.children.iterate(b => { if (b && b.active && b.x < -KILL_MARGIN) b.destroy(); });
    this.borgyCoins.children.iterate(c => {
      if (!c || !c.active) return;

      if (c.x < -KILL_MARGIN) {
        c.destroy();
        return;
      }

      if (this.player && this.player.active) {
        const dx = c.x - this.player.x;
        const dy = c.y - this.player.y;
        const distSq = dx * dx + dy * dy;

        const pickupRadius = 130;

        if (distSq <= pickupRadius * pickupRadius) {
          const cx2 = c.x;
          const cy2 = c.y;
          c.disableBody(true, true);
          this.onCollectBorgyCoin(cx2, cy2);
        }
      }
    });

    this.bots.children.iterate(b => { if (b && b.active && b.x < -KILL_MARGIN) b.destroy(); });

    if (this.pipeDecor) {
      this.pipeDecor.children.iterate(d => { if (d && d.active && d.x < -KILL_MARGIN) d.destroy(); });
    }

    this.pipePairs = this.pipePairs.filter(pair =>
      pair &&
      pair.top && pair.bottom &&
      pair.top.active && pair.bottom.active
    );

    if (this.multiplierActive && this.bonusFollower && this.player.active){
      this.bonusFollower.x = this.player.x - this.player.displayWidth*0.9;
      this.bonusFollower.y = this.player.y;
      const remaining = this.multiplierUntil - this.time.now;
      if (remaining <= 3000){
        this.bonusFollower.setVisible(Math.floor(this.time.now / 150) % 2 === 0);
      } else {
        this.bonusFollower.setVisible(true);
      }
    }

    if (this.DEBUG && this.debugTxt){
      this.debugTxt.setText(`speed:${this.curSpeed}  delay:${this.curDelay}  next:${Math.max(0, Math.ceil(this.nextSpawnAt - this.time.now))}ms`);
    }
  }

  _resizePipeToRim(img, isTop, rimY, scaleX) {
    const H = this.scale.height;

    const targetH = isTop
      ? Math.max(20, Math.ceil(rimY + PIPE_OVERSCAN))
      : Math.max(20, Math.ceil((H - rimY) + PIPE_OVERSCAN));

    const texW = img.width;
    const texH = img.height;

    const scaleY = targetH / texH;
    img.setScale(scaleX, scaleY);
    img.y = rimY;

    img.setImmovable(true);
    img.body.setAllowGravity(false);

    const MOUTH_PCT = 0.20;
    const mouthTexH = texH * MOUTH_PCT;
    const halfMouth = mouthTexH * 0.5;

    if (isTop) {
      const bodyHeight = texH - halfMouth;
      img.body.setSize(texW, bodyHeight, false);
      img.body.setOffset(0, 0);
    } else {
      const bodyHeight = texH - halfMouth;
      img.body.setSize(texW, bodyHeight, false);
      img.body.setOffset(0, halfMouth);
    }
  }

  // ========= Génération d’une paire =========
  spawnPair(silentFirst){
    const W = this.scale.width, H = this.scale.height;

    const TOP_BAND  = Math.round(H * PLAYFIELD_TOP_PCT);
    const BOT_BAND  = Math.round(H * PLAYFIELD_BOT_PCT);
    const RIM_LIMIT = Math.round(H * PIPE_RIM_MAX_PCT);

    const playable = Math.max(40, BOT_BAND - TOP_BAND);
    const MIN_GAP = 90;
    const GAP = Math.round(Phaser.Math.Clamp(this.curGap ?? PROFILE.gap, MIN_GAP, playable - 40));

    let minY = TOP_BAND + Math.floor(GAP/2);
    let maxY = Math.min(BOT_BAND - Math.floor(GAP/2), RIM_LIMIT - Math.floor(GAP/2) + PAD);
    if (maxY < minY) { const c = Math.round((TOP_BAND + BOT_BAND)/2); minY = maxY = c; }
    const gapY = Phaser.Math.Between(minY, maxY);

    const x  = W + SPAWN_X_OFFSET;
    const vx = this.started ? this.curSpeed : 0;

    const topKey    = this.isXmasMode ? "pipe_top_ice"    : "pipe_top";
    const bottomKey = this.isXmasMode ? "pipe_bottom_snow": "pipe_bottom";

    const topImg    = this.physics.add.image(x, 0, topKey).setDepth(6).setOrigin(0.5, 1);
    const bottomImg = this.physics.add.image(x, 0, bottomKey).setDepth(6).setOrigin(0.5, 0);

    const scaleXt = PIPE_W_DISPLAY / topImg.width;
    const scaleXb = PIPE_W_DISPLAY / bottomImg.width;

    let yTopRim0    = Math.round(gapY - GAP/2 + (PAD - JOINT_OVERLAP));
    let yBottomRim0 = Math.round(gapY + GAP/2 - (PAD - JOINT_OVERLAP));

    this._resizePipeToRim(topImg, true,  yTopRim0,    scaleXt);
    this._resizePipeToRim(bottomImg, false, yBottomRim0, scaleXb);

    topImg.body.setVelocityX(vx);
    bottomImg.body.setVelocityX(vx);

    if (this.game._hardMode === true) { topImg.setTint(0x6d1f12); bottomImg.setTint(0x6d1f12); }
    else { topImg.clearTint(); bottomImg.clearTint(); }

    this.pipes.add(topImg);
    this.pipes.add(bottomImg);

    this.pipePairs.push({ top: topImg, bottom: bottomImg });

    const gapCenterY = (topImg.y + bottomImg.y) / 2;

    const sensorX = x + (PIPE_W_DISPLAY*PIPE_BODY_W)/2 + 6;
    const sensor = this.add.rectangle(sensorX, H*0.5, 8, H, 0x000000, 0);
    sensor.setVisible(false);
    this.physics.add.existing(sensor, false);
    sensor.body.setAllowGravity(false);
    sensor.body.setImmovable(true);
    sensor.body.setVelocityX(vx);
    sensor.isScore = !silentFirst;
    this.sensors.add(sensor);

    this.pairsSpawned++;

    // BONUS SWISSBORG
    if (ENABLE_BONUS && this.started && (this.pairsSpawned % BONUS_EVERY === 0)){
      const bonusX = x;
      const bonusY = gapCenterY;
      const bonus = this.physics.add.image(bonusX, bonusY, "bonus_sb")
        .setDepth(7).setScale(0.55).setImmovable(true);
      bonus.body.setAllowGravity(false);
      bonus.body.setVelocityX(this.curSpeed);
      bonus.body.setSize(bonus.displayWidth*3.0, bonus.displayHeight*3.0, true);
      this.bonuses.add(bonus);
    }

    // BORGY COINS
    if (this.started && this.pairsSpawned >= this.nextCoinAt){
      const coinX = x;
      const coinY = gapCenterY;
      this.spawnBorgyCoin(coinX, coinY, this.curSpeed);
      this.nextCoinAt += Phaser.Math.Between(3, 6);
    }

    // Robot SwissBorg décoratif mais mortel : 1 apparition toutes les 15 paires
    if (this.started && this.pairsSpawned > 0 && this.pairsSpawned % 15 === 0) {
      const botScale = 0.14;
      const fromBottom = Phaser.Math.Between(0, 1) === 0;

      const botKey = this.isXmasMode ? "sb_robot_xmas" : "sb_robot";

      if (fromBottom) {
        const bot = this.physics.add
          .image(bottomImg.x, bottomImg.y, botKey)
          .setDepth(5)
          .setScale(botScale)
          .setImmovable(true);

        bot.body.setAllowGravity(false);
        bot.body.setVelocityX(vx);

        const bw = bot.displayWidth * 0.65;
        const bh = bot.displayHeight * 0.9;
        bot.body.setSize(bw, bh, true);

        this.bots.add(bot);

        const h = bot.displayHeight;
        const yHidden = bottomImg.y + h * 0.6;
        const yShown  = bottomImg.y;

        bot.y = yHidden;

        this.tweens.add({
          targets: bot,
          y: { from: yHidden, to: yShown },
          duration: 900,
          yoyo: true,
          repeat: -1,
          ease: "Sine.inOut"
        });
      } else {
        const bot = this.physics.add
          .image(topImg.x, topImg.y, botKey)
          .setDepth(5)
          .setScale(botScale)
          .setFlipY(true)
          .setImmovable(true);

        bot.body.setAllowGravity(false);
        bot.body.setVelocityX(vx);

        const bw = bot.displayWidth * 0.65;
        const bh = bot.displayHeight * 0.9;
        bot.body.setSize(bw, bh, true);

        this.bots.add(bot);

        const h = bot.displayHeight;
        const yHidden = topImg.y - h * 0.6;
        const yShown  = topImg.y;

        bot.y = yHidden;

        this.tweens.add({
          targets: bot,
          y: { from: yHidden, to: yShown },
          duration: 900,
          yoyo: true,
          repeat: -1,
          ease: "Sine.inOut"
        });
      }
    }

    if (this.game._hardMode === true) {
      const maxClose = Math.max(0, Math.floor((GAP - MIN_GAP) / 2) - 2);
      const amp = Math.min(HARD_DOOR_AMPLITUDE_PX, maxClose);

      if (amp > 0) {
        const driver = { delta: 0 };
        const tween = this.tweens.add({
          targets: driver,
          delta: amp,
          duration: HARD_DOOR_HALF_PERIOD,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.inOut',
          onUpdate: () => {
            const d = driver.delta;
            const newTop    = yTopRim0    + d;
            const newBottom = yBottomRim0 - d;
            const topClamped    = Phaser.Math.Clamp(newTop,    TOP_BAND + 10, RIM_LIMIT - 10);
            const bottomClamped = Phaser.Math.Clamp(newBottom, TOP_BAND + 10, BOT_BAND  - 10);

            this._resizePipeToRim(topImg, true,  topClamped,    scaleXt);
            this._resizePipeToRim(bottomImg, false, bottomClamped, scaleXb);

            topImg.body.setVelocityX(this.curSpeed);
            bottomImg.body.setVelocityX(this.curSpeed);
          }
        });

        const stopTween = () => { try { tween.stop(); tween.remove(); } catch {} };
        topImg.once('destroy', stopTween);
        bottomImg.once('destroy', stopTween);
      }
    }
  }

  // ====== gestion du contact Borgy / pièce ======>
  handleBorgyCoinOverlap(player, coin){
    if (!coin || !coin.active) return;
    const cx = coin.x;
    const cy = coin.y;
    coin.disableBody(true, true);
    this.onCollectBorgyCoin(cx, cy);
  }

  // ====== Spawn d’une pièce avec hitbox identique au bonus SwissBorg ======>
  spawnBorgyCoin(x, y, vx){
    const coin = this.physics.add.image(x, y, "borgy_coin")
      .setDepth(8)
      .setScale(0.09)
      .setImmovable(true);

    coin.body.setAllowGravity(false);
    coin.body.setVelocityX(vx);

    let targetSide = 140;
    try {
      const bonusTex = this.textures.get("bonus_sb");
      const bonusImg = bonusTex.getSourceImage?.();
      if (bonusImg) {
        const bonusDisplayW = bonusImg.width * 0.55;
        targetSide = bonusDisplayW * 5.0;
      }
    } catch (e) {
      console.warn("calc bonus hitbox error", e);
    }

    coin.body.setSize(targetSide, targetSide, true);

    this.borgyCoins.add(coin);

    this.tweens.add({
      targets: coin,
      scaleX: 0.10 * 0.9,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut"
    });
  }

  onCollectBorgyCoin(x, y){
    const isHard = this.game._hardMode === true;
    let gain;

    if (this.skinIsGold) {
      gain = 5;
    } else {
      gain = isHard ? 2 : 1;
    }

    this.borgyCoinCount += gain;
    saveBorgyCoins(this.borgyCoinCount);
    if (this.borgyCoinText){
      this.borgyCoinText.setText(`🪙 ${this.borgyCoinCount}`);
    }

    if (!this.game._muted && this.sfxCoin){
      this.sfxCoin.play();
    }

    const floatTxt = this.add.text(x, y, `+${gain}`, {
      fontFamily:"monospace", fontSize:32, color:"#ffffaa", stroke:"#000000", strokeThickness:4
    }).setDepth(30).setOrigin(0.5);
    this.tweens.add({
      targets: floatTxt,
      y: y - 60,
      alpha: 0,
      duration: 700,
      ease: "Cubic.out",
      onComplete: () => floatTxt.destroy()
    });
  }

  activateMultiplier(){
    this.multiplierActive = true;
    this.multiplierUntil = this.time.now + BONUS_DURATION;

    if (this.bonusFollower){
      this.bonusFollower.destroy();
      this.bonusFollower = null;
    }
    this.bonusFollower = this.add.image(
      this.player.x - this.player.displayWidth*0.9,
      this.player.y,
      "bonus_sb"
    ).setDepth(9).setScale(0.4);

    this.time.delayedCall(BONUS_DURATION, () => {
      this.multiplierActive = false;
      if (this.bonusFollower){
        this.bonusFollower.destroy();
        this.bonusFollower = null;
      }
    });
  }

  addScore(n){
    const isHard = this.game._hardMode === true;
    let multBase = 1;
    if (this.multiplierActive) {
      multBase = this.skinIsEmerald ? 3 : 2;
    }
    const hardBonus = isHard ? 1.2 : 1.0;
    const value = Math.round(n * multBase * hardBonus);

    this.score += value;
    this.scoreText.setText(`${t("HUD_SCORE")} ${this.score}`);
    updateQuestsFromEvent("score", this.score);
    if (!this.game._muted && this.sfxScore) this.sfxScore.play();

    if (!isHard) {
      if (this.score >= 200) {
        const extraScore = this.score - 200;
        const newSpeedStep = Math.floor(extraScore / 50) + 1;
        if (newSpeedStep > this.scoreSpeedStep) {
          const deltaPerStep = -10;
          const stepsToApply = newSpeedStep - this.scoreSpeedStep;
          const delta = deltaPerStep * stepsToApply;
          this.curSpeed = Math.max(DIFF.minSpeed, this.curSpeed + delta);
          this.scoreSpeedStep = newSpeedStep;
          this._forceVelocities();
        }
      }

      const MIN_GAP_NORMAL = 140;
      if (this.score >= 200) {
        const extraScoreGap = this.score - 200;
        const newGapStep = Math.floor(extraScoreGap / 50) + 1;
        if (newGapStep > this.scoreGapStep) {
          this.scoreGapStep = newGapStep;
        }
        const REDUCE_PER_STEP = 12;
        const targetGap = Math.max(
          MIN_GAP_NORMAL,
          PROFILE.gap - REDUCE_PER_STEP * this.scoreGapStep
        );
        this.curGap = targetGap;
      }
    }
  }

  gameOver(){
    if (this.isOver) return;

    if (this.isInvincible) return;

    if (this.skinIsDiamond && this.canRevive) {
      this.canRevive = false;
      this._revivePlayer();
      return;
    }

    this._finalGameOver();
  }

  _findNearestPipePairAhead(){
    if (!this.pipePairs || !this.pipePairs.length || !this.player) return null;
    const px = this.player.x || 0;
    let best = null;
    let bestDist = Infinity;

    for (const pair of this.pipePairs){
      if (!pair || !pair.top || !pair.bottom) continue;
      if (!pair.top.active || !pair.bottom.active) continue;
      const x = pair.top.x;
      const d = x - px;
      if (d < -40) continue;
      if (d < bestDist) {
        bestDist = d;
        best = pair;
      }
    }
    return best;
  }

  _revivePlayer(){
    if (!this.player || !this.player.body) {
      this._finalGameOver();
      return;
    }

    const W = this.scale.width;
    const H = this.scale.height;

    const pair = this._findNearestPipePairAhead();

    let targetX, targetY;
    if (pair) {
      targetX = pair.top.x;
      targetY = (pair.top.y + pair.bottom.y) / 2;
    } else {
      targetX = W * 0.18;
      targetY = H * ((PLAYFIELD_TOP_PCT + PLAYFIELD_BOT_PCT) / 2);
    }

    this.isInvincible = true;

    this.player.body.enable = false;
    this.player.setVelocity(0, 0);

    const startScaleX = this.player.scaleX;
    const startScaleY = this.player.scaleY;

    this.tweens.add({
      targets: this.player,
      alpha: 0,
      scaleX: startScaleX * 0.7,
      scaleY: startScaleY * 0.7,
      duration: 200,
      ease: "Cubic.in",
      onComplete: () => {
        this.player.setPosition(targetX, targetY);
        this.player.setAngle(0);
        this.player.body.enable = true;
        this.player.setVelocity(0, 0);

        this.tweens.add({
          targets: this.player,
          alpha: 1,
          scaleX: startScaleX,
          scaleY: startScaleY,
          duration: 220,
          ease: "Cubic.out"
        });

        const txt = this.add.text(
          this.player.x,
          this.player.y - 60,
          t("REVIVE_TEXT"),
          { fontFamily:"monospace", fontSize:32, color:"#ffffff", stroke:"#000000", strokeThickness:6 }
        ).setOrigin(0.5).setDepth(200);

        this.tweens.add({
          targets: txt,
          y: txt.y - 40,
          alpha: 0,
          duration: 800,
          ease: "Cubic.out",
          onComplete: () => txt.destroy()
        });

        this.time.delayedCall(2000, () => {
          this.isInvincible = false;
        });
      }
    });
  }

  _finalGameOver(){
    if (this.isOver) return;
    this.isOver = true; 
    this.started = false;

    // on autorise le leaderboard au moment du game over
    this._cancelLeaderboard = false;

    saveLocalBestScore(this.score);

    // ⚡ Daily challenge : mise à jour + éventuelle récompense 500 coins
    const dailyRes = updateDailyChallengeOnGameOver(this.score);
    const gotDailyReward = dailyRes && dailyRes.gotReward === true;
    if (gotDailyReward) {
      this.borgyCoinCount = dailyRes.coinsAfter;
      if (this.borgyCoinText){
        this.borgyCoinText.setText(`🪙 ${this.borgyCoinCount}`);
      }
      if (!this.game._muted && this.sfxCoin){
        this.sfxCoin.play();
      }
    }

    try { this.inputZone?.disableInteractive(); this.inputZone?.removeAllListeners(); } catch {}
    try { this.input.keyboard.removeAllListeners(); } catch {}

    if (!this.game._muted && this.sfxGameOver) {
      const bgm = this.game._bgm;
      if (bgm) bgm.setVolume(0.15);
      this.sfxGameOver.once("complete", () => { if (bgm && !this.game._muted) bgm.setVolume(0.35); });
      this.sfxGameOver.play();
    }

    this.pipes.clear(true, true);
    this.sensors.clear(true, true);
    this.bonuses.clear(true, true);
    this.borgyCoins.clear(true, true);
    this.bots.clear(true, true);
    if (this.pipeDecor) this.pipeDecor.clear(true, true);
    this.pipePairs = [];
    if (this.bonusFollower){
      this.bonusFollower.destroy();
      this.bonusFollower = null;
    }

    const W = this.scale.width, H = this.scale.height;
    this.add.rectangle(W/2, H/2, W*0.8, 380, 0x12323a, 0.92).setDepth(100);
    this.add.text(W/2, H/2 - 110, t("GAME_OVER_TITLE"), { fontFamily:"Georgia,serif", fontSize:68, color:"#fff" })
      .setOrigin(0.5).setDepth(101);
    this.add.text(W/2, H/2 - 28, `${t("GAME_OVER_SCORE")} ${this.score}`, { fontFamily:"monospace", fontSize:48, color:"#cffff1" })
      .setOrigin(0.5).setDepth(101);

    // Si Daily reward gagné, petit tag sous le score
    if (gotDailyReward) {
      const dailyTxt = this.add.text(
        W/2,
        H/2 + 4,
        "+500 Borgy Coins — " + t("DAILY_TITLE"),
        { fontFamily:"monospace", fontSize:24, color:"#ffeaa7", stroke:"#000000", strokeThickness:4 }
      ).setOrigin(0.5).setDepth(102);

      this.tweens.add({
        targets: dailyTxt,
        y: dailyTxt.y - 18,
        duration: 900,
        ease: "Cubic.out"
      });
    }

    // Bouton PARTAGER MON SCORE sous le score
    const shareBtn = this.add.text(
      W/2,
      H/2 + 32,
      t("GAME_OVER_SHARE"),
      {
        fontFamily: "monospace",
        fontSize: 32,
        color: "#ffffff",
        backgroundColor: "#0b7285",
        padding: { left: 22, right: 22, top: 8, bottom: 8 }
      }
    ).setOrigin(0.5).setDepth(101).setInteractive({ useHandCursor: true });

    shareBtn.on("pointerover", () => shareBtn.setBackgroundColor("#0e8595"));
    shareBtn.on("pointerout",  () => shareBtn.setBackgroundColor("#0b7285"));
    shareBtn.on("pointerdown", () => this.handleShareScore());

    const replay = this.add.text(W/2, H/2 + 100, t("GAME_OVER_REPLAY"),
      { fontFamily:"monospace", fontSize:44, color:"#fff", backgroundColor:"#0db187", padding:{left:22,right:22,top:10,bottom:10} })
      .setOrigin(0.5).setDepth(101).setInteractive({useHandCursor:true});
    // si le joueur clique, on annule le leaderboard
    replay.on("pointerdown", ()=> {
      this._cancelLeaderboard = true;
      this.scene.restart();
    });

    const menuBtn = this.add.text(W/2, H/2 + 176, t("GAME_OVER_MENU"),
      { fontFamily:"monospace", fontSize:40, color:"#fff", backgroundColor:"#0a8ea1", padding:{left:22,right:22,top:8,bottom:8} })
      .setOrigin(0.5).setDepth(101).setInteractive({useHandCursor:true});
    menuBtn.on("pointerdown", () => {
      this._cancelLeaderboard = true;
      const bgm = this.game._bgm;
      if (bgm && !this.game._muted) bgm.setVolume(0.35);
      this.scene.start("menu");
    });

    const isHard = this.game._hardMode === true;
    // AFFICHAGE LEADERBOARD PAGINÉ APRÈS ENREGISTREMENT
    postScore(this.score, isHard).then(() => {
      if (this._cancelLeaderboard) return;
      if (!this.isOver) return;
      if (!this.scene.isActive()) return;
      this.showLeaderboard(isHard);
    });
  }

  // Popup de partage (nouveau texte FR + EN + lien bot)
  handleShareScore(){
    const score  = this.score | 0;
    const isHard = this.game._hardMode === true;

    const modeFr = isHard ? "Hard" : "Normal";
    const modeEn = isHard ? "Hard" : "Normal";

    const botUrl = "https://t.me/Borgyboss_bot";

    // Texte FR
    const textFr =
      `Je viens de faire un nouveau high score de ${score} points ` +
      `en mode ${modeFr} sur FlappyBorgy ! Tu peux me battre ? ` +
      `Viens te challenger ici : ${botUrl}`;

    // Texte EN (proche de la suggestion que tu as reçue)
    const textEn =
      `Just hit a new high score of ${score} points in ${modeEn} Mode on FlappyBorgy! ` +
      `Can you beat it? Challenge yourself here: ${botUrl}`;

    const fullText = `${textFr}\n\n${textEn}`;

    // Web Share API (mobile, certains navigateurs)
    if (navigator.share){
      navigator.share({ text: fullText, url: botUrl }).catch(()=>{});
      return;
    }

    const W = this.scale.width;
    const H = this.scale.height;
    const depth = 420;
    const elements = [];

    const overlay = this.add.rectangle(W/2, H/2, W, H, 0x000000, 0.55)
      .setDepth(depth)
      .setInteractive();
    elements.push(overlay);

    const panel = this.add.rectangle(W/2, H/2, W*0.8, H*0.5, 0x05252f, 0.96)
      .setDepth(depth+1);
    elements.push(panel);

    const title = this.add.text(W/2, H*0.32, t("SHARE_TITLE"), {
      fontFamily: "Georgia,serif",
      fontSize: 40,
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(depth+2);
    elements.push(title);

    const msgText = this.add.text(W*0.15, H*0.37, fullText, {
      fontFamily: "monospace",
      fontSize: 20,
      color: "#e5f2ff",
      wordWrap: { width: W*0.7 }
    }).setOrigin(0,0).setDepth(depth+2);
    elements.push(msgText);

    const infoText = this.add.text(W/2, H*0.53, t("SHARE_HINT"), {
      fontFamily: "monospace",
      fontSize: 20,
      color: "#cffff1",
      align: "center",
      wordWrap: { width: W*0.7 }
    }).setOrigin(0.5).setDepth(depth+2);
    elements.push(infoText);

    const openUrl = (u) => {
      try {
        if (window.Telegram?.WebApp?.openLink) {
          window.Telegram.WebApp.openLink(u);
        } else {
          window.open(u, "_blank");
        }
      } catch(e) {
        try { window.open(u, "_blank"); } catch {}
      }
    };

    const xUrl      = `https://twitter.com/intent/tweet?text=${encodeURIComponent(fullText)}`;
    const tgUrl     = `https://t.me/share/url?url=${encodeURIComponent(botUrl)}&text=${encodeURIComponent(fullText)}`;
    const instaUrl  = "https://www.instagram.com/";
    const tiktokUrl = "https://www.tiktok.com/";

    const makeBtn = (x, y, label) => {
      const btn = this.add.text(x, y, label, {
        fontFamily: "monospace",
        fontSize: 20,
        color: "#ffffff",
        backgroundColor: "#0b7285",
        padding: { left: 14, right: 14, top: 6, bottom: 6 }
      }).setOrigin(0.5).setDepth(depth+2).setInteractive({ useHandCursor: true });

      btn.on("pointerover", () => btn.setBackgroundColor("#0e8595"));
      btn.on("pointerout",  () => btn.setBackgroundColor("#0b7285"));

      elements.push(btn);
      return btn;
    };

    const btnX   = makeBtn(W*0.24, H*0.60, "X");
    btnX.on("pointerdown", () => openUrl(xUrl));

    const btnTg  = makeBtn(W*0.42, H*0.60, "Telegram");
    btnTg.on("pointerdown", () => openUrl(tgUrl));

    const btnIg  = makeBtn(W*0.60, H*0.60, "Instagram");
    btnIg.on("pointerdown", () => openUrl(instaUrl));

    const btnTk  = makeBtn(W*0.78, H*0.60, "TikTok");
    btnTk.on("pointerdown", () => openUrl(tiktokUrl));

    if (navigator.clipboard && navigator.clipboard.writeText){
      const copyBtn = makeBtn(W/2, H*0.69, t("SHARE_COPY"));
      copyBtn.on("pointerdown", () => {
        navigator.clipboard.writeText(fullText).then(() => {
          copyBtn.setText(t("SHARE_COPIED"));
          this.time.delayedCall(1200, () => copyBtn.setText(t("SHARE_COPY")));
        }).catch(()=>{});
      });
    }

    const close = this.add.text(W/2, H*0.80, t("SHARE_CLOSE"), {
      fontFamily: "monospace",
      fontSize: 28,
      color: "#ffffff",
      backgroundColor: "#0db187",
      padding: { left: 22, right: 22, top: 8, bottom: 8 }
    }).setOrigin(0.5).setDepth(depth+2).setInteractive({ useHandCursor: true });
    elements.push(close);

    const destroyAll = () => {
      elements.forEach(el => { try { el.destroy(); } catch(e){} });
    };

    overlay.on("pointerdown", destroyAll);
    close.on("pointerdown", destroyAll);
  }

  // LEADERBOARD paginé dans la GameScene (après Game Over)
  showLeaderboard(isHard = false){
    const W = this.scale.width;
    const H = this.scale.height;
    const depth = 300;

    const elements = [];
    const rows = [];
    let currentPage = 1;
    let currentScope = "all"; // "all" | "week" | "month"

    const panel = this.add
      .rectangle(W / 2, H * 0.5, W * 0.78, H * 0.6, 0x0a2a2f, 0.92)
      .setDepth(depth);
    elements.push(panel);

    const titleText = isHard ? t("LEADERBOARD_TITLE_HARD") : t("LEADERBOARD_TITLE");
    const title = this.add
      .text(W / 2, H * 0.18, titleText, {
        fontFamily: "Georgia,serif",
        fontSize: 60,
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setDepth(depth + 1);
    elements.push(title);

    const pageLabel = this.add
      .text(W / 2, H * 0.24, `${t("LEADERBOARD_PAGE_LABEL")} 1`, {
        fontFamily: "monospace",
        fontSize: 24,
        color: "#cffff1",
      })
      .setOrigin(0.5)
      .setDepth(depth + 1);
    elements.push(pageLabel);

    const scopeY = H * 0.28;

    const btnGlobal = this.add.text(W * 0.30, scopeY, t("LEADERBOARD_SCOPE_GLOBAL"), {
      fontFamily: "monospace",
      fontSize: 24,
      color: "#fff",
      backgroundColor: "#0db187",
      padding: { left: 10, right: 10, top: 6, bottom: 6 },
    }).setOrigin(0.5).setDepth(depth + 1).setInteractive({ useHandCursor: true });
    elements.push(btnGlobal);

    const btnWeek = this.add.text(W * 0.50, scopeY, t("LEADERBOARD_SCOPE_WEEK"), {
      fontFamily: "monospace",
      fontSize: 24,
      color: "#fff",
      backgroundColor: "#0a4d8a",
      padding: { left: 10, right: 10, top: 6, bottom: 6 },
    }).setOrigin(0.5).setDepth(depth + 1).setInteractive({ useHandCursor: true });
    elements.push(btnWeek);

    const btnMonth = this.add.text(W * 0.70, scopeY, t("LEADERBOARD_SCOPE_MONTH"), {
      fontFamily: "monospace",
      fontSize: 24,
      color: "#fff",
      backgroundColor: "#0a4d8a",
      padding: { left: 10, right: 10, top: 6, bottom: 6 },
    }).setOrigin(0.5).setDepth(depth + 1).setInteractive({ useHandCursor: true });
    elements.push(btnMonth);

    const refreshScopeButtons = () => {
      const onColor  = "#0db187";
      const offColor = "#0a4d8a";

      btnGlobal.setBackgroundColor(currentScope === "all"   ? onColor : offColor);
      btnWeek.setBackgroundColor(  currentScope === "week"  ? onColor : offColor);
      btnMonth.setBackgroundColor( currentScope === "month" ? onColor : offColor);
    };
    refreshScopeButtons();

    const colX = W * 0.23;
    const startY = H * 0.34;
    const lineH = 56;

    const close = this.add
      .text(W / 2, H * 0.82, t("COMMON_CLOSE"), {
        fontFamily: "monospace",
        fontSize: 44,
        color: "#fff",
        backgroundColor: "#0db187",
        padding: { left: 22, right: 22, top: 8, bottom: 8 },
      })
      .setOrigin(0.5)
      .setDepth(depth + 1)
      .setInteractive({ useHandCursor: true });
    elements.push(close);

    const prevBtn = this.add
      .text(W * 0.28, H * 0.82, "◀", {
        fontFamily: "monospace",
        fontSize: 40,
        color: "#fff",
        backgroundColor: "#0a8ea1",
        padding: { left: 18, right: 18, top: 8, bottom: 8 },
      })
      .setOrigin(0.5)
      .setDepth(depth + 1)
      .setInteractive({ useHandCursor: true });
    elements.push(prevBtn);

    const nextBtn = this.add
      .text(W * 0.72, H * 0.82, "▶", {
        fontFamily: "monospace",
        fontSize: 40,
        color: "#fff",
        backgroundColor: "#0a8ea1",
        padding: { left: 18, right: 18, top: 8, bottom: 8 },
      })
      .setOrigin(0.5)
      .setDepth(depth + 1)
      .setInteractive({ useHandCursor: true });
    elements.push(nextBtn);

    const destroyAll = () => {
      rows.forEach((r) => {
        try { r.destroy(); } catch (e) {}
      });
      elements.forEach((el) => {
        try { el.destroy(); } catch (e) {}
      });
    };

    close.on("pointerdown", destroyAll);

    const refreshButtonsState = (listLength) => {
      if (currentPage <= 1) {
        prevBtn.disableInteractive();
        prevBtn.setAlpha(0.4);
      } else {
        prevBtn.setInteractive({ useHandCursor: true });
        prevBtn.setAlpha(1);
      }

      if (listLength < 10) {
        nextBtn.disableInteractive();
        nextBtn.setAlpha(0.4);
      } else {
        nextBtn.setInteractive({ useHandCursor: true });
        nextBtn.setAlpha(1);
      }
    };

    const loadPage = async (page) => {
      const list = await fetchLeaderboard(10, isHard, page, currentScope);

      rows.forEach((r) => {
        try { r.destroy(); } catch (e) {}
      });
      rows.length = 0;

      currentPage = page;
      pageLabel.setText(`${t("LEADERBOARD_PAGE_LABEL")} ${page}`);

      list.slice(0, 10).forEach((row, i) => {
        const y = startY + i * lineH;

        const rankTxt = this.add
          .text(
            colX,
            y,
            String((page - 1) * 10 + i + 1).padStart(2, "0") + ".",
            { fontFamily: "monospace", fontSize: 36, color: "#bff" }
          )
          .setDepth(depth + 1)
          .setOrigin(0, 0.5);

        const nameTxt = this.add
          .text(colX + 70, y, row.name || "Player", {
            fontFamily: "monospace",
            fontSize: 36,
            color: "#fff",
          })
          .setDepth(depth + 1)
          .setOrigin(0, 0.5);

        const scoreTxt = this.add
          .text(W * 0.72, y, String(row.best), {
            fontFamily: "monospace",
            fontSize: 36,
            color: "#cffff1",
          })
          .setDepth(depth + 1)
          .setOrigin(1, 0.5);

        rows.push(rankTxt, nameTxt, scoreTxt);
      });

      refreshButtonsState(list.length);
    };

    prevBtn.on("pointerdown", () => {
      if (currentPage > 1) loadPage(currentPage - 1);
    });

    nextBtn.on("pointerdown", () => {
      loadPage(currentPage + 1);
    });

    btnGlobal.on("pointerdown", () => {
      currentScope = "all";
      refreshScopeButtons();
      loadPage(1);
    });
    btnWeek.on("pointerdown", () => {
      currentScope = "week";
      refreshScopeButtons();
      loadPage(1);
    });
    btnMonth.on("pointerdown", () => {
      currentScope = "month";
      refreshScopeButtons();
      loadPage(1);
    });

    loadPage(1);
  }
}

window.addEventListener("load", () => {
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game-root",
    backgroundColor: "#9edff1",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: GAME_W, height: GAME_H },
    physics: { default: "arcade", arcade: { gravity: { y: 0 }, debug: false } }, // debug false = plus de hitbox visibles
    scene: [PreloadScene, MenuScene, GameScene],
    pixelArt: true,
    fps: { target: 60, min: 30, forceSetTimeOut: false }
  });
});
