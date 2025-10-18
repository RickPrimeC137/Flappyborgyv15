// public/game.js

/* ------------ Constantes ------------ */
const W = 768, H = 1366;                      // Portrait
const PROFILE = { gravity: 1400, jump: -380, pipeSpeed: -220, gap: 230 };
const BORGY_SCALE = 0.25;                     // taille Borgy ingame
const PIPE_W = 120;                           // largeur apparente d’un fût
const SPAWN_EVERY = 1400;                     // ms

const BONUS_EVERY = 50;                       // bonus toutes les 50 paires
const BONUS_DURATION = 10000;                 // 10 s
const AURA_SOFT = 0x9FFFE0;

/* Styles de tuyaux (corps + capots) */
const PIPE_STYLES = [
  { body: 'pipe_v2_graphite',  cap: 'cap_v2_graphite'  },
  { body: 'pipe_v2_hexghost',  cap: 'cap_v2_hexghost'  },
  { body: 'pipe_v2_mintglass', cap: 'cap_v2_mintglass' },
  { body: 'pipe_v2_neonedge',  cap: 'cap_v2_neonedge'  },
  { body: 'pipe_v2_porcelain', cap: 'cap_v2_porcelain' },
  { body: 'pipe_v2_brushed',   cap: 'cap_v2_brushed'   },
  { body: 'pipe_v2_dualband',  cap: 'cap_v2_dualband'  },
  { body: 'pipe_v2_frosted',   cap: 'cap_v2_frosted'   }
];

/* ------------ Preload ------------ */
class PreloadScene extends Phaser.Scene {
  constructor(){ super('PreloadScene'); }

  preload(){
    // petite barre de chargement
    const w = 360, x = W/2 - w/2, y = H/2;
    const bg = this.add.rectangle(x, y, w, 8, 0x0d9488).setOrigin(0,0.5);
    const fg = this.add.rectangle(x, y, 1, 8, 0xffffff).setOrigin(0,0.5);
    this.load.on('progress', p => fg.width = w * p);

    // IMPORTANT : racine = /public
    this.load.setPath('assets');

    // Borgy + bonus
    this.load.image('borgy_ingame', 'borgy_ingame.png');
    this.load.image('sb_token',     'sb_token_user.png');

    // Pipes (corps + capots)
    PIPE_STYLES.forEach(s => {
      this.load.image(s.body, `${s.body}.png`);
      this.load.image(s.cap,  `${s.cap}.png`);
    });
  }

  create(){
    this.scene.start('GameScene');
  }
}

/* ------------ Jeu ------------ */
class GameScene extends Phaser.Scene {
  constructor(){ super('GameScene'); }

  init(){
    this.score = 0;
    this.pipesPassed = 0;
    this.multiplierActive = false;
    this.followCaps = [];
    this.skinIndex = 0;
    this.spawnCount = 0;
    this.lastTopY = null;
  }

  create(){
    this.cameras.main.setBackgroundColor('#9EE1F2');
    this.physics.world.gravity.y = PROFILE.gravity;

    // Score
    this.scoreText = this.add.text(24, 24, 'Score: 0', {
      fontFamily: 'monospace', fontSize: '44px', color: '#0b4',
      stroke: '#000', strokeThickness: 6
    }).setDepth(50).setScrollFactor(0);

    this.multText = this.add.text(W-24, 24, '', {
      fontFamily: 'monospace', fontSize: '40px', color: '#b1ffe6',
      stroke: '#007a62', strokeThickness: 6
    }).setDepth(50).setScrollFactor(0).setOrigin(1,0);

    // Joueur
    this.player = this.physics.add.image(W*0.25, H*0.45, 'borgy_ingame')
      .setScale(BORGY_SCALE)
      .setCollideWorldBounds(true)
      .setDepth(10);
    // hitbox arrondie
    const r = Math.max(this.player.width, this.player.height) * 0.22;
    this.player.setCircle(r, this.player.width/2 - r, this.player.height/2 - r);

    // Aura
    this.aura = this.add.circle(this.player.x, this.player.y,
      Math.max(this.player.displayWidth, this.player.displayHeight)*0.65,
      AURA_SOFT, 0.22).setVisible(false).setDepth(9);

    // Groupes de collision
    this.pipesTop = this.physics.add.group({ allowGravity:false, immovable:true });
    this.pipesBottom = this.physics.add.group({ allowGravity:false, immovable:true });

    // Collisions
    this.physics.add.collider(this.player, this.pipesTop,    () => this.gameOver());
    this.physics.add.collider(this.player, this.pipesBottom, () => this.gameOver());

    // Input
    this.input.on('pointerdown', () => this.flap());
    this.input.keyboard.on('keydown-SPACE', () => this.flap());

    // Spawner
    this.time.addEvent({ delay: SPAWN_EVERY, loop:true, callback: () => this.spawnPair(W+80) });
    // Démarrer avec quelques paires
    [0,1,2].forEach(i => this.spawnPair(W + 200 + i*280));
  }

  flap(){ this.player.setVelocityY(PROFILE.jump); }

  spawnPair(x){
    // Choix du style (cyclique)
    const style = PIPE_STYLES[this.skinIndex];
    this.skinIndex = (this.skinIndex + 1) % PIPE_STYLES.length;

    // Choix hauteur du trou
    const gap = PROFILE.gap, minTop = 90, maxTop = H - 90 - gap;
    let topY;
    // petit pattern alterné/hasard pour varier
    if (this.spawnCount % 4 === 0)      topY = minTop + 20;
    else if (this.spawnCount % 4 === 1) topY = maxTop - 20;
    else                                topY = Phaser.Math.Between(minTop, maxTop);
    this.spawnCount++;

    // TOP (ancré bas)
    const topPipe = this.pipesTop.create(x, topY, style.body)
      .setOrigin(0.5,1).setDisplaySize(PIPE_W, topY).setDepth(5);
    topPipe.body.setVelocityX(PROFILE.pipeSpeed);

    // BOTTOM (ancré haut)
    const bottomH = H - (topY + gap);
    const bottomPipe = this.pipesBottom.create(x, topY + gap + bottomH, style.body)
      .setOrigin(0.5,1).setFlipY(true).setDisplaySize(PIPE_W, bottomH).setDepth(5);
    bottomPipe.body.setVelocityX(PROFILE.pipeSpeed);

    // Caps décoratifs
    const topCap = this.add.image(x, topY - topPipe.displayHeight, style.cap)
      .setOrigin(0.5,1).setDepth(6).setAlpha(0.95);
    const bottomCap = this.add.image(x, bottomPipe.y - bottomPipe.displayHeight, style.cap)
      .setOrigin(0.5,0).setFlipY(true).setDepth(6).setAlpha(0.95);

    // Les caps “suivent” leurs corps
    const follow = () => {
      if (!topPipe.active) return;
      topCap.x = topPipe.x;    topCap.y = topPipe.y - topPipe.displayHeight;
      bottomCap.x = bottomPipe.x; bottomCap.y = bottomPipe.y - bottomPipe.displayHeight;
      if (topPipe.x < -250){ topCap.destroy(); bottomCap.destroy(); }
    };
    this.followCaps.push(follow);

    // Capteur de score : **dynamique** (pas static) sinon la vélocité ne s’applique pas
    const sensor = this.add.rectangle(x + PIPE_W/2 + 10, H/2, 10, H, 0x000000, 0);
    this.physics.add.existing(sensor);
    sensor.body.setAllowGravity(false).setImmovable(true).setVelocityX(PROFILE.pipeSpeed);

    this.physics.add.overlap(this.player, sensor, () => {
      if (!sensor.active) return;
      sensor.destroy();
      this.pipesPassed++;
      this.score += (this.multiplierActive ? 2 : 1);
      this.scoreText.setText('Score: ' + this.score);

      if (this.pipesPassed > 0 && this.pipesPassed % BONUS_EVERY === 0){
        this.spawnBonus(x + 420, Phaser.Math.Between(200, H - 280));
      }
    });
  }

  spawnBonus(x,y){
    const b = this.physics.add.image(x, y, 'sb_token').setScale(0.55).setDepth(7);
    b.body.setAllowGravity(false).setVelocityX(PROFILE.pipeSpeed);
    this.physics.add.overlap(this.player, b, () => {
      if (!b.active) return;
      b.destroy(); this.activateMultiplier();
    });
    this.time.delayedCall(12000, () => b.destroy());
  }

  activateMultiplier(){
    if (this.multTimer) this.multTimer.remove(false);
    this.multiplierActive = true;
    this.multText.setText('x2');
    this.aura.setVisible(true);

    this.multTimer = this.time.delayedCall(BONUS_DURATION, () => {
      this.multiplierActive = false;
      this.multText.setText('');
      this.aura.setVisible(false);
    });
  }

  update(_,dt){
    // tilt agréable
    const vy = this.player.body.velocity.y;
    this.player.setAngle(Phaser.Math.Clamp(vy * 0.06, -20, 25));

    // Aura suit le joueur
    if (this.aura.visible){
      this.aura.x = this.player.x; this.aura.y = this.player.y;
      this.aura.alpha = 0.2 + 0.08 * Math.sin(this.time.now/180);
    }

    // Nettoyage caps followers
    this.followCaps.forEach(f => f());
  }

  gameOver(){
    if (!this.player.active) return;
    this.physics.pause();
    this.player.setTint(0xff6b6b);
    this.time.delayedCall(800, () => this.scene.restart());
  }
}

/* ------------ Boot Phaser ------------ */
window.addEventListener('load', () => {
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',     // <- mets ici l'id de ton conteneur (ex: <div id="game"></div>)
    width: W,
    height: H,
    backgroundColor: '#9EE1F2',
    physics: { default: 'arcade', arcade: { debug:false } },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [PreloadScene, GameScene]
  });
});
