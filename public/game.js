/*  FlappyBorgy – v15 + Menu
    - Scène de MENU: Jouer / Classement / Son (mute)
    - Scène de JEU: tuyaux physiques (8 skins), collisions, score, bonus x2 10s + halo
*/

//////////////////////////////
// Constantes communes
//////////////////////////////
const W = 768, H = 1366; // Portrait logique

// Gameplay
const PROFILE = { gravity: 1400, jump: 380 };
const PIPE_W = 120;
const PIPE_SPEED = -240;
const GAP_MIN = 220, GAP_MAX = 280;
const SPAWN_EVERY_MS = 1400;
const BONUS_EVERY = 50;
const BONUS_TIME = 10000;

// Skins disponibles (noms = fichiers)
const SKINS = [
  'graphite','hexghost','mintglass','neonedge',
  'porcelain','brushed','dualband','frosted'
];

///////////////////////////////////////////
// SCENE: Menu principal
///////////////////////////////////////////
class MenuScene extends Phaser.Scene {
  constructor(){ super('menu'); }

  preload() {
    this.load.setPath('assets');
    this.load.image('borgy_ingame', 'borgy_ingame.png');
    this.load.image('sb_token_user', 'sb_token_user.png');
    // Charger au menu évite les flashs au start de la scène de jeu
    SKINS.forEach(n => {
      this.load.image(`pipe_${n}`, `pipe_v2_${n}.png`);
      this.load.image(`cap_${n}`,  `cap_v2_${n}.png`);
    });
  }

  create() {
    this.cameras.main.setBackgroundColor('#97d7e6');
    this._drawClouds();

    // Titre
    this.add.text(W/2, 130, 'FLAPPY BORGY', {
      fontFamily:'monospace', fontSize:'72px', color:'#ffffff', stroke:'#004d59', strokeThickness:10
    }).setOrigin(0.5);

    // Borgy décor
    const dog = this.add.image(W*0.22, H*0.62, 'borgy_ingame').setScale(0.52);
    this.tweens.add({ targets: dog, y: dog.y-20, duration: 1000, yoyo:true, repeat:-1, ease: 'sine.inOut' });

    // Bouton helper
    const makeBtn = (y, label, cb) => {
      const t = this.add.text(W/2, y, label, {
        fontFamily:'monospace', fontSize:'54px', color:'#ffffff',
        backgroundColor:'#17a88a', padding:{ x:22, y:12 }
      }).setOrigin(0.5).setInteractive({ useHandCursor:true });
      t.on('pointerover', ()=>t.setStyle({ backgroundColor:'#129b7e'}));
      t.on('pointerout', ()=>t.setStyle({ backgroundColor:'#17a88a'}));
      t.on('pointerup', cb);
      return t;
    };

    // Boutons
    makeBtn(H*0.50, 'Jouer', () => this.scene.start('game'));

    makeBtn(H*0.60, 'Classement', () => this._openLeaderboard());

    // Mute / Son
    const muted = this.sound.mute;
    const btnSound = makeBtn(H*0.70, muted ? 'Son : OFF' : 'Son : ON', () => {
      this.sound.mute = !this.sound.mute;
      btnSound.setText(this.sound.mute ? 'Son : OFF' : 'Son : ON');
    });

    // Version
    this.add.text(W-20, H-16, 'v15', { fontFamily:'monospace', fontSize:'26px', color:'#003e49' })
        .setOrigin(1,1).setAlpha(0.7);
  }

  _drawClouds(){
    const g = this.add.graphics({ fillStyle: { color: 0xffffff, alpha: 0.35 }, lineStyle: { width: 0 }});
    const rnd = (a,b)=>Phaser.Math.Between(a,b);
    for(let i=0;i<5;i++){
      const cx = rnd(80, W-80), cy = rnd(160, H*0.45), r = rnd(40,80);
      g.fillCircle(cx, cy, r);
      g.fillCircle(cx-r*0.7, cy+10, r*0.7);
      g.fillCircle(cx+r*0.7, cy+10, r*0.7);
    }
  }

  _openLeaderboard(){
    // Overlay simple qui tente d’appeler /api/leaderboard (JSON)
    const bg = this.add.rectangle(W/2, H/2, W*0.9, H*0.7, 0x0c3947, 0.92).setDepth(1000);
    const title = this.add.text(W/2, H*0.25, 'Top 10', {
      fontFamily:'monospace', fontSize:'58px', color:'#ffffff'
    }).setOrigin(0.5).setDepth(1001);

    const box = this.add.container(0,0).setDepth(1001);

    const close = this.add.text(W/2, H*0.78, 'Fermer', {
      fontFamily:'monospace', fontSize:'46px', color:'#ffffff',
      backgroundColor:'#17a88a', padding:{x:18,y:8}
    }).setOrigin(0.5).setInteractive({ useHandCursor:true }).setDepth(1001);
    close.on('pointerup', () => { [bg,title,close].forEach(o=>o.destroy()); box.destroy(); });

    fetch('/api/leaderboard').then(r => r.json()).then(data => {
      const rows = Array.isArray(data) ? data : (data.rows || []);
      if(!rows.length) throw 0;
      rows.slice(0,10).forEach((row, i) => {
        const y = H*0.32 + i*52;
        const line = this.add.text(W*0.5, y, `${String(i+1).padStart(2,'0')}. ${row.name || row.username || 'player'}  —  ${row.score}`, {
          fontFamily:'monospace', fontSize:'34px', color:'#baf7ff'
        }).setOrigin(0.5);
        box.add(line);
      });
    }).catch(()=> {
      const t = this.add.text(W/2, H*0.48, 'Classement indisponible', {
        fontFamily:'monospace', fontSize:'38px', color:'#ffd0d0'
      }).setOrigin(0.5);
      box.add(t);
    });
  }
}

///////////////////////////////////////////
// SCENE: Jeu (reprend ton gameplay v15)
///////////////////////////////////////////
class GameScene extends Phaser.Scene {
  constructor(){ super('game'); }

  preload () {
    this.load.setPath('assets');
    this.load.image('borgy_ingame', 'borgy_ingame.png');
    this.load.image('sb_token_user', 'sb_token_user.png');
    SKINS.forEach(n => {
      this.load.image(`pipe_${n}`, `pipe_v2_${n}.png`);
      this.load.image(`cap_${n}`,  `cap_v2_${n}.png`);
    });
  }

  create () {
    this.cameras.main.setBackgroundColor('#97d7e6');
    this.physics.world.setBounds(0,0,this.scale.width,this.scale.height);

    this.score = 0;
    this.pipesSpawned = 0;
    this.dead = false;
    this.multiplierActive = false;
    this.scoreMultiplier = 1;
    this.followCaps = [];

    this.scoreText = this.add.text(28, 26, 'Score: 0', {
      fontFamily:'monospace', fontSize:'42px', color:'#ffffff', stroke:'#000', strokeThickness:6
    }).setScrollFactor(0).setDepth(50);

    this.multiText = this.add.text(this.scale.width-20, 26, '', {
      fontFamily:'monospace', fontSize:'36px', color:'#e0ffe0', stroke:'#005533', strokeThickness:6
    }).setOrigin(1,0).setScrollFactor(0).setDepth(50);

    this.player = this.physics.add.sprite(this.scale.width*0.22, this.scale.height*0.5, 'borgy_ingame')
        .setScale(0.36).setDepth(10).setCollideWorldBounds(true);
    this.player.body.setSize(this.player.width*0.55, this.player.height*0.55, true)
                    .setOffset(this.player.width*0.225, this.player.height*0.25);
    this.player.body.setGravityY(PROFILE.gravity);

    this.input.on('pointerdown', ()=>this._flap());
    this.input.keyboard.on('keydown-SPACE', ()=>this._flap());

    this.auraRing = this.add.circle(0,0,120,0x22D6A1,0.22).setVisible(false).setDepth(9);

    this.pipes = this.physics.add.group({ allowGravity:false, immovable:true });
    this.physics.add.collider(this.player, this.pipes, ()=>this._onHitPipe());

    this.time.addEvent({ delay: SPAWN_EVERY_MS, loop:true, callback: ()=>this._spawnPipePair() });

    this.events.on('update', () => {
      this.followCaps.forEach(f=>f());
      if (this.auraRing.visible) {
        this.auraRing.x = this.player.x; this.auraRing.y = this.player.y;
        this.auraRing.scale = 0.95 + 0.05*Math.sin(this.time.now*0.004);
      }
    });
  }

  update(){}

  // ---- Gameplay helpers
  _flap(){ if(!this.dead) this.player.setVelocityY(-PROFILE.jump); }

  _onHitPipe(){
    if(this.dead) return;
    this.dead = true;
    this._clearBonus();

    this.physics.pause();
    this.player.setTint(0xff6666);

    const box = this.add.rectangle(W/2, H/2, 520, 300, 0x123b46, 0.9).setDepth(100);
    const t1  = this.add.text(W/2, H/2 - 80, 'Game Over', { fontFamily:'monospace', fontSize:'64px', color:'#ffffff'}).setOrigin(0.5).setDepth(101);
    const t2  = this.add.text(W/2, H/2 - 10, `Score:  ${this.score}`, { fontFamily:'monospace', fontSize:'46px', color:'#baffff'}).setOrigin(0.5).setDepth(101);

    const bReplay = this.add.text(W/2, H/2 + 70, 'Rejouer', {
      fontFamily:'monospace', fontSize:'48px', backgroundColor:'#17a88a', color:'#ffffff', padding:{x:18, y:10}
    }).setOrigin(0.5).setDepth(101).setInteractive({ useHandCursor:true });
    bReplay.on('pointerup', () => { [box,t1,t2,bReplay].forEach(o=>o.destroy()); this.scene.restart(); });

    // Bouton Menu
    const bMenu = this.add.text(W/2, H/2 + 140, 'Menu', {
      fontFamily:'monospace', fontSize:'44px', backgroundColor:'#0f7b92', color:'#ffffff', padding:{x:16,y:8}
    }).setOrigin(0.5).setDepth(101).setInteractive({ useHandCursor:true });
    bMenu.on('pointerup', () => this.scene.start('menu'));
  }

  _spawnPipePair(){
    if(this.dead) return;

    const holeY = Phaser.Math.Between(240, this.scale.height - 240);
    const holeH = Phaser.Math.Between(GAP_MIN, GAP_MAX);

    const skinIndex = this.pipesSpawned % SKINS.length;
    const skin = SKINS[skinIndex];
    const x = this.scale.width + 120;

    const pair = this._makePipe(x, holeY, holeH, skin);
    this.pipesSpawned++;

    pair.scored = false;
    this.time.addEvent({
      delay: 50, loop:true,
      callback: () => {
        if (!pair || pair.destroyed || pair.scored || this.dead) return;
        const any = pair.topBody || pair.bottomBody;
        if (any && any.x + PIPE_W*0.5 < this.player.x) {
          pair.scored = true;
          this._addScore(1 * this.scoreMultiplier);
        }
      }
    });

    if (this.pipesSpawned % BONUS_EVERY === 0) this._spawnBonus(x + 450, holeY);
  }

  _makePipe(x, holeY, holeH, skin){
    const bodyKey = `pipe_${skin}`, capKey = `cap_${skin}`;
    const minH = 40;
    const topH = Math.max(minH, holeY - holeH/2);
    const bottomH = Math.max(minH, this.scale.height - (holeY + holeH/2));

    const topBody = this.physics.add.image(x, topH, bodyKey)
      .setOrigin(0.5,1).setDisplaySize(PIPE_W, topH).setImmovable(true).setDepth(5);
    topBody.body.setAllowGravity(false).setVelocityX(PIPE_SPEED);
    this.pipes.add(topBody);

    const bottomBody = this.physics.add.image(x, holeY + holeH/2 + bottomH, bodyKey)
      .setOrigin(0.5,1).setDisplaySize(PIPE_W, bottomH).setFlipY(true).setImmovable(true).setDepth(5);
    bottomBody.body.setAllowGravity(false).setVelocityX(PIPE_SPEED);
    this.pipes.add(bottomBody);

    const topCap = this.add.image(x, 0, capKey).setOrigin(0.5,1).setDepth(6);
    const bottomCap = this.add.image(x, 0, capKey).setOrigin(0.5,0).setFlipY(true).setDepth(6);

    const follow = () => {
      if (!topBody.active) return;
      topCap.x = topBody.x; topCap.y = topBody.y - topBody.displayHeight;
      bottomCap.x = bottomBody.x; bottomCap.y = bottomBody.y - bottomBody.displayHeight;
    };
    this.followCaps.push(follow);

    this.time.addEvent({ delay: 12000, callback: ()=>[topBody,bottomBody,topCap,bottomCap].forEach(o=>o && o.destroy()) });
    return { topBody, bottomBody, topCap, bottomCap };
  }

  _spawnBonus(x, y){
    const b = this.physics.add.image(x, y, 'sb_token_user').setScale(0.75).setDepth(20);
    b.body.setAllowGravity(false).setVelocityX(PIPE_SPEED);
    this.physics.add.overlap(this.player, b, () => { b.destroy(); this._startBonus(); });
  }

  _startBonus(){
    this.multiplierActive = true;
    this.scoreMultiplier = 2;
    this.auraRing.setVisible(true);
    this._updateMultiplierText(BONUS_TIME);

    if (this.bonusTimerEvt) this.bonusTimerEvt.remove(false);
    const t0 = this.time.now;
    this.bonusTimerEvt = this.time.addEvent({
      delay: 100, loop:true, callback: () => {
        const left = Math.max(0, BONUS_TIME - (this.time.now - t0));
        this._updateMultiplierText(left);
        if (left <= 0) this._clearBonus();
      }
    });
  }

  _clearBonus(){
    this.multiplierActive = false;
    this.scoreMultiplier = 1;
    this.auraRing.setVisible(false);
    this.multiText.setText('');
    if (this.bonusTimerEvt) { this.bonusTimerEvt.remove(false); this.bonusTimerEvt = null; }
  }

  _addScore(n){
    this.score += n;
    this.scoreText.setText(`Score: ${this.score}`);
  }

  _updateMultiplierText(msLeft){
    const s = Math.ceil(msLeft/1000);
    this.multiText.setText(`x2  ${s}s`);
  }
}

///////////////////////////////////////////
// Boot Phaser avec 2 scènes
///////////////////////////////////////////
const config = {
  type: Phaser.AUTO,
  width: W, height: H,
  backgroundColor: '#97d7e6',
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false }
  },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [MenuScene, GameScene]
};

new Phaser.Game(config);
