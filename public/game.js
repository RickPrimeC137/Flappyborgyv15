// FlappyBorgy v15 — Menu + Jeu avec mise à l’échelle responsive

const BASE = { W: 768, H: 1366 }; // monde logique portrait
const INGAME_BORGY_KEY = 'borgy_ingame';
const PIPE_STYLES = ['graphite','hexghost','mintglass','neonedge','porcelain','brushed','dualband','frosted'];

/* --------- utilitaires d'échelle --------- */
// renvoie un objet "métriques" calculé une fois par scène en fonction de BASE
function computeMetrics(scene) {
  const W = BASE.W, H = BASE.H;

  // Tous les paramètres clés en % du monde
  const gap       = Math.round(H * 0.50);  // ouverture entre tuyaux
  const pipeW     = Math.round(W * 0.30);  // largeur visuelle standard de tous les tuyaux
  const pipeSpeed = -Math.round(W * 0.42); // vitesse horizontale (px/s)
  const gravityY  = Math.round(H * 1.05);  // gravité du joueur
  const jumpVy    = -Math.round(H * 0.25); // impulsion “saut”
  const playerH   = Math.round(H * 0.18);  // hauteur visuelle cible de Borgy
  const uiPad     = Math.round(W * 0.03);

  return { W, H, gap, pipeW, pipeSpeed, gravityY, jumpVy, playerH, uiPad };
}

// applique un scale uniforme pour atteindre une hauteur cible
function scaleToHeight(img, targetH) {
  const tex = img.scene.textures.get(img.texture.key).getSourceImage();
  const k = targetH / tex.height;
  img.setScale(k);
  return k;
}

// applique un scale uniforme pour atteindre une largeur cible
function scaleToWidth(img, targetW) {
  const tex = img.scene.textures.get(img.texture.key).getSourceImage();
  const k = targetW / tex.width;
  img.setScale(k);
  return k;
}

/* --------- UI bouton vectoriel --------- */
function makeButton(scene, label, x, y, onClick) {
  const btn = scene.add.rectangle(x, y, 420, 96, 0x10c9a9)
    .setStrokeStyle(6, 0x0b8d77).setOrigin(0.5).setInteractive({ useHandCursor: true });
  const txt = scene.add.text(x, y, label, { fontFamily: 'Arial', fontSize: 42, color: '#ffffff' }).setOrigin(0.5);
  btn.on('pointerover', () => btn.setFillStyle(0x17e0be));
  btn.on('pointerout',  () => btn.setFillStyle(0x10c9a9));
  btn.on('pointerdown', () => onClick && onClick());
  return scene.add.container(0, 0, [btn, txt]);
}

/* --------- SCÈNE MENU --------- */
class MenuScene extends Phaser.Scene {
  constructor(){ super('Menu'); }
  preload() {
    this.load.image(INGAME_BORGY_KEY, 'assets/borgy_ingame.png?v=2');
    this.load.image('tokenSB', 'assets/sb_token_user.png');
    PIPE_STYLES.forEach(s => {
      this.load.image(`pipe_${s}`, `assets/pipe_v2_${s}.png`);
      this.load.image(`cap_${s}`,  `assets/cap_v2_${s}.png`);
    });
  }
  create() {
    this.cameras.main.setBackgroundColor('#8dd0e1');
    const M = computeMetrics(this);

    this.add.text(BASE.W/2, 160, 'FlappyBorgy', {
      fontFamily: 'Arial Black', fontSize: 72, color: '#0a6e5c'
    }).setOrigin(0.5);

    const borgy = this.add.image(BASE.W/2, 420, INGAME_BORGY_KEY).setOrigin(0.5).setAngle(-6);
    scaleToHeight(borgy, Math.round(M.playerH*1.2));

    makeButton(this, 'JOUER',      BASE.W/2, 820,  () => this.scene.start('Game'));
    makeButton(this, 'CRÉDITS',    BASE.W/2, 930,  () => {
      const p = this.add.rectangle(BASE.W/2, BASE.H/2, 580, 420, 0x0d4050, 0.92).setStrokeStyle(6, 0x0ab79a);
      const t = this.add.text(BASE.W/2, BASE.H/2,
        'Jeu: FlappyBorgy\nGraphismes: styles SwissBorg\nMoteur: Phaser 3',
        { fontFamily:'Arial', fontSize:30, color:'#c9fff4', align:'center', wordWrap:{ width: 480 } }
      ).setOrigin(0.5);
      const b = makeButton(this,'FERMER', BASE.W/2, BASE.H/2+150, ()=>{p.destroy();t.destroy();b.destroy();});
    });
  }
}

/* --------- SCÈNE JEU --------- */
class GameScene extends Phaser.Scene {
  constructor(){ super('Game'); }
  create() {
    this.cameras.main.setBackgroundColor('#8dd0e1');
    this.M = computeMetrics(this);

    // Joueur
    this.player = this.physics.add.image(BASE.W*0.28, BASE.H*0.5, INGAME_BORGY_KEY)
      .setOrigin(0.5).setDepth(5);
    scaleToHeight(this.player, this.M.playerH);
    this.player.body.setGravityY(this.M.gravityY);
    this.player.setCollideWorldBounds(true);

    // Groupes
    this.pipes   = this.physics.add.group({ immovable: true, allowGravity: false });
    this.caps    = this.add.group();
    this.sensors = this.physics.add.group({ allowGravity: false });

    // UI
    this.score = 0;
    this.scoreText = this.add.text(this.M.uiPad, this.M.uiPad, 'Score: 0', {
      fontFamily:'Arial Black', fontSize: 40, color:'#ffffff', stroke:'#115a4c', strokeThickness:6
    }).setDepth(10);

    makeButton(this, 'MENU', BASE.W - 110, 60, () => this.scene.start('Menu')).setScale(0.7);

    // input
    this.input.on('pointerdown', () => { this.player.setVelocityY(this.M.jumpVy); });

    // collisions
    this.physics.add.collider(this.player, this.pipes, () => this.gameOver());

    // timer
    this.styleIdx = 0;
    this.timer = this.time.addEvent({ delay: 1100, loop: true, callback: () => this.spawnPair() });
  }

  spawnPair() {
    const { W, H, gap, pipeW, pipeSpeed } = this.M;
    const topY = Phaser.Math.Between(80, H - gap - 160);

    const style = PIPE_STYLES[this.styleIdx++ % PIPE_STYLES.length];
    const pipeKey = `pipe_${style}`;
    const capKey  = `cap_${style}`;

    const x = W + 80;

    // tuyaux
    const top = this.physics.add.image(x, topY, pipeKey).setOrigin(0.5, 1).setDepth(20);
    const bot = this.physics.add.image(x, topY + gap, pipeKey).setOrigin(0.5, 0).setFlipY(true).setDepth(20);
    scaleToWidth(top, pipeW); scaleToWidth(bot, pipeW);
    top.body.allowGravity = bot.body.allowGravity = false;
    top.setVelocityX(pipeSpeed); bot.setVelocityX(pipeSpeed);
    this.pipes.addMultiple([top, bot]);

    // capots déco (même scale que les tuyaux)
    const capTop = this.add.image(x, topY, capKey).setOrigin(0.5, 1).setDepth(21);
    const capBot = this.add.image(x, topY + gap, capKey).setOrigin(0.5, 0).setFlipY(true).setDepth(21);
    const capScale = scaleToWidth(capTop, pipeW); capBot.setScale(capScale);
    const duration = ((W + 160) / Math.abs(pipeSpeed)) * 1000;
    this.tweens.add({ targets:[capTop, capBot], x:-120, duration, ease:'Linear',
      onComplete:()=>{ capTop.destroy(); capBot.destroy(); } });

    // capteur de score
    const zone = this.add.zone(x, topY + gap/2, 8, H);
    this.physics.add.existing(zone);
    zone.body.setAllowGravity(false); zone.body.setVelocityX(pipeSpeed);
    this.sensors.add(zone);
    this.physics.add.overlap(this.player, zone, () => {
      if (!zone.scored) { zone.scored = true; this.score++; this.scoreText.setText('Score: ' + this.score); zone.destroy(); }
    });
  }

  update() {
    if (this.player.y < -30 || this.player.y > BASE.H + 30) this.gameOver();
    this.pipes.children.iterate(p => { if (p && p.x < -120) p.destroy(); });
  }

  gameOver() {
    if (this.ended) return;
    this.ended = true;
    this.timer?.remove(false);
    this.physics.world.colliders.destroy();

    const panel = this.add.rectangle(BASE.W/2, BASE.H/2, 620, 460, 0x0d4151, 0.92).setStrokeStyle(6, 0x0ab79a);
    this.add.text(BASE.W/2, BASE.H/2 - 120, 'Game Over', { fontFamily:'Arial Black', fontSize:70, color:'#c9fff4' }).setOrigin(0.5);
    this.add.text(BASE.W/2, BASE.H/2 - 40, `Score: ${this.score}`, { fontFamily:'Arial', fontSize:40, color:'#c9fff4' }).setOrigin(0.5);
    makeButton(this, 'REJOUER', BASE.W/2, BASE.H/2 + 60,  () => this.scene.restart());
    makeButton(this, 'MENU',    BASE.W/2, BASE.H/2 + 160, () => this.scene.start('Menu'));
  }
}

/* --------- Lancement Phaser --------- */
const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: BASE.W,
  height: BASE.H,
  physics: { default: 'arcade', arcade: { debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  backgroundColor: '#8dd0e1',
  scene: [MenuScene, GameScene]
};
new Phaser.Game(config);
