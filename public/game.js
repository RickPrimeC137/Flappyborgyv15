/*  FlappyBorgy v15 — Pipes 4K + Menu + Beep + Cap Masks
 *  Phaser 3 (inclus via <script src="phaser.min.js"></script> dans index.html)
 */

///////////////////////
//  PARAMÈTRES JEU  //
///////////////////////
const WORLD_W = 768;
const WORLD_H = 1366;

const PROFILE = {
  gravity: 1400,
  jump: -380,
  pipeSpeed: -225,
  gap: 260                   // trou un peu plus large pour mobiles
};

const BORGY_SCALE = 0.22;
const PIPE_W = 150;          // largeur visuelle des tuyaux
const CAP_H   = 130;         // hauteur visuelle des caps (fixe, masquée au bord)
const BODY_STROKE = 0x0b4a3f;
const BODY_FILL_LIGHT = 0x34d399;   // vert clair
const BODY_FILL_DARK  = 0x1a2a25;   // très sombre

const SPAWN_DELAY = 1500;    // délai entre paires
const CHANGE_SKIN_EVERY = 50; // change de skin toutes les 50 paires

///////////////////////
//  SCÈNE PRELOAD    //
///////////////////////
class PreloadScene extends Phaser.Scene {
  constructor(){ super('preload'); }

  preload(){
    const W = this.scale.width, H = this.scale.height;

    // Barre de chargement
    const bg = this.add.rectangle(W/2, H*0.55, 360, 10, 0x000000, 0.15).setOrigin(0.5);
    const fg = this.add.rectangle(W/2 - 180, H*0.55, 1, 10, 0x00b894).setOrigin(0,0.5);
    const pct = this.add.text(W/2, H*0.55+22, '0%', { fontFamily:'monospace', fontSize:18, color:'#044' }).setOrigin(0.5);
    this.load.on('progress', v => { fg.width = 360*v; pct.setText(Math.round(v*100)+'%'); });

    this.load.setPath('assets');

    // Joueur
    this.load.image('borgy', 'borgy_ingame.png');

    // Pipes (4 images)
    this.load.image('pipe_light_top',    'pipe_light_top.png');
    this.load.image('pipe_light_bottom', 'pipe_light_bottom.png');
    this.load.image('pipe_dark_top',     'pipe_dark_top.png');
    this.load.image('pipe_dark_bottom',  'pipe_dark_bottom.png');

    // Son
    this.load.audio('beep', 'beep.mp3');
  }

  create(){
    this.scene.start('menu');
  }
}

///////////////////////
//  SCÈNE MENU       //
///////////////////////
class MenuScene extends Phaser.Scene {
  constructor(){ super('menu'); }

  create(){
    const W = this.scale.width, H = this.scale.height;

    this.add.text(W/2, H*0.28, 'FlappyBorgy', {
      fontFamily: 'Georgia, serif',
      fontSize: 80,
      color: '#063',
      stroke: '#0a3a38',
      strokeThickness: 10
    }).setOrigin(0.5);

    this.add.text(W/2, H*0.42, 'Tap to Start', {
      fontFamily: 'monospace',
      fontSize: 48,
      color: '#ffffff',
      stroke: '#0a3a38',
      strokeThickness: 8
    }).setOrigin(0.5).setAlpha(0.9);

    // little mascot
    this.add.image(W/2, H*0.58, 'borgy')
      .setScale(0.28)
      .setAngle(-10);

    this.input.once('pointerdown', ()=> this.scene.start('game'));
    this.input.keyboard?.once('keydown-SPACE', ()=> this.scene.start('game'));
  }
}

///////////////////////
//  SCÈNE GAME       //
///////////////////////
class GameScene extends Phaser.Scene {
  constructor(){ super('game'); }

  init(){
    this.score = 0;
    this.pairsSpawned = 0;       // pour le changement de skin
    this.started = false;

    // Pattern
    this.spawnCount = 0;
    this.patternMode = 'STAIRS'; // plus propre : escaliers
    this.lastTopY = null;
  }

  create(){
    const W = this.scale.width, H = this.scale.height;

    // Score
    this.scoreText = this.add.text(24, 24, 'Score: 0', {
      fontFamily: 'monospace', fontSize: 48, color: '#ffffff',
      stroke: '#0a3a38', strokeThickness: 8
    }).setDepth(1000).setOrigin(0,0);

    // Groupes
    this.pipes = this.physics.add.group();
    this.sensors = this.physics.add.group();

    // Joueur
    this.player = this.physics.add.sprite(W*0.24, H*0.45, 'borgy')
      .setScale(BORGY_SCALE)
      .setCollideWorldBounds(true)
      .setDepth(10);
    this.player.body.setAllowGravity(false);   // pas de gravité avant le 1er tap
    this.player.body.setSize(this.player.width*0.55, this.player.height*0.55, true)
        .setOffset(this.player.width*0.225, this.player.height*0.25);

    // Overlay "tap pour démarrer"
    this.tapOverlay = this.add.text(W/2, H*0.70, 'Tap to flap', {
      fontFamily:'monospace', fontSize: 46, color:'#eaffff',
      stroke:'#0a3a38', strokeThickness: 6
    }).setOrigin(0.5).setDepth(1000).setAlpha(0.9);

    // Entrées
    const startIfNeeded = () => {
      if (!this.started){
        this.started = true;
        this.player.body.setAllowGravity(true);
        this.player.setVelocityY(-220); // petit saut de départ
        this.tapOverlay.setVisible(false);
        // Timer de spawn
        this.spawnTimer = this.time.addEvent({
          delay: SPAWN_DELAY,
          loop: true,
          callback: ()=> this.spawnPipePair()
        });
        // Une première paire de suite pour éviter le vide
        this.spawnPipePair();
      }else{
        this.flap();
      }
    };
    this.input.on('pointerdown', startIfNeeded);
    this.input.keyboard?.on('keydown-SPACE', startIfNeeded);

    // Collisions
    this.physics.add.overlap(this.player, this.pipes, ()=> this.gameOver(), null, this);

    // Son
    this.beep = this.sound.add('beep', { volume: 0.35 });
  }

  update(time){
    if (!this.started) return;

    // Inclinaison
    if (this.player.body.velocity.y < -20) this.player.setAngle(-16);
    else if (this.player.body.velocity.y > 160) this.player.setAngle(22);
    else this.player.setAngle(0);

    // Nettoyage hors écran
    this.pipes.children.each(p => {
      if (p.active && p.x < -PIPE_W*2) p.destroy();
    });
    this.sensors.children.each(s => {
      if (s.active && s.x < -50) s.destroy();
    });
  }

  flap(){
    if (!this.player.active) return;
    this.player.setVelocityY(PROFILE.jump);
  }

  spawnPipePair(){
    const W = this.scale.width, H = this.scale.height;

    // Pattern (choix du topY)
    const gap = PROFILE.gap;
    const minTop = 90;
    const maxTop = H - (gap + 180);
    let topY;

    switch (this.patternMode) {
      case 'STAIRS': {
        const steps = 6;
        const stepH = (maxTop - minTop) / steps;
        topY = minTop + ( (this.spawnCount % steps) * stepH );
        break;
      }
      case 'RANDOM': default:
        topY = Phaser.Math.Between(minTop, maxTop);
    }
    this.spawnCount++;

    const holeY = topY + gap/2;
    const topH = topY;
    const bottomH = H - (holeY + gap/2);

    // Skin (change toutes les 50 paires)
    const skinIndex = Math.floor(this.pairsSpawned / CHANGE_SKIN_EVERY) % 2;
    const skin = (skinIndex === 0) ? 'light' : 'dark';

    const x = W + 40;

    // VISU + COLLISIONS
    const pair = this.createPipeVisualsAndBodies(x, topH, bottomH, holeY, gap, skin);
    this.pairsSpawned++;

    // Capteur de score
    const sensor = this.add.rectangle(x + PIPE_W + 40, H/2, 12, H, 0x000, 0)
      .setDepth(1);
    this.physics.add.existing(sensor, true);
    sensor.body.setVelocityX(PROFILE.pipeSpeed);
    this.sensors.add(sensor);

    this.physics.add.overlap(this.player, sensor, ()=>{
      if (!sensor.active) return;
      sensor.destroy();
      this.incrementScore();
    });
  }

  createPipeVisualsAndBodies(x, topH, bottomH, holeY, gap, skin){
    const H = this.scale.height;

    // Corps = simples rectangles propres (derrière les caps)
    const bodyColor = (skin === 'light') ? BODY_FILL_LIGHT : BODY_FILL_DARK;

    const topBody = this.add.rectangle(x, topH, PIPE_W, topH, bodyColor)
      .setOrigin(0.5,1).setDepth(4).setStrokeStyle(6, BODY_STROKE, 0.6);
    const bottomBody = this.add.rectangle(x, holeY + gap/2 + bottomH, PIPE_W, bottomH, bodyColor)
      .setOrigin(0.5,1).setDepth(4).setStrokeStyle(6, BODY_STROKE, 0.6).setFlipY(true);

    this.physics.add.existing(topBody, true);
    this.physics.add.existing(bottomBody, true);
    topBody.body.setVelocityX(PROFILE.pipeSpeed);
    bottomBody.body.setVelocityX(PROFILE.pipeSpeed);

    this.pipes.add(topBody);
    this.pipes.add(bottomBody);

    // Caps (avec MASQUES pour couper le halo des PNG)
    const topKey = (skin === 'light') ? 'pipe_light_top' : 'pipe_dark_top';
    const botKey = (skin === 'light') ? 'pipe_light_bottom' : 'pipe_dark_bottom';

    const topCap = this.add.image(x, topBody.y - topBody.height, topKey)
      .setOrigin(0.5,1).setDepth(6)
      .setDisplaySize(PIPE_W, CAP_H);
    const bottomCap = this.add.image(x, holeY + gap/2, botKey)
      .setOrigin(0.5,0).setDepth(6)
      .setDisplaySize(PIPE_W, CAP_H);

    // --- MASQUES GEOMETRY pour couper net au bord du tuyau
    {
      const gTop = this.make.graphics({ x: 0, y: 0, add: false });
      gTop.fillStyle(0xffffff);
      gTop.fillRect(-PIPE_W/2, -CAP_H, PIPE_W, CAP_H);
      const maskTop = gTop.createGeometryMask();
      topCap.setMask(maskTop);
    }
    {
      const gBot = this.make.graphics({ x: 0, y: 0, add: false });
      gBot.fillStyle(0xffffff);
      gBot.fillRect(-PIPE_W/2, 0, PIPE_W, CAP_H);
      const maskBot = gBot.createGeometryMask();
      bottomCap.setMask(maskBot);
    }

    // Faire "suivre" les caps les corps
    const follow = () => {
      if (!topBody.active) return;
      topCap.x = topBody.x;
      topCap.y = topBody.y - topBody.height;
      bottomCap.x = bottomBody.x;
      bottomCap.y = holeY + gap/2;
    };
    this.events.on('update', follow);

    // Donner la vitesse aux caps (sinon ils restent statiques)
    this.tweens.add({
      targets: [topCap, bottomCap],
      x: -PIPE_W*2,
      duration: ( (x + PIPE_W*2) / Math.abs(PROFILE.pipeSpeed) ) * 1000,
      ease: 'Linear',
      onComplete: ()=> {
        topCap.destroy(); bottomCap.destroy();
        this.events.off('update', follow);
      }
    });

    return { topBody, bottomBody, topCap, bottomCap };
  }

  incrementScore(){
    this.score += 1;
    this.scoreText.setText('Score: ' + this.score);
    this.beep?.play();
  }

  gameOver(){
    if (!this.player.active) return;

    this.player.disableBody(true,false);
    this.player.setTint(0xff6b6b);
    this.spawnTimer && this.spawnTimer.remove(false);

    const W = this.scale.width, H = this.scale.height;

    const panel = this.add.rectangle(W/2, H/2, W*0.82, 360, 0x163945, 0.92).setDepth(1000);
    this.add.text(W/2, H/2-110, 'Game Over', {
      fontFamily:'Georgia, serif', fontSize:72, color:'#fff'
    }).setOrigin(0.5).setDepth(1001);
    this.add.text(W/2, H/2-30, `Score : ${this.score}`, {
      fontFamily:'monospace', fontSize:52, color:'#c9fff4'
    }).setOrigin(0.5).setDepth(1001);

    const btn = this.add.text(W/2, H/2+70, 'Rejouer', {
      fontFamily:'monospace', fontSize:52, color:'#fff',
      backgroundColor:'#0db187', padding:{left:22,right:22,top:10,bottom:10}
    }).setOrigin(0.5).setDepth(1001).setInteractive({ useHandCursor:true });

    btn.once('pointerdown', ()=> this.scene.restart());
  }
}

///////////////////////
//  BOOT CONFIG      //
///////////////////////
window.addEventListener('load', ()=>{
  const config = {
    type: Phaser.AUTO,
    parent: 'game-root',
    backgroundColor: '#9edff1',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: WORLD_W,
      height: WORLD_H
    },
    physics: {
      default: 'arcade',
      arcade: { gravity: {y:0}, debug: false }
    },
    scene: [PreloadScene, MenuScene, GameScene]
  };

  new Phaser.Game(config);
});
