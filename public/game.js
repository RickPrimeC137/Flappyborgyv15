/* FlappyBorgy — mobile clean build (fond train, limites visuelles, anti-fantômes) */

const GAME_W = 768, GAME_H = 1366;

const PROFILE = {
  gravity: 1400,
  jump: -380,
  pipeSpeed: -220,       // px/s (vers la gauche)
  gap: 260,              // ouverture par défaut
  spawnDelay: 2000       // rythme proche Flappy Bird
};

const PAD = 2;
const PIPE_BODY_W = 0.92;   // % de largeur utile de hitbox
const PIPE_W_DISPLAY = 180;

// Taille du joueur
const PLAYER_SCALE = 0.16;

// Fond & bande jouable (en % de la hauteur écran)
const BG_KEY = 'bg_train';
const PLAYFIELD_TOP_PCT = 0.20;   // haut de la zone de gaps
const PLAYFIELD_BOT_PCT = 0.95;   // bas de la zone de gaps

// Limite de rebord bas: empêche le tuyau du bas de descendre dans la zone “train/sol”
const PIPE_RIM_MAX_PCT = 0.78;    // ajuste 0.76–0.80 selon ton image

const THEME_PERIOD = 50;
const ENABLE_BONUS = true;
const BONUS_EVERY = 30;
const BONUS_DURATION = 10000;

// Anti “réapparition” & couverture bord d’écran
const KILL_MARGIN = 260;  // px à gauche avant destruction forcée
const EXTRA_LEN   = 80;   // (non utilisé pour la hauteur, gardé pour compat)

// Couverture totale + joints sans jour
const PIPE_OVERSCAN = 140;   // dépassement haut/bas pour couvrir l'écran
const JOINT_OVERLAP = 1;     // chevauchement de 1 px au joint haut/bas

// >>> Nouveauté : bandes de mort (empêche de sortir de la zone jouable)
const ENABLE_KILL_BANDS = true;

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
    this.load.image(BG_KEY, 'bg_train.png'); // portrait 768x1366
    this.load.image('borgy', 'borgy_ingame.png');
    this.load.image('pipe_light_top',    'pipe_light_top.png');
    this.load.image('pipe_light_bottom', 'pipe_light_bottom.png');
    this.load.image('pipe_dark_top',     'pipe_dark_top.png');
    this.load.image('pipe_dark_bottom',  'pipe_dark_bottom.png');
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

    this.add.text(W/2, H*0.18, 'FlappyBorgy', { fontFamily:'Georgia,serif', fontSize:64, color:'#0b4a44' }).setOrigin(0.5);
    this.makeBtn(W/2, H*0.32, 'Jouer', () => this.scene.start('game', { startTheme:'light' }));
    this.makeBtn(W/2, H*0.40, 'Quêtes', () => {
      const t = this.add.text(W/2, H*0.48, 'Quêtes (à venir) ✨', {fontFamily:'monospace', fontSize:28, color:'#0b4a44'}).setOrigin(0.5);
      this.time.delayedCall(1500, ()=>t.destroy());
    });
    this.add.text(W/2, H*0.86, 'Tap/Espace pour sauter\nÉvitez les tuyaux',
      { fontFamily:'monospace', fontSize:24, color:'#0b4a44', align:'center' }).setOrigin(0.5);
  }
  makeBtn(x,y,label,cb){
    const t = this.add.text(x,y,label,{ fontFamily:'monospace', fontSize:36, color:'#fff',
      backgroundColor:'#12a38a', padding:{left:18,right:18,top:12,bottom:10} })
      .setOrigin(0.5).setInteractive({useHandCursor:true});
    t.on('pointerover', ()=> t.setBackgroundColor('#0f8e78'));
    t.on('pointerout',  ()=> t.setBackgroundColor('#12a38a'));
    t.on('pointerdown', cb);
    return t;
  }
}

/* ================== GAME ================== */
class GameScene extends Phaser.Scene {
  constructor(){ super('game'); }

  init(data){
    this.started = false;
    this.isOver  = false;
    this.theme = data?.startTheme || 'light';

    this.score = 0;
    this.pairsSpawned = 0;
    this.spawnAccum = 0;

    this.movers = [];
  }

  create(){
    const W = this.scale.width, H = this.scale.height;

    // Fond
    const bg = this.add.image(W/2, H/2, BG_KEY).setDepth(-10);
    bg.setScale(Math.max(W/bg.width, H/bg.height)).setScrollFactor(0);

    // Arrondi des positions (évite les seams)
    this.cameras.main.roundPixels = true;

    // Zone d’input plein écran
    this.inputZone = this.add.zone(0,0,W,H).setOrigin(0,0).setInteractive();
    this.inputZone.on('pointerdown', () => this.onTap());
    this.input.keyboard.on('keydown-SPACE', () => this.onTap());

    // UI
    this.scoreText = this.add.text(24, 20, 'Score: 0', {
      fontFamily:'monospace', fontSize:48, color:'#fff', stroke:'#0a3a38', strokeThickness:8
    }).setDepth(20);

    // Groupe tuyaux (pour collisions)
    this.pipes = this.physics.add.group();

    // Joueur
    this.player = this.physics.add.sprite(W*0.18, H*((PLAYFIELD_TOP_PCT+PLAYFIELD_BOT_PCT)/2), 'borgy')
      .setScale(PLAYER_SCALE)
      .setDepth(10)
      .setCollideWorldBounds(true);
    this.player.body.setAllowGravity(false);

    // Hitbox
    const pw = this.player.displayWidth;
    const ph = this.player.displayHeight;
    this.player.body
      .setSize(pw * 0.45, ph * 0.45, true)
      .setOffset(pw * 0.215, ph * 0.20);

    this.player.setGravityY(0); // avant le départ

    // >>> Bandes de mort invisibles (empêchent le hors-zone)
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

    // Collisions player vs pipes
    this.physics.add.overlap(this.player, this.pipes, () => this.gameOver(), null, this);

    // Première paire (immobile tant que non démarré)
    this.spawnPair(true);
  }

  onTap(){
    if (this.isOver){
      this.scene.restart({ startTheme: this.theme });
      return;
    }
    if (!this.started){
      this.started = true;
      this.player.body.setAllowGravity(true);
      this.player.setGravityY(PROFILE.gravity);
      this.spawnAccum = 0;
    }
    if (this.player.active) this.player.setVelocityY(PROFILE.jump);
  }

  update(time, delta){
    if (this.isOver) return;

    // inclinaison du joueur
    const vy = this.player.body.velocity.y;
    if      (vy < -40) this.player.setAngle(-16);
    else if (vy > 140) this.player.setAngle(20);
    else               this.player.setAngle(0);

    // cadence spawn
    if (this.started){
      this.spawnAccum += delta;
      while (this.spawnAccum >= PROFILE.spawnDelay){
        this.spawnAccum -= PROFILE.spawnDelay;
        this.spawnPair(false);
      }
    }

    // mouvement manuel + sync bodies
    if (this.started){
      const dx = PROFILE.pipeSpeed * (delta / 1000);
      for (let i = this.movers.length - 1; i >= 0; i--){
        const o = this.movers[i];
        if (!o || !o.active) { this.movers.splice(i,1); continue; }
        o.x += dx;
        if (o.body?.updateFromGameObject) o.body.updateFromGameObject();
        if (o.x < -KILL_MARGIN) { o.destroy(); this.movers.splice(i,1); }
      }
    }

    // Kill de sûreté
    this.pipes?.children?.iterate(p => {
      if (!p || !p.active) return;
      if (p.x + p.displayWidth * 0.5 < -KILL_MARGIN) p.destroy();
    });
    if (this._lastSensor?.active && this._lastSensor.x < -KILL_MARGIN) {
      this._lastSensor.destroy();
    }

    // alternance de thème
    if (this.pairsSpawned > 0 && this.pairsSpawned % THEME_PERIOD === 0){
      this.theme = (this.theme === 'light') ? 'dark' : 'light';
      this.pairsSpawned++; // évite le rebouclage
    }
  }

  // ========= spawnPair ROBUSTE =========
  spawnPair(silentFirst){
    const W = this.scale.width, H = this.scale.height;

    // 1) Bornes sûres (liées au décor)
    const TOP_BAND  = Math.round(H * PLAYFIELD_TOP_PCT);
    const BOT_BAND  = Math.round(H * PLAYFIELD_BOT_PCT);
    const RIM_LIMIT = Math.round(H * PIPE_RIM_MAX_PCT); // rebord bas max

    // gap effectif (protège si la bande jouable est trop petite)
    const playable = Math.max(40, BOT_BAND - TOP_BAND);
    const MIN_GAP = 90; // mini jouable si on doit réduire
    const GAP = Math.round(Phaser.Math.Clamp(PROFILE.gap, MIN_GAP, playable - 40));

    // centre du gap borné
    let minY = TOP_BAND + Math.floor(GAP/2);
    let maxY = Math.min(BOT_BAND - Math.floor(GAP/2), RIM_LIMIT - Math.floor(GAP/2) + PAD);
    if (maxY < minY) { const c = Math.round((TOP_BAND + BOT_BAND)/2); minY = maxY = c; }
    const gapY = Phaser.Math.Between(minY, maxY);

    // 2) Clés d’assets
    const style = (this.theme === 'light') ? 'light' : 'dark';
    const keyTop = `pipe_${style}_top`;
    const keyBot = `pipe_${style}_bottom`;

    const x = W + PIPE_W_DISPLAY * 0.6; // spawn à droite

    // 3) Sprites (origins: top=0.5,1 / bottom=0.5,0)
    const topImg    = this.physics.add.image(x, 0, keyTop).setDepth(6).setOrigin(0.5, 1);
    const bottomImg = this.physics.add.image(x, 0, keyBot).setDepth(6).setOrigin(0.5, 0);

    const nativeWt = topImg.width,  nativeHt = topImg.height;
    const nativeWb = bottomImg.width, nativeHb = bottomImg.height;
    const scaleXt  = PIPE_W_DISPLAY / nativeWt;
    const scaleXb  = PIPE_W_DISPLAY / nativeWb;

    // 4) Visuel robuste (overscan + chevauchement + arrondis)
    const yTopRim    = Math.round(gapY - GAP/2 + (PAD - JOINT_OVERLAP));
    const yBottomRim = Math.round(gapY + GAP/2 - (PAD - JOINT_OVERLAP));

    const topH    = Math.max(20, Math.ceil(yTopRim + PIPE_OVERSCAN));           // du haut de l'écran jusqu'au rim haut
    const bottomH = Math.max(20, Math.ceil((H - yBottomRim) + PIPE_OVERSCAN));  // du rim bas au bas de l'écran

    topImg.setScale(scaleXt, topH / nativeHt);
    bottomImg.setScale(scaleXb, bottomH / nativeHb);

    topImg.y    = yTopRim;     // rim haut
    bottomImg.y = yBottomRim;  // rim bas

    // 5) Bodies & collisions
    const displayWt = nativeWt * scaleXt;
    topImg.setImmovable(true).body.setAllowGravity(false);
    topImg.body.setSize(displayWt * PIPE_BODY_W, topImg.displayHeight, true);
    topImg.body.setOffset((displayWt - displayWt*PIPE_BODY_W)/2, topImg.displayHeight - topImg.body.height);

    const displayWb = nativeWb * scaleXb;
    bottomImg.setImmovable(true).body.setAllowGravity(false);
    bottomImg.body.setSize(displayWb * PIPE_BODY_W, bottomImg.displayHeight, true);
    bottomImg.body.setOffset((displayWb - displayWb*PIPE_BODY_W)/2, 0);

    topImg.setData('isPipe', true);
    bottomImg.setData('isPipe', true);
    this.pipes.add(topImg);
    this.pipes.add(bottomImg);
    this.movers.push(topImg, bottomImg);

    // 6) Sensor score
    const sensor = this.add.rectangle(x + (PIPE_W_DISPLAY*PIPE_BODY_W)/2 + 6, H*0.5, 8, H, 0x000000, 0);
    this.physics.add.existing(sensor, false);
    sensor.body.setAllowGravity(false).setImmovable(true);
    sensor.isScore = !silentFirst;
    sensor.setData('isSensor', true);
    this._lastSensor = sensor;
    this.movers.push(sensor);

    this.physics.add.overlap(this.player, sensor, () => {
      if (this.isOver || !sensor.active || !sensor.isScore) return; // garde si crash
      sensor.destroy();
      this.addScore(1);
    });

    this.pairsSpawned++;

    // bonus
    if (ENABLE_BONUS && this.started && (this.pairsSpawned % BONUS_EVERY === 0)){
      const by = Phaser.Math.Clamp(gapY + Phaser.Math.Between(-160,160),
        GAME_H*PLAYFIELD_TOP_PCT+40, GAME_H*PLAYFIELD_BOT_PCT-40);
      this.spawnBonus(x + 520, by);
    }

    // fail-safe cleanup
    this.time.delayedCall(16000, () => [topImg, bottomImg, sensor].forEach(o => o && o.destroy()));
  }

  spawnBonus(x, y){
    const bonus = this.physics.add.image(x, y, 'bonus_sb')
      .setDepth(7).setScale(0.55).setImmovable(true);
    bonus.body.setAllowGravity(false);
    this.movers.push(bonus);

    this.physics.add.overlap(this.player, bonus, () => {
      if (!bonus.active) return;
      bonus.destroy();
      this.activateMultiplier();
    });

    this.time.delayedCall(12000, () => bonus && bonus.destroy());
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

    // stoppe tous les timers/DelayedCall attachés à la scène
    this.time.removeAllEvents();

    // nettoie
    this.movers.forEach(o => o?.destroy());
    this.movers = [];
    this.pipes.clear(true, true);
    if (this._lastSensor?.active) this._lastSensor.destroy();

    // UI Game Over
    const W = this.scale.width, H = this.scale.height;
    this.add.rectangle(W/2, H/2, W*0.8, 360, 0x12323a, 0.92).setDepth(100);
    this.add.text(W/2, H/2 - 110, 'Game Over', { fontFamily:'Georgia,serif', fontSize:72, color:'#fff' })
      .setOrigin(0.5).setDepth(101);
    this.add.text(W/2, H/2 - 30, `Score : ${this.score}`, { fontFamily:'monospace', fontSize:52, color:'#cffff1' })
      .setOrigin(0.5).setDepth(101);

    const replay = this.add.text(W/2, H/2 + 70, 'Rejouer', {
      fontFamily:'monospace', fontSize:48, color:'#fff',
      backgroundColor:'#0db187', padding:{left:22,right:22,top:10,bottom:10}
    }).setOrigin(0.5).setDepth(101).setInteractive({useHandCursor:true});
    replay.on('pointerdown', ()=> this.scene.restart({ startTheme: this.theme }));
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
    pixelArt: true    // rendu net pour le style pixel
  });
});
