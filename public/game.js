/* FlappyBorgy — montagnes 1024x1536 (pipes light only + Telegram leaderboard)
   Domaine du jeu : https://flappyborgyv15.onrender.com
   API : https://rickprimec137-flappyborgyv15.onrender.com
   ⚠️ Mets ta vidéo dans /assets/intro.mp4
*/

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
const PLAYER_SCALE   = 0.15;

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

// Pièces Borgy
const COIN_MIN_PIPES = 5;
const COIN_MAX_PIPES = 10;

/* ===== Anim “portes” (Hard) ===== */
const HARD_DOOR_AMPLITUDE_PX = 70;      // déplacement max de CHAQUE bord
const HARD_DOOR_HALF_PERIOD  = 900;     // ms pour “fermer” puis yoyo pour “ouvrir”

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
  scene.game.events.on(Phaser.Core.Events.FOCUS, () => { if (!scene.sound.locked) gm._bgm?.resume(); });
}

/* ======= Difficulté ======= */
const DIFF = {
  stepMs: 13000,
  speedDelta: -20,
  delayDelta: -150,
  minSpeed: -380,
  minDelay: 1100,
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
    const r = await fetch(url, { cache: "no-store" }); // évite 304 sans body
    if (!r.ok) { console.warn("lb status", r.status); return []; }
    const j = await r.json().catch(() => null); // si jamais
    return j?.ok ? j.list : [];
  } catch (e) {
    console.warn("lb fetch error", e);
    return [];
  }
}

/* ================== Quêtes + Borgy Coins ================== */
const QUEST_STORAGE_KEY = "flappy_borgy_quests_v2";
const COINS_STORAGE_KEY = "flappy_borgy_coins_v1";

function todayKey(){ return new Date().toISOString().slice(0,10); }

function makeNewQuestSet(oldStats = {}) {
  const stats = {
    bestNormal: oldStats.bestNormal || 0,
    bestHard: oldStats.bestHard || 0,
    gamesPlayed: oldStats.gamesPlayed || 0,
    bonusesTaken: oldStats.bonusesTaken || 0
  };

  const bestAny = Math.max(20, stats.bestNormal, stats.bestHard);
  const easyTarget = Math.max(20, Math.round(bestAny * 0.6));
  const proTarget  = Math.max(easyTarget + 10, Math.round(bestAny * 1.1));

  const bonusTarget = Math.max(
    1,
    Math.min(5, Math.ceil((stats.bonusesTaken || 0) / 3) + 1)
  );

  return {
    day: todayKey(),
    stats,
    quests: [
      {
        id: "score_easy",
        title: `Atteins ${easyTarget} points`,
        type: "score",
        target: easyTarget,
        progress: 0,
        done: false,
        rewardNormal: 5,
        rewardHard: 8
      },
      {
        id: "score_pro",
        title: `Atteins ${proTarget} points`,
        type: "score",
        target: proTarget,
        progress: 0,
        done: false,
        rewardNormal: 10,
        rewardHard: 15
      },
      {
        id: "bonus_hunter",
        title: `Ramasse ${bonusTarget} bonus`,
        type: "bonus",
        target: bonusTarget,
        progress: 0,
        done: false,
        rewardNormal: 8,
        rewardHard: 12
      }
    ]
  };
}

function loadQuests(){
  try{
    const raw = localStorage.getItem(QUEST_STORAGE_KEY);
    if (raw) {
      let data = JSON.parse(raw);
      if (!data.day || data.day !== todayKey()) {
        // Nouveau jour => on régénère à partir des stats
        data = makeNewQuestSet(data.stats || {});
        saveQuests(data);
        return data;
      }
      // s'assure que stats existe
      if (!data.stats) data.stats = { bestNormal:0, bestHard:0, gamesPlayed:0, bonusesTaken:0 };
      return data;
    }
  }catch(e){ console.warn("loadQuests error", e); }
  const base = makeNewQuestSet({});
  saveQuests(base);
  return base;
}
function saveQuests(data){
  try{ localStorage.setItem(QUEST_STORAGE_KEY, JSON.stringify(data)); }catch(e){}
}

function getBorgyCoins(){
  try{
    const raw = localStorage.getItem(COINS_STORAGE_KEY);
    return raw ? Number(raw) || 0 : 0;
  }catch(e){ return 0; }
}
function addBorgyCoins(n){
  const cur = getBorgyCoins();
  const next = Math.max(0, cur + (Number(n) || 0));
  try{ localStorage.setItem(COINS_STORAGE_KEY, String(next)); }catch(e){}
  return next;
}

// evt: "score" | "bonus" | "game"
// value: score courant ou 1
// ctx: { isHard?: boolean }
function updateQuestsFromEvent(evt, value, ctx = {}){
  const data = loadQuests();
  const stats = data.stats || (data.stats = { bestNormal:0, bestHard:0, gamesPlayed:0, bonusesTaken:0 });
  const isHard = !!ctx.isHard;

  // Stats globales
  if (evt === "score") {
    if (isHard) stats.bestHard  = Math.max(stats.bestHard  || 0, value);
    else        stats.bestNormal= Math.max(stats.bestNormal|| 0, value);
  }
  if (evt === "bonus") {
    stats.bonusesTaken = (stats.bonusesTaken || 0) + 1;
  }
  if (evt === "game") {
    stats.gamesPlayed = (stats.gamesPlayed || 0) + 1;
  }

  let gained = 0;
  let changed = false;

  for (const q of data.quests){
    if (q.done) continue;

    let newProg = q.progress;
    if (q.type === "score" && evt === "score") {
      newProg = Math.max(q.progress, value);
    }
    if (q.type === "bonus" && evt === "bonus") {
      newProg = q.progress + 1;
    }
    if (q.type === "game"  && evt === "game")  {
      newProg = q.progress + 1;
    }

    if (newProg !== q.progress){
      q.progress = newProg;
      changed = true;
      if (q.progress >= q.target){
        q.done = true;
        const reward = isHard ? q.rewardHard : q.rewardNormal;
        gained += reward;
      }
    }
  }

  if (changed) saveQuests(data);
  if (gained > 0) addBorgyCoins(gained);

  return { changed, gained };
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

    // Bonus SwissBorg + Borgy Coin
    if (ENABLE_BONUS) this.load.image("bonus_sb", "sb_token_user.png");
    this.load.image("coin_borgy", "borgy_coin.png");

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

    ensureBgm(this); // musique normale en menu

    const muteBtn = this.add.text(W - 70, 30, "🔊", { fontFamily:"monospace", fontSize:42, color:"#fff" })
      .setOrigin(0.5).setDepth(50).setInteractive({useHandCursor:true});
    if (typeof this.game._muted === "undefined") this.game._muted = false;
    else { muteBtn.setText(this.game._muted ? "🔇" : "🔊"); this.game._bgm?.setMute(this.game._muted); }
    muteBtn.on("pointerdown", () => {
      const s = this.game._bgm; const m = this.game._muted === true;
      s?.setMute(!m); this.game._muted = !m; muteBtn.setText(this.game._muted ? "🔇" : "🔊");
    });

    this.add.text(W/2, H*0.13, "FlappyBorgy", { fontFamily:"Georgia,serif", fontSize:64, color:"#0b4a44" }).setOrigin(0.5);

    // Affichage des Borgy Coins
    const coins = getBorgyCoins();
    this.add.text(W/2, H*0.19, `Borgy Coins : ${coins}`, {
      fontFamily:"monospace", fontSize:28, color:"#0b4a44", backgroundColor:"rgba(255,255,255,0.7)",
      padding:{ left:12, right:12, top:6, bottom:6 }
    }).setOrigin(0.5);

    // Leaderboard : si Hard activé, affiche le board Hard
    this.makeBtn(W/2, H*0.35, "Leaderboard", async () => {
      const isHard = this.game._hardMode === true;
      const list = await fetchLeaderboard(10, isHard);
      this.showLeaderboard(list, isHard);
    });

    this.makeBtn(W/2, H*0.27, "Jouer",       () => this.scene.start("game"));
    this.makeBtn(W/2, H*0.43, "Quêtes 🔥",   () => this.showQuests());

    // Bouton "Voter pour Borgy"
    this.makeBtn(W/2, H*0.51, "🗳️ Voter pour Borgy", () => {
      const url = "https://lewk.com/vote/BorGY4ub2Fz4RLboGxnuxWdZts7EKhUTB624AFmfCgX";
      if (window.Telegram?.WebApp?.openLink) {
        window.Telegram.WebApp.openLink(url);
      } else {
        window.open(url, "_blank");
      }
    });

    // Bouton "Buy Borgy"
    this.makeBtn(W/2, H*0.57, "Buy Borgy", () => {
      const url = "https://borgysol.com/";
      if (window.Telegram?.WebApp?.openLink) {
        window.Telegram.WebApp.openLink(url);
      } else {
        window.open(url, "_blank");
      }
    });

    // Bascule Hard juste en dessous
    if (typeof this.game._hardMode === "undefined") {
      try { this.game._hardMode = JSON.parse(localStorage.getItem("flappy_borgy_hard") || "false"); }
      catch { this.game._hardMode = false; }
    }
    const hardBtn = this.makeBtn(
      W/2,
      H*0.63,
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
    const t = this.add.text(x,y,label,{ fontFamily:"monospace", fontSize:34, color:"#fff",
      backgroundColor:"#12a38a", padding:{left:18,right:18,top:10,bottom:10} })
      .setOrigin(0.5).setInteractive({useHandCursor:true});
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
    const coins = getBorgyCoins();
    const W = this.scale.width, H = this.scale.height; const depth = 700;
    const panel = this.add.rectangle(W/2, H*0.5, W*0.82, H*0.58, 0x062b35, 0.94).setDepth(depth);
    const title = this.add.text(W/2, H*0.24, "Quêtes du jour", { fontFamily:"Georgia,serif", fontSize:60, color:"#ffffff" })
      .setOrigin(0.5).setDepth(depth+1);

    this.add.text(W/2, H*0.30, `Borgy Coins : ${coins}`, {
      fontFamily:"monospace", fontSize:26, color:"#fff"
    }).setOrigin(0.5).setDepth(depth+1);

    const startY = H*0.35, lineH = 80;
    data.quests.forEach((q, i) => {
      const y = startY + i*lineH; const pct = Math.min(1, q.progress / q.target);
      this.add.text(W*0.14, y, q.title, { fontFamily:"monospace", fontSize:26, color:q.done ? "#b3ffcf" : "#fff" })
        .setOrigin(0,0.5).setDepth(depth+1);
      const barW=W*0.40, barX=W*0.52;
      this.add.rectangle(barX, y, barW, 12, 0xffffff, 0.15).setOrigin(0,0.5).setDepth(depth+1);
      this.add.rectangle(barX, y, barW*pct, 12, q.done ? 0x15b665 : 0x17a689, 1).setOrigin(0,0.5).setDepth(depth+1);
      this.add.text(W*0.93, y, `${Math.min(q.progress, q.target)}/${q.target}`, { fontFamily:"monospace", fontSize:22, color:"#fff" })
        .setOrigin(1,0.5).setDepth(depth+1);
      this.add.text(W*0.14, y+24, `Récompense: ${q.rewardNormal}🪙 (Normal) / ${q.rewardHard}🪙 (Hard)`,
        { fontFamily:"monospace", fontSize:18, color:"#c3ede5" })
        .setOrigin(0,0.5).setDepth(depth+1);
    });
    const close = this.add.text(W/2, H*0.78, "Fermer", { fontFamily:"monospace", fontSize:40, color:"#fff",
      backgroundColor:"#0db187", padding:{left:26,right:26,top:10,bottom:10} })
      .setOrigin(0.5).setDepth(depth+1).setInteractive({useHandCursor:true});
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
    this.pipes = null; this.sensors = null; this.bonuses = null;
    this.coinItems = null;
    this.nextSpawnAt = Infinity; this.lastSpawnMs = -1;
    this.curSpeed = PROFILE.pipeSpeed; this.curDelay = PROFILE.spawnDelay;
    this.curGap   = PROFILE.gap;
    this.DEBUG = false; this.debugTxt = null;

    // Bonus x2 + aura Borgy
    this.multiplierActive = false;
    this.borgyAura = null;
    this.borgyAuraVisible = false;
    this.borgyAuraFlickerEvt = null;

    // Apparition des pièces Borgy
    this.pipesSinceCoin = 0;
    this.nextCoinIn = Phaser.Math.Between(COIN_MIN_PIPES, COIN_MAX_PIPES);
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

    this.pipes   = this.physics.add.group();
    this.sensors = this.physics.add.group();
    this.bonuses = this.physics.add.group();
    this.coinItems = this.physics.add.group();

    this.inputZone = this.add.zone(0,0,W,H).setOrigin(0,0).setInteractive();
    this.inputZone.on("pointerdown", () => this.onTap());
    this.input.keyboard.on("keydown-SPACE", () => this.onTap());

    this.scoreText = this.add.text(24, 18, "Score: 0",
      { fontFamily:"monospace", fontSize:46, color:"#fff", stroke:"#0a3a38", strokeThickness:8 }).setDepth(20);

    // Compteur de Borgy Coins (haut droit)
    const currentCoins = getBorgyCoins();
    this.coinsText = this.add.text(W - 32, 22, `🪙 ${currentCoins}`, {
      fontFamily:"monospace", fontSize:32, color:"#fff", stroke:"#0a3a38", strokeThickness:6
    }).setOrigin(1,0).setDepth(20);

    if (this.DEBUG){
      this.debugTxt = this.add.text(16, 64, "", { fontFamily:"monospace", fontSize: 16, color: "#bff" }).setDepth(20);
    }

    this.player = this.physics.add.sprite(W*0.18, H*((PLAYFIELD_TOP_PCT+PLAYFIELD_BOT_PCT)/2), "borgy")
      .setScale(PLAYER_SCALE).setDepth(10).setCollideWorldBounds(true);
    this.player.body.setAllowGravity(false);
    const pw = this.player.displayWidth, ph = this.player.displayHeight;
    this.player.body.setSize(pw*0.45, ph*0.45, true).setOffset(pw*0.215, ph*0.20);
    this.player.setGravityY(0);

    // Aura Borgy (bonus x2)
    this.borgyAura = this.add.image(this.player.x - 90, this.player.y - 6, "borgy")
      .setScale(PLAYER_SCALE * 0.7)
      .setDepth(9)
      .setAlpha(0);

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
      if (!bonus.active) return;
      bonus.destroy();
      this.activateMultiplier();
      updateQuestsFromEvent("bonus", 1, { isHard: this.game._hardMode === true });
    }, null, this);
    this.physics.add.overlap(this.player, this.coinItems, (_p, coin) => {
      if (!coin.active) return;
      const cx = coin.x, cy = coin.y;
      coin.destroy();
      this.collectBorgyCoin(cx, cy);
    }, null, this);

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
    this.coinItems.children.iterate(c => { if (c?.body) c.body.setVelocityX(this.curSpeed); });
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

      // premier spawn immédiat (pas de point)
      this.spawnPair(true);
      this.lastSpawnMs = this.time.now;
      this.nextSpawnAt = this.time.now + this.curDelay;

      this._maybeSwitchToHardMusic();

      updateQuestsFromEvent("game", 1, { isHard: this.game._hardMode === true });
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
    this.coinItems.children.iterate(c => { if (c && c.active && c.x < -KILL_MARGIN) c.destroy(); });

    // Aura Borgy suit le joueur
    if (this.borgyAura && this.borgyAuraVisible) {
      const targetX = this.player.x - 90;
      const targetY = this.player.y - 6;
      this.borgyAura.x = Phaser.Math.Linear(this.borgyAura.x, targetX, 0.25);
      this.borgyAura.y = Phaser.Math.Linear(this.borgyAura.y, targetY, 0.25);
    }

    if (this.DEBUG && this.debugTxt){
      this.debugTxt.setText(`speed:${this.curSpeed}  delay:${this.curDelay}  next:${Math.max(0, Math.ceil(this.nextSpawnAt - this.time.now))}ms`);
    }
  }

  // ===== util: met à jour l’échelle/physique d’un tuyau selon la position de sa "lèvre" =====
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

    // Hard : teinte “lave”
    if (this.game._hardMode === true) { topImg.setTint(0x6d1f12); bottomImg.setTint(0x6d1f12); }
    else { topImg.clearTint(); bottomImg.clearTint(); }

    this.pipes.add(topImg);
    this.pipes.add(bottomImg);

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
    this.pipesSinceCoin++;

    // BONUS SwissBorg : toujours dans le trou
    if (ENABLE_BONUS && this.started && (this.pairsSpawned % BONUS_EVERY === 0)){
      const maxOffset = Math.max(20, GAP * 0.25);
      let by = gapY + Phaser.Math.Between(-maxOffset, maxOffset);
      const innerTop = gapY - GAP/2 + 30;
      const innerBot = gapY + GAP/2 - 30;
      by = Phaser.Math.Clamp(by, innerTop, innerBot);

      const bonus = this.physics.add.image(x + 520, by, "bonus_sb")
        .setDepth(7).setScale(0.55).setImmovable(true);
      bonus.body.setAllowGravity(false);
      bonus.body.setVelocityX(this.curSpeed);

      // Hitbox un peu plus large
      const bw = bonus.displayWidth;
      const bh = bonus.displayHeight;
      bonus.body.setSize(bw*1.2, bh*1.2, true);

      this.bonuses.add(bonus);
    }

    // Pièce Borgy : tous les 5–10 couples, toujours dans l'écart
    if (this.started && this.pipesSinceCoin >= this.nextCoinIn){
      this.pipesSinceCoin = 0;
      this.nextCoinIn = Phaser.Math.Between(COIN_MIN_PIPES, COIN_MAX_PIPES);

      const coinOffsetMax = Math.max(20, GAP * 0.2);
      let cy = gapY + Phaser.Math.Between(-coinOffsetMax, coinOffsetMax);
      const coinInnerTop = gapY - GAP/2 + 35;
      const coinInnerBot = gapY + GAP/2 - 35;
      cy = Phaser.Math.Clamp(cy, coinInnerTop, coinInnerBot);

      const coin = this.physics.add.image(x + 480, cy, "coin_borgy")
        .setDepth(8)
        .setScale(0.20)
        .setImmovable(true);
      coin.body.setAllowGravity(false);
      coin.body.setVelocityX(this.curSpeed);

      const cw = coin.displayWidth;
      const ch = coin.displayHeight;
      coin.body.setSize(cw*1.2, ch*1.2, true);

      this.coinItems.add(coin);
    }

    /* ====== Animation porte (Hard uniquement) ====== */
    if (this.game._hardMode === true) {
      // amplitude sûre pour ne jamais passer sous MIN_GAP
      const maxClose = Math.max(0, Math.floor((GAP - MIN_GAP) / 2) - 2);
      const amp = Math.min(HARD_DOOR_AMPLITUDE_PX, maxClose);

      if (amp > 0) {
        const driver = { delta: 0 }; // delta >0 ferme, <0 ouvre
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
            // bornes de sécurité (empêche de sortir de la zone)
            const topClamped    = Phaser.Math.Clamp(newTop,    TOP_BAND + 10, RIM_LIMIT - 10);
            const bottomClamped = Phaser.Math.Clamp(newBottom, TOP_BAND + 10, BOT_BAND  - 10);

            this._resizePipeToRim(topImg, true,  topClamped,    scaleXt);
            this._resizePipeToRim(bottomImg, false, bottomClamped, scaleXb);

            // conserver la vitesse horizontale actuelle
            topImg.body.setVelocityX(this.curSpeed);
            bottomImg.body.setVelocityX(this.curSpeed);
          }
        });

        // Nettoyage du tween si les sprites disparaissent
        const stopTween = () => { try { tween.stop(); tween.remove(); } catch {} };
        topImg.once('destroy', stopTween);
        bottomImg.once('destroy', stopTween);
      }
    }
  }

  activateMultiplier(){
    this.multiplierActive = true;
    this.borgyAuraVisible = true;
    if (this.borgyAura) this.borgyAura.setAlpha(0.9);

    if (this.borgyAuraFlickerEvt) {
      this.borgyAuraFlickerEvt.remove(false);
      this.borgyAuraFlickerEvt = null;
    }

    const flickerStart = BONUS_DURATION - 3000;
    this.time.delayedCall(flickerStart, () => {
      if (!this.borgyAura) return;
      let on = true;
      this.borgyAura.setAlpha(0.9);
      this.borgyAuraFlickerEvt = this.time.addEvent({
        delay: 150,
        repeat: Math.floor(3000 / 150),
        callback: () => {
          if (!this.borgyAuraVisible) return;
          on = !on;
          this.borgyAura.setAlpha(on ? 0.9 : 0.25);
        }
      });
    });

    this.time.delayedCall(BONUS_DURATION, () => {
      this.multiplierActive = false;
      this.borgyAuraVisible = false;
      if (this.borgyAura) this.borgyAura.setAlpha(0);
      if (this.borgyAuraFlickerEvt) {
        this.borgyAuraFlickerEvt.remove(false);
        this.borgyAuraFlickerEvt = null;
      }
    });
  }

  collectBorgyCoin(x, y){
    const total = addBorgyCoins(1);
    if (this.coinsText) this.coinsText.setText(`🪙 ${total}`);

    const t = this.add.text(x, y - 40, "+1", {
      fontFamily:"monospace",
      fontSize:32,
      color:"#ffeb3b",
      stroke:"#000",
      strokeThickness:6
    }).setDepth(30).setOrigin(0.5);

    this.tweens.add({
      targets: t,
      y: y - 100,
      alpha: 0,
      duration: 700,
      ease: "Cubic.out",
      onComplete: () => t.destroy()
    });
  }

  addScore(n){
    this.score += this.multiplierActive ? n*2 : n;
    this.scoreText.setText("Score: " + this.score);
    updateQuestsFromEvent("score", this.score, { isHard: this.game._hardMode === true });
    if (!this.game._muted && this.sfxScore) this.sfxScore.play();
  }

  gameOver(){
    if (this.isOver) return;
    this.isOver = true; this.started = false;

    // 🔧 Empêche la zone d'input du jeu d'intercepter les clics sur les boutons d'overlay
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
    this.coinItems.clear(true, true);

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
