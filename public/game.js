// public/game.js

/* ---------- Config ---------- */
const W = 768, H = 1366;            // Portrait logique
const GRAVITY = 1300;
const JUMP_VELOCITY = -380;
const SCROLL_SPEED = -220;
const GAP = 230;                    // Espace entre tuyaux
const SPAWN_EVERY = 1400;           // ms

const PIPE_KEYS = [
  'pipe_v2_brushed','pipe_v2_dualband','pipe_v2_frosted','pipe_v2_graphite',
  'pipe_v2_hexghost','pipe_v2_mintglass','pipe_v2_neonedge','pipe_v2_porcelain'
];

const CAP_KEYS = [
  'cap_v2_brushed','cap_v2_dualband','cap_v2_frosted','cap_v2_graphite',
  'cap_v2_hexghost','cap_v2_mintglass','cap_v2_neonedge','cap_v2_porcelain'
];

/* ---------- Boot Scene ---------- */
class Boot extends Phaser.Scene {
  constructor(){ super('Boot'); }

  preload(){
    // Barre de chargement ultra simple
    const w = 360, x = W/2 - w/2, y = H/2;
    const bg = this.add.rectangle(x, y, w, 8, 0x0ea5a0).setOrigin(0,0.5);
    const fg = this.add.rectangle(x, y, 1, 8, 0xffffff).setOrigin(0,0.5);

    this.load.on('progress', p => fg.width = Math.max(1, w*p));

    // IMPORTANT : racine = /public
    this.load.setPath('assets');

    // Borgy
    this.load.image('borgy', 'borgy_ingame.png');

    // Tous les tuyaux + chapeaux
    PIPE_KEYS.forEach(k => this.load.image(k, `${k}.png`));
    CAP_KEYS.forEach(k  => this.load.image(k, `${k}.png`));

    // Petits nuages simples (facultatifs)
    this.load.image('cloud', 'sb_token_user.png'); // on recycle l’icône si besoin
  }

  create(){
    // Quand tout est prêt, on passe sur Play
    this.scene.start('Play');
  }
}

/* ---------- Play Scene ---------- */
class Play extends Phaser.Scene {
  constructor(){ super('Play'); }

  create(){
    this.cameras.main.setBackgroundColor(0x9EE1F2);

    // Monde & physique
    this.physics.world.setBounds(0, 0, W, H);
    this.physics.world.gravity.y = GRAVITY;

    // Score
    this.score = 0;
    this.scoreText = this.add.text(24, 24, 'Score: 0', {
      fontFamily: 'monospace', fontSize: '44px', color: '#0b4', stroke: '#000', strokeThickness: 6
    }).setScrollFactor(0).setDepth(10);

    // Borgy (taille réduite)
    this.player = this.physics.add.image(180, H*0.45, 'borgy')
      .setScale(0.33)             // << taille ingame
      .setCircle(150)             // hitbox arrondie (ajuste si besoin)
      .setBounce(0)
      .setCollideWorldBounds(true);
    this.player.body.setOffset(this.player.width*0.5 - 150, this.player.height*0.5 - 150);

    // Input
    this.input.on('pointerdown', () => this.flap());
    this.input.keyboard.on('keydown-SPACE', () => this.flap());

    // Groupes de tuyaux
    this.pipesTop = this.physics.add.group({ allowGravity: false, immovable: true });
    this.pipesBottom = this.physics.add.group({ allowGravity: false, immovable: true });

    // Collisions
    this.physics.add.collider(this.player, this.pipesTop,   () => this.gameOver(), null, this);
    this.physics.add.collider(this.player, this.pipesBottom,() => this.gameOver(), null, this);

    // Spawn régulier
    this.time.addEvent({
      delay: SPAWN_EVERY,
      loop: true,
      callback: () => this.spawnPair(W + 100)
    });

    // Démarrer avec 3 paires déjà posées
    [0, 1, 2].forEach(i => this.spawnPair(W + 200 + i*280));
  }

  flap(){
    this.player.setVelocityY(JUMP_VELOCITY);
  }

  spawnPair(x){
    // Choix style aléatoire commun aux deux tuyaux
    const i = Math.floor(Math.random()*PIPE_KEYS.length);
    const pipeKey = PIPE_KEYS[i];
    const capKey  = CAP_KEYS[i];

    // Calcul hauteur
    const minTop = 90;
    const maxTop = H - 90 - GAP;
    const topY   = Phaser.Math.Between(minTop, maxTop);

    // TOP (ancré en bas)
    const topPipe = this.pipesTop.create(x, topY, pipeKey)
      .setOrigin(0.5, 1).setScale(0.42).setVelocityX(SCROLL_SPEED);
    // BOTTOM (ancré en haut)
    const bottomPipe = this.pipesBottom.create(x, topY + GAP, pipeKey)
      .setOrigin(0.5, 0).setScale(0.42).setVelocityX(SCROLL_SPEED);

    // (Option) caps décoratifs (non collidants)
    this.add.image(x, topY - topPipe.displayHeight, capKey)
      .setOrigin(0.5, 1).setScale(0.42).setDepth(2).setAlpha(0.95).setData('cap', true)
      .setData('vx', SCROLL_SPEED);
    this.add.image(x, bottomPipe.y + bottomPipe.displayHeight, capKey)
      .setOrigin(0.5, 0).setScale(0.42).setDepth(2).setAlpha(0.95).setData('cap', true)
      .setData('vx', SCROLL_SPEED);

    // Marqueur de score (compte 1 quand le centre passe le joueur)
    topPipe.scorable = true;
  }

  update(_, dt){
    // Comptage + recyclage
    this.pipesTop.getChildren().forEach(top => {
      // Score
      if (top.scorable && top.x + top.displayWidth/2 < this.player.x){
        top.scorable = false;
        this.score++;
        this.scoreText.setText('Score: ' + this.score);
      }
      // Recyclage
      if (top.x < -200){
        // Détruit son compagnon du bas avec le même index
        const idx = this.pipesTop.getChildren().indexOf(top);
        const bot = this.pipesBottom.getChildren()[idx];
        if (bot) bot.destroy();
        top.destroy();
      }
    });

    // Faire défiler les “caps” décoratifs manuellement
    this.children.list.forEach(ch => {
      if (ch.getData('cap')){
        ch.x += ch.getData('vx') * (dt/1000);
        if (ch.x < -200) ch.destroy();
      }
    });

    // Si le joueur sort par le bas -> fin
    if (this.player.y > H + 60) this.gameOver();
  }

  gameOver(){
    // Petit “freeze” et relance
    this.physics.pause();
    this.player.setTint(0xff7777);
    this.time.delayedCall(700, () => this.scene.restart());
  }
}

/* ---------- Démarrage ---------- */
window.addEventListener('load', () => {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    width: W,
    height: H,
    parent: 'game',
    physics: { default: 'arcade', arcade: { debug: false } },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [Boot, Play],
    backgroundColor: '#9EE1F2'
  });
});
