/* FlappyBorgy – menu + pipes + (option) bonus SwissBorg x2 (no audio) */

const GAME_W = 768;
const GAME_H = 1366;

const PROFILE = {
  gravity: 1400,
  jump: -380,
  pipeSpeed: -220,
  gap: 260,
  spawnDelay: 1450
};

const PIPE_W = 180;
const BORGY_SCALE = 0.22;
const THEME_PERIOD = 50;

// ---- BONUS (mettre à false pour désactiver sans toucher au reste) ----
const ENABLE_BONUS = true;
const BONUS_EVERY = 30;       // toutes les N paires générées
const BONUS_DURATION = 10000; // 10 s
const BONUS_AURA_COLOR = 0x22D6A1;
const BONUS_AURA_SOFT  = 0x9FFFE0;

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

    // pipes clairs/sombres (PNG transparents)
    this.load.image('pipe_light_top',    'pipe_light_top.png');
    this.load.image('pipe_light_bottom', 'pipe_light_bottom.png');
    this.load.image('pipe_dark_top',     'pipe_dark_top.png');
    this.load.image('pipe_dark_bottom',  'pipe_dark_bottom.png');

    // bonus (optionnel)
    if (ENABLE_BONUS) this.load.image('bonus_sb', 'sb_token_user.png');
  }
  create(){ this.scene.start('menu'); }
}

class MenuScene extends Phaser.Scene {
  constructor(){ super('menu'); }
  create(){
    const W = this.scale.width, H = this.scale.height;
    this.add.text(W/2, H*0.18, 'FlappyBorgy', { fontFamily:'Georgia,serif', fontSize:64, color:'#0b4a44' }).setOrigin(0.5);

    const play = this.makeBtn(W/2, H*0.32, 'Jouer', () => this.scene.start('game', { startTheme:'light' }));
    const quests = this.makeBtn(W/2, H*0.40, 'Quêtes', () => {
      quests.setText('Bientôt ✨'); this.time.delayedCall(1200, ()=>quests.setText('Quêtes'));
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
    this.score = 0;
    this.pairsSpawned = 0;
    this.started = false;
    this.theme = data?.startTheme || 'light';
    this.followCaps = [];

    // bonus
    this.multiplierActive = false;
    this.multTimer = null;
  }

  create(){
    const W = this.scale.width, H = this.scale.height;

    // score + label x2
    this.scoreText = this.add.text(24, 20, 'Score: 0', {
      fontFamily:'monospace', fontSize:48, color:'#fff', stroke:'#0a3a38', strokeThickness:8
    }).setDepth(20);
    this.multText = this.add.text(W-24, 24, '', {
      fontFamily:'monospace', fontSize:42, color:'#b1ffe6', stroke:'#007a62', strokeThickness:6
    }).setOrigin(1,0).setDepth(20);

    // groupe tuyaux
    this.pipes = this.physics.add.group();

    // joueur
    this.player = this.physics.add.sprite(W*0.22, H*0.45, 'borgy')
      .setScale(BORGY_SCALE).setDepth(10).setCollideWorldBounds(true);
    this.player.body.setAllowGravity(false);
    this.player.body.setSize(this.player.width*0.55, this.player.height*0.55, true)
                    .setOffset(this.player.width*0.225, this.player.height*0.25);

    // aura bonus
    this.aura = this.add.circle(this.player.x, this.player.y,
      Math.max(this.player.displayWidth, this.player.displayHeight)*0.7, BONUS_AURA_SOFT, 0.22)
      .setVisible(false).setDepth(9);

    // inputs
    this.input.on('pointerdown', () => this.handleInput());
    this.input.keyboard.on('keydown-SPACE', () => this.handleInput());

    // collisions
    this.physics.add.overlap(this.player, this.pipes, () => this.gameOver(), null, this);

    // première paire à l’écran (immobile tant qu’on n’a pas tap)
    this.spawnPair(true);

    // timer de spawn (tourne mais ne pousse des pairs que si started)
    this.spawnTimer = this.time.addEvent({
      delay: PROFILE.spawnDelay,
      loop: true,
      callback: () => { if (this.started) this.spawnPair(false); }
    });
  }

  handleInput(){
    if (!this.started){
      this.started = true;
      this.player.body.setAllowGravity(true);
      // mettre en mouvement tout ce qui existe déjà
      this.pipes.children.each(p => { if (p.body) p.body.setVelocityX(PROFILE.pipeSpeed); });
      // sensor éventuel déjà présent
      if (this._lastSensor?.body) this._lastSensor.body.setVelocityX(PROFILE.pipeSpeed);
      // relance un spawn immédiat
      this.spawnPair(false);
    }
    if (this.player.active) this.player.setVelocityY(PROFILE.jump);
  }

  update(t){
    const vy = this.player.body.velocity.y;
    if      (vy < -40) this.player.setAngle(-16);
    else if (vy > 140) this.player.setAngle(20);
    else               this.player.setAngle(0);

    // aura
    if (this.aura.visible){
      this.aura.x = this.player.x;
      this.aura.y = this.player.y;
      this.aura.alpha = 0.2 + 0.08 * Math.sin(t/180);
    }

    this.followCaps.forEach(fn => fn());
    this.pipes.children.each(ch => { if (ch.active && ch.x < -PIPE_W*1.8) ch.destroy(); });

    // bascule de thème
    if (this.pairsSpawned > 0 && this.pairsSpawned % THEME_PERIOD === 0){
      this.theme = (this.theme === 'light') ? 'dark' : 'light';
      this.pairsSpawned++; // pour éviter rebascule immédiate
    }
  }

  spawnPair(silentFirst){
    const W = this.scale.width, H = this.scale.height;
    const gap = PROFILE.gap;

    const minTop = 80;
    const maxTop = H - (gap + 180);
    const topY   = Phaser.Math.Clamp(Phaser.Math.Between(minTop, maxTop), minTop, maxTop);
    const holeCenter = topY + gap/2;

    const style = (this.theme === 'light') ? 'light' : 'dark';
    const keyTop = `pipe_${style}_top`;
    const keyBot = `pipe_${style}_bottom`;

    const topH = topY;
    const botH = H - (holeCenter + gap/2);
    const xStart = W + PIPE_W * 0.5;

    const topBody = this.physics.add.image(xStart, topH, keyTop)
      .setOrigin(0.5, 1).setDisplaySize(PIPE_W, Math.max(20, topH))
      .setImmovable(true).setDepth(5);
    const botBody = this.physics.add.image(xStart, H, keyBot)
      .setOrigin(0.5, 1).setFlipY(true)
      .setDisplaySize(PIPE_W, Math.max(20, botH))
      .setImmovable(true).setDepth(5);

    topBody.body.setAllowGravity(false);
    botBody.body.setAllowGravity(false);
    if (this.started){
      topBody.body.setVelocityX(PROFILE.pipeSpeed);
      botBody.body.setVelocityX(PROFILE.pipeSpeed);
    }
    this.pipes.add(topBody); this.pipes.add(botBody);

    // capteur de score
    const sensor = this.add.rectangle(xStart + PIPE_W/2 + 10, H*0.5, 8, H, 0x000000, 0);
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

    // BONUS: toutes les N paires (uniquement quand started)
    if (ENABLE_BONUS && this.started && (this.pairsSpawned % BONUS_EVERY === 0)){
      const by = Phaser.Math.Clamp(holeCenter + Phaser.Math.Between(-160,160), 200, H-220);
      this.spawnBonus(xStart + 520, by);
    }

    // nettoyage
    this.time.delayedCall(15000, () => [topBody, botBody, sensor].forEach(o => o && o.destroy()));
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
    const add = this.multiplierActive ? n*2 : n;
    this.score += add;
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
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTRE_BOTH || Phaser.Scale.CENTER_BOTH, width: GAME_W, height: GAME_H },
    physics: { default: 'arcade', arcade: { gravity:{y:0}, debug:false } },
    scene: [PreloadScene, MenuScene, GameScene]
  });
});
