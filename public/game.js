/*  FlappyBorgy – v15 (Pipes+Bonus+Fixes)
 *  © you
 *  Nécessite Phaser 3 (déjà inclus dans index.html)
 */

const PROFILE = {
  gravity: 1400,
  jump: -380,
  pipeSpeed: -220,
  gap: 230
};

const BORGY_SCALE = 0.22;
const PIPE_W = 130;
const SPAWN_DELAY = 1600;           // délai entre paires
const HOLE_MIN = 90;                // limites de placement
const HOLE_MAX_MARGIN = 160;

const BONUS_EVERY = 50;             // bonus toutes les 50 paires
const BONUS_DURATION = 10000;       // 10s
const BONUS_COLOR = 0x22D6A1;
const AURA_SOFT = 0x9FFFE0;

const PIPE_SKINS = [
  'graphite','hexghost','mintglass','neonedge',
  'porcelain','brushed','dualband','frosted'
];

let game;

/* ----------------- BOOT ----------------- */
window.addEventListener('load', () => {
  const config = {
    type: Phaser.AUTO,
    parent: 'game-root',
    backgroundColor: '#9edff1',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 768,
      height: 1366
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { y: 0 },
        debug: false
      }
    },
    scene: [PreloadScene, GameScene]
  };

  game = new Phaser.Game(config);
});

/* ----------------- PRELOAD ----------------- */
function PreloadScene() { Phaser.Scene.call(this, { key: 'PreloadScene' }); }
PreloadScene.prototype = Object.create(Phaser.Scene.prototype);
PreloadScene.prototype.constructor = PreloadScene;

PreloadScene.prototype.preload = function () {
  // joueur
  this.load.image('borgy_ingame', 'assets/borgy_ingame.png');

  // bonus
  this.load.image('sb_token', 'assets/sb_token_user.png');

  // pipes skins & caps
  PIPE_SKINS.forEach(s => {
    this.load.image(`pipe_${s}`, `assets/pipe_v2_${s}.png`);
    this.load.image(`cap_${s}`,  `assets/cap_v2_${s}.png`);
  });

  // petite barre de progression
  const w = this.scale.width * 0.6, h = 10;
  const x = this.scale.width * 0.2, y = this.scale.height * 0.5;
  const bg = this.add.rectangle(x, y, w, h, 0xdddddd).setOrigin(0, 0.5);
  const fg = this.add.rectangle(x, y, 1, h, 0x00c389).setOrigin(0, 0.5);
  this.load.on('progress', p => fg.width = w * p);
  this.load.on('complete', () => { bg.destroy(); fg.destroy(); });
};

PreloadScene.prototype.create = function () {
  this.scene.start('GameScene');
};

/* ----------------- GAME ----------------- */
function GameScene() { Phaser.Scene.call(this, { key: 'GameScene' }); }
GameScene.prototype = Object.create(Phaser.Scene.prototype);
GameScene.prototype.constructor = GameScene;

GameScene.prototype.init = function () {
  this.score = 0;
  this.multiplierActive = false;
  this.pipesPassed = 0;
  this.lastPairId = 0;

  this.followCaps = [];
  this.currentSkinIndex = 0;
  this.spawnCount = 0;

  this.patterns = ['ALT_HIGH_LOW','STAIRS','SINE','RANDOM_JITTER','RANDOM'];
  this.patternMode = 'ALT_HIGH_LOW';
  this.lastTopY = null;
};

GameScene.prototype.create = function () {
  const W = this.scale.width;
  const H = this.scale.height;

  // --- Texte Score & Mult ---
  this.scoreText = this.add.text(24, 20, 'Score: 0', {
    fontFamily: 'monospace',
    fontSize: '48px',
    color: '#ffffff',
    stroke: '#0a3a38',
    strokeThickness: 8
  }).setDepth(50).setOrigin(0, 0.0);

  this.multText = this.add.text(W - 24, 20, '', {
    fontFamily: 'monospace',
    fontSize: '40px',
    color: '#b1ffe6',
    stroke: '#007a62',
    strokeThickness: 6
  }).setDepth(50).setOrigin(1, 0);

  // --- Groupe tuyaux
  this.pipes = this.physics.add.group();

  // --- Joueur (réduit)
  this.player = this.physics.add
    .sprite(W * 0.22, H * 0.5, 'borgy_ingame')
    .setScale(BORGY_SCALE)
    .setDepth(10)
    .setCollideWorldBounds(true);
  this.player.body.setGravityY(PROFILE.gravity);
  this.player.body
    .setSize(this.player.width * 0.55, this.player.height * 0.55, true)
    .setOffset(this.player.width * 0.225, this.player.height * 0.25);

  // --- Halo bonus
  this.aura = this.add.circle(0, 0, Math.max(this.player.displayWidth, this.player.displayHeight)*0.65, AURA_SOFT, 0.22)
    .setVisible(false)
    .setDepth(9);

  // --- Inputs
  this.input.on('pointerdown', () => this.flap());
  this.input.keyboard.on('keydown-SPACE', () => this.flap());

  // --- Collisions avec tuyaux
  this.physics.add.overlap(this.player, this.pipes, () => this.gameOver(), null, this);

  // --- Spawner de tuyaux
  this.spawnTimer = this.time.addEvent({
    delay: SPAWN_DELAY,
    loop: true,
    callback: () => this.spawnPipePair()
  });

  // spawn tout de suite une première paire
  this.spawnPipePair();
};

GameScene.prototype.update = function (t, dt) {
  // tilt léger
  if (this.player.body.velocity.y < -20) this.player.setAngle(-18);
  else if (this.player.body.velocity.y > 120) this.player.setAngle(22);
  else this.player.setAngle(0);

  // Aura suit le joueur
  if (this.aura.visible) {
    this.aura.x = this.player.x;
    this.aura.y = this.player.y;
    this.aura.alpha = 0.2 + 0.08 * Math.sin(t / 180);
  }

  // mettre à jour la position des caps si besoin
  this.followCaps.forEach(fn => fn());

  // suppression éléments trop à gauche (sécurité)
  this.pipes.children.each(child => {
    if (child.active && child.x < -PIPE_W * 2) child.destroy();
  });
};

/* --------- Gameplay helpers --------- */
GameScene.prototype.flap = function () {
  if (!this.player.active) return;
  this.player.setVelocityY(PROFILE.jump);
};

GameScene.prototype.spawnPipePair = function () {
  const W = this.scale.width;
  const H = this.scale.height;

  // Pattern pour Y du trou
  const gap = PROFILE.gap;
  const minTop = HOLE_MIN;
  const maxTop = H - (gap + HOLE_MAX_MARGIN);
  let topY;

  switch (this.patternMode) {
    case 'ALT_HIGH_LOW':
      topY = (this.spawnCount % 2 === 0) ? (minTop + 20) : (maxTop - 20);
      break;
    case 'STAIRS': {
      const steps = 5;
      const steph = (maxTop - minTop) / steps;
      topY = minTop + ((this.spawnCount % steps) * steph);
      break;
    }
    case 'SINE': {
      const mid = (minTop + maxTop) / 2;
      const amp = (maxTop - minTop) * 0.42;
      topY = mid + Math.sin(this.spawnCount * 0.8) * amp;
      break;
    }
    case 'RANDOM_JITTER': {
      const last = this.lastTopY ?? ((minTop + maxTop) / 2);
      const jitter = Phaser.Math.Between(-120, 120);
      topY = Phaser.Math.Clamp(last + jitter, minTop, maxTop);
      break;
    }
    default:
      topY = Phaser.Math.Between(minTop, maxTop);
  }
  this.lastTopY = topY;
  this.spawnCount++;

  const holeY = topY + gap / 2;
  const skin = PIPE_SKINS[this.currentSkinIndex];
  this.currentSkinIndex = (this.currentSkinIndex + 1) % PIPE_SKINS.length;

  const x = this.cameras.main.width + 40; // rapproché pour bien voir
  const pair = this.makePipe(x, holeY, gap, skin);

  // capteurs de score
  const sensor = this.add.rectangle(x + PIPE_W + 20, this.scale.height * 0.5, 10, this.scale.height, 0x000000, 0);
  this.physics.add.existing(sensor, true);
  sensor.body.setVelocityX(PROFILE.pipeSpeed);
  sensor.isScoreSensor = true;

  this.physics.add.overlap(this.player, sensor, () => {
    if (!sensor.active) return;
    sensor.destroy();
    this.incrementScore();
  });

  // bonus toutes les BONUS_EVERY paires
  if (this.pipesPassed > 0 && this.pipesPassed % BONUS_EVERY === 0) {
    this.spawnBonus(x + 450, Phaser.Math.Between(200, this.scale.height - 280));
  }
};

GameScene.prototype.makePipe = function (x, holeY, holeH, skin) {
  const bodyKey = `pipe_${skin}`;
  const capKey  = `cap_${skin}`;

  const usingImages = this.textures.exists(bodyKey) && this.textures.exists(capKey);

  const H = this.scale.height;
  const minH = 40;
  const topH = Math.max(minH, holeY - holeH / 2);
  const bottomH = Math.max(minH, H - (holeY + holeH / 2));

  let topBody, bottomBody, topCap = null, bottomCap = null;

  if (usingImages) {
    // Corps
    topBody = this.physics.add.image(x, topH, bodyKey)
      .setOrigin(0.5, 1)
      .setDisplaySize(PIPE_W, topH)
      .setImmovable(true)
      .setDepth(5);
    topBody.body.setAllowGravity(false).setVelocityX(PROFILE.pipeSpeed);

    bottomBody = this.physics.add.image(x, holeY + holeH / 2 + bottomH, bodyKey)
      .setOrigin(0.5, 1)
      .setFlipY(true)
      .setDisplaySize(PIPE_W, bottomH)
      .setImmovable(true)
      .setDepth(5);
    bottomBody.body.setAllowGravity(false).setVelocityX(PROFILE.pipeSpeed);

    // Caps
    topCap    = this.add.image(x, 0, capKey).setOrigin(0.5, 1).setDepth(6);
    bottomCap = this.add.image(x, 0, capKey).setOrigin(0.5, 0).setFlipY(true).setDepth(6);
  } else {
    // Fallback rectangles (debug si textures manquantes)
    console.warn('Fallback rectangles used for skin:', skin);
    const color = 0x10b981, stroke = 0x0a3a38;

    topBody = this.add.rectangle(x, topH, PIPE_W, topH, color)
      .setOrigin(0.5, 1).setStrokeStyle(6, stroke).setDepth(5);
    bottomBody = this.add.rectangle(x, holeY + holeH / 2 + bottomH, PIPE_W, bottomH, color)
      .setOrigin(0.5, 1).setStrokeStyle(6, stroke).setFlipY(true).setDepth(5);

    this.physics.add.existing(topBody, true);
    this.physics.add.existing(bottomBody, true);
    topBody.body.setVelocityX(PROFILE.pipeSpeed);
    bottomBody.body.setVelocityX(PROFILE.pipeSpeed);
  }

  this.pipes.add(topBody);
  this.pipes.add(bottomBody);

  // suivre les caps collés aux corps
  const f = () => {
    if (!topBody.active) return;
    if (topCap) {
      topCap.x = topBody.x;
      topCap.y = topBody.y - topBody.displayHeight;
    }
    if (bottomCap) {
      bottomCap.x = bottomBody.x;
      bottomCap.y = bottomBody.y - bottomBody.displayHeight;
    }
  };
  this.followCaps.push(f);

  // nettoyage
  this.time.addEvent({
    delay: 12000,
    callback: () => [topBody, bottomBody, topCap, bottomCap].forEach(o => o && o.destroy())
  });

  return { topBody, bottomBody, topCap, bottomCap };
};

GameScene.prototype.spawnBonus = function (x, y) {
  const bonus = this.physics.add.image(x, y, 'sb_token')
    .setDepth(7)
    .setScale(0.55)
    .setImmovable(true);
  bonus.body.setAllowGravity(false).setVelocityX(PROFILE.pipeSpeed);

  this.physics.add.overlap(this.player, bonus, () => {
    if (!bonus.active) return;
    bonus.destroy();
    this.activateMultiplier();
  });

  // safety destroy
  this.time.delayedCall(12000, () => bonus.destroy());
};

GameScene.prototype.activateMultiplier = function () {
  if (this.multTimer) this.multTimer.remove(false);

  this.multiplierActive = true;
  this.multText.setText('x2');
  this.aura.setVisible(true).setFillStyle(AURA_SOFT, 0.28);

  this.multTimer = this.time.delayedCall(BONUS_DURATION, () => {
    this.multiplierActive = false;
    this.multText.setText('');
    this.aura.setVisible(false);
  });
};

GameScene.prototype.incrementScore = function () {
  this.pipesPassed++;
  const add = this.multiplierActive ? 2 : 1;
  this.score += add;
  this.scoreText.setText('Score: ' + this.score);
};

GameScene.prototype.gameOver = function () {
  if (!this.player.active) return;

  this.player.disableBody(true, false);
  this.player.setTint(0xff6b6b);
  this.spawnTimer && this.spawnTimer.remove(false);

  const W = this.scale.width;
  const H = this.scale.height;

  const panel = this.add.rectangle(W/2, H/2, W*0.82, 360, 0x163945, 0.92).setDepth(100);
  const tt = this.add.text(W/2, H/2 - 110, 'Game Over', {
    fontFamily: 'Georgia, serif',
    fontSize: '72px',
    color: '#ffffff'
  }).setOrigin(0.5).setDepth(101);

  this.add.text(W/2, H/2 - 30, `Score :  ${this.score}`, {
    fontFamily: 'monospace',
    fontSize: '52px',
    color: '#c9fff4'
  }).setOrigin(0.5).setDepth(101);

  const btn = this.add.text(W/2, H/2 + 70, 'Rejouer', {
    fontFamily: 'monospace',
    fontSize: '52px',
    color: '#ffffff',
    backgroundColor: '#0db187',
    padding: { left: 22, right: 22, top: 10, bottom: 10 }
  }).setOrigin(0.5).setDepth(101).setInteractive({ useHandCursor: true });

  btn.on('pointerdown', () => this.scene.restart());
};
