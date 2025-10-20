/* FlappyBorgy — génération des tuyaux style “canvas” (anti halo), menu, score, bonus optionnel */

const GAME_W = 768, GAME_H = 1366;

const PROFILE = {
  gravity: 1000,
  jump: -380,
  pipeSpeed: -220,
  gap: 260,          // taille de l’ouverture
  spawnDelay: 1500   // ~1.5s, cohérent avec SPAWN_EVERY de ton snippet
};

// Hypothèses “style canvas” (padding transparent dans le PNG)
const PAD = 2;            // padding transparent sur la largeur (gauche/droite)
const PIPE_BODY_W = 0.92; // proportion utile (sans padding). On re-calculera en px via la largeur source.
const PIPE_W_DISPLAY = 180; // largeur d’affichage à l’écran

const THEME_PERIOD = 50;      // alterne clair/sombre tous les 50
const ENABLE_BONUS = true;    // bonus SwissBorg
const BONUS_EVERY = 30;
const BONUS_DURATION = 10000;
const BONUS_AURA_SOFT = 0x9FFFE0;

class PreloadScene extends Phaser.Scene {
  constructor(){ super('preload'); }
  preload(){
    const W = this.scale.width, H = this.scale.height;
    const bg = this.add.rectangle(W/2, H*0.55, W*0.52, 12, 0x000000, 0.15).setOrigin(0.5);
    const fg = this.add.rectangle(W*0.24, H*0.55, 2, 12, 0x17a689).setOrigin(0,0.5);
    const pct = this.add.text(W/2, H*0.55+26, '0%', {fontFamily:'monospace', fontSize:18, color:'#044'}).setOrigin(0.5);
    this.load.on('progress', p => { fg.width = (W*0.52) * p; pct.setText(Math.round(p*100)+'%'); });

    this.load.setPath('assets');
    this.load.image('borgy', 'borgy_ingame.png');

    // 2 thèmes (haut/bas)
    this.load.image('pipe_light_top',    'pipe_light_top.png');
    this.load.image('pipe_light_bottom', 'pipe_light_bottom.png');
    this.load.image('pipe_dark_top',     'pipe_dark_top.png');
    this.load.image('pipe_dark_bottom',  'pipe_dark_bottom.png');

    if (ENABLE_BONUS) this.load.image('bonus_sb', 'sb_token_user.png');
  }
  create(){ this.scene.start('menu'); }
}

class MenuScene extends Phaser.Scene {
  constructor(){ super('menu'); }
  create(){
    const W = this.scale.width, H = this.scale.height;
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

class GameScene extends Phaser.Scene {
  constructor(){ super('game'); }

  init(data){
    this.started = false;
    this.theme = data?.startTheme || 'light';

    this.score = 0;
    this.pairsSpawned = 0;
    this.followCaps = [];
    this._pipeTexInfo = null; // largeur brute des textures (pour crop+hitbox)

    // bonus
    this.multiplierActive = false;
    this.multTimer = null;
  }

  create(){
    const W = this.scale.width, H = this.scale.height;

    // Zone d’input plein écran
    this.inputZone = this.add.zone(0,0,W,H).setOrigin(0,0).setInteractive();
    this.inputZone.on('pointerdown', () => this.onTap());
    this.input.keyboard.on('keydown-SPACE', () => this.onTap());

    // UI
    this.scoreText = this.add.text(24, 20, 'Score: 0', {
      fontFamily:'monospace', fontSize:48, color:'#fff', stroke:'#0a3a38', strokeThickness:8
    }).setDepth(20);
    this.multText = this.add.text(W-24, 24, '', {
      fontFamily:'monospace', fontSize:42, color:'#b1ffe6', stroke:'#007a62', strokeThickness:6
    }).setOrigin(1,0).setDepth(20);

    // Groupe tuyaux
    this.pipes = this.physics.add.group();

    // Joueur
    this.player = this.physics.add.sprite(W*0.22, H*0.45, 'borgy')
      .setScale(0.22).setDepth(10).setCollideWorldBounds(true);
    this.player.body.setAllowGravity(false);
    this.player.body.setSize(this.player.width*0.55, this.player.height*0.55, true)
                    .setOffset(this.player.width*0.225, this.player.height*0.25);

    // Aura bonus
    this.aura = this.add.circle(this.player.x, this.player.y,
      Math.max(this.player.displayWidth, this.player.displayHeight)*0.7, BONUS_AURA_SOFT, 0.22)
      .setVisible(false).setDepth(9);

    // Collision player vs pipes
    this.physics.add.overlap(this.player, this.pipes, () => this.gameOver(), null, this);

    // Prépare infos textures (largeurs source) pour crop/hitbox anti halo
    this._pipeTexInfo = this.computeTextureInfo();

    // Première paire (immobile tant que non démarré)
    this.spawnPair(true);
  }

  computeTextureInfo(){
    const lightTop = this.textures.get('pipe_light_top').getSourceImage();
    const widthPx  = lightTop.width;      // largeur brute d’un PNG
    const usefulW  = Math.max(8, Math.floor(widthPx - PAD*2));  // zone utile sans padding
    return { widthPx, usefulW };
  }

  onTap(){
    if (!this.started){
      this.started = true;
      this.player.body.setAllowGravity(true);

      // mets en mouvement ce qui est déjà là
      this.pipes.children.iterate(p => { if (p?.body) p.body.setVelocityX(PROFILE.pipeSpeed); });
      if (this._lastSensor?.body) this._lastSensor.body.setVelocityX(PROFILE.pipeSpeed);

      // spawn immédiat + timer régulier
      this.spawnPair(false);
      this.spawnTimer && this.spawnTimer.remove(false);
      this.spawnTimer = this.time.addEvent({
        delay: PROFILE.spawnDelay,
        loop: true,
        callback: () => this.spawnPair(false)
      });
    }
    if (this.player.active) this.player.setVelocityY(PROFILE.jump);
  }

  update(t){
    const vy = this.player.body.velocity.y;
    if      (vy < -40) this.player.setAngle(-16);
    else if (vy > 140) this.player.setAngle(20);
    else               this.player.setAngle(0);

    if (this.aura.visible){
      this.aura.x = this.player.x;
      this.aura.y = this.player.y;
      this.aura.alpha = 0.2 + 0.08 * Math.sin(t/180);
    }

    this.followCaps.forEach(fn => fn());
    this.pipes.children.iterate(ch => { if (ch && ch.active && ch.x < -PIPE_W_DISPLAY*2) ch.destroy(); });

    // alternance de thème
    if (this.pairsSpawned > 0 && this.pairsSpawned % THEME_PERIOD === 0){
      this.theme = (this.theme === 'light') ? 'dark' : 'light';
      this.pairsSpawned++; // évite bascule multiple
    }
  }

  spawnPair(silentFirst){
    const W = this.scale.width, H = this.scale.height;
    const gap = PROFILE.gap;

    // Position du centre de la gap avec marges (style canvas)
    const margin = 60;
    const gapY = margin + gap/2 + Math.random() * (H - 2*margin - gap);

    const style = (this.theme === 'light') ? 'light' : 'dark';
    const keyTop = `pipe_${style}_top`;
    const keyBot = `pipe_${style}_bottom`;

    // Info textures pour crop/hitbox
    const srcW   = this._pipeTexInfo.widthPx;
    const useful = this._pipeTexInfo.usefulW;
    const cropX  = PAD;
    const cropW  = useful;

    // position X d’apparition
    const x = W + PIPE_W_DISPLAY * 0.6;

    // BOTTOM (sous le trou)
    const bottomImg = this.add.image(x, 0, keyBot).setDepth(5);
    bottomImg.setCrop(cropX, 0, cropW, bottomImg.height);
    bottomImg.setOrigin(0.5, 0); // ancre en haut
    // hauteur affichée = de gap bas jusqu’en bas écran
    const bottomH = H - (gapY + gap/2) + PAD;
    bottomImg.setDisplaySize(PIPE_W_DISPLAY, Math.max(20, bottomH));
    bottomImg.y = gapY + gap/2 - PAD;

    this.physics.add.existing(bottomImg, false);
    bottomImg.body.setAllowGravity(false).setImmovable(true);

    // hitbox = seulement la partie utile (comme dans ton AABB)
    const bodyWpx = PIPE_W_DISPLAY * (useful / srcW);
    const offsetX = (PIPE_W_DISPLAY - bodyWpx) / 2;
    bottomImg.body.setSize(bodyWpx, bottomImg.displayHeight, true);
    bottomImg.body.setOffset(offsetX, 0);

    if (this.started) bottomImg.body.setVelocityX(PROFILE.pipeSpeed);
    this.pipes.add(bottomImg);

    // TOP (au-dessus du trou)
    const topImg = this.add.image(x, 0, keyTop).setDepth(5);
    topImg.setCrop(cropX, 0, cropW, topImg.height);
    topImg.setOrigin(0.5, 1); // ancre en bas
    const topH = gapY - gap/2 + PAD;
    topImg.setDisplaySize(PIPE_W_DISPLAY, Math.max(20, topH));
    topImg.y = gapY - gap/2 + PAD;

    this.physics.add.existing(topImg, false);
    topImg.body.setAllowGravity(false).setImmovable(true);
    topImg.body.setSize(bodyWpx, topImg.displayHeight, true);
    topImg.body.setOffset(offsetX, topImg.displayHeight - topImg.body.height); // recalage

    if (this.started) topImg.body.setVelocityX(PROFILE.pipeSpeed);
    this.pipes.add(topImg);

    // Capteur score (fin et haut comme dans le canvas — dès qu’on dépasse le corps)
    const sensor = this.add.rectangle(x + bodyWpx/2 + 6, H*0.5, 8, H, 0x000000, 0);
    this.physics.add.existing(sensor, false);
    sensor.body.setAllowGravity(false).setImmovable(true);
    if (this.started) sensor.body.setVelocityX(PROFILE.pipeSpeed);
    sensor.isScore = !silentFirst;
    this._lastSensor = sensor;

    this.physics.add.overlap(this.player, sensor, () => {
      if (!sensor.active || !sensor.isScore) return;
      sensor.destroy();
      this.addScore(1);
    });

    this.pairsSpawned++;

    // Bonus occasionnel
    if (ENABLE_BONUS && this.started && (this.pairsSpawned % BONUS_EVERY === 0)){
      const by = Phaser.Math.Clamp(gapY + Phaser.Math.Between(-160,160), 200, H-220);
      this.spawnBonus(x + 520, by);
    }

    // Nettoyage retardé
    this.time.delayedCall(16000, () => [topImg, bottomImg, sensor].forEach(o => o && o.destroy()));
  }

  spawnBonus(x, y){
    const bonus = this.physics.add.image(x, y, 'bonus_sb')
      .setDepth(7).setScale(0.55).setImmovable(true);
    bonus.body.setAllowGravity(false);
    if (this.started) bonus.body.setVelocityX(PROFILE.pipeSpeed);

    this.physics.add.overlap(this.player, bonus, () => {
      if (!bonus.active) return;
      bonus.destroy();
      this.activateMultiplier();
    });

    this.time.delayedCall(12000, () => bonus && bonus.destroy());
  }

  activateMultiplier(){
    if (this.multTimer) this.multTimer.remove(false);
    this.multiplierActive = true;
    this.multText.setText('x2');
    this.aura.setVisible(true).setFillStyle(BONUS_AURA_SOFT, 0.28);
    this.multTimer = this.time.delayedCall(BONUS_DURATION, () => {
      this.multiplierActive = false;
      this.multText.setText('');
      this.aura.setVisible(false);
    });
  }

  addScore(n){
    this.score += this.multiplierActive ? n*2 : n;
    this.scoreText.setText('Score: ' + this.score);
  }

  gameOver(){
    if (!this.player.active) return;
    this.player.disableBody(true, false);
    this.player.setTint(0xff7a7a);
    this.spawnTimer && this.spawnTimer.remove(false);

    const W = this.scale.width, H = this.scale.height;
    this.add.rectangle(W/2, H/2, W*0.8, 360, 0x12323a, 0.92).setDepth(100);
    this.add.text(W/2, H/2 - 110, 'Game Over', { fontFamily:'Georgia,serif', fontSize:72, color:'#fff' }).setOrigin(0.5).setDepth(101);
    this.add.text(W/2, H/2 - 30, `Score : ${this.score}`, { fontFamily:'monospace', fontSize:52, color:'#cffff1' }).setOrigin(0.5).setDepth(101);
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
    scene: [PreloadScene, MenuScene, GameScene]
  });
});
