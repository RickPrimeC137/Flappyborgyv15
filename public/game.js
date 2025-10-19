/*  FlappyBorgy v15 — Phaser 3
 *  - Tuyaux 4K (clair/sombre) avec body tilé sans halos
 *  - Collisions robustes via rectangles physiques
 *  - Bip à chaque passage
 *  - Menu démarrer + Quêtes journalières
 *
 *  Assets attendus dans /public/assets :
 *   - borgy_ingame.png
 *   - sb_token_user.png
 *   - pipe_light_top.png,    pipe_light_bottom.png
 *   - pipe_dark_top.png,     pipe_dark_bottom.png
 */

/////////////////////// CONSTANTES GLOBALES ///////////////////////
const W_LOGICAL = 768;
const H_LOGICAL = 1366;

const PROFILE = {
  gravity: 1400,
  jump: -380,
  pipeSpeed: -220,
  gap: 230
};

const BORGY_SCALE = 0.22;
const PIPE_W = 160;         // largeur visuelle des tuyaux
const SPAWN_DELAY = 1600;   // délai entre paires
const HOLE_MIN = 120;       // marge top
const HOLE_MAX_MARGIN = 160;// marge bottom

const BONUS_EVERY = 50;       // bonus toutes les 50 paires
const BONUS_DURATION = 10000; // 10s

const VARIANTS = [
  { top: 'pipe_light_top', bottom: 'pipe_light_bottom' },
  { top: 'pipe_dark_top',  bottom: 'pipe_dark_bottom' }
];

// petit bip en base64 (court “click”)
// (ogg 8kHz ~200B)
const BEEP_DATA =
  'data:audio/ogg;base64,T2dnUwACAAAAAAAAAAA+3m4dAAAAABgXH8cBHgF2b2dnUwA=';

///////////////////////////////////////////////////////////////////

let game;

window.addEventListener('load', () => {
  const config = {
    type: Phaser.AUTO,
    parent: 'game-root',
    backgroundColor: '#9edff1',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: W_LOGICAL,
      height: H_LOGICAL
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { y: 0 },
        debug: false
      }
    },
    scene: [PreloadScene, MenuScene, GameScene, QuestScene]
  };

  game = new Phaser.Game(config);
});

//////////////////////////// PRELOAD //////////////////////////////
function PreloadScene() { Phaser.Scene.call(this, { key: 'PreloadScene' }); }
PreloadScene.prototype = Object.create(Phaser.Scene.prototype);
PreloadScene.prototype.constructor = PreloadScene;

PreloadScene.prototype.preload = function () {
  const W = this.scale.width, H = this.scale.height;

  // Barre de chargement
  const bg = this.add.rectangle(W/2, H/2, 460, 10, 0x000000, 0.15).setOrigin(0.5);
  const bar = this.add.rectangle(W/2 - 230, H/2, 1, 10, 0x00a67e).setOrigin(0, 0.5);
  const pct = this.add.text(W/2, H/2 + 26, '0%', { fontFamily: 'monospace', fontSize: 18, color: '#055' }).setOrigin(0.5);

  this.load.on('progress', v => { bar.width = 460 * v; pct.setText(Math.round(v*100)+'%'); });

  this.load.setPath('assets');

  // Joueur + bonus
  this.load.image('borgy', 'borgy_ingame.png');
  this.load.image('sb_token', 'sb_token_user.png');

  // Tuyaux 4K (2 variantes, chaque variante top/bottom)
  this.load.image('pipe_light_top',    'pipe_light_top.png');
  this.load.image('pipe_light_bottom', 'pipe_light_bottom.png');
  this.load.image('pipe_dark_top',     'pipe_dark_top.png');
  this.load.image('pipe_dark_bottom',  'pipe_dark_bottom.png');

  // Bip
  this.load.audio('beep', BEEP_DATA);
};

PreloadScene.prototype.create = function () {
  this.scene.start('MenuScene');
};

///////////////////////////// MENU ////////////////////////////////
function MenuScene() { Phaser.Scene.call(this, { key: 'MenuScene' }); }
MenuScene.prototype = Object.create(Phaser.Scene.prototype);
MenuScene.prototype.constructor = MenuScene;

MenuScene.prototype.create = function () {
  const W = this.scale.width, H = this.scale.height;

  this.add.text(W/2, H*0.28, 'FLAPPY BORGY', {
    fontFamily: 'Georgia, serif',
    fontSize: '82px',
    color: '#0b3d3b',
    stroke: '#ffffff',
    strokeThickness: 12
  }).setOrigin(0.5);

  const btn = this.add.text(W/2, H*0.48, 'Taper pour jouer', {
    fontFamily: 'monospace',
    fontSize: '52px',
    color: '#ffffff',
    backgroundColor: '#0db187',
    padding: { left: 28, right: 28, top: 14, bottom: 14 }
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });

  btn.on('pointerdown', () => this.scene.start('GameScene'));

  const qBtn = this.add.text(W/2, H*0.62, 'Quêtes journalières', {
    fontFamily: 'monospace',
    fontSize: '44px',
    color: '#0b3d3b',
    backgroundColor: '#b1ffe6',
    padding: { left: 22, right: 22, top: 10, bottom: 10 }
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });

  qBtn.on('pointerdown', () => this.scene.start('QuestScene'));
};

///////////////////////////// GAME ////////////////////////////////
function GameScene() { Phaser.Scene.call(this, { key: 'GameScene' }); }
GameScene.prototype = Object.create(Phaser.Scene.prototype);
GameScene.prototype.constructor = GameScene;

GameScene.prototype.init = function () {
  this.score = 0;
  this.pipesPassed = 0;
  this.multiplierActive = false;
  this.followers = []; // fonctions qui “suivent” les bodies
  this.variantIndex = 0;
  this.spawnCount = 0;
  this.lastTopY = null;
};

GameScene.prototype.create = function () {
  const W = this.scale.width, H = this.scale.height;

  // Score
  this.scoreText = this.add.text(24, 18, 'Score: 0', {
    fontFamily: 'monospace',
    fontSize: '56px',
    color: '#ffffff',
    stroke: '#0a3a38',
    strokeThickness: 8
  }).setDepth(50);

  this.multText = this.add.text(W - 24, 22, '', {
    fontFamily: 'monospace',
    fontSize: '46px',
    color: '#b1ffe6',
    stroke: '#007a62',
    strokeThickness: 6
  }).setOrigin(1, 0).setDepth(50);

  // Groupes
  this.sensors = this.physics.add.group();

  // Joueur
  this.player = this.physics.add.sprite(W*0.22, H*0.5, 'borgy')
    .setScale(BORGY_SCALE)
    .setDepth(10)
    .setCollideWorldBounds(true);

  this.player.body.setGravityY(PROFILE.gravity);
  this.player.body.setSize(this.player.width * 0.55, this.player.height * 0.55, true);
  this.player.body.setOffset(this.player.width * 0.225, this.player.height * 0.25);

  // Son
  this.beep = this.sound.add('beep', { volume: 0.5 });

  // Inputs
  this.input.on('pointerdown', () => this.flap());
  this.input.keyboard.on('keydown-SPACE', () => this.flap());

  // Overlaps
  // Les collisions sont gérées par overlap avec les rectangles physiques créés par makePipe()
  // On attachera l’overlap pour chaque body lors de la création de pipe.

  // Timer de spawn
  this.spawnTimer = this.time.addEvent({
    delay: SPAWN_DELAY,
    loop: true,
    callback: () => this.spawnPair()
  });

  // Première paire
  this.spawnPair();
};

GameScene.prototype.update = function (t) {
  // Tilt visuel du joueur
  if (this.player.body.velocity.y < -20) this.player.setAngle(-18);
  else if (this.player.body.velocity.y > 120) this.player.setAngle(22);
  else this.player.setAngle(0);

  // Met à jour les visuels qui “suivent” leurs bodies physiques
  this.followers.forEach(fn => fn());

  // Nettoyage de sécurité (capteurs)
  this.sensors.children.each(s => {
    if (s.active && s.x < -PIPE_W * 2) s.destroy();
  });
};

///// Gameplay helpers
GameScene.prototype.flap = function () {
  if (!this.player.active) return;
  this.player.setVelocityY(PROFILE.jump);
};

GameScene.prototype.spawnPair = function () {
  const W = this.scale.width, H = this.scale.height;

  // Trou
  const gap = PROFILE.gap;
  const minTop = HOLE_MIN;
  const maxTop = H - (gap + HOLE_MAX_MARGIN);
  let topY;

  // Pattern simple: escaliers
  const steps = 6;
  const stepH = (maxTop - minTop) / steps;
  topY = minTop + ((this.spawnCount % steps) * stepH);
  this.spawnCount++;

  const holeY = topY + gap / 2;

  // Variante clair/sombre toutes les 50 paires
  const idx = Math.floor(this.pipesPassed / 50) % VARIANTS.length;
  const variant = VARIANTS[idx];

  const x = W + 40;
  const pair = this.makePipe(x, holeY, gap, variant);

  // Capteur de score (RECTANGLE avec physique)
  const sensor = this.add.rectangle(x + PIPE_W + 10, H * 0.5, 10, H, 0x000000, 0);
  this.physics.add.existing(sensor, true);
  sensor.body.setAllowGravity(false);
  sensor.body.setVelocityX(PROFILE.pipeSpeed);
  this.sensors.add(sensor);

  this.physics.add.overlap(this.player, sensor, () => {
    if (!sensor.active) return;
    sensor.destroy();
    this.incrementScore();
  });

  // Bonus toutes les 50 paires (un peu décalé)
  if (this.pipesPassed > 0 && this.pipesPassed % BONUS_EVERY === 0) {
    this.spawnBonus(x + 450, Phaser.Math.Between(220, H - 260));
  }
};

GameScene.prototype.makePipeBodyTexture = function (keyBottom) {
  // Texture tilée cache : <keyBottom>_body
  const bodyKey = keyBottom + '_body';
  if (this.textures.exists(bodyKey)) return bodyKey;

  // Crée une texture (render) à partir d’une bande centrale du "bottom"
  const src = this.textures.get(keyBottom).getSourceImage();
  const tmp = this.textures.createCanvas(Phaser.Utils.String.UUID(), 32, src.height);

  const ctx = tmp.getContext();
  // on coupe une bande sans rebords (évite halos)
  const sliceX = Math.floor(src.width * 0.48);
  const sliceW = Math.max(2, Math.floor(src.width * 0.04));
  ctx.drawImage(src, sliceX, 0, sliceW, src.height, 0, 0, 32, src.height);

  // Convertir en texture Phaser
  const rt = this.make.renderTexture({ width: 32, height: src.height, add: false });
  rt.draw(tmp.canvas, 0, 0);
  rt.saveTexture(bodyKey);

  // nettoyage
  tmp.destroy();
  rt.destroy();

  return bodyKey;
};

GameScene.prototype.makePipe = function (x, holeY, holeH, variant) {
  const H = this.scale.height;

  const topH = Math.max(40, holeY - holeH / 2);
  const bottomH = Math.max(40, H - (holeY + holeH / 2));

  const bodyKey = this.makePipeBodyTexture(variant.bottom);

  // VISUELS (tileSprites)
  const topBody = this.add.tileSprite(x, topH, PIPE_W, topH, bodyKey)
    .setOrigin(0.5, 1).setDepth(5);

  const bottomBody = this.add.tileSprite(x, holeY + holeH / 2 + bottomH, PIPE_W, bottomH, bodyKey)
    .setOrigin(0.5, 1).setFlipY(true).setDepth(5);

  const capTop = this.add.image(x, topH, variant.top).setOrigin(0.5, 1).setDepth(6);
  const capBottom = this.add.image(x, holeY + holeH / 2 + bottomH, variant.bottom).setOrigin(0.5, 0).setDepth(6);

  // PHYSIQUE : rectangles statiques avec vitesse horizontale
  const tbPhysRect = this.add.rectangle(topBody.x, topBody.y - topH / 2, PIPE_W, topH, 0x000000, 0);
  this.physics.add.existing(tbPhysRect, true);
  tbPhysRect.body.setAllowGravity(false);
  tbPhysRect.body.setVelocityX(PROFILE.pipeSpeed);

  const bbPhysRect = this.add.rectangle(bottomBody.x, bottomBody.y - bottomH / 2, PIPE_W, bottomH, 0x000000, 0);
  this.physics.add.existing(bbPhysRect, true);
  bbPhysRect.body.setAllowGravity(false);
  bbPhysRect.body.setVelocityX(PROFILE.pipeSpeed);

  // Collisions
  this.physics.add.overlap(this.player, tbPhysRect, () => this.gameOver(), null, this);
  this.physics.add.overlap(this.player, bbPhysRect, () => this.gameOver(), null, this);

  // Follower : aligne les visuels sur les rectangles
  const follow = () => {
    if (!tbPhysRect.active) return;
    topBody.x = tbPhysRect.x; topBody.y = tbPhysRect.y + topH / 2;
    bottomBody.x = bbPhysRect.x; bottomBody.y = bbPhysRect.y + bottomH / 2;
    capTop.x = topBody.x; capTop.y = topBody.y;
    capBottom.x = bottomBody.x; capBottom.y = bottomBody.y - bottomH;

    // Scroll visuel léger pour donner l’illusion de matière
    topBody.tilePositionY += 0.5;
    bottomBody.tilePositionY += 0.5;

    // Destruction hors écran
    if (topBody.x < -PIPE_W * 2) {
      [topBody, bottomBody, capTop, capBottom, tbPhysRect, bbPhysRect].forEach(o => o && o.destroy());
    }
  };
  this.followers.push(follow);

  // Sécurité : cleanup dur
  this.time.delayedCall(15000, () => {
    [topBody, bottomBody, capTop, capBottom, tbPhysRect, bbPhysRect].forEach(o => o && o.destroy());
  });

  return { topBody, bottomBody, capTop, capBottom, tbPhysRect, bbPhysRect };
};

GameScene.prototype.spawnBonus = function (x, y) {
  const token = this.physics.add.image(x, y, 'sb_token')
    .setDepth(7)
    .setScale(0.55);
  token.body.setAllowGravity(false).setVelocityX(PROFILE.pipeSpeed);

  this.physics.add.overlap(this.player, token, () => {
    if (!token.active) return;
    token.destroy();
    this.activateMultiplier();
  });

  this.time.delayedCall(12000, () => token.destroy());
};

GameScene.prototype.activateMultiplier = function () {
  if (this.multTimer) this.multTimer.remove(false);
  this.multiplierActive = true;
  this.multText.setText('x2');
  this.multTimer = this.time.delayedCall(BONUS_DURATION, () => {
    this.multiplierActive = false;
    this.multText.setText('');
  });
};

GameScene.prototype.incrementScore = function () {
  this.pipesPassed++;
  this.score += (this.multiplierActive ? 2 : 1);
  this.scoreText.setText('Score: ' + this.score);
  if (this.beep) this.beep.play();

  // Quêtes
  QuestSystem.inc('pipes', 1);
  QuestSystem.inc('score', (this.multiplierActive ? 2 : 1));
};

GameScene.prototype.gameOver = function () {
  if (!this.player.active) return;

  this.player.disableBody(true, false);
  this.spawnTimer && this.spawnTimer.remove(false);

  const W = this.scale.width, H = this.scale.height;
  const panel = this.add.rectangle(W/2, H/2, W*0.82, 360, 0x163945, 0.92).setDepth(100);
  this.add.text(W/2, H/2 - 110, 'Game Over', {
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

///////////////////////// QUÊTES JOURNALIÈRES /////////////////////
const QuestSystem = {
  KEY: 'borgy_daily_quests',
  getDayKey() {
    const d = new Date();
    return d.getUTCFullYear() + '-' + (d.getUTCMonth()+1) + '-' + d.getUTCDate();
  },
  _data: null,
  load() {
    const raw = localStorage.getItem(this.KEY);
    try { this._data = raw ? JSON.parse(raw) : null; } catch { this._data = null; }
    const day = this.getDayKey();
    if (!this._data || this._data.day !== day) {
      this._data = {
        day,
        coins: 0,
        quests: [
          { id: 'pipes', label: 'Passe 30 tuyaux', target: 30, progress: 0, reward: 10, claimed: false },
          { id: 'score', label: 'Marque 50 points', target: 50, progress: 0, reward: 15, claimed: false },
          { id: 'bonus', label: 'Prends 1 bonus', target: 1, progress: 0, reward: 20, claimed: false },
        ]
      };
      this.save();
    }
  },
  save() { localStorage.setItem(this.KEY, JSON.stringify(this._data)); },
  inc(id, v=1) {
    if (!this._data) this.load();
    const q = this._data.quests.find(q => q.id === id);
    if (!q) return;
    q.progress = Math.min(q.target, q.progress + v);
    this.save();
  },
  claim(id) {
    const q = this._data.quests.find(q => q.id === id);
    if (!q || q.claimed || q.progress < q.target) return false;
    q.claimed = true;
    this._data.coins += q.reward;
    this.save();
    return true;
  },
  all() { if (!this._data) this.load(); return this._data; }
};

function QuestScene() { Phaser.Scene.call(this, { key: 'QuestScene' }); }
QuestScene.prototype = Object.create(Phaser.Scene.prototype);
QuestScene.prototype.constructor = QuestScene;

QuestScene.prototype.create = function () {
  const W = this.scale.width, H = this.scale.height;
  const data = QuestSystem.all();

  this.add.text(W/2, 120, 'Quêtes du jour', {
    fontFamily: 'Georgia, serif',
    fontSize: '72px',
    color: '#0b3d3b'
  }).setOrigin(0.5);

  this.add.text(W/2, 190, `Pièces : ${data.coins}`, {
    fontFamily: 'monospace',
    fontSize: '46px',
    color: '#0b3d3b'
  }).setOrigin(0.5);

  let y = 280;
  data.quests.forEach(q => {
    const done = q.progress >= q.target;
    const line = this.add.text(80, y, `${q.label}  (${q.progress}/${q.target})   +${q.reward}💰`, {
      fontFamily: 'monospace',
      fontSize: '40px',
      color: done ? '#0a7a57' : '#0b3d3b'
    }).setOrigin(0, 0.5);

    const btnTxt = q.claimed ? 'Réclamée' : (done ? 'Récupérer' : '…');
    const btn = this.add.text(W - 80, y, btnTxt, {
      fontFamily: 'monospace',
      fontSize: '38px',
      color: '#ffffff',
      backgroundColor: done && !q.claimed ? '#0db187' : '#7a8a8a',
      padding: { left: 16, right: 16, top: 8, bottom: 8 }
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: done && !q.claimed });

    btn.on('pointerdown', () => {
      if (QuestSystem.claim(q.id)) this.scene.restart();
    });

    y += 100;
  });

  const back = this.add.text(W/2, H - 100, '← Retour', {
    fontFamily: 'monospace',
    fontSize: '44px',
    color: '#ffffff',
    backgroundColor: '#0db187',
    padding: { left: 22, right: 22, top: 10, bottom: 10 }
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });

  back.on('pointerdown', () => this.scene.start('MenuScene'));
};

// Initialise les quêtes au lancement
QuestSystem.load();
