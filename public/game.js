/*  FlappyBorgy – v15  (Phaser 3, portrait)
    - Borgy sprite Arcade, tuyaux physiques (8 skins), collisions, score
    - Bonus SwissBorg: x2 pendant 10s + halo
    - Patterns de spawn simples (aléatoires) + rotation de skins
*/

//////////////////////////////
// Constantes & globals
//////////////////////////////
const W = 768;
const H = 1366; // Portrait logique

// Physique/Gameplay
const PROFILE = { gravity: 1400, jump: 380 };
const PIPE_W = 120;
const PIPE_SPEED = -240;
const GAP_MIN = 220;
const GAP_MAX = 280;
const SPAWN_EVERY_MS = 1400;
const BONUS_EVERY = 50;   // un bonus toutes les 50 paires
const BONUS_TIME = 10000; // 10 s

// Skins disponibles (correspond exactement aux fichiers)
const SKINS = [
  'graphite','hexghost','mintglass','neonedge',
  'porcelain','brushed','dualband','frosted'
];

// Variables globales Phaser
let scene;
let player;
let pipes;              // groupe Arcade (corps collision)
let followCaps = [];    // callbacks pour recoller les "caps" décor
let scoreText, multiText;
let score = 0;
let pipesSpawned = 0;
let dead = false;
let multiplierActive = false;
let scoreMultiplier = 1;
let auraRing;          // halo bonus
let bonusTimerEvt;     // timer x2

//////////////////////////////
// Boot Phaser
//////////////////////////////
const config = {
  type: Phaser.AUTO,
  width: W,
  height: H,
  backgroundColor: '#97d7e6',  // bleu ciel
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false // passe à true pour visualiser les hitboxes
    }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: { preload, create, update }
};

new Phaser.Game(config);

//////////////////////////////
// Preload
//////////////////////////////
function preload () {
  this.load.setPath('assets');

  // Borgy + bonus
  this.load.image('borgy_ingame', 'borgy_ingame.png');
  this.load.image('sb_token_user', 'sb_token_user.png');

  // Skins (corps + cap)
  SKINS.forEach(n => {
    this.load.image(`pipe_${n}`, `pipe_v2_${n}.png`);
    this.load.image(`cap_${n}`,  `cap_v2_${n}.png`);
  });
}

//////////////////////////////
// Create
//////////////////////////////
function create () {
  scene = this;

  // Monde Arcade
  this.physics.world.setBounds(0, 0, this.scale.width, this.scale.height);

  // ---- UI / HUD
  score = 0;
  pipesSpawned = 0;
  dead = false;
  multiplierActive = false;
  scoreMultiplier = 1;

  scoreText = this.add.text(28, 26, 'Score: 0', {
    fontFamily: 'monospace', fontSize: '42px', color: '#ffffff', stroke: '#000', strokeThickness: 6
  }).setScrollFactor(0).setDepth(50);

  multiText = this.add.text(this.scale.width - 20, 26, '', {
    fontFamily: 'monospace', fontSize: '36px', color: '#e0ffe0', stroke: '#005533', strokeThickness: 6
  }).setOrigin(1,0).setScrollFactor(0).setDepth(50);

  // ---- Player
  player = this.physics.add.sprite(this.scale.width*0.22, this.scale.height*0.5, 'borgy_ingame')
    .setScale(0.36)
    .setDepth(10)
    .setCollideWorldBounds(true);

  // hitbox resserrée
  player.body.setSize(player.width*0.55, player.height*0.55, true)
        .setOffset(player.width*0.225, player.height*0.25);
  player.body.setGravityY(PROFILE.gravity);

  // Input: tap = jump
  this.input.on('pointerdown', flap);
  this.input.keyboard.on('keydown-SPACE', flap);

  // Halo (invisible au départ)
  auraRing = this.add.circle(0, 0, 120, 0x22D6A1, 0.22).setVisible(false).setDepth(9);

  // ---- Pipes
  pipes = this.physics.add.group({ allowGravity:false, immovable:true });

  // Collision joueur ↔ tuyaux
  this.physics.add.collider(player, pipes, onHitPipe, null, this);

  // Spawns récurrents
  this.time.addEvent({ delay: SPAWN_EVERY_MS, loop: true, callback: () => spawnPipePair(this) });

  // Recoller les caps à chaque frame
  this.events.on('update', () => {
    followCaps.forEach(f => f());
    if (auraRing.visible) {
      auraRing.x = player.x; auraRing.y = player.y;
      auraRing.scale = 0.95 + 0.05*Math.sin(this.time.now*0.004);
    }
  });
}

//////////////////////////////
// Update
//////////////////////////////
function update () {
  // rien d'obligatoire ici (collisions/spawns autonomes)
}

//////////////////////////////
// Actions
//////////////////////////////
function flap() {
  if (dead) return;
  player.setVelocityY(-PROFILE.jump);
}

function onHitPipe() {
  if (dead) return;
  dead = true;

  // stop bonus si actif
  clearBonus();

  scene.physics.pause();
  player.setTint(0xff6666);

  // petit panneau Game Over + rejouer
  const box = scene.add.rectangle(W/2, H/2, 520, 300, 0x123b46, 0.9).setDepth(100);
  const t1  = scene.add.text(W/2, H/2 - 80, 'Game Over', { fontFamily:'monospace', fontSize:'64px', color:'#ffffff'}).setOrigin(0.5).setDepth(101);
  const t2  = scene.add.text(W/2, H/2 - 10, `Score:  ${score}`, { fontFamily:'monospace', fontSize:'46px', color:'#baffff'}).setOrigin(0.5).setDepth(101);

  const btn = scene.add.text(W/2, H/2 + 70, 'Rejouer', {
    fontFamily:'monospace', fontSize:'48px', backgroundColor:'#17a88a', color:'#ffffff', padding:{x:18, y:10}
  }).setOrigin(0.5).setDepth(101).setInteractive({ useHandCursor:true });
  btn.on('pointerup', () => {
    [box,t1,t2,btn].forEach(o=>o.destroy());
    scene.scene.restart();
  });
}

//////////////////////////////
// Spawns de tuyaux
//////////////////////////////
function spawnPipePair(scn) {
  if (dead) return;

  // trou aléatoire
  const holeY = Phaser.Math.Between(240, scn.scale.height - 240);
  const holeH = Phaser.Math.Between(GAP_MIN, GAP_MAX);

  // skin en rotation (tous les 8 on repart)
  const skinIndex = pipesSpawned % SKINS.length;
  const skin = SKINS[skinIndex];

  const x = scn.scale.width + 120;
  const pair = makePipe(scn, x, holeY, holeH, skin);
  pipesSpawned++;

  // score quand la paire passe à gauche du joueur
  pair.scored = false;

  scn.time.addEvent({
    delay: 50, loop: true,
    callback: () => {
      if (!pair || pair.destroyed || pair.scored || dead) return;
      const any = pair.topBody || pair.bottomBody;
      if (any && any.x + PIPE_W*0.5 < player.x) {
        pair.scored = true;
        addScore(1 * scoreMultiplier);
      }
    }
  });

  // bonus toutes les 50 paires
  if (pipesSpawned % BONUS_EVERY === 0) spawnBonus(scn, x + 450, holeY);
}

// construit une paire (Arcade bodies + décor caps)
function makePipe(scn, x, holeY, holeH, skin) {
  const bodyKey = `pipe_${skin}`;
  const capKey  = `cap_${skin}`;

  // hauteurs clampées
  const minH = 40;
  const topH = Math.max(minH, holeY - holeH/2);
  const bottomH = Math.max(minH, scn.scale.height - (holeY + holeH/2));

  // TOP body
  const topBody = scn.physics.add.image(x, topH, bodyKey)
        .setOrigin(0.5, 1)
        .setDisplaySize(PIPE_W, topH)
        .setImmovable(true).setDepth(5);
  topBody.body.setAllowGravity(false).setVelocityX(PIPE_SPEED);
  pipes.add(topBody);

  // BOTTOM body
  const bottomBody = scn.physics.add.image(x, holeY + holeH/2 + bottomH, bodyKey)
        .setOrigin(0.5, 1) // on le flippe visuellement, body reste ok
        .setDisplaySize(PIPE_W, bottomH)
        .setFlipY(true)
        .setImmovable(true).setDepth(5);
  bottomBody.body.setAllowGravity(false).setVelocityX(PIPE_SPEED);
  pipes.add(bottomBody);

  // Décor (caps) – pas de physique
  const topCap    = scn.add.image(x, 0, capKey).setOrigin(0.5,1).setDepth(6);
  const bottomCap = scn.add.image(x, 0, capKey).setOrigin(0.5,0).setFlipY(true).setDepth(6);

  // recoller les caps
  const f = () => {
    if (!topBody.active) return;
    topCap.x = topBody.x;
    topCap.y = topBody.y - topBody.displayHeight;
    bottomCap.x = bottomBody.x;
    bottomCap.y = bottomBody.y - bottomBody.displayHeight;
  };
  followCaps.push(f);

  // nettoyage quand offscreen
  scn.time.addEvent({
    delay: 12000, callback: () => {
      [topBody, bottomBody, topCap, bottomCap].forEach(o => o && o.destroy());
    }
  });

  return { topBody, bottomBody, topCap, bottomCap };
}

//////////////////////////////
// Bonus SwissBorg
//////////////////////////////
function spawnBonus(scn, x, y) {
  const b = scn.physics.add.image(x, y, 'sb_token_user').setScale(0.75).setDepth(20);
  b.body.setAllowGravity(false).setVelocityX(PIPE_SPEED);

  // overlap joueur/bonus
  scn.physics.add.overlap(player, b, () => {
    b.destroy();
    startBonus();
  });
}

function startBonus() {
  multiplierActive = true;
  scoreMultiplier = 2;
  auraRing.setVisible(true);
  updateMultiplierText(BONUS_TIME);

  if (bonusTimerEvt) bonusTimerEvt.remove(false);
  const t0 = scene.time.now;
  bonusTimerEvt = scene.time.addEvent({
    delay: 100, loop: true,
    callback: () => {
      const left = Math.max(0, BONUS_TIME - (scene.time.now - t0));
      updateMultiplierText(left);
      if (left <= 0) clearBonus();
    }
  });
}

function clearBonus() {
  multiplierActive = false;
  scoreMultiplier = 1;
  auraRing.setVisible(false);
  multiText.setText('');
  if (bonusTimerEvt) { bonusTimerEvt.remove(false); bonusTimerEvt = null; }
}

//////////////////////////////
// Score / UI
//////////////////////////////
function addScore(n) {
  score += n;
  scoreText.setText(`Score: ${score}`);
}

function updateMultiplierText(msLeft) {
  const s = Math.ceil(msLeft/1000);
  multiText.setText(`x2  ${s}s`);
}
