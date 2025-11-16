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
  spawnDelay: 2400
};

const PAD = 2;
const PIPE_BODY_W    = 0.92;
const PIPE_W_DISPLAY = 180;
const PLAYER_SCALE   = 0.14; // légèrement réduit pour bien caser tous les skins

const BG_KEY       = "bg_mountains";
const BG_HARD_KEY  = "bg_volcano"; // assets/bg_volcano.png
const PLAYFIELD_TOP_PCT = 0.15;
const PLAYFIELD_BOT_PCT = 0.90;
const PIPE_RIM_MAX_PCT  = 0.80;

const PIPE_OVERSCAN = 160;
const JOINT_OVERLAP = 1;
const KILL_MARGIN   = 260;

const ENABLE_KILL_BANDS = true;

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
  cooldownMs: 250
};
const SPAWN_X_OFFSET = PIPE_W_DISPLAY * 0.6;

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
async function fetchLeaderboard(limit = 10, isHard = false) {
  try {
    const url = `${API_BASE}/api/leaderboard?limit=${limit}${isHard ? "&mode=hard" : ""}&_=${Date.now()}`;
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

/* ================== SKINS ================== */
const SKINS_STORAGE_KEY = "flappy_borgy_skins_v1";

const SKINS_DEF = [
  { id: "borgy_default", key: "borgy",         name: "Borgy Classique",  price: 0,    ownedByDefault: true  },
  { id: "borgy_knight",  key: "borgy_knight",  name: "Borgy Chevalier",  price: 1000, ownedByDefault: false },
  { id: "borgy_dragon",  key: "borgy_dragon",  name: "Borgy Dragon",     price: 1000, ownedByDefault: false },
  { id: "borgy_space",   key: "borgy_space",   name: "Borgy Astronaute", price: 1000, ownedByDefault: false },
  { id: "borgy_cyber",   key: "borgy_cyber",   name: "Borgy Cyber",      price: 1000, ownedByDefault: false },
  { id: "borgy_cowboy",  key: "borgy_cowboy",  name: "Borgy Cow-boy",    price: 1000, ownedByDefault: false }
];

function loadSkinState(){
  try{
    const raw = localStorage.getItem(SKINS_STORAGE_KEY);
    if (raw){
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.skins) && data.skins.length){
        return data;
      }
    }
  }catch(e){}
  // init par défaut
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
  try{ localStorage.setItem(SKINS_STORAGE_KEY, JSON.stringify(data)); }catch(e){}
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

/* ================== PRELOAD ================== */
class PreloadScene extends Phaser.Scene {
  constructor(){ super("preload"); }

  init(){
    const root = document.getElementById("game-root") || document.body;
    const vid = document.createElement("video");
    vid.src = "assets/intro.mp4";
    vid.autoplay = true; vid.loop = true; vid.muted = true; vid.playsInline = true;
    Object.assign(vid.style,{
      position:"absolute",left:"50%",top:"15%",transform:"translateX(-50%)",
      width:"62%",maxWidth:"520px",borderRadius:"14px",zIndex:"9999",pointerEvents:"none"
    });
    root.appendChild(vid); this._loadingVideoEl = vid;
  }

  preload(){
    const W = this.scale.width, H = this.scale.height;
    this.load.setPath("assets");

    // Fonds
    this.load.image(BG_KEY,      "bg_mountains.jpg");
    this.load.image(BG_HARD_KEY, "bg_volcano.png");

    // Sprites & pipes
    this.load.image("borgy",       "borgy_ingame.png");
    this.load.image("pipe_top",    "pipe_light_top.png");
    this.load.image("pipe_bottom", "pipe_light_bottom.png");

    // Skins joueur
    this.load.image("borgy_knight",  "borgy_knight.png");
    this.load.image("borgy_dragon",  "borgy_dragon.png");
    this.load.image("borgy_space",   "borgy_space.png");
    this.load.image("borgy_cyber",   "borgy_cyber.png");
    this.load.image("borgy_cowboy",  "borgy_cowboy.png");

    // Bonus visuels
    this.load.image("bonus_sb",   "sb_token_user.png");
    this.load.image("borgy_coin", "borgy_coin.png");

    // Robot SwissBorg (accroché aux tuyaux du bas)
    this.load.image("sb_robot", "sb_robot.png");

    // Audio normal
    this.load.audio("bgm", "bgm.mp3");
    this.load.audio("bgm_alt", "audio_a19c0824bd.mp3");
    // Audio HARD (au 1er tap)
    this.load.audio("bgm_hard", "turbulence-246380.mp3");

    // SFX
    this.load.audio("sfx_gameover", "flappy-borgy-game-over-C.wav");
    this.load.audio("sfx_score",    "flappy_borgy_wouf_chiot_0_2s.wav");

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

    const muteBtn = this.add.text(W - 70, 30, "🔊", { fontFamily:"monospace", fontSize:42, color:"#fff" })
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
    this.add.text(W/2, H*0.19, `Borgy Coins : ${totalCoins}`, {
      fontFamily:"monospace",
      fontSize:30,
      color:"#0b4a44"
    }).setOrigin(0.5);

    this.makeBtn(W/2, H*0.30, "Jouer",       () => this.scene.start("game"));
    this.makeBtn(W/2, H*0.38, "Leaderboard", async () => {
      const isHard = this.game._hardMode === true;
      const list = await fetchLeaderboard(10, isHard);
      this.showLeaderboard(list, isHard);
    });
    this.makeBtn(W/2, H*0.46, "Quêtes 🔥",   () => this.showQuests());
    this.makeBtn(W/2, H*0.54, "Borgy Coins Shop", () => this.showShop());
    this.makeBtn(W/2, H*0.62, "🗳️ Voter pour Borgy", () => {
      const url = "https://lewk.com/vote/BorGY4ub2Fz4RLboGxnuxWdZts7EKhUTB624AFmfCgX";
      if (window.Telegram?.WebApp?.openLink) {
        window.Telegram.WebApp.openLink(url);
      } else {
        window.open(url, "_blank");
      }
    });
    this.makeBtn(W/2, H*0.70, "Buy Borgy", () => {
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
      this.game._hardMode ? "Mode Hard : ON" : "Mode Hard : OFF",
      () => {
        this.game._hardMode = !this.game._hardMode;
        localStorage.setItem("flappy_borgy_hard", JSON.stringify(this.game._hardMode));
        hardBtn.setText(this.game._hardMode ? "Mode Hard : ON" : "Mode Hard : OFF");
        hardBtn.setBackgroundColor(this.game._hardMode ? "#b91c1c" : "#12a38a");
      }
    );
    hardBtn.setBackgroundColor(this.game._hardMode ? "#b91c1c" : "#12a38a");

    this.add.text(W/2, H*0.92, "Tap/Espace pour sauter — évitez les tuyaux",
      { fontFamily:"monospace", fontSize:22, color:"#0b4a44", align:"center" }).setOrigin(0.5);
  }

  makeBtn(x,y,label,cb){
    const t = this.add.text(x,y,label,{
      fontFamily:"monospace",
      fontSize:34,
      color:"#fff",
      backgroundColor:"#12a38a",
      padding:{left:18,right:18,top:10,bottom:10}
    })
      .setOrigin(0.5)
      .setInteractive({useHandCursor:true});
    t.on("pointerover", ()=> t.setBackgroundColor("#0f8e78"));
    t.on("pointerout",  ()=> t.setBackgroundColor("#12a38a"));
    t.on("pointerdown", cb);
    return t;
  }

  showLeaderboard(list, isHard = false){
    const W = this.scale.width, H = this.scale.height; const depth = 500;
    const panel = this.add.rectangle(W/2, H*0.5, W*0.78, H*0.6, 0x0a2a2f, 0.92).setDepth(depth);
    const titleText = isHard ? "Leaderboard (Hard)" : "Leaderboard";
    const title = this.add.text(W/2, H*0.22, titleText, { fontFamily:"Georgia,serif", fontSize:60, color:"#ffffff" })
      .setOrigin(0.5).setDepth(depth+1);
    const colX = W*0.23, startY = H*0.30, lineH = 56;
    list.slice(0,10).forEach((row, i) => {
      const y = startY + i*lineH;
      this.add.text(colX, y, String(i+1).padStart(2,"0")+".", {fontFamily:"monospace", fontSize:36, color:"#bff"})
        .setDepth(depth+1).setOrigin(0,0.5);
      this.add.text(colX+70, y, row.name || "Player", {fontFamily:"monospace", fontSize:36, color:"#fff"})
        .setDepth(depth+1).setOrigin(0,0.5);
      this.add.text(W*0.72, y, String(row.best), {fontFamily:"monospace", fontSize:36, color:"#cffff1"})
        .setDepth(depth+1).setOrigin(1,0.5);
    });
    const close = this.add.text(W/2, H*0.82, "Fermer", { fontFamily:"monospace", fontSize:44, color:"#fff",
      backgroundColor:"#0db187", padding:{left:22,right:22,top:8,bottom:8} })
      .setOrigin(0.5).setDepth(depth+1).setInteractive({useHandCursor:true});
    const destroyAll = () => [panel, title, close, ...this.children.list.filter(o => o.depth>=depth && !o.input)]
      .forEach(o => o?.destroy());
    close.on("pointerdown", destroyAll);
  }

  showQuests(){
    const data = loadQuests();
    const W = this.scale.width, H = this.scale.height; const depth = 700;

    const isHard = this.game._hardMode === true;
    const totalAfter = applyQuestCoins(data, isHard);

    const panel = this.add.rectangle(W/2, H*0.5, W*0.82, H*0.58, 0x062b35, 0.94).setDepth(depth);
    const title = this.add.text(W/2, H*0.26, "Quêtes du jour", { fontFamily:"Georgia,serif", fontSize:60, color:"#ffffff" })
      .setOrigin(0.5).setDepth(depth+1);
    this.add.text(W/2, H*0.30, isHard ? "(Récompenses x2 en Hard)" : "", {
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
      this.add.text(W*0.14, y+28, `Récompense: ${rewardTxt}`, { fontFamily:"monospace", fontSize:18, color:"#c3ede5" })
        .setOrigin(0,0.5).setDepth(depth+1);
    });

    this.add.text(W/2, H*0.68, `Total Borgy Coins : ${totalAfter} 🪙`, {
      fontFamily:"monospace", fontSize:26, color:"#cffff1"
    }).setOrigin(0.5).setDepth(depth+1);

    const close = this.add.text(W/2, H*0.78, "Fermer", { fontFamily:"monospace", fontSize:40, color:"#fff",
      backgroundColor:"#0db187", padding:{left:26,right:26,top:10,bottom:10} })
      .setOrigin(0.5).setDepth(depth+1).setInteractive({useHandCursor:true});
    const destroyAll = () => [panel, title, close, ...this.children.list.filter(o => o.depth>=depth && !o.input)]
      .forEach(o => o?.destroy());
    close.on("pointerdown", destroyAll);
  }

  showShop(){
    const W = this.scale.width, H = this.scale.height; const depth = 650;

    // applique d'éventuelles récompenses de quêtes avant d'afficher les coins
    const dataQ = loadQuests();
    const isHard = this.game._hardMode === true;
    applyQuestCoins(dataQ, isHard);

    const panel = this.add.rectangle(W/2, H*0.5, W*0.8, H*0.55, 0x05252f, 0.96).setDepth(depth);
    const title = this.add.text(W/2, H*0.26, "Borgy Coins Shop", { fontFamily:"Georgia,serif", fontSize:54, color:"#ffffff" })
      .setOrigin(0.5).setDepth(depth+1);

    const coinsNow = loadBorgyCoins();
    const coinsText = this.add.text(W*0.5, H*0.33, `Tu as actuellement : ${coinsNow} 🪙`, {
      fontFamily:"monospace", fontSize:30, color:"#cffff1", align:"center"
    }).setOrigin(0.5).setDepth(depth+1);

    this.add.text(W*0.5, H*0.38, "Choisis ton skin Borgy :", {
      fontFamily:"monospace", fontSize:22, color:"#9be7ff", align:"center"
    }).setOrigin(0.5).setDepth(depth+1);

    let skinState = loadSkinState();
    const buttonsById = {};
    const startY = H*0.42;
    const lineH  = 64;

    const refreshButtons = () => {
      skinState = loadSkinState();
      coinsText.setText(`Tu as actuellement : ${loadBorgyCoins()} 🪙`);
      skinState.skins.forEach(s => {
        const btn = buttonsById[s.id];
        if (!btn) return;
        if (!s.owned){
          btn.setText("Acheter");
          btn.setBackgroundColor("#b45309");
        } else if (skinState.selectedId === s.id){
          btn.setText("Sélectionné");
          btn.setBackgroundColor("#15803d");
        } else {
          btn.setText("Utiliser");
          btn.setBackgroundColor("#0db187");
        }
      });
    };

    skinState.skins.forEach((skin, i) => {
      const y = startY + i*lineH;
      const priceStr = skin.price === 0 ? "Gratuit" : `${skin.price} 🪙`;

      this.add.text(W*0.16, y, skin.name, {
        fontFamily:"monospace", fontSize:26, color:"#ffffff"
      }).setOrigin(0,0.5).setDepth(depth+1);

      this.add.text(W*0.60, y, priceStr, {
        fontFamily:"monospace", fontSize:22, color:"#ffedd5"
      }).setOrigin(1,0.5).setDepth(depth+1);

      const btn = this.add.text(W*0.62, y, "...", {
        fontFamily:"monospace", fontSize:22, color:"#ffffff",
        backgroundColor:"#b45309",
        padding:{left:14,right:14,top:6,bottom:6}
      }).setOrigin(0,0.5).setDepth(depth+1).setInteractive({useHandCursor:true});

      buttonsById[skin.id] = btn;

      btn.on("pointerdown", () => {
        const state = loadSkinState();
        const s = state.skins.find(ss => ss.id === skin.id);
        if (!s) return;

        if (!s.owned){
          const res = tryBuySkin(skin.id);
          if (!res.ok && res.reason === "not_enough_coins"){
            const warn = this.add.text(W*0.5, H*0.64, "Pas assez de Borgy Coins !", {
              fontFamily:"monospace", fontSize:22, color:"#ffb4b4",
              backgroundColor:"#7f1d1d",
              padding:{left:16,right:16,top:6,bottom:6}
            }).setOrigin(0.5).setDepth(depth+2);
            this.tweens.add({
              targets: warn,
              alpha: 0,
              duration: 1200,
              delay: 900,
              onComplete: () => warn.destroy()
            });
            return;
          }
          // on sélectionne automatiquement le nouveau skin acheté
          selectSkin(skin.id);
        } else {
          // juste sélectionner
          selectSkin(skin.id);
        }
        refreshButtons();
      });
    });

    refreshButtons();

    const close = this.add.text(W/2, H*0.78, "Fermer", {
      fontFamily:"monospace", fontSize:40, color:"#fff",
      backgroundColor:"#0db187", padding:{left:26,right:26,top:10,bottom:10}
    }).setOrigin(0.5).setDepth(depth+1).setInteractive({useHandCursor:true});

    const destroyAll = () => [panel, title, close, ...this.children.list.filter(o => o.depth>=depth && !o.input)]
      .forEach(o => o?.destroy());
    close.on("pointerdown", destroyAll);
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
    this.nextSpawnAt = Infinity; this.lastSpawnMs = -1;
    this.curSpeed = PROFILE.pipeSpeed; this.curDelay = PROFILE.spawnDelay;
    this.curGap   = PROFILE.gap;
    this.DEBUG = false; this.debugTxt = null;

    this.multiplierActive = false;
    this.multiplierUntil = 0;
    this.bonusFollower = null;

    this.borgyCoinCount = loadBorgyCoins();
    this.nextCoinAt = Phaser.Math.Between(3, 7);
  }

  create(){
    const W = this.scale.width, H = this.scale.height;

    const isHard = this.game._hardMode === true;
    const keyWanted = isHard ? BG_HARD_KEY : BG_KEY;
    const hasKey = this.textures.exists(keyWanted);
    const bg = this.add.image(W/2, H/2, hasKey ? keyWanted : BG_KEY).setDepth(-10);
    bg.setScale(Math.max(W/bg.width, H/bg.height)).setScrollFactor(0);
    this.cameras.main.roundPixels = true;

    if (isHard) {
      this.curSpeed = PROFILE.pipeSpeed - 60;
      this.curDelay = PROFILE.spawnDelay - 500;
      this.curGap   = Math.max(120, PROFILE.gap - 40);
    }

    this.pipes      = this.physics.add.group();
    this.sensors    = this.physics.add.group();
    this.bonuses    = this.physics.add.group();
    this.borgyCoins = this.physics.add.group();
    this.bots       = this.physics.add.group(); // robots SwissBorg décoratifs

    this.inputZone = this.add.zone(0,0,W,H).setOrigin(0,0).setInteractive();
    this.inputZone.on("pointerdown", () => this.onTap());
    this.input.keyboard.on("keydown-SPACE", () => this.onTap());

    this.scoreText = this.add.text(24, 18, "Score: 0",
      { fontFamily:"monospace", fontSize:46, color:"#fff", stroke:"#0a3a38", strokeThickness:8 }).setDepth(20);

    this.borgyCoinText = this.add.text(W-24, 18, `🪙 ${this.borgyCoinCount}`, {
      fontFamily:"monospace", fontSize:36, color:"#fff", stroke:"#0a3a38", strokeThickness:6
    }).setOrigin(1,0).setDepth(20);

    if (this.DEBUG){
      this.debugTxt = this.add.text(16, 64, "", { fontFamily:"monospace", fontSize: 16, color: "#bff" }).setDepth(20);
    }

    const skinKey = getSelectedSkinKey();
    this.player = this.physics.add.sprite(
      W*0.18,
      H*((PLAYFIELD_TOP_PCT+PLAYFIELD_BOT_PCT)/2),
      skinKey
    )
      .setScale(PLAYER_SCALE).setDepth(10).setCollideWorldBounds(true);
    this.player.body.setAllowGravity(false);
    const pw = this.player.displayWidth, ph = this.player.displayHeight;
    this.player.body.setSize(pw*0.50, ph*0.50, true).setOffset(pw*0.20, ph*0.22);
    this.player.setGravityY(0);

    this.sfxGameOver = this.sound.add("sfx_gameover", { volume: 0.75 });
    this.sfxScore    = this.sound.add("sfx_score",    { volume: 0.6 });

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

    this.time.addEvent({
      delay: DIFF.stepMs, loop: true, callback: () => {
        this.curSpeed = Math.max(DIFF.minSpeed, this.curSpeed + DIFF.speedDelta);
        this.curDelay = Math.max(DIFF.minDelay, this.curDelay + DIFF.delayDelta);
        if (this.started) {
          this.nextSpawnAt = Math.max(this.time.now + this.curDelay, this.nextSpawnAt);
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
  }

  _maybeSwitchToHardMusic(){
    if (this.game._hardMode === true) {
      ensureBgm(this, { forceKey: "bgm_hard" });
    }
  }

  onTap(){
    if (this.isOver){ this.scene.restart(); return; }
    if (!this.started){
      this.started = true;
      this.player.body.setAllowGravity(true);
      this.player.setGravityY(PROFILE.gravity);

      this.spawnPair(true);
      this.lastSpawnMs = this.time.now;
      this.nextSpawnAt = this.time.now + this.curDelay;

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
      this.nextSpawnAt = this.time.now + this.curDelay;
    }

    if (this.started) this._forceVelocities();

    this.pipes.children.iterate(p => { if (p && p.active && (p.x + p.displayWidth*0.5 < -KILL_MARGIN)) p.destroy(); });
    this.sensors.children.iterate(s => { if (s && s.active && s.x < -KILL_MARGIN) s.destroy(); });
    this.bonuses.children.iterate(b => { if (b && b.active && b.x < -KILL_MARGIN) b.destroy(); });
    this.borgyCoins.children.iterate(c => { if (c && c.active && c.x < -KILL_MARGIN) c.destroy(); });
    this.bots.children.iterate(b => { if (b && b.active && b.x < -KILL_MARGIN) b.destroy(); });

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

  _resizePipeToRim(img, isTop, rimY, scaleX){
    const H = this.scale.height;
    const targetH = isTop
      ? Math.max(20, Math.ceil(rimY + PIPE_OVERSCAN))
      : Math.max(20, Math.ceil((H - rimY) + PIPE_OVERSCAN));

    img.setScale(scaleX, targetH / img.height);
    img.y = rimY;

    const displayW = img.width * scaleX;
    img.setImmovable(true).body.setAllowGravity(false);
    img.body.setSize(displayW * PIPE_BODY_W, img.displayHeight, true);
    img.body.setOffset((displayW - displayW*PIPE_BODY_W)/2, isTop ? img.displayHeight - img.body.height : 0);
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

    const topImg    = this.physics.add.image(x, 0, "pipe_top"   ).setDepth(6).setOrigin(0.5, 1);
    const bottomImg = this.physics.add.image(x, 0, "pipe_bottom").setDepth(6).setOrigin(0.5, 0);

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

    // centre réel du gap après redimensionnement
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

    // BONUS SWISSBORG : au milieu de la paire (même X, centre du trou)
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

    // BORGY COINS : tous les 3–7 tuyaux, également au centre du gap
    if (this.started && this.pairsSpawned >= this.nextCoinAt){
      const coinX = x;
      const coinY = gapCenterY;
      this.spawnBorgyCoin(coinX, coinY, this.curSpeed);
      this.nextCoinAt += Phaser.Math.Between(3, 7);
    }

    // Robot SwissBorg accroché à un tuyau du bas : 1 apparition sur 20
    if (Phaser.Math.Between(1, 20) === 1){
      const botX = bottomImg.x + bottomImg.displayWidth * 0.35;
      const botY = bottomImg.y + 80;
      const bot = this.physics.add.image(botX, botY, "sb_robot")
        .setDepth(5)
        .setScale(0.23)
        .setImmovable(true);
      bot.body.setAllowGravity(false);
      bot.body.setVelocityX(vx);
      this.bots.add(bot);

      // petite anim de "coucou" avec le bras
      this.tweens.add({
        targets: bot,
        angle: { from: -8, to: 8 },
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut"
      });
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

  // ====== gestion du contact Borgy / pièce ======
  handleBorgyCoinOverlap(player, coin){
    if (!coin || !coin.active) return;
    const cx = coin.x;
    const cy = coin.y;
    coin.disableBody(true, true);
    this.onCollectBorgyCoin(cx, cy);
  }

  spawnBorgyCoin(x, y, vx){
    const coin = this.physics.add.image(x, y, "borgy_coin")
      .setDepth(8)
      .setScale(0.10)
      .setImmovable(true);
    coin.body.setAllowGravity(false);
    coin.body.setVelocityX(vx);

    const bw = coin.displayWidth * 3.2;
    const bh = coin.displayHeight * 3.2;
    coin.body.setSize(bw, bh);
    coin.body.setOffset(
      (coin.displayWidth  - bw) / 3,
      (coin.displayHeight - bh) / 3
    );

    this.borgyCoins.add(coin);

    this.tweens.add({
      targets: coin,
      scaleX: 0.02,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut"
    });
  }

  onCollectBorgyCoin(x, y){
    this.borgyCoinCount += 1;
    saveBorgyCoins(this.borgyCoinCount);
    if (this.borgyCoinText){
      this.borgyCoinText.setText(`🪙 ${this.borgyCoinCount}`);
    }

    const floatTxt = this.add.text(x, y, "+1", {
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
    const multBase = this.multiplierActive ? 2 : 1;
    const hardBonus = isHard ? 1.2 : 1.0;
    const value = Math.round(n * multBase * hardBonus);

    this.score += value;
    this.scoreText.setText("Score: " + this.score);
    updateQuestsFromEvent("score", this.score);
    if (!this.game._muted && this.sfxScore) this.sfxScore.play();
  }

  gameOver(){
    if (this.isOver) return;
    this.isOver = true; this.started = false;

    saveLocalBestScore(this.score);

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
    if (this.bonusFollower){
      this.bonusFollower.destroy();
      this.bonusFollower = null;
    }

    const W = this.scale.width, H = this.scale.height;
    this.add.rectangle(W/2, H/2, W*0.8, 360, 0x12323a, 0.92).setDepth(100);
    this.add.text(W/2, H/2 - 110, "Game Over", { fontFamily:"Georgia,serif", fontSize:68, color:"#fff" })
      .setOrigin(0.5).setDepth(101);
    this.add.text(W/2, H/2 - 28, `Score : ${this.score}`, { fontFamily:"monospace", fontSize:48, color:"#cffff1" })
      .setOrigin(0.5).setDepth(101);

    const replay = this.add.text(W/2, H/2 + 50, "Rejouer",
      { fontFamily:"monospace", fontSize:44, color:"#fff", backgroundColor:"#0db187", padding:{left:22,right:22,top:10,bottom:10} })
      .setOrigin(0.5).setDepth(101).setInteractive({useHandCursor:true});
    replay.on("pointerdown", ()=> this.scene.restart());

    const menuBtn = this.add.text(W/2, H/2 + 140, "Menu principal",
      { fontFamily:"monospace", fontSize:40, color:"#fff", backgroundColor:"#0a8ea1", padding:{left:22,right:22,top:8,bottom:8} })
      .setOrigin(0.5).setDepth(101).setInteractive({useHandCursor:true});
    menuBtn.on("pointerdown", () => {
      const bgm = this.game._bgm;
      if (bgm && !this.game._muted) bgm.setVolume(0.35);
      this.scene.start("menu");
    });

    const isHard = this.game._hardMode === true;
    postScore(this.score, isHard).then(() =>
      fetchLeaderboard(10, isHard).then(list => { if (list?.length) this.showLeaderboard(list, isHard); })
    );
  }

  showLeaderboard(list, isHard = false){
    const W = this.scale.width, H = this.scale.height; const depth = 300;
    const panel = this.add.rectangle(W/2, H*0.5, W*0.78, H*0.6, 0x0a2a2f, 0.92).setDepth(depth);
    const titleText = isHard ? "Leaderboard (Hard)" : "Leaderboard";
    const title = this.add.text(W/2, H*0.22, titleText, { fontFamily:"Georgia,serif", fontSize:60, color:"#ffffff" })
      .setOrigin(0.5).setDepth(depth+1);
    const colX = W*0.23, startY = H*0.30, lineH = 56;
    list.slice(0,10).forEach((row, i) => {
      const y = startY + i*lineH;
      this.add.text(colX, y, String(i+1).padStart(2,"0")+".", {fontFamily:"monospace", fontSize:36, color:"#bff"})
        .setDepth(depth+1).setOrigin(0,0.5);
      this.add.text(colX+70, y, row.name || "Player", {fontFamily:"monospace", fontSize:36, color:"#fff"})
        .setDepth(depth+1).setOrigin(0,0.5);
      this.add.text(W*0.72, y, String(row.best), {fontFamily:"monospace", fontSize:36, color:"#cffff1"})
        .setDepth(depth+1).setOrigin(1,0.5);
    });
    const close = this.add.text(W/2, H*0.82, "Fermer",
      { fontFamily:"monospace", fontSize:44, color:"#fff", backgroundColor:"#0db187", padding:{left:22,right:22,top:8,bottom:8} })
      .setOrigin(0.5).setDepth(depth+1).setInteractive({useHandCursor:true});
    const destroyAll = () => [panel, title, close, ...this.children.list.filter(o => o.depth>=depth && !o.input)]
      .forEach(o => o?.destroy());
    close.on("pointerdown", destroyAll);
  }
}

window.addEventListener("load", () => {
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game-root",
    backgroundColor: "#9edff1",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: GAME_W, height: GAME_H },
    physics: { default: "arcade", arcade: { gravity: { y: 0 }, debug: false } },
    scene: [PreloadScene, MenuScene, GameScene],
    pixelArt: true,
    fps: { target: 60, min: 30, forceSetTimeOut: true }
  });
});
