/*  FlappyBorgy – v15
 *  Scenes: Preload -> Start -> Game
 *  Phaser 3 requis (déjà inclus dans index.html)
 */

/* ---------------- Constantes ---------------- */
const PROFILE = {
  gravity: 1400,
  jump: -380,
  pipeSpeed: -220,
  gap: 230
};

const BORGY_SCALE   = 0.18;   // taille du joueur
const PIPE_W        = 100;    // largeur apparente du fût
const SPAWN_EVERY   = 1600;   // délai entre paires (ms)

const BONUS_EVERY   = 50;     // toutes les 50 paires
const BONUS_DURATION= 10000;  // 10s
const AURA_SOFT     = 0x9FFFE0;

/* Styles de tuyaux (corps + capot) */
const PIPE_STYLES = [
  { body:'pipe_graphite',  cap:'cap_graphite'  },
  { body:'pipe_hexghost',  cap:'cap_hexghost'  },
  { body:'pipe_mintglass', cap:'cap_mintglass' },
  { body:'pipe_neonedge',  cap:'cap_neonedge'  },
  { body:'pipe_porcelain', cap:'cap_porcelain' },
  { body:'pipe_brushed',   cap:'cap_brushed'   },
  { body:'pipe_dualband',  cap:'cap_dualband'  },
  { body:'pipe_frosted',   cap:'cap_frosted'   },
];

/* ---------------- Boot du jeu ---------------- */
window.addEventListener('load', () => {
  const config = {
    type: Phaser.AUTO,
    parent: 'game-root',
    backgroundColor: '#9EE1F2',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 768,
      height: 1366,
    },
    physics: {
      default: 'arcade',
      arcade: { gravity: { y: 0 }, debug: false }
    },
    scene: [PreloadScene, StartScene, GameScene]
  };
  new Phaser.Game(config);
});

/* =========================================================
   PRELOAD
   ========================================================= */
function PreloadScene(){ Phaser.Scene.call(this,{key:'preload'}); }
PreloadScene.prototype = Object.create(Phaser.Scene.prototype);
PreloadScene.prototype.constructor = PreloadScene;

PreloadScene.prototype.preload = function(){
  const W = this.scale.width, H = this.scale.height;

  // Barre de chargement
  const barBg = this.add.rectangle(W/2, H/2, 360, 8, 0x000000, 0.15).setOrigin(0.5);
  const bar   = this.add.rectangle(W/2-180, H/2, 1, 8, 0x00a67e).setOrigin(0,0.5);
  const pct   = this.add.text(W/2, H/2+24, '0%', {fontFamily:'monospace',fontSize:18,color:'#055'}).setOrigin(0.5);

  this.load.on('progress', v => { bar.width = 360*v; pct.setText((v*100|0)+'%'); });

  // Chemin commun
  this.load.setPath('assets');

  // ===== ASSETS =====
  // Joueur
  this.load.image('borgy_ingame','borgy_ingame.png');
  // Bonus
  this.load.image('sb_token','sb_token_user.png');
  // Pipes + caps (noms EXACTS requis côté fichiers)
  this.load.image('pipe_graphite',  'pipe_v2_graphite.png');
  this.load.image('cap_graphite',   'cap_v2_graphite.png');
  this.load.image('pipe_hexghost',  'pipe_v2_hexghost.png');
  this.load.image('cap_hexghost',   'cap_v2_hexghost.png');
  this.load.image('pipe_mintglass', 'pipe_v2_mintglass.png');
  this.load.image('cap_mintglass',  'cap_v2_mintglass.png');
  this.load.image('pipe_neonedge',  'pipe_v2_neonedge.png');
  this.load.image('cap_neonedge',   'cap_v2_neonedge.png');
  this.load.image('pipe_porcelain', 'pipe_v2_porcelain.png');
  this.load.image('cap_porcelain',  'cap_v2_porcelain.png');
  this.load.image('pipe_brushed',   'pipe_v2_brushed.png');
  this.load.image('cap_brushed',    'cap_v2_brushed.png');
  this.load.image('pipe_dualband',  'pipe_v2_dualband.png');
  this.load.image('cap_dualband',   'cap_v2_dualband.png');
  this.load.image('pipe_frosted',   'pipe_v2_frosted.png');
  this.load.image('cap_frosted',    'cap_v2_frosted.png');
};

PreloadScene.prototype.create = function(){
  this.scene.start('start');
};

/* =========================================================
   START (menu principal)
   ========================================================= */
function StartScene(){ Phaser.Scene.call(this,{key:'start'}); }
StartScene.prototype = Object.create(Phaser.Scene.prototype);
StartScene.prototype.constructor = StartScene;

StartScene.prototype.create = function(){
  const W = this.scale.width, H = this.scale.height;

  this.add.text(W/2, H*0.22, 'FlappyBorgy v15', {
    fontFamily:'monospace', fontSize:'64px', color:'#084',
    stroke:'#000', strokeThickness:8
  }).setOrigin(0.5);

  const borgy = this.add.image(W/2, H*0.43, 'borgy_ingame')
    .setScale(BORGY_SCALE*1.4);
  this.tweens.add({ targets: borgy, y: borgy.y-12, yoyo:true, repeat:-1, duration:900, ease:'sine.inOut' });

  const btn = this.add.text(W/2, H*0.70, 'JOUER', {
    fontFamily:'monospace', fontSize:'60px', color:'#fff',
    backgroundColor:'#0db187',
    padding:{left:36,right:36,top:14,bottom:14}
  }).setOrigin(0.5).setInteractive({useHandCursor:true}).setDepth(10);

  this.add.text(W/2, H*0.78, 'Touchez l’écran pour voler', {
    fontFamily:'monospace', fontSize:'28px', color:'#055'
  }).setOrigin(0.5);

  btn.on('pointerdown', () => this.scene.start('game'));
};

/* =========================================================
   GAME
   ========================================================= */
function GameScene(){ Phaser.Scene.call(this,{key:'game'}); }
GameScene.prototype = Object.create(Phaser.Scene.prototype);
GameScene.prototype.constructor = GameScene;

GameScene.prototype.init = function(){
  this.score = 0;
  this.pipesPassed = 0;
  this.multiplierActive = false;
  this.spawnCount = 0;
  this.skinIndex = 0;
  this.started = false;
};

GameScene.prototype.create = function(){
  const W = this.scale.width, H = this.scale.height;

  // Texte score + multiplicateur
  this.scoreText = this.add.text(24, 24, 'Score: 0', {
    fontFamily:'monospace', fontSize:'44px', color:'#0b4',
    stroke:'#000', strokeThickness:6
  }).setDepth(50);

  this.multText = this.add.text(W-24, 24, '', {
    fontFamily:'monospace', fontSize:'40px', color:'#b1ffe6',
    stroke:'#007a62', strokeThickness:6
  }).setOrigin(1,0).setDepth(50);

  // Joueur (gravité coupée au départ)
  this.player = this.physics.add.image(W*0.25, H*0.45, 'borgy_ingame')
    .setScale(BORGY_SCALE)
    .setCollideWorldBounds(true)
    .setDepth(10);
  const r = Math.max(this.player.width, this.player.height)*0.22;
  this.player.setCircle(r, this.player.width/2 - r, this.player.height/2 - r);
  this.player.body.setAllowGravity(false);

  // Aura bonus
  this.aura = this.add.circle(this.player.x, this.player.y,
    Math.max(this.player.displayWidth, this.player.displayHeight)*0.65,
    AURA_SOFT, 0.22).setVisible(false).setDepth(9);

  // Groupes de collision
  this.pipesTop    = this.physics.add.group({ allowGravity:false, immovable:true });
  this.pipesBottom = this.physics.add.group({ allowGravity:false, immovable:true });

  // Colliders
  this.physics.add.collider(this.player, this.pipesTop,    () => this.gameOver());
  this.physics.add.collider(this.player, this.pipesBottom, () => this.gameOver());

  // Tap to start
  this.hint = this.add.text(W/2, H*0.58, 'TAP TO START', {
    fontFamily:'monospace', fontSize:'54px', color:'#083'
  }).setOrigin(0.5).setDepth(60);

  const onInput = () => this.started ? this.flap() : this.startGame();
  this.input.on('pointerdown', onInput);
  this.input.keyboard.on('keydown-SPACE', onInput);
};

GameScene.prototype.startGame = function(){
  const W = this.scale.width, H = this.scale.height;
  this.started = true;
  this.hint?.destroy();

  this.physics.world.gravity.y = PROFILE.gravity;
  this.player.body.setAllowGravity(true);

  // spawn initial
  [0,1,2].forEach(i => this.spawnPair(W + 220 + i*260));

  // boucle
  this.spawnEvt = this.time.addEvent({
    delay: SPAWN_EVERY, loop:true,
    callback: () => this.spawnPair(W + 80)
  });
};

GameScene.prototype.flap = function(){ this.player.setVelocityY(PROFILE.jump); };

GameScene.prototype.update = function(){
  if (!this.started) return;

  const vy = this.player.body.velocity.y;
  this.player.setAngle(Phaser.Math.Clamp(vy * 0.06, -20, 25));

  if (this.aura.visible){
    this.aura.setPosition(this.player.x, this.player.y);
    this.aura.alpha = 0.2 + 0.08 * Math.sin(this.time.now/180);
  }
};

/* ---------- Spawner de paires ---------- */
GameScene.prototype.spawnPair = function(x){
  const W = this.scale.width, H = this.scale.height;

  const style = PIPE_STYLES[this.skinIndex];
  this.skinIndex = (this.skinIndex + 1) % PIPE_STYLES.length;

  const gap    = PROFILE.gap;
  const minTop = 90;
  const maxTop = H - 90 - gap;

  // variété simple
  let topY;
  if      (this.spawnCount % 4 === 0) topY = minTop + 20;
  else if (this.spawnCount % 4 === 1) topY = maxTop - 20;
  else                                topY = Phaser.Math.Between(minTop, maxTop);
  this.spawnCount++;

  const bottomH = H - (topY + gap);

  // Haut : ancré en bas (origin 0.5,1)
  const topPipe = this.pipesTop.create(x, topY, style.body)
    .setOrigin(0.5,1).setDisplaySize(PIPE_W, topY).setDepth(5);
  topPipe.body.setVelocityX(PROFILE.pipeSpeed);

  // Bas : ancré en haut (origin 0.5,0) + flipY
  const bottomPipe = this.pipesBottom.create(x, topY + gap, style.body)
    .setOrigin(0.5,0).setFlipY(true).setDisplaySize(PIPE_W, bottomH).setDepth(5);
  bottomPipe.body.setVelocityX(PROFILE.pipeSpeed);

  // Caps décoratifs (on leur donne aussi une vélocité)
  const topCap = this.add.image(x, topY, style.cap).setOrigin(0.5,1).setDepth(6).setAlpha(0.96);
  const bottomCap = this.add.image(x, topY+gap, style.cap).setOrigin(0.5,0).setFlipY(true).setDepth(6).setAlpha(0.96);
  this.physics.world.enable([topCap, bottomCap], Phaser.Physics.Arcade.DYNAMIC_BODY);
  topCap.body.setAllowGravity(false).setVelocityX(PROFILE.pipeSpeed);
  bottomCap.body.setAllowGravity(false).setVelocityX(PROFILE.pipeSpeed);

  // Capteur de score (invisible)
  const sensor = this.add.rectangle(x + PIPE_W/2 + 10, H/2, 10, H, 0x000000, 0);
  this.physics.add.existing(sensor);
  sensor.body.setAllowGravity(false).setImmovable(true).setVelocityX(PROFILE.pipeSpeed);

  this.physics.add.overlap(this.player, sensor, () => {
    if (!sensor.active) return;
    sensor.destroy();
    this.pipesPassed++;
    const add = this.multiplierActive ? 2 : 1;
    this.score += add;
    this.scoreText.setText('Score: ' + this.score);

    // bonus périodique
    if (this.pipesPassed > 0 && this.pipesPassed % BONUS_EVERY === 0){
      this.spawnBonus(x + 420, Phaser.Math.Between(200, H - 280));
    }
  });

  // ménage
  this.time.delayedCall(12000, () => {
    [topPipe, bottomPipe, topCap, bottomCap, sensor].forEach(o => o && o.destroy());
  });
};

/* ---------- Bonus ---------- */
GameScene.prototype.spawnBonus = function(x, y){
  const bonus = this.physics.add.image(x, y, 'sb_token')
    .setScale(0.55).setDepth(7);
  bonus.body.setAllowGravity(false).setVelocityX(PROFILE.pipeSpeed);

  this.physics.add.overlap(this.player, bonus, () => {
    if (!bonus.active) return;
    bonus.destroy();
    this.activateMultiplier();
  });

  this.time.delayedCall(12000, () => bonus.destroy());
};

GameScene.prototype.activateMultiplier = function(){
  if (this.multTimer) this.multTimer.remove(false);
  this.multiplierActive = true;
  this.multText.setText('x2 10s');
  this.aura.setVisible(true);

  let left = BONUS_DURATION/1000|0;
  this.multTimer = this.time.addEvent({
    delay: 1000, repeat: left,
    callback: () => {
      left--;
      if (left <= 0){
        this.multiplierActive = false;
        this.multText.setText('');
        this.aura.setVisible(false);
      } else {
        this.multText.setText('x2 ' + left + 's');
      }
    }
  });
};

/* ---------- Game Over ---------- */
GameScene.prototype.gameOver = function(){
  if (!this.player.active) return;
  this.player.disableBody(true, false).setTint(0xff6b6b);
  this.spawnEvt && this.spawnEvt.remove(false);

  const W = this.scale.width, H = this.scale.height;

  const panel = this.add.rectangle(W/2, H/2, W*0.82, 360, 0x163945, 0.92).setDepth(100);
  this.add.text(W/2, H/2 - 110, 'Game Over', {
    fontFamily:'Georgia, serif', fontSize:'72px', color:'#fff'
  }).setOrigin(0.5).setDepth(101);

  this.add.text(W/2, H/2 - 30, `Score :  ${this.score}`, {
    fontFamily:'monospace', fontSize:'52px', color:'#c9fff4'
  }).setOrigin(0.5).setDepth(101);

  const replay = this.add.text(W/2, H/2 + 70, 'Rejouer', {
    fontFamily:'monospace', fontSize:'48px', color:'#fff',
    backgroundColor:'#0db187', padding:{left:22,right:22,top:10,bottom:10}
  }).setOrigin(0.5).setInteractive({useHandCursor:true}).setDepth(101);

  const home = this.add.text(W/2, H/2 + 140, 'Menu', {
    fontFamily:'monospace', fontSize:'36px', color:'#fff',
    backgroundColor:'#0b8266', padding:{left:18,right:18,top:8,bottom:8}
  }).setOrigin(0.5).setInteractive({useHandCursor:true}).setDepth(101);

  replay.on('pointerdown', () => this.scene.restart());
  home.on('pointerdown',   () => this.scene.start('start'));
};
