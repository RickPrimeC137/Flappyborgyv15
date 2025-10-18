/*  FlappyBorgy v15+ (pipes 4K, style switch /50, beep, leaderboard)
    Requires: Phaser 3 (déjà inclus dans index.html) & endpoints:
      GET  /api/leaderboard   -> [{name,score}, ...]
      POST /api/leaderboard   -> body: {name, score}
*/

const WORLD_W = 768;
const WORLD_H = 1366;

const PIPE_SPEED   = -220;
const PIPE_WIDTH   = 120;
const GAP_Y        = 260;             // Trou vertical
const GAP_X        = 260;             // Espacement horizontal entre paires
const SPAWN_DELAY  = Math.round((PIPE_WIDTH + GAP_X) / Math.abs(PIPE_SPEED) * 1000); // ≈ 1730 ms

const BORGY_SCALE  = 0.22;
const GRAVITY_Y    = 1400;
const JUMP_VY      = -380;

const BONUS_EVERY  = 50;              // Switch de style toutes les 50 passerelles
const AURA_COLOR   = 0x9FFFE0;

let game;

/* ---------------- Boot ---------------- */
window.addEventListener('load', () => {
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-root',
    backgroundColor: '#9EDFF1',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: WORLD_W, height: WORLD_H },
    physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
    scene: [PreloadScene, MenuScene, GameScene]
  });
});

/* ---------------- Preload ---------------- */
function PreloadScene() { Phaser.Scene.call(this, { key: 'preload' }); }
PreloadScene.prototype = Object.create(Phaser.Scene.prototype);
PreloadScene.prototype.constructor = PreloadScene;

PreloadScene.prototype.preload = function () {
  const W = this.scale.width, H = this.scale.height;

  // Barre simple
  const bg = this.add.rectangle(W/2, H/2, 360, 8, 0x000000, 0.15).setOrigin(0.5);
  const bar = this.add.rectangle(W/2 - 180, H/2, 1, 8, 0x00a67e).setOrigin(0, 0.5);
  const pct = this.add.text(W/2, H/2 + 28, '0%', { fontFamily: 'monospace', fontSize: 18, color: '#055' }).setOrigin(0.5);

  this.load.on('progress', v => { bar.width = 360 * v; pct.setText(`${Math.round(v*100)}%`); });

  // Assets images existantes
  this.load.setPath('assets');
  this.load.image('borgy', 'borgy_ingame.png');
  this.load.image('sb_token', 'sb_token_user.png');
};

PreloadScene.prototype.create = function () {
  this.scene.start('menu');
};

/* ---------------- Menu ---------------- */
function MenuScene() { Phaser.Scene.call(this, { key: 'menu' }); }
MenuScene.prototype = Object.create(Phaser.Scene.prototype);
MenuScene.prototype.constructor = MenuScene;

MenuScene.prototype.create = function () {
  const W = this.scale.width, H = this.scale.height;

  this.add.text(W/2, H*0.22, 'FlappyBorgy', {
    fontFamily: 'Georgia, serif', fontSize: 72, color: '#0b3e38'
  }).setOrigin(0.5);

  const hint = this.add.text(W/2, H*0.32, 'Touchez pour jouer', {
    fontFamily: 'monospace', fontSize: 32, color: '#095'
  }).setOrigin(0.5);
  this.tweens.add({ targets: hint, alpha: 0.35, yoyo: true, repeat: -1, duration: 900 });

  // Petit borgy décoratif
  const deco = this.add.sprite(W*0.3, H*0.55, 'borgy').setScale(0.22);
  this.tweens.add({ targets: deco, angle: { from:-6, to: 6 }, yoyo:true, repeat:-1, duration: 900, ease: 'sine.inOut' });

  // Boutons
  const btnPlay = this.makeBtn(W/2, H*0.58, 'Démarrer');
  const btnTop  = this.makeBtn(W/2, H*0.67, 'Classement');

  btnPlay.on('pointerdown', () => this.scene.start('game', { first: true }));
  btnTop.on('pointerdown',  () => this.showLeaderboard());

  // pseudo mémorisé
  const name = localStorage.getItem('borgy_name') || '';
  const nameTxt = this.add.text(W/2, H*0.78, name ? `Joueur: ${name}` : 'Appuyez N pour définir votre pseudo', {
    fontFamily: 'monospace', fontSize: 24, color: '#033'
  }).setOrigin(0.5);
  this.input.keyboard.on('keydown-N', async () => {
    const pseudo = prompt('Votre pseudo pour le classement ?') || 'anonyme';
    localStorage.setItem('borgy_name', pseudo);
    nameTxt.setText(`Joueur: ${pseudo}`);
  });
};

MenuScene.prototype.makeBtn = function (x, y, label) {
  const b = this.add.text(x, y, label, {
    fontFamily: 'monospace', fontSize: 38, color: '#fff', backgroundColor: '#0db187',
    padding: { left: 24, right: 24, top: 12, bottom: 12 }
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });
  b.on('pointerover', () => b.setAlpha(0.85));
  b.on('pointerout',  () => b.setAlpha(1));
  return b;
};

MenuScene.prototype.showLeaderboard = async function () {
  const W = this.scale.width, H = this.scale.height;
  const panel = this.add.rectangle(W/2, H/2, W*0.86, H*0.7, 0x12333a, 0.94);
  const title = this.add.text(W/2, H*0.2, 'Top 10', { fontFamily:'Georgia,serif', fontSize: 64, color: '#fff' })
    .setOrigin(0.5);

  let items = [];
  try { items = await (await fetch('/api/leaderboard')).json(); }
  catch { items = []; }

  items = (items || []).slice(0, 10);
  if (!items.length) items = [{name:'—', score:0}];

  const list = this.add.container(W/2, H*0.27);
  items.forEach((it, i) => {
    const t = this.add.text(0, i*44, `${String(i+1).padStart(2,'0')}. ${it.name} — ${it.score}`, {
      fontFamily:'monospace', fontSize: 30, color:'#bff'
    }).setOrigin(0.5,0);
    list.add(t);
  });

  const close = this.makeBtn(W/2, H*0.78, 'Fermer');
  close.on('pointerdown', () => { panel.destroy(); title.destroy(); list.destroy(); close.destroy(); });
};

/* ---------------- Game ---------------- */
function GameScene() { Phaser.Scene.call(this, { key: 'game' }); }
GameScene.prototype = Object.create(Phaser.Scene.prototype);
GameScene.prototype.constructor = GameScene;

GameScene.prototype.init = function () {
  this.score = 0;
  this.pipesPassed = 0;
  this.currentStyle = 0;              // 0 = MintGlass, 1 = Graphite
  this.followCaps = [];
};

GameScene.prototype.create = function () {
  const W = this.scale.width, H = this.scale.height;

  // Génère les textures 4K (vectorielles)
  this.createPipeTextures();

  // Score
  this.scoreText = this.add.text(24, 18, 'Score: 0', {
    fontFamily:'monospace', fontSize:'48px', color:'#fff', stroke:'#0a3a38', strokeThickness:8
  }).setDepth(50);

  // Joueur (immobile jusqu’au 1er tap)
  this.player = this.physics.add.sprite(W*0.25, H*0.5, 'borgy').setScale(BORGY_SCALE).setDepth(10);
  this.player.body.setAllowGravity(false);
  this.player.body.setSize(this.player.width*0.55, this.player.height*0.55, true)
                   .setOffset(this.player.width*0.225, this.player.height*0.25);

  // Halo bonus (pas utilisé ici, mais prêt)
  this.aura = this.add.circle(this.player.x, this.player.y, Math.max(this.player.displayWidth, this.player.displayHeight)*0.65, AURA_COLOR, 0.2)
                .setVisible(false).setDepth(9);

  // Groupes
  this.pipes = this.physics.add.group();

  // Collisions
  this.physics.add.overlap(this.player, this.pipes, () => this.gameOver(), null, this);

  // Input
  this.input.once('pointerdown', () => this.startRun());
  this.input.keyboard.once('keydown-SPACE', () => this.startRun());
  this.input.on('pointerdown', () => this.flap());
  this.input.keyboard.on('keydown-SPACE', () => this.flap());

  // Message “Tapez pour voler”
  const hint = this.add.text(W*0.5, H*0.6, 'Tape pour voler', { fontFamily:'monospace', fontSize:36, color:'#033' })
                  .setOrigin(0.5);
  this.tweens.add({ targets: hint, alpha: 0.3, yoyo:true, repeat:-1, duration:700 });

  this.hint = hint;
};

GameScene.prototype.startRun = function () {
  const H = this.scale.height;
  this.hint?.destroy();

  this.player.body.setAllowGravity(true);
  this.player.body.setGravityY(GRAVITY_Y);
  this.flap(); // coup de boost de départ

  // Spawner
  this.spawnTimer = this.time.addEvent({
    delay: SPAWN_DELAY,
    loop: true,
    callback: () => this.spawnPipePair()
  });

  // Première paire
  this.spawnPipePair();

  // Un premier capteur pour son/score arrivera avec la première paire
};

GameScene.prototype.flap = function () {
  if (!this.player.active) return;
  this.player.setVelocityY(JUMP_VY);
};

GameScene.prototype.update = function (t) {
  // Tilt léger
  if (!this.player.body) return;
  const vy = this.player.body.velocity.y;
  this.player.setAngle(vy < -20 ? -18 : vy > 120 ? 22 : 0);

  // Suivi d’éventuels caps
  this.followCaps.forEach(fn => fn());

  // Nettoyage offscreen
  this.pipes.children.each(ch => { if (ch.active && ch.x < -PIPE_WIDTH*2) ch.destroy(); });
};

/* ---------- Pipes 4K : génération vectorielle ---------- */
GameScene.prototype.createPipeTextures = function () {
  // Crée deux tuiles 64x64 + un cap 140x46 pour chaque style (A=MintGlass, B=Graphite)
  const makeTile = (key, base, light, stroke) => {
    const g = this.add.graphics();
    g.clear();
    // fond
    g.fillStyle(base, 1); g.fillRect(0, 0, 64, 64);
    // bandes
    g.fillStyle(light, 0.35);
    g.fillRect(0, 12, 64, 6);
    g.fillRect(0, 30, 64, 6);
    g.fillRect(0, 48, 64, 6);
    // bord
    g.lineStyle(2, stroke, 0.8); g.strokeRect(1, 1, 62, 62);
    g.generateTexture(key, 64, 64); g.destroy();
  };

  const makeCap = (key, base, light, stroke) => {
    const g = this.add.graphics();
    g.clear();
    const w = 140, h = 46, r = 16;
    // cap
    g.fillStyle(base, 1);
    g.fillRoundedRect(0, 0, w, h, { tl:r, tr:r, bl:r, br:r });
    // highlight
    g.fillStyle(light, 0.35);
    g.fillRoundedRect(6, 8, w-12, 10, { tl:10, tr:10, bl:10, br:10 });
    // bord
    g.lineStyle(4, stroke, 0.9);
    g.strokeRoundedRect(0, 0, w, h, { tl:r, tr:r, bl:r, br:r });

    g.generateTexture(key, w, h); g.destroy();
  };

  // Style A : MintGlass
  makeTile('tileA', 0x1ec9a5, 0xa4ffe6, 0x0a6555);
  makeCap ('capA',  0x1ec9a5, 0xa4ffe6, 0x0a6555);

  // Style B : Graphite
  makeTile('tileB', 0x16a085, 0x7ee8cf, 0x094c41);
  makeCap ('capB',  0x16a085, 0x7ee8cf, 0x094c41);
};

GameScene.prototype.spawnPipePair = function () {
  const W = this.scale.width, H = this.scale.height;

  // Trou vertical
  const minTop = 90;
  const maxTop = H - (GAP_Y + 160);
  const topY = Phaser.Math.Between(minTop, maxTop);
  const holeY = topY + GAP_Y/2;

  const styleKey = this.currentStyle === 0 ? { tile:'tileA', cap:'capA' } : { tile:'tileB', cap:'capB' };
  const x = W + PIPE_WIDTH/2 + 12;

  // Corps (TileSprite) + cap
  const makeBody = (xx, yy, h, isTop) => {
    const body = this.add.tileSprite(xx, yy, PIPE_WIDTH, h, styleKey.tile)
      .setOrigin(0.5, isTop ? 1 : 0).setDepth(5);
    this.physics.add.existing(body, true);
    body.body.setVelocityX(PIPE_SPEED).setImmovable(true).setAllowGravity(false);
    this.pipes.add(body);

    const cap = this.add.image(xx, isTop ? (yy - h) : yy, styleKey.cap)
      .setOrigin(0.5, isTop ? 1 : 0)
      .setFlipY(!isTop)
      .setDepth(6);

    // suit le corps
    this.followCaps.push(() => { if (!body.active) return; cap.x = body.x; cap.y = isTop ? (body.y - body.displayHeight) : body.y; });
    // destroy tardif
    this.time.delayedCall(14000, () => { body.destroy(); cap.destroy(); });
  };

  const topH = holeY - GAP_Y/2;             // hauteur top
  const botH = H - (holeY + GAP_Y/2);       // hauteur bottom

  makeBody(x, topH, topH, true);
  makeBody(x, holeY + GAP_Y/2, botH, false);

  // Capteur de score + son
  const sensor = this.add.rectangle(x + PIPE_WIDTH + 20, H/2, 10, H, 0x000, 0);
  this.physics.add.existing(sensor, true);
  sensor.body.setVelocityX(PIPE_SPEED);
  this.physics.add.overlap(this.player, sensor, () => {
    if (!sensor.active) return;
    sensor.destroy();
    this.incrementScore();
  });
};

GameScene.prototype.incrementScore = function () {
  this.pipesPassed++;
  this.score += 1;
  this.scoreText.setText('Score: ' + this.score);

  // petit beep
  this.beep(1040, 0.07);

  // switch de style tous les 50
  if (this.pipesPassed % BONUS_EVERY === 0) {
    this.currentStyle = (this.currentStyle + 1) % 2;
    const tag = this.add.text(this.scale.width - 22, 80,
      this.currentStyle ? 'Graphite' : 'MintGlass',
      { fontFamily:'monospace', fontSize: 28, color:'#bff', stroke:'#055', strokeThickness:4 }
    ).setOrigin(1,0).setDepth(60).setAlpha(0);
    this.tweens.add({ targets: tag, alpha:1, yoyo:true, hold:700, duration:300, onComplete:()=>tag.destroy() });
  }
};

GameScene.prototype.beep = function (freq = 880, dur = 0.08) {
  const ac = this.sound.context;
  const now = ac.currentTime;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = 'square';
  o.frequency.setValueAtTime(freq, now);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.25, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  o.connect(g).connect(ac.destination);
  o.start(now);
  o.stop(now + dur + 0.02);
};

GameScene.prototype.gameOver = async function () {
  if (!this.player.active) return;
  this.player.disableBody(true, false);
  this.spawnTimer && this.spawnTimer.remove(false);

  const W = this.scale.width, H = this.scale.height;
  const panel = this.add.rectangle(W/2, H/2, W*0.86, 360, 0x163945, 0.92).setDepth(100);
  this.add.text(W/2, H/2 - 110, 'Game Over', { fontFamily:'Georgia,serif', fontSize:72, color:'#fff' })
      .setOrigin(0.5).setDepth(101);
  this.add.text(W/2, H/2 - 30, `Score : ${this.score}`, { fontFamily:'monospace', fontSize:52, color:'#c9fff4' })
      .setOrigin(0.5).setDepth(101);

  const btnReplay = this.add.text(W/2 - 120, H/2 + 80, 'Rejouer', {
    fontFamily:'monospace', fontSize:40, color:'#fff', backgroundColor:'#0db187',
    padding:{left:18,right:18,top:10,bottom:10}
  }).setOrigin(0.5).setDepth(101).setInteractive({ useHandCursor:true });

  const btnTop = this.add.text(W/2 + 130, H/2 + 80, 'Classement', {
    fontFamily:'monospace', fontSize:40, color:'#fff', backgroundColor:'#0aa',
    padding:{left:18,right:18,top:10,bottom:10}
  }).setOrigin(0.5).setDepth(101).setInteractive({ useHandCursor:true });

  btnReplay.on('pointerdown', () => this.scene.restart());
  btnTop.on('pointerdown', () => this.scene.start('menu'));

  // Envoi classement
  try {
    const name = localStorage.getItem('borgy_name') || 'anonyme';
    await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ name, score: this.score })
    });
  } catch (_) {}
};
