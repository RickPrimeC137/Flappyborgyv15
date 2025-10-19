/* FlappyBorgy — build sans son */

const GAME_W = 768;
const GAME_H = 1366;

const PROFILE = {
  gravity: 1400,
  jump: -380,
  pipeSpeed: -220,
  gap: 260,              // taille de l'ouverture
  spawnDelay: 1600       // délai entre paires
};

const BORGY_SCALE = 0.22;
const PIPE_W = 180;       // largeur d'affichage des tuyaux

// noms d'assets présents dans public/assets/
const ASSETS = {
  borgy: 'borgy_ingame.png',
  lightTop: 'pipe_light_top.png',
  lightBottom: 'pipe_light_bottom.png',
  darkTop: 'pipe_dark_top.png',
  darkBottom: 'pipe_dark_bottom.png',
  token: 'sb_token_user.png'
};

let game;

window.addEventListener('load', () => {
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-root',
    backgroundColor: '#9edff1',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: GAME_W, height: GAME_H },
    physics: {
      default: 'arcade',
      arcade: { gravity: { y: 0 }, debug: false }
    },
    scene: [PreloadScene, MenuScene, GameScene]
  });
});

/* ======== PRELOAD ======== */

function PreloadScene(){ Phaser.Scene.call(this,{key:'preload'}) }
PreloadScene.prototype = Object.create(Phaser.Scene.prototype); PreloadScene.prototype.constructor=PreloadScene;

PreloadScene.prototype.preload = function () {
  const W = this.scale.width, H = this.scale.height;
  const barBg = this.add.rectangle(W*0.5, H*0.5, W*0.5, 10, 0x0b7463, 0.18).setOrigin(0.5);
  const bar = this.add.rectangle(W*0.25, H*0.5, 1, 10, 0x0b7463).setOrigin(0,0.5);
  const pct = this.add.text(W*0.5, H*0.5+18, '0%', {font:'16px monospace', color:'#055'}).setOrigin(0.5);

  this.load.on('progress', p => { bar.width = (W*0.5) * p; pct.setText(Math.round(p*100)+'%'); });

  this.load.setPath('assets');
  this.load.image('borgy', ASSETS.borgy);
  this.load.image('pipe_light_top', ASSETS.lightTop);
  this.load.image('pipe_light_bottom', ASSETS.lightBottom);
  this.load.image('pipe_dark_top', ASSETS.darkTop);
  this.load.image('pipe_dark_bottom', ASSETS.darkBottom);
  this.load.image('sb_token', ASSETS.token);
};

PreloadScene.prototype.create = function () { this.scene.start('menu'); };

/* ======== MENU ======== */

function MenuScene(){ Phaser.Scene.call(this,{key:'menu'}) }
MenuScene.prototype = Object.create(Phaser.Scene.prototype); MenuScene.prototype.constructor=MenuScene;

MenuScene.prototype.create = function () {
  const W = this.scale.width, H = this.scale.height;
  this.add.text(W*0.5, H*0.18, 'FlappyBorgy', {
    fontFamily:'Georgia, serif', fontSize:'64px', color:'#154f43'
  }).setOrigin(0.5);

  const btnPlay = this.add.text(W*0.5, H*0.34, 'Jouer', styleBtn())
    .setOrigin(0.5).setPadding(20,10,20,10).setInteractive({useHandCursor:true});
  btnPlay.on('pointerdown', () => this.scene.start('game'));

  const btnQuests = this.add.text(W*0.5, H*0.42, 'Quêtes', styleBtnSecondary())
    .setOrigin(0.5).setPadding(20,10,20,10).setInteractive({useHandCursor:true});
  btnQuests.on('pointerdown', () => this.showQuests());

  this.add.text(W*0.5, H*0.92, 'Tap/Space pour sauter\nÉvitez les tuyaux', {
    font:'20px monospace', color:'#0a3a38', align:'center'
  }).setOrigin(0.5);
};

MenuScene.prototype.showQuests = function () {
  const W = this.scale.width, H = this.scale.height;
  const panel = this.add.rectangle(W/2, H/2, W*0.8, H*0.6, 0x0e3b37, 0.94);
  const t = this.add.text(W/2, H/2 - 220, 'Quêtes du jour', {font:'36px Georgia', color:'#fff'}).setOrigin(0.5);
  const quests = [
    'Atteindre 5 points',
    'Passer 3 tuyaux d’affilée',
    'Jouer 3 parties'
  ];
  this.add.text(W/2, H/2 - 150, '— Aujourd’hui —', {font:'20px monospace', color:'#b9fff1'}).setOrigin(0.5);
  this.add.text(W/2 - W*0.33, H/2 - 120, '• ' + quests.join('\n• '), {
    font:'22px monospace', color:'#eafffb', lineSpacing:10
  }).setOrigin(0,0);

  const close = this.add.text(W/2, H/2 + 250, 'Fermer', styleBtn()).setOrigin(0.5).setInteractive({useHandCursor:true});
  close.on('pointerdown', () => { panel.destroy(); t.destroy(); close.destroy(); this.children.each(c=>{ if(c.style && c.text && c!==close && c!==t) c.destroy?.() }); this.scene.restart(); });
};

function styleBtn(){
  return { font:'32px monospace', color:'#ffffff', backgroundColor:'#0db187', stroke:'#0a3a38', strokeThickness:6 };
}
function styleBtnSecondary(){
  return { font:'28px monospace', color:'#083b33', backgroundColor:'#c8fff0', stroke:'#0db187', strokeThickness:4 };
}

/* ======== GAME ======== */

function GameScene(){ Phaser.Scene.call(this,{key:'game'}) }
GameScene.prototype = Object.create(Phaser.Scene.prototype); GameScene.prototype.constructor=GameScene;

GameScene.prototype.init = function () {
  this.score = 0;
  this.pairs = [];            // { top, bottom, scored }
  this.spawnTimer = null;
  this.playing = false;
};

GameScene.prototype.create = function () {
  const W = this.scale.width, H = this.scale.height;

  // texte score
  this.scoreText = this.add.text(24, 20, 'Score: 0', {
    font:'48px monospace', color:'#ffffff', stroke:'#0a3a38', strokeThickness:8
  }).setDepth(1000);

  // joueur
  this.player = this.physics.add.sprite(W*0.23, H*0.45, 'borgy')
    .setScale(BORGY_SCALE).setDepth(10).setCollideWorldBounds(true);
  this.player.body.setGravityY(PROFILE.gravity);
  // boîte de collision un peu réduite
  this.player.body.setSize(this.player.width*0.55, this.player.height*0.55, true)
                  .setOffset(this.player.width*0.225, this.player.height*0.25);

  // groupe de tuyaux
  this.pipes = this.physics.add.group();

  // collisions
  this.physics.add.overlap(this.player, this.pipes, () => this.gameOver(), null, this);

  // input
  this.input.keyboard.on('keydown-SPACE', () => this.handleInput());
  this.input.on('pointerdown', () => this.handleInput());

  // message "Tap pour commencer"
  this.tapText = this.add.text(W*0.5, H*0.62, 'Tap/Space pour commencer', {
    font:'30px monospace', color:'#0a3a38', backgroundColor:'#c8fff0'
  }).setOrigin(0.5).setDepth(500);

  // on démarre immobile : le jeu s’active lors du 1er input
  this.playing = false;
};

GameScene.prototype.handleInput = function () {
  if (!this.playing) {
    this.playing = true;
    this.tapText?.destroy();
    // boucle de spawn
    this.spawnTimer = this.time.addEvent({
      delay: PROFILE.spawnDelay,
      loop: true,
      callback: () => this.spawnPair()
    });
    // spawn immédiat
    this.spawnPair();
  }
  // saut
  this.player.setVelocityY(PROFILE.jump);
};

GameScene.prototype.spawnPair = function () {
  const W = this.scale.width, H = this.scale.height;
  const gap = PROFILE.gap;

  // plage verticale sûre
  const MIN_TOP = 80;
  const MAX_TOP = H - (gap + 180);
  const topY = Phaser.Math.Between(MIN_TOP, MAX_TOP);
  const holeY = topY + gap/2;

  // tous les 50, alterner skin light/dark
  const useDark = (Math.floor(this.score/50) % 2) === 1;

  const bodyTopKey = useDark ? 'pipe_dark_bottom' : 'pipe_light_bottom';    // haut = bottom (colerette vers bas)
  const bodyBotKey = useDark ? 'pipe_dark_top'    : 'pipe_light_top';       // bas = top (colerette vers haut)

  // hauteurs
  const topHeight = topY;
  const bottomHeight = H - (holeY + gap/2);

  // TOP (colerette vers le bas) => flipY = true
  const top = this.physics.add.image(W + 120, topHeight, bodyTopKey)
    .setOrigin(0.5,1).setFlipY(true).setDisplaySize(PIPE_W, topHeight).setImmovable(true).setDepth(5);
  top.body.setAllowGravity(false).setVelocityX(PROFILE.pipeSpeed);

  // BOTTOM (colerette vers le haut)
  const bottom = this.physics.add.image(W + 120, holeY + gap/2 + bottomHeight, bodyBotKey)
    .setOrigin(0.5,1).setDisplaySize(PIPE_W, bottomHeight).setImmovable(true).setDepth(5);
  bottom.body.setAllowGravity(false).setVelocityX(PROFILE.pipeSpeed);

  this.pipes.addMultiple([top, bottom]);
  this.pairs.push({ top, bottom, scored:false });

  // auto-clean
  this.time.delayedCall(14000, () => { top.destroy(); bottom.destroy(); });
};

GameScene.prototype.update = function () {
  if (!this.playing) return;

  // inclinaison
  if (this.player.body.velocity.y < -30) this.player.setAngle(-18);
  else if (this.player.body.velocity.y > 160) this.player.setAngle(22);
  else this.player.setAngle(0);

  // score quand le bord droit du top passe à gauche du joueur
  for (const p of this.pairs) {
    if (p.scored || !p.top.active) continue;
    const rightEdge = p.top.x + (PIPE_W/2);
    if (rightEdge < this.player.x) {
      p.scored = true;
      this.score++;
      this.scoreText.setText('Score: ' + this.score);
    }
  }

  // supprimer les tuyaux trop à gauche
  this.pipes.children.each(ch => { if (ch.active && ch.x < -PIPE_W*2) ch.destroy(); });
};

GameScene.prototype.gameOver = function () {
  if (!this.player.active) return;
  this.player.disableBody(true,false).setTint(0xff7676);
  this.spawnTimer?.remove(false);

  const W = this.scale.width, H = this.scale.height;
  const panel = this.add.rectangle(W/2, H/2, W*0.8, 360, 0x163945, 0.92).setDepth(2000);
  this.add.text(W/2, H/2-110, 'Game Over', {font:'64px Georgia', color:'#ffffff'}).setOrigin(0.5).setDepth(2001);
  this.add.text(W/2, H/2-30, `Score : ${this.score}`, {font:'44px monospace', color:'#c9fff4'}).setOrigin(0.5).setDepth(2001);

  const btn = this.add.text(W/2, H/2+70, 'Rejouer', {
    font:'40px monospace', color:'#fff', backgroundColor:'#0db187', padding:{left:22,right:22,top:10,bottom:10}
  }).setOrigin(0.5).setDepth(2001).setInteractive({useHandCursor:true});
  btn.on('pointerdown', () => this.scene.restart());
};
