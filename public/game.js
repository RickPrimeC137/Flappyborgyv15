/*  FlappyBorgy v15 – clean pipes + menu + score sound
 *  Phaser 3 (inclus via <script src="phaser.min.js"> dans index.html)
 */

///////////////////////
// Paramètres généraux
///////////////////////
const LOGICAL_W = 768;
const LOGICAL_H = 1366;

const PROFILE = {
  gravity: 1400,
  jump: -380,
  pipeSpeed: -220,
  gap: 240,              // hauteur du trou
};

const BORGY_SCALE = 0.18;            // taille du chien
const PIPE_W = 132;                  // largeur visuelle
const SPAWN_DELAY = 1600;            // délai entre paires
const HOLE_MIN = 100;                // zone haute minimale
const HOLE_MAX_MARGIN = 180;         // marge basse (contre le sol)

const PIPE_STYLE_CHANGE_EVERY = 50;  // alterner tous les 50
const PIPE_STYLES = ['light', 'dark'];

///////////////////////
// Boot du jeu
///////////////////////
window.addEventListener('load', () => {
  const config = {
    type: Phaser.AUTO,
    parent: 'game-root',
    backgroundColor: '#9EDFF1',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: LOGICAL_W,
      height: LOGICAL_H,
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { y: 0 },
        debug: false,
      },
    },
    scene: [PreloadScene, MenuScene, GameScene],
  };

  new Phaser.Game(config);
});

///////////////////////
// PRELOAD
///////////////////////
function PreloadScene() { Phaser.Scene.call(this, { key: 'preload' }); }
PreloadScene.prototype = Object.create(Phaser.Scene.prototype);
PreloadScene.prototype.constructor = PreloadScene;

PreloadScene.prototype.preload = function () {
  const W = this.scale.width, H = this.scale.height;
  const barW = 400, barH = 10, x = (W - barW) / 2, y = H * 0.5;

  const bg = this.add.rectangle(x, y, barW, barH, 0x000000, 0.15).setOrigin(0, 0.5);
  const fg = this.add.rectangle(x, y, 1, barH, 0x00B37A).setOrigin(0, 0.5);
  const pct = this.add.text(W/2, y + 24, '0%', { fontFamily: 'monospace', fontSize: 20, color: '#0a3a38' }).setOrigin(0.5);

  this.load.on('progress', p => { fg.width = barW * p; pct.setText(`${Math.round(p*100)}%`); });

  this.load.setPath('assets');

  // joueur + bonus (bonus facultatif ici)
  this.load.image('borgy_ingame', 'borgy_ingame.png');
  this.load.image('sb_token', 'sb_token_user.png');

  // 4 visuels des tuyaux (top = cap en haut, bottom = cap en bas)
  this.load.image('pipe_light_top',    'pipe_light_top.png');
  this.load.image('pipe_light_bottom', 'pipe_light_bottom.png');
  this.load.image('pipe_dark_top',     'pipe_dark_top.png');
  this.load.image('pipe_dark_bottom',  'pipe_dark_bottom.png');

  // son de score (facultatif — s’il n’existe pas, aucun crash)
  this.load.audio('point', 'point.wav');

  this.load.once('complete', () => this.scene.start('menu'));
};

///////////////////////
// MENU
///////////////////////
function MenuScene() { Phaser.Scene.call(this, { key: 'menu' }); }
MenuScene.prototype = Object.create(Phaser.Scene.prototype);
MenuScene.prototype.constructor = MenuScene;

MenuScene.prototype.create = function () {
  const W = this.scale.width, H = this.scale.height;

  this.add.text(W/2, H*0.28, 'FLAPPYBORGY', {
    fontFamily: 'Georgia, serif',
    fontSize: 84,
    color: '#0b3d3a',
    stroke: '#ffffff',
    strokeThickness: 8
  }).setOrigin(0.5);

  this.add.text(W/2, H*0.38, 'Version 15', {
    fontFamily: 'monospace',
    fontSize: 28,
    color: '#055'
  }).setOrigin(0.5);

  const btn = this.add.text(W/2, H*0.55, 'JOUER', {
    fontFamily: 'monospace',
    fontSize: 56,
    color: '#ffffff',
    backgroundColor: '#0db187',
    padding: { left: 28, right: 28, top: 12, bottom: 12 }
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });

  this.add.text(W/2, H*0.64, 'Tape pour sauter • Evite les tuyaux', {
    fontFamily: 'monospace',
    fontSize: 24,
    color: '#064'
  }).setOrigin(0.5);

  btn.on('pointerdown', () => this.scene.start('game'));
  this.input.keyboard.once('keydown-SPACE', () => this.scene.start('game'));
};

///////////////////////
// JEU
///////////////////////
function GameScene() { Phaser.Scene.call(this, { key: 'game' }); }
GameScene.prototype = Object.create(Phaser.Scene.prototype);
GameScene.prototype.constructor = GameScene;

GameScene.prototype.init = function () {
  this.score = 0;
  this.pairsSpawned = 0;
  this.pipesPassed = 0;

  this.patterns = ['ALT_HIGH_LOW', 'STAIRS', 'SINE', 'RANDOM_JITTER', 'RANDOM'];
  this.patternMode = 'STAIRS';
  this.lastTopY = null;

  this.gameStarted = false;
  this.spawnTimer = null;
};

GameScene.prototype.create = function () {
  const W = this.scale.width, H = this.scale.height;

  // Score
  this.scoreText = this.add.text(24, 22, 'Score: 0', {
    fontFamily: 'monospace',
    fontSize: '48px',
    color: '#ffffff',
    stroke: '#0a3a38',
    strokeThickness: 8
  }).setDepth(10).setOrigin(0, 0);

  // Groupe des tuyaux
  this.pipes = this.physics.add.group();

  // Joueur (gravité OFF tant que la partie n'a pas commencé)
  this.player = this.physics.add.sprite(W * 0.25, H * 0.45, 'borgy_ingame')
    .setScale(BORGY_SCALE)
    .setCollideWorldBounds(true)
    .setDepth(5);

  this.player.body.setAllowGravity(false);            // OFF => attend le premier tap
  this.player.body.setGravityY(PROFILE.gravity);      // gravité prête
  // hitbox plus courte
  this.player.body.setSize(this.player.width * 0.55, this.player.height * 0.55, true)
                  .setOffset(this.player.width * 0.225, this.player.height * 0.25);

  // Message "Tap to start"
  this.readyText = this.add.text(W/2, H*0.62, 'Tape pour démarrer', {
    fontFamily: 'monospace',
    fontSize: 44,
    color: '#ffffff',
    stroke: '#086',
    strokeThickness: 6
  }).setOrigin(0.5).setDepth(10);

  // Entrées
  this.input.on('pointerdown', () => this.flap());
  this.input.keyboard.on('keydown-SPACE', () => this.flap());

  // Collision avec les tuyaux
  this.physics.add.overlap(this.player, this.pipes, () => this.gameOver(), null, this);

  // Une première paire pour remplir l’écran dès le départ (mais vitesse nulle tant que pas commencé)
  this.spawnPipePair(true);
};

GameScene.prototype.startGame = function () {
  if (this.gameStarted) return;
  this.gameStarted = true;

  this.player.body.setAllowGravity(true);
  this.readyText && this.readyText.destroy();

  // Timer de spawn
  this.spawnTimer = this.time.addEvent({
    delay: SPAWN_DELAY,
    loop: true,
    callback: () => this.spawnPipePair(false),
  });

  // Donner la vitesse aux éléments déjà présents
  this.pipes.children.each(p => {
    if (p.body && p.body.velocity.x === 0) p.body.setVelocityX(PROFILE.pipeSpeed);
  });
};

GameScene.prototype.update = function (t, dt) {
  // Inclinaison du chien
  if (this.player.body.velocity.y < -20) this.player.setAngle(-18);
  else if (this.player.body.velocity.y > 120) this.player.setAngle(22);
  else this.player.setAngle(0);

  // Nettoyage des objets trop à gauche
  this.pipes.children.each(child => {
    if (child.active && child.x < -PIPE_W * 2) child.destroy();
  });
};

///////////////////////
// Contrôles & gameplay
///////////////////////
GameScene.prototype.flap = function () {
  if (!this.gameStarted) this.startGame();
  if (!this.player.active) return;
  this.player.setVelocityY(PROFILE.jump);
};

GameScene.prototype.incrementScore = function () {
  this.pipesPassed++;
  this.score += 1;
  this.scoreText.setText('Score: ' + this.score);

  // bip (silencieux si l’asset n’existe pas)
  const s = this.sound.get('point');
  if (this.cache.audio.exists('point')) {
    this.sound.play('point', { volume: 0.45 });
  }
};

///////////////////////
// Génération des tuyaux
///////////////////////
GameScene.prototype.chooseTopY = function () {
  const H = this.scale.height;
  const gap = PROFILE.gap;
  const minTop = HOLE_MIN;
  const maxTop = H - (gap + HOLE_MAX_MARGIN);

  let topY;
  switch (this.patternMode) {
    case 'ALT_HIGH_LOW':
      topY = (this.pairsSpawned % 2 === 0) ? (minTop + 20) : (maxTop - 20);
      break;
    case 'STAIRS': {
      const steps = 5;
      const steph = (maxTop - minTop) / steps;
      topY = minTop + ((this.pairsSpawned % steps) * steph);
      break;
    }
    case 'SINE': {
      const mid = (minTop + maxTop) / 2;
      const amp = (maxTop - minTop) * 0.42;
      topY = mid + Math.sin(this.pairsSpawned * 0.8) * amp;
      break;
    }
    case 'RANDOM_JITTER': {
      const last = this.lastTopY ?? ((minTop + maxTop) / 2);
      const jitter = Phaser.Math.Between(-140, 140);
      topY = Phaser.Math.Clamp(last + jitter, minTop, maxTop);
      break;
    }
    default:
      topY = Phaser.Math.Between(minTop, maxTop);
  }
  this.lastTopY = topY;
  return topY;
};

/**
 * Crée une paire de tuyaux (haut + bas) et un capteur de score.
 * @param {boolean} freeze - si true, la vitesse est 0 (pour l’écran d’attente)
 */
GameScene.prototype.spawnPipePair = function (freeze) {
  const speedX = freeze ? 0 : PROFILE.pipeSpeed;

  const W = this.scale.width, H = this.scale.height;
  const x = W + 40;

  const topY = this.chooseTopY();
  const holeY = topY + PROFILE.gap / 2;

  // Alterner de style tous les 50
  const styleIndex = Math.floor(this.pairsSpawned / PIPE_STYLE_CHANGE_EVERY) % PIPE_STYLES.length;
  const style = PIPE_STYLES[styleIndex]; // 'light' | 'dark'
  this.pairsSpawned++;

  // Construit la paire
  this.makePipe(x, holeY, PROFILE.gap, style, speedX);

  // Capteur de score (ligne invisible que le joueur traverse)
  const sensor = this.add.rectangle(x + PIPE_W + 6, H * 0.5, 8, H, 0x000000, 0);
  this.physics.add.existing(sensor);
  sensor.body.setAllowGravity(false).setImmovable(true).setVelocityX(speedX);
  sensor.isScoreSensor = true;

  this.physics.add.overlap(this.player, sensor, () => {
    if (!sensor.active) return;
    sensor.destroy();
    this.incrementScore();
  });
};

GameScene.prototype.makePipe = function (x, holeY, holeH, style, speedX) {
  const H = this.scale.height;
  const minH = 40;
  const topH    = Math.max(minH, holeY - holeH / 2);           // colonne du haut
  const bottomH = Math.max(minH, H - (holeY + holeH / 2));     // colonne du bas

  // HAUT : cap vers le bas => image *_bottom, ancrée en bas
  const keyTop = `pipe_${style}_bottom`;
  const topPipe = this.physics.add.image(x, topH, keyTop)
    .setOrigin(0.5, 1)
    .setDisplaySize(PIPE_W, topH)
    .setImmovable(true)
    .setDepth(4);
  topPipe.body.setAllowGravity(false).setVelocityX(speedX);

  // BAS : cap vers le haut => image *_top, ancrée en haut
  const keyBottom = `pipe_${style}_top`;
  const bottomPipe = this.physics.add.image(x, holeY + holeH / 2, keyBottom)
    .setOrigin(0.5, 0)
    .setDisplaySize(PIPE_W, bottomH)
    .setImmovable(true)
    .setDepth(4);
  bottomPipe.body.setAllowGravity(false).setVelocityX(speedX);

  this.pipes.add(topPipe);
  this.pipes.add(bottomPipe);

  // Sécurité : cleanup
  this.time.delayedCall(12000, () => [topPipe, bottomPipe].forEach(o => o && o.destroy()));
};

///////////////////////
// Fin de partie
///////////////////////
GameScene.prototype.gameOver = function () {
  if (!this.player.active) return;

  // stop spawns
  this.spawnTimer && this.spawnTimer.remove(false);

  // figer le joueur
  this.player.disableBody(true, false);
  this.player.setTint(0xff6b6b);

  const W = this.scale.width, H = this.scale.height;

  const panel = this.add.rectangle(W/2, H/2, W * 0.82, 360, 0x153b47, 0.92).setDepth(100);
  this.add.text(W/2, H/2 - 110, 'Game Over', {
    fontFamily: 'Georgia, serif',
    fontSize: 72,
    color: '#ffffff'
  }).setOrigin(0.5).setDepth(101);

  this.add.text(W/2, H/2 - 30, `Score :  ${this.score}`, {
    fontFamily: 'monospace',
    fontSize: 52,
    color: '#c9fff4'
  }).setOrigin(0.5).setDepth(101);

  const btn = this.add.text(W/2, H/2 + 70, 'Rejouer', {
    fontFamily: 'monospace',
    fontSize: 52,
    color: '#ffffff',
    backgroundColor: '#0db187',
    padding: { left: 22, right: 22, top: 10, bottom: 10 }
  }).setOrigin(0.5).setDepth(101).setInteractive({ useHandCursor: true });

  btn.on('pointerdown', () => this.scene.restart());
  this.input.keyboard.once('keydown-SPACE', () => this.scene.restart());
};
