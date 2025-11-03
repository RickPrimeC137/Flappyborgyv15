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
  jump: -380,
  pipeSpeed: -220,
  gap: 270,
  spawnDelay: 2400
};

const PAD = 2;
const PIPE_BODY_W    = 0.92;
const PIPE_W_DISPLAY = 180;
const PLAYER_SCALE   = 0.16;

const BG_KEY = "bg_mountains";
const BG_HARD_KEY = "bg_volcano";   // 🔥 nouveau fond pour le mode Hard (assets/bg_volcano.jpg)
const PLAYFIELD_TOP_PCT = 0.15;
const PLAYFIELD_BOT_PCT = 0.90;
const PIPE_RIM_MAX_PCT  = 0.82;

const PIPE_OVERSCAN = 160;
const JOINT_OVERLAP = 1;
const KILL_MARGIN   = 260;

const ENABLE_KILL_BANDS = true;

const ENABLE_BONUS = true;
const BONUS_EVERY = 30;
const BONUS_DURATION = 10000;

/* ============ Musique de fond (unique, 2 pistes possibles) ============ */
function ensureBgm(scene) {
  const gm = scene.game;

  if (!gm._bgm || gm._bgm.isDestroyed) {
    const key = Math.random() < 0.5 ? "bgm" : "bgm_alt";
    gm._bgm = scene.sound.add(key, {
      loop: true,
      volume: 0.35,
    });
    if (gm._muted === true) {
      gm._bgm.setMute(true);
    }
  }

  const start = () => { if (!gm._bgm.isPlaying) gm._bgm.play(); };

  if (scene.sound.locked) {
    scene.input.once("pointerdown", start);
    scene.input.keyboard?.once("keydown-SPACE", start);
  } else {
    start();
  }

  scene.game.events.off(Phaser.Core.Events.BLUR);
  scene.game.events.off(Phaser.Core.Events.FOCUS);
  scene.game.events.on(Phaser.Core.Events.BLUR, () => gm._bgm?.pause());
  scene.game.events.on(Phaser.Core.Events.FOCUS, () => {
    if (!scene.sound.locked) gm._bgm?.resume();
  });
}

/* ======= Difficulté / anti-superposition ======= */
const DIFF = {
  stepMs: 12500,
  speedDelta: -20,
  delayDelta: -150,
  minSpeed: -380,
  minDelay: 1100,
  cooldownMs: 250
};
const SPAWN_X_OFFSET = PIPE_W_DISPLAY * 0.6;

/* ================== LEADERBOARD (client) ================== */
const API_BASE = "https://rickprimec137-flappyborgyv15.onrender.com";
function tgInitData(){ try { return TG?.initData || null; } catch { return null; } }
async function postScore(score){
  const initData = tgInitData();
  if (!initData) return;
  try{
    await fetch(`${API_BASE}/api/score`, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ score, initData })
    });
  }catch(e){ console.warn("score post error", e); }
}
async function fetchLeaderboard(limit=10){
  try{
    const r = await fetch(`${API_BASE}/api/leaderboard?limit=${limit}`);
    const j = await r.json();
    return j.ok ? j.list : [];
  }catch(e){ console.warn("lb fetch error", e); return []; }
}

/* ================== PETIT GESTIONNAIRE DE QUÊTES ================== */
const QUEST_STORAGE_KEY = "flappy_borgy_quests_v1";
/* modèle:
  {
    quests: [
      { id:"score50", title:"Atteins 50 points",   type:"score",   target:50,  progress:0, done:false, reward:"+50 xp" },
      { id:"score150",title:"Atteins 150 points",  type:"score",   target:150, progress:0, done:false, reward:"+150 xp" },
      { id:"bonus1",  title:"Ramasse 1 bonus",     type:"bonus",   target:1,   progress:0, done:false, reward:"Cosmétique ?" }
    ]
  }
*/
function loadQuests(){
  try{
    const raw = localStorage.getItem(QUEST_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  }catch(e){}
  const base = {
    quests: [
      { id:"score50",  title:"Atteins 50 points",  type:"score", target:50,  progress:0, done:false, reward:"+50 pts" },
      { id:"score150", title:"Atteins 150 points", type:"score", target:150, progress:0, done:false, reward:"+150 pts" },
      { id:"bonus1",   title:"Ramasse 1 bonus",    type:"bonus", target:1,   progress:0, done:false, reward:"Sticker 🎉" },
    ]
  };
  saveQuests(base);
  return base;
}
function saveQuests(data){
  try{ localStorage.setItem(QUEST_STORAGE_KEY, JSON.stringify(data)); }catch(e){}
}
function updateQuestsFromEvent(evt, value){
  // evt = "score" ou "bonus" ou "game"
  const data = loadQuests();
  let changed = false;
  for (const q of data.quests){
    if (q.done) continue;
    if (q.type === "score" && evt === "score") {
      const v = Math.max(q.progress, value);
      if (v !== q.progress){
        q.progress = v;
        if (q.progress >= q.target) { q.done = true; }
        changed = true;
      }
    }
    if (q.type === "bonus" && evt === "bonus") {
      q.progress += 1;
      if (q.progress >= q.target) { q.done = true; }
      changed = true;
    }
    if (q.type === "game" && evt === "game") {
      q.progress += 1;
      if (q.progress >= q.target) { q.done = true; }
      changed = true;
    }
  }
  if (changed) saveQuests(data);
  return changed;
}

/* ================== PRELOAD (vidéo DOM + barre) ================== */
class PreloadScene extends Phaser.Scene {
  constructor(){ super("preload"); }

  init(){
    const root = document.getElementById("game-root") || document.body;
    const vid = document.createElement("video");
    vid.src = "assets/intro.mp4";
    vid.autoplay = true;
    vid.loop = true;
    vid.muted = true;
    vid.playsInline = true;
    vid.style.position = "absolute";
    vid.style.left = "50%";
    vid.style.top = "9%";
    vid.style.transform = "translateX(-50%)";
    vid.style.width = "62%";
    vid.style.maxWidth = "520px";
    vid.style.borderRadius = "14px";
    vid.style.zIndex = "9999";
    vid.style.pointerEvents = "none";
    root.appendChild(vid);
    this._loadingVideoEl = vid;
  }

  preload(){
    const W = this.scale.width, H = this.scale.height;

    this.load.setPath("assets");

    // fonds
    this.load.image(BG_KEY,        "bg_mountains.jpg");
    this.load.image(BG_HARD_KEY,   "bg_volcano.jpg"); // 🔥 fond Hard

    // sprites & pipes
    this.load.image("borgy",       "borgy_ingame.png");
    this.load.image("pipe_top",    "pipe_light_top.png");
    this.load.image("pipe_bottom", "pipe_light_bottom.png");

    // audio
    this.load.audio("bgm", "bgm.mp3");
    this.load.audio("bgm_alt", "audio_a19c0824bd.mp3");
    this.load.audio("sfx_gameover", "flappy-borgy-game-over-C.wav");
    this.load.audio("sfx_score",    "flappy_borgy_wouf_chiot_0_2s.wav");

    if (ENABLE_BONUS) this.load.image("bonus_sb", "sb_token_user.png");

    // barre de chargement
    const bgBar = this.add.rectangle(W/2, H*0.8, W*0.52, 12, 0x000000, 0.25).setOrigin(0.5);
    const fgBar = this.add.rectangle(W*0.24, H*0.8, 2, 12, 0x17a689).setOrigin(0,0.5);
    const pct   = this.add.text(W/2, H*0.8+26, "0%", {fontFamily:"monospace", fontSize:18, color:"#fff"}).setOrigin(0.5);
    this.load.on("progress", p => {
      fgBar.width = (W*0.52)*p;
      pct.setText(Math.round(p*100)+"%");
    });
  }

  create(){
    if (this._loadingVideoEl) {
      this._loadingVideoEl.remove();
      this._loadingVideoEl = null;
    }
    this.scene.start("menu");
  }
}

/* ================== MENU ================== */
class MenuScene extends Phaser.Scene {
  constructor(){ super("menu"); }
  create(){
    const W = this.scale.width, H = this.scale.height;

    // BG du menu : toujours le fond standard (on ne le change pas ici)
    const bg = this.add.image(W/2, H/2, BG_KEY).setDepth(-20);
    bg.setScale(Math.max(W/bg.width, H/bg.height)).setScrollFactor(0);

    ensureBgm(this);

    const muteBtn = this.add.text(W - 70, 30, "🔊", {
      fontFamily: "monospace",
      fontSize: 42,
      color: "#fff"
    })
      .setOrigin(0.5)
      .setDepth(50)
      .setInteractive({ useHandCursor: true });

    if (typeof this.game._muted === "undefined") {
      this.game._muted = false;
    } else {
      muteBtn.setText(this.game._muted ? "🔇" : "🔊");
      if (this.game._bgm) this.game._bgm.setMute(this.game._muted);
    }

    muteBtn.on("pointerdown", () => {
      const s = this.game._bgm;
      const currentlyMuted = this.game._muted === true;
      if (s) s.setMute(!currentlyMuted);
      this.game._muted = !currentlyMuted;
      muteBtn.setText(this.game._muted ? "🔇" : "🔊");
    });

    this.add.text(W/2, H*0.13, "FlappyBorgy", { fontFamily:"Georgia,serif", fontSize:64, color:"#0b4a44" }).setOrigin(0.5);
    this.makeBtn(W/2, H*0.27, "Jouer",       () => this.scene.start("game"));
    this.makeBtn(W/2, H*0.35, "Leaderboard", async () => {
      const list = await fetchLeaderboard(10);
      this.showLeaderboard(list);
    });
    this.makeBtn(W/2, H*0.43, "Quêtes 🔥",   () => this.showQuests());

    // 🗳️ Bouton “Voter pour Borgy”
    this.makeBtn(W/2, H*0.51, "🗳️ Voter pour Borgy", () => {
      const url = "https://lewk.com/vote/BorGY4ub2Fz4RLboGxnuxWdZts7EKhUTB624AFmfCgX";
      if (window.Telegram?.WebApp?.openLink) {
        window.Telegram.WebApp.openLink(url);
      } else {
        window.open(url, "_blank");
      }
    });

    // 🔀 Bouton de bascule Mode Hard
    if (typeof this.game._hardMode === "undefined") {
      try {
        this.game._hardMode = JSON.parse(localStorage.getItem("flappy_borgy_hard") || "false");
      } catch { this.game._hardMode = false; }
    }
    const hardBtn = this.makeBtn(W/2, H*0.59,
      this.game._hardMode ? "Mode Hard : ON" : "Mode Hard : OFF",
      () => {
        this.game._hardMode = !this.game._hardMode;
        localStorage.setItem("flappy_borgy_hard", JSON.stringify(this.game._hardMode));
        hardBtn.setText(this.game._hardMode ? "Mode Hard : ON" : "Mode Hard : OFF");
        hardBtn.setBackgroundColor(this.game._hardMode ? "#b91c1c" : "#12a38a"); // rouge = Hard
      }
    );
    hardBtn.setBackgroundColor(this.game._hardMode ? "#b91c1c" : "#12a38a");

    this.add.text(W/2, H*0.92, "Tap/Espace pour sauter — évitez les tuyaux",
      { fontFamily:"monospace", fontSize:22, color:"#0b4a44", align:"center" }).setOrigin(0.5);
  }
  makeBtn(x,y,label,cb){
    const t = this.add.text(x,y,label,{
      fontFamily:"monospace", fontSize:34, color:"#fff",
      backgroundColor:"#12a38a",
      padding:{left:18,right:18,top:10,bottom:10}
    }).setOrigin(0.5).setInteractive({useHandCursor:true});
    t.on("pointerover", ()=> t.setBackgroundColor("#0f8e78"));
    t.on("pointerout",  ()=> t.setBackgroundColor("#12a38a"));
    t.on("pointerdown", cb);
    return t;
  }
  showLeaderboard(list){
    const W = this.scale.width, H = this.scale.height;
    const depth = 500;
    const panel = this.add.rectangle(W/2, H*0.5, W*0.78, H*0.6, 0x0a2a2f, 0.92).setDepth(depth);
    const title = this.add.text(W/2, H*0.22, "Leaderboard", {
      fontFamily:"Georgia,serif", fontSize:60, color:"#ffffff"
    }).setOrigin(0.5).setDepth(depth+1);

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

    const close = this.add.text(W/2, H*0.82, "Fermer", {
      fontFamily:"monospace", fontSize:44, color:"#fff",
      backgroundColor:"#0db187", padding:{left:22,right:22,top:8,bottom:8}
    }).setOrigin(0.5).setDepth(depth+1).setInteractive({useHandCursor:true});
    const destroyAll = () =>
      [panel, title, close, ...this.children.list.filter(o => o.depth>=depth && !o.input)].forEach(o => o?.destroy());
    close.on("pointerdown", destroyAll);
  }
  showQuests(){
    const data = loadQuests();
    const W = this.scale.width, H = this.scale.height;
    const depth = 700;

    const panel = this.add.rectangle(W/2, H*0.5, W*0.82, H*0.58, 0x062b35, 0.94).setDepth(depth);
    const title = this.add.text(W/2, H*0.26, "Quêtes du jour", {
      fontFamily:"Georgia,serif", fontSize:60, color:"#ffffff"
    }).setOrigin(0.5).setDepth(depth+1);

    const startY = H*0.33;
    const lineH = 72;
    data.quests.forEach((q, i) => {
      const y = startY + i*lineH;
      const pct = Math.min(1, q.progress / q.target);
      this.add.text(W*0.14, y, q.title, {
        fontFamily:"monospace", fontSize:30, color:q.done ? "#b3ffcf" : "#fff"
      }).setOrigin(0,0.5).setDepth(depth+1);

      // barre de progression
      const barW = W*0.38;
      const barX = W*0.54;
      this.add.rectangle(barX, y, barW, 12, 0xffffff, 0.15).setOrigin(0,0.5).setDepth(depth+1);
      this.add.rectangle(barX, y, barW*pct, 12, q.done ? 0x15b665 : 0x17a689, 1).setOrigin(0,0.5).setDepth(depth+1);

      this.add.text(W*0.93, y, `${Math.min(q.progress, q.target)}/${q.target}`, {
        fontFamily:"monospace", fontSize:24, color:"#fff"
      }).setOrigin(1,0.5).setDepth(depth+1);

      this.add.text(W*0.14, y+28, `Récompense: ${q.reward}`, {
        fontFamily:"monospace", fontSize:18, color:"#c3ede5"
      }).setOrigin(0,0.5).setDepth(depth+1);
    });

    const close = this.add.text(W/2, H*0.78, "Fermer", {
      fontFamily:"monospace", fontSize:40, color:"#fff",
      backgroundColor:"#0db187", padding:{left:26,right:26,top:10,bottom:10}
    }).setOrigin(0.5).setDepth(depth+1).setInteractive({useHandCursor:true});

    const destroyAll = () =>
      [panel, title, close, ...this.children.list.filter(o => o.depth>=depth && !o.input)].forEach(o => o?.destroy());
    close.on("pointerdown", destroyAll);
  }
}

/* ================== GAME ================== */
class GameScene extends Phaser.Scene {
  constructor(){ super("game"); }

  init(){
    this.started = false;
    this.isOver  = false;

    this.score = 0;
    this.pairsSpawned = 0;

    this.pipes   = null;
    this.sensors = null;
    this.bonuses = null;

    this.nextSpawnAt = Infinity;
    this.lastSpawnMs = -1;

    this.curSpeed = PROFILE.pipeSpeed;
    this.curDelay = PROFILE.spawnDelay;

    this.DEBUG = false;
    this.debugTxt = null;
  }

  create(){
    const W = this.scale.width, H = this.scale.height;

    ensureBgm(this);

    // 🗻 Choix du fond selon le mode
    const bgKeyToUse = (this.game._hardMode === true) ? BG_HARD_KEY : BG_KEY;
    const bg = this.add.image(W/2, H/2, bgKeyToUse).setDepth(-10);
    bg.setScale(Math.max(W/bg.width, H/bg.height)).setScrollFactor(0);
    this.cameras.main.roundPixels = true;

    this.pipes   = this.physics.add.group();
    this.sensors = this.physics.add.group();
    this.bonuses = this.physics.add.group();

    this.inputZone = this.add.zone(0,0,W,H).setOrigin(0,0).setInteractive();
    this.inputZone.on("pointerdown", () => this.onTap());
    this.input.keyboard.on("keydown-SPACE", () => this.onTap());

    this.scoreText = this.add.text(24, 18, "Score: 0", {
      fontFamily:"monospace", fontSize:46, color:"#fff", stroke:"#0a3a38", strokeThickness:8
    }).setDepth(20);

    if (this.DEBUG){
      this.debugTxt = this.add.text(16, 64, "", { fontFamily: "monospace", fontSize: 16, color: "#bff" }).setDepth(20);
    }

    this.player = this.physics.add.sprite(W*0.18, H*((PLAYFIELD_TOP_PCT+PLAYFIELD_BOT_PCT)/2), "borgy")
      .setScale(PLAYER_SCALE)
      .setDepth(10)
      .setCollideWorldBounds(true);
    this.player.body.setAllowGravity(false);

    const pw = this.player.displayWidth, ph = this.player.displayHeight;
    this.player.body.setSize(pw*0.45, ph*0.45, true).setOffset(pw*0.215, ph*0.20);
    this.player.setGravityY(0);

    // sfx
    this.sfxGameOver = this.sound.add("sfx_gameover", { volume: 0.75 });
    this.sfxScore    = this.sound.add("sfx_score",    { volume: 0.6 });

    if (ENABLE_KILL_BANDS){
      const topBand = Math.round(H * PLAYFIELD_TOP_PCT);
      const botBand = Math.round(H * PLAYFIELD_BOT_PCT);
      this.killTop = this.add.rectangle(W/2, topBand/2, W, topBand, 0x00ff00, 0).setDepth(0);
      this.physics.add.existing(this.killTop, true);
      this.killBottom = this.add.rectangle(W/2, (H + botBand)/2, W, H - botBand, 0xff0000, 0).setDepth(0);
      this.physics.add.existing(this.killBottom, true);
      this.physics.add.overlap(this.player, this.killTop,    () => this.gameOver(), null, this);
      this.physics.add.overlap(this.player, this.killBottom, () => this.gameOver(), null, this);
    }

    this.physics.add.overlap(this.player, this.pipes,   () => this.gameOver(), null, this);
    this.physics.add.overlap(this.player, this.sensors, (_p, sensor) => {
      if (this.isOver || !sensor.active || !sensor.isScore) return;
      sensor.isScore = false;
      sensor.destroy();
      this.addScore(1);
    }, null, this);
    this.physics.add.overlap(this.player, this.bonuses, (_p, bonus) => {
      if (!bonus.active) return;
      bonus.destroy();
      this.activateMultiplier();
      updateQuestsFromEvent("bonus", 1);
    }, null, this);

    this.time.addEvent({
      delay: DIFF.stepMs,
      loop: true,
      callback: () => {
        this.curSpeed = Math.max(DIFF.minSpeed, this.curSpeed + DIFF.speedDelta);
        this.curDelay = Math.max(DIFF.minDelay, this.curDelay + DIFF.delayDelta);
        if (this.started) {
          this.nextSpawnAt = Math.max(this.time.now + this.curDelay, this.nextSpawnAt);
        }
      }
    });
  }

  onTap(){
    if (this.isOver){
      this.scene.restart();
      return;
    }

    if (!this.started){
      this.started = true;
      this.player.body.setAllowGravity(true);
      this.player.setGravityY(PROFILE.gravity);

      this.nextSpawnAt = this.time.now + this.curDelay;
      this.lastSpawnMs = -1;

      // comptabilise "une partie lancée"
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

    if (this.started){
      this.pipes.children.iterate(p => { if (p?.body) p.body.setVelocityX(this.curSpeed); });
      this.sensors.children.iterate(s => { if (s?.body) s.body.setVelocityX(this.curSpeed); });
      this.bonuses.children.iterate(b => { if (b?.body) b.body.setVelocityX(this.curSpeed); });
    }

    this.pipes.children.iterate(p => { if (p && p.active && (p.x + p.displayWidth*0.5 < -KILL_MARGIN)) p.destroy(); });
    this.sensors.children.iterate(s => { if (s && s.active && s.x < -KILL_MARGIN) s.destroy(); });
    this.bonuses.children.iterate(b => { if (b && b.active && b.x < -KILL_MARGIN) b.destroy(); });

    if (this.DEBUG && this.debugTxt){
      this.debugTxt.setText(`speed:${this.curSpeed}  delay:${this.curDelay}  next:${Math.max(0, Math.ceil(this.nextSpawnAt - this.time.now))}ms`);
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
    const GAP = Math.round(Phaser.Math.Clamp(PROFILE.gap, MIN_GAP, playable - 40));

    let minY = TOP_BAND + Math.floor(GAP/2);
    let maxY = Math.min(BOT_BAND - Math.floor(GAP/2), RIM_LIMIT - Math.floor(GAP/2) + PAD);
    if (maxY < minY) {
      const c = Math.round((TOP_BAND + BOT_BAND)/2);
      minY = maxY = c;
    }
    const gapY = Phaser.Math.Between(minY, maxY);

    const x  = W + SPAWN_X_OFFSET;
    const vx = this.started ? this.curSpeed : 0;

    const topImg    = this.physics.add.image(x, 0, "pipe_top"   ).setDepth(6).setOrigin(0.5, 1);
    const bottomImg = this.physics.add.image(x, 0, "pipe_bottom").setDepth(6).setOrigin(0.5, 0);

    const scaleXt = PIPE_W_DISPLAY / topImg.width;
    const scaleXb = PIPE_W_DISPLAY / bottomImg.width;

    const yTopRim    = Math.round(gapY - GAP/2 + (PAD - JOINT_OVERLAP));
    const yBottomRim = Math.round(gapY + GAP/2 - (PAD - JOINT_OVERLAP));

    const topH    = Math.max(20, Math.ceil(yTopRim + PIPE_OVERSCAN));
    const bottomH = Math.max(20, Math.ceil((H - yBottomRim) + PIPE_OVERSCAN));

    topImg.setScale(scaleXt, topH / topImg.height);
    bottomImg.setScale(scaleXb, bottomH / bottomImg.height);

    topImg.y    = yTopRim;
    bottomImg.y = yBottomRim;

    const displayWt = topImg.width * scaleXt;
    topImg.setImmovable(true).body.setAllowGravity(false);
    topImg.body.setSize(displayWt * PIPE_BODY_W, topImg.displayHeight, true);
    topImg.body.setOffset((displayWt - displayWt*PIPE_BODY_W)/2, topImg.displayHeight - topImg.body.height);
    topImg.body.setVelocityX(vx);

    const displayWb = bottomImg.width * scaleXb;
    bottomImg.setImmovable(true).body.setAllowGravity(false);
    bottomImg.body.setSize(displayWb * PIPE_BODY_W, bottomImg.displayHeight, true);
    bottomImg.body.setOffset((displayWb - displayWb*PIPE_BODY_W)/2, 0);
    bottomImg.body.setVelocityX(vx);

    this.pipes.add(topImg);
    this.pipes.add(bottomImg);

    const sensorX = x + (PIPE_W_DISPLAY*PIPE_BODY_W)/2 + 6;
    const sensor = this.add.rectangle(sensorX, H*0.5, 8, H, 0x000000, 0);
    this.physics.add.existing(sensor, false);
    sensor.body.setAllowGravity(false);
    sensor.body.setImmovable(true);
    sensor.body.setVelocityX(vx);
    sensor.isScore = !silentFirst;
    this.sensors.add(sensor);

    this.pairsSpawned++;

    if (ENABLE_BONUS && this.started && (this.pairsSpawned % BONUS_EVERY === 0)){
      const by = Phaser.Math.Clamp(
        gapY + Phaser.Math.Between(-160,160),
        H*PLAYFIELD_TOP_PCT+40,
        H*PLAYFIELD_BOT_PCT-40
      );
      const bonus = this.physics.add.image(x + 520, by, "bonus_sb")
        .setDepth(7).setScale(0.55).setImmovable(true);
      bonus.body.setAllowGravity(false);
      bonus.body.setVelocityX(this.curSpeed);
      this.bonuses.add(bonus);
    }
  }

  activateMultiplier(){
    this.multiplierActive = true;
    this.time.delayedCall(BONUS_DURATION, () => { this.multiplierActive = false; });
  }

  addScore(n){
    this.score += this.multiplierActive ? n*2 : n;
    this.scoreText.setText("Score: " + this.score);

    // quêtes score
    updateQuestsFromEvent("score", this.score);

    if (!this.game._muted && this.sfxScore) {
      this.sfxScore.play();
    }
  }

  gameOver(){
    if (this.isOver) return;
    this.isOver = true;
    this.started = false;

    if (!this.game._muted && this.sfxGameOver) {
      const bgm = this.game._bgm;
      if (bgm) bgm.setVolume(0.15);
      this.sfxGameOver.once("complete", () => {
        if (bgm && !this.game._muted) bgm.setVolume(0.35);
      });
      this.sfxGameOver.play();
    }

    this.pipes.clear(true, true);
    this.sensors.clear(true, true);
    this.bonuses.clear(true, true);

    const W = this.scale.width, H = this.scale.height;
    this.add.rectangle(W/2, H/2, W*0.8, 360, 0x12323a, 0.92).setDepth(100);
    this.add.text(W/2, H/2 - 110, "Game Over", { fontFamily:"Georgia,serif", fontSize:68, color:"#fff" })
      .setOrigin(0.5).setDepth(101);
    this.add.text(W/2, H/2 - 28, `Score : ${this.score}`, { fontFamily:"monospace", fontSize:48, color:"#cffff1" })
      .setOrigin(0.5).setDepth(101);

    const replay = this.add.text(W/2, H/2 + 50, "Rejouer", {
      fontFamily:"monospace", fontSize:44, color:"#fff",
      backgroundColor:"#0db187", padding:{left:22,right:22,top:10,bottom:10}
    }).setOrigin(0.5).setDepth(101).setInteractive({useHandCursor:true});
    replay.on("pointerdown", ()=> this.scene.restart());

    const menuBtn = this.add.text(W/2, H/2 + 140, "Menu principal", {
      fontFamily:"monospace", fontSize:40, color:"#fff",
      backgroundColor:"#0a8ea1", padding:{left:22,right:22,top:8,bottom:8}
    }).setOrigin(0.5).setDepth(101).setInteractive({useHandCursor:true});
    menuBtn.on("pointerdown", () => {
      const bgm = this.game._bgm;
      if (bgm && !this.game._muted) bgm.setVolume(0.35);
      this.scene.start("menu");
    });

    postScore(this.score).then(() =>
      fetchLeaderboard(10).then(list => { if (list?.length) this.showLeaderboard(list); })
    );
  }

  showLeaderboard(list){
    const W = this.scale.width, H = this.scale.height;
    const depth = 300;
    const panel = this.add.rectangle(W/2, H*0.5, W*0.78, H*0.6, 0x0a2a2f, 0.92).setDepth(depth);
    const title = this.add.text(W/2, H*0.22, "Leaderboard", {
      fontFamily:"Georgia,serif", fontSize:60, color:"#ffffff"
    }).setOrigin(0.5).setDepth(depth+1);

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

    const close = this.add.text(W/2, H*0.82, "Fermer", {
      fontFamily:"monospace", fontSize:44, color:"#fff",
      backgroundColor:"#0db187", padding:{left:22,right:22,top:8,bottom:8}
    }).setOrigin(0.5).setDepth(depth+1).setInteractive({useHandCursor:true});
    const destroyAll = () =>
      [panel, title, close, ...this.children.list.filter(o => o.depth>=depth && !o.input)].forEach(o => o?.destroy());
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
