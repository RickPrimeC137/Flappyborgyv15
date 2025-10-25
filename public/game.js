/* FlappyBorgy — montagnes 1024x1536 (pipes light only + Telegram leaderboard)
   Domaine du jeu : https://flappyborgyv15.onrender.com
   API : https://rickprimec137-flappyborgyv15.onrender.com
*/

const TG = window.Telegram?.WebApp || null;
if (TG) { try { TG.ready(); TG.expand(); } catch {} }

// ========= Constantes jeu =========
const GAME_W = 1024, GAME_H = 1536;

const PROFILE = {
  gravity: 1400,
  jump: -380,
  pipeSpeed: -220,
  gap: 270,
  spawnDelay: 2000
};

const PAD = 2;
const PIPE_BODY_W = 0.92;
const PIPE_W_DISPLAY = 180;
const PLAYER_SCALE = 0.17;

const BG_KEY = 'bg_mountains';
const PLAYFIELD_TOP_PCT = 0.16;
const PLAYFIELD_BOT_PCT = 0.90;
const PIPE_RIM_MAX_PCT  = 0.82;

const PIPE_OVERSCAN = 160;
const JOINT_OVERLAP = 1;
const KILL_MARGIN   = 260;

const ENABLE_KILL_BANDS = true;
const ENABLE_BONUS = true;
const BONUS_EVERY = 30;
const BONUS_DURATION = 10000;

// ================== LEADERBOARD (client) ==================
const API_BASE = "https://rickprimec137-flappyborgyv15.onrender.com";

function tgInitData(){ try { return TG?.initData || null; } catch { return null; } }
async function postScore(score){
  const initData = tgInitData();
  if (!initData) return;
  try{
    await fetch(`${API_BASE}/api/score`, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
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

/* ================== PRELOAD ================== */
class PreloadScene extends Phaser.Scene {
  constructor(){ super('preload'); }
  preload(){
    const W = this.scale.width, H = this.scale.height;
    const bg = this.add.rectangle(W/2, H*0.55, W*0.52, 12, 0x000000, 0.15).setOrigin(0.5);
    const fg = this.add.rectangle(W*0.24, H*0.55, 2, 12, 0x17a689).setOrigin(0,0.5);
    const pct = this.add.text(W/2, H*0.55+26, '0%', {fontFamily:'monospace', fontSize:18, color:'#044'}).setOrigin(0.5);
    this.load.on('progress', p => { fg.width = (W*0.52) * p; pct.setText(Math.round(p*100)+'%'); });

    this.load.setPath('assets');
    this.load.image(BG_KEY, 'bg_mountains.jpg');
    this.load.image('borgy', 'borgy_ingame.png');
    this.load.image('pipe_top',    'pipe_light_top.png');
    this.load.image('pipe_bottom', 'pipe_light_bottom.png');
    if (ENABLE_BONUS) this.load.image('bonus_sb', 'sb_token_user.png');
  }
  create(){ this.scene.start('menu'); }
}

/* ================== MENU ================== */
class MenuScene extends Phaser.Scene {
  constructor(){ super('menu'); }
  create(){
    const W = this.scale.width, H = this.scale.height;
    const bg = this.add.image(W/2, H/2, BG_KEY).setDepth(-20);
    bg.setScale(Math.max(W/bg.width, H/bg.height)).setScrollFactor(0);

    this.add.text(W/2, H*0.13, 'FlappyBorgy', { fontFamily:'Georgia,serif', fontSize:64, color:'#0b4a44' }).setOrigin(0.5);
    this.makeBtn(W/2, H*0.27, 'Jouer',  () => this.scene.start('game'));
    this.makeBtn(W/2, H*0.35, 'Leaderboard', async () => {
      const list = await fetchLeaderboard(10);
      this.showLeaderboard(list);
    });
    this.add.text(W/2, H*0.92, 'Tap/Espace pour sauter — évitez les tuyaux',
      { fontFamily:'monospace', fontSize:22, color:'#0b4a44', align:'center' }).setOrigin(0.5);
  }
  makeBtn(x,y,label,cb){
    const t = this.add.text(x,y,label,{ fontFamily:'monospace', fontSize:34, color:'#fff',
      backgroundColor:'#12a38a', padding:{left:18,right:18,top:10,bottom:10} })
      .setOrigin(0.5).setInteractive({useHandCursor:true});
    t.on('pointerover', ()=> t.setBackgroundColor('#0f8e78'));
    t.on('pointerout',  ()=> t.setBackgroundColor('#12a38a'));
    t.on('pointerdown', cb);
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
}

/* ================== GAME ================== */
class GameScene extends Phaser.Scene {
  constructor(){ super('game'); }

  init(){
    this.started = false;
    this.isOver  = false;

    this.score = 0;
    this.pairsSpawned = 0;

    this.pipes   = null;
    this.sensors = null;
    this.bonuses = null;

    // Accumulateur pour spawns (remplace le timer)
    this.spawnAcc = 0;
  }

  create(){
    const W = this.scale.width, H = this.scale.height;

    const bg = this.add.image(W/2, H/2, BG_KEY).setDepth(-10);
    bg.setScale(Math.max(W/bg.width, H/bg.height)).setScrollFactor(0);
    this.cameras.main.roundPixels = true;

    this.pipes   = this.physics.add.group();
    this.sensors = this.physics.add.group();
    this.bonuses = this.physics.add.group();

    this.inputZone = this.add.zone(0,0,W,H).setOrigin(0,0).setInteractive();
    this.inputZone.on('pointerdown', () => this.onTap());
    this.input.keyboard.on('keydown-SPACE', () => this.onTap());

    this.scoreText = this.add.text(24, 18, 'Score: 0', {
      fontFamily:'monospace', fontSize:46, color:'#fff', stroke:'#0a3a38', strokeThickness:8
    }).setDepth(20);

    this.player = this.physics.add.sprite(W*0.18, H*((PLAYFIELD_TOP_PCT+PLAYFIELD_BOT_PCT)/2), 'borgy')
      .setScale(PLAYER_SCALE)
      .setDepth(10)
      .setCollideWorldBounds(true);
    this.player.body.setAllowGravity(false);

    const pw = this.player.displayWidth;
    const ph = this.player.displayHeight;
    this.player.body
      .setSize(pw * 0.45, ph * 0.45, true)
      .setOffset(pw * 0.215, ph * 0.20);
    this.player.setGravityY(0);

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

    this.physics.add.overlap(this.player, this.pipes, () => this.gameOver(), null, this);
    this.physics.add.overlap(this.player, this.sensors, (_player, sensor) => {
      if (this.isOver || !sensor.active || !sensor.isScore) return;
      sensor.isScore = false;
      sensor.destroy();
      this.addScore(1);
    }, null, this);

    this.physics.add.overlap(this.player, this.bonuses, (_player, bonus) => {
      if (!bonus.active) return;
      bonus.destroy();
      this.activateMultiplier();
    }, null, this);

    // 1ʳᵉ paire affichée mais immobile
    this.spawnPair(true);
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

      // Met en mouvement la paire initiale
      this.pipes.children.iterate(p => p?.body?.setVelocityX(PROFILE.pipeSpeed));
      this.sensors.children.iterate(s => s?.body?.setVelocityX(PROFILE.pipeSpeed));

      // Reset de l’accumulateur de spawn
      this.spawnAcc = 0;

      try { TG?.expand?.(); } catch {}
    }
    if (this.player.active) this.player.setVelocityY(PROFILE.jump);
  }

  update(_time, delta){
    if (this.isOver) return;

    // Inclinaison du joueur
    const vy = this.player.body.velocity.y;
    if      (vy < -40) this.player.setAngle(-16);
    else if (vy > 140) this.player.setAngle(20);
    else               this.player.setAngle(0);

    // Spawner via accumulateur (fiable WebView)
    if (this.started){
      this.spawnAcc += delta;
      while (this.spawnAcc >= PROFILE.spawnDelay){
        this.spawnAcc -= PROFILE.spawnDelay;
        this.spawnPair(false);
      }
    }

    // Kill de sûreté à gauche
    this.pipes.children.iterate(p => {
      if (!p || !p.active) return;
      if (p.x + p.displayWidth*0.5 < -KILL_MARGIN) p.destroy();
    });
    this.sensors.children.iterate(s => { if (s && s.active && s.x < -KILL_MARGIN) s.destroy(); });
    this.bonuses.children.iterate(b => { if (b && b.active && b.x < -KILL_MARGIN) b.destroy(); });
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
    if (maxY < minY) { const c = Math.round((TOP_BAND + BOT_BAND)/2); minY = maxY = c; }
    const gapY = Phaser.Math.Between(minY, maxY);

    const x = W + PIPE_W_DISPLAY * 0.6;
    const vx = this.started ? PROFILE.pipeSpeed : 0;

    const topImg    = this.physics.add.image(x, 0, 'pipe_top'   ).setDepth(6).setOrigin(0.5, 1);
    const bottomImg = this.physics.add.image(x, 0, 'pipe_bottom').setDepth(6).setOrigin(0.5, 0);

    const scaleXt  = PIPE_W_DISPLAY / topImg.width;
    const scaleXb  = PIPE_W_DISPLAY / bottomImg.width;

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
      const by = Phaser.Math.Clamp(gapY + Phaser.Math.Between(-160,160),
        H*PLAYFIELD_TOP_PCT+40, H*PLAYFIELD_BOT_PCT-40);
      const bonus = this.physics.add.image(x + 520, by, 'bonus_sb')
        .setDepth(7).setScale(0.55).setImmovable(true);
      bonus.body.setAllowGravity(false);
      bonus.body.setVelocityX(PROFILE.pipeSpeed);
      this.bonuses.add(bonus);
    }

    // debug court
    try { console.log('[spawn] pair', { x, gapY, GAP, vx }); } catch {}
  }

  activateMultiplier(){
    this.multiplierActive = true;
    this.time.delayedCall(BONUS_DURATION, () => { this.multiplierActive = false; });
  }

  addScore(n){
    this.score += this.multiplierActive ? n*2 : n;
    this.scoreText.setText('Score: ' + this.score);
  }

  gameOver(){
    if (this.isOver) return;
    this.isOver = true;
    this.started = false;

    this.pipes.clear(true, true);
    this.sensors.clear(true, true);
    this.bonuses.clear(true, true);

    const W = this.scale.width, H = this.scale.height;
    this.add.rectangle(W/2, H/2, W*0.8, 320, 0x12323a, 0.92).setDepth(100);
    this.add.text(W/2, H/2 - 100, 'Game Over', { fontFamily:'Georgia,serif', fontSize:68, color:'#fff' })
      .setOrigin(0.5).setDepth(101);
    this.add.text(W/2, H/2 - 28, `Score : ${this.score}`, { fontFamily:'monospace', fontSize:48, color:'#cffff1' })
      .setOrigin(0.5).setDepth(101);

    const replay = this.add.text(W/2, H/2 + 60, 'Rejouer', {
      fontFamily:'monospace', fontSize:44, color:'#fff',
      backgroundColor:'#0db187', padding:{left:22,right:22,top:10,bottom:10}
    }).setOrigin(0.5).setDepth(101).setInteractive({useHandCursor:true});
    replay.on('pointerdown', ()=> this.scene.restart());

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

window.addEventListener('load', () => {
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-root',
    backgroundColor: '#9edff1',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: GAME_W, height: GAME_H },
    physics: { default: 'arcade', arcade: { gravity:{y:0}, debug:false } },
    scene: [PreloadScene, MenuScene, GameScene],
    pixelArt: true,
    fps: { target: 60, min: 30, forceSetTimeOut: true }
  });
});
