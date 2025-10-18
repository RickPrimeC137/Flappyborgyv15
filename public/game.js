/*  FlappyBorgy – v15  (Menu + Jeu)
    Scènes:
      - BootScene: preload
      - MenuScene: JOUER / CLASSEMENT / SON
      - GameScene: gameplay (tuyaux physiques, collisions, bonus x2)
*/

// ---------- Constantes communes ----------
const W = 768, H = 1366;     // Portrait logique
const PROFILE = { gravity: 1400, jump: 380 };
const PIPE_W = 120, PIPE_SPEED = -240;
const GAP_MIN = 220, GAP_MAX = 280;
const SPAWN_EVERY_MS = 1400;
const BONUS_EVERY = 50, BONUS_TIME = 10_000;

// rotation de 8 skins (doivent exister dans public/assets)
const SKINS = [
  'graphite','hexghost','mintglass','neonedge',
  'porcelain','brushed','dualband','frosted'
];

// ---------- Boot / Preload ----------
class BootScene extends Phaser.Scene {
  constructor(){ super('Boot'); }
  preload(){
    this.load.setPath('assets');
    // Borgy + bonus
    this.load.image('borgy_ingame', 'borgy_ingame.png');
    this.load.image('sb_token_user', 'sb_token_user.png');

    // Skins (corps + cap)
    SKINS.forEach(n=>{
      this.load.image(`pipe_${n}`, `pipe_v2_${n}.png`);
      this.load.image(`cap_${n}`,  `cap_v2_${n}.png`);
    });
  }
  create(){ this.scene.start('Menu'); }
}

// ---------- Menu principal ----------
class MenuScene extends Phaser.Scene {
  constructor(){ super('Menu'); }

  create(){
    const cx = this.scale.width/2, cy = this.scale.height/2;

    // ciel
    this.cameras.main.setBackgroundColor('#97d7e6');

    // Borgy décoratif
    this.add.image(cx, cy-220, 'borgy_ingame').setScale(0.65).setDepth(1);

    // titre
    this.add.text(cx, cy-420, 'FlappyBorgy', {
      fontFamily:'monospace', fontSize:'78px', color:'#ffffff', stroke:'#0a3a38', strokeThickness:10
    }).setOrigin(0.5);

    // helper bouton
    const makeBtn = (y, label, cb) => {
      const g = this.add.rectangle(cx, y, 420, 90, 0x17a88a, 1).setStrokeStyle(6, 0x0a3a38)
        .setDepth(2).setInteractive({useHandCursor:true});
      const t = this.add.text(cx, y, label, {fontFamily:'monospace', fontSize:'44px', color:'#ffffff'})
        .setOrigin(0.5).setDepth(3);
      g.on('pointerover', ()=>g.setFillStyle(0x14c4a0));
      g.on('pointerout',  ()=>g.setFillStyle(0x17a88a));
      g.on('pointerup', cb);
      return {g,t};
    };

    // boutons
    makeBtn(cy+60,  'JOUER', () => this.scene.start('Game'));
    makeBtn(cy+180, 'CLASSEMENT', () => this.openLeaderboard());
    this.muteBtn = makeBtn(cy+300, this.sound.mute ? 'SON: OFF' : 'SON: ON', () => {
      this.sound.mute = !this.sound.mute;
      this.muteBtn.t.setText(this.sound.mute ? 'SON: OFF' : 'SON: ON');
    });

    // pied de page
    this.add.text(cx, this.scale.height - 40, 'v15', {fontFamily:'monospace', fontSize:'22px', color:'#083b49'})
      .setOrigin(0.5);
  }

  // Panneau de classement (lecture GET /api/leaderboard)
  async openLeaderboard(){
    const cx = this.scale.width/2, cy = this.scale.height/2;

    const panel = this.add.rectangle(cx, cy, 560, 720, 0x123b46, 0.95).setDepth(10);
    const title = this.add.text(cx, cy-300, 'Top 10', {
      fontFamily:'monospace', fontSize:'56px', color:'#ffffff'
    }).setOrigin(0.5).setDepth(11);

    const close = this.add.text(cx, cy+300, 'Fermer', {
      fontFamily:'monospace', fontSize:'36px', color:'#ffffff', backgroundColor:'#17a88a', padding:{x:14,y:8}
    }).setOrigin(0.5).setDepth(11).setInteractive({useHandCursor:true});
    close.on('pointerup', ()=>[panel,title,close,list].forEach(o=>o.destroy()));

    // Récupération via l’API (si indisponible → fallback vide)
    let rows = [];
    try{
      const r = await fetch('/api/leaderboard');
      rows = (await r.json()).slice(0,10);
    }catch(e){ rows=[]; }

    const list = this.add.container(cx-240, cy-240).setDepth(11);
    if(!rows.length){
      list.add(this.add.text(cx-240, cy-240, 'Pas encore de scores.', {
        fontFamily:'monospace', fontSize:'30px', color:'#bff'
      }).setOrigin(0,0));
      return;
    }
    rows.forEach((row,i)=>{
      const y = i*56;
      const name = (row.name || '???').slice(0,12);
      list.add(this.add.text(0, y, `${i+1}. ${name}`, {fontFamily:'monospace', fontSize:'32px', color:'#ffffff'}));
      list.add(this.add.text(380, y, `${row.score}`, {fontFamily:'monospace', fontSize:'32px', color:'#bff'}).setOrigin(1,0));
    });
  }
}

// ---------- Jeu ----------
class GameScene extends Phaser.Scene {
  constructor(){ super('Game'); }

  create(){
    this.score = 0;
    this.pipesSpawned = 0;
    this.dead = false;
    this.multiplierActive = false;
    this.scoreMultiplier = 1;
    this.followCaps = [];
    this.bonusTimerEvt = null;

    // Monde & HUD
    this.physics.world.setBounds(0, 0, this.scale.width, this.scale.height);
    this.scoreText = this.add.text(28, 26, 'Score: 0', {
      fontFamily:'monospace', fontSize:'42px', color:'#ffffff', stroke:'#000', strokeThickness:6
    }).setScrollFactor(0).setDepth(50);
    this.multiText = this.add.text(this.scale.width-20, 26, '', {
      fontFamily:'monospace', fontSize:'36px', color:'#e0ffe0', stroke:'#005533', strokeThickness:6
    }).setOrigin(1,0).setScrollFactor(0).setDepth(50);

    // Joueur
    this.player = this.physics.add.sprite(this.scale.width*0.22, this.scale.height*0.5, 'borgy_ingame')
      .setScale(0.36).setDepth(10).setCollideWorldBounds(true);
    this.player.body.setSize(this.player.width*0.55, this.player.height*0.55, true)
        .setOffset(this.player.width*0.225, this.player.height*0.25);
    this.player.body.setGravityY(PROFILE.gravity);

    this.input.on('pointerdown', ()=>this.flap());
    this.input.keyboard.on('keydown-SPACE', ()=>this.flap());

    // Halo bonus
    this.auraRing = this.add.circle(0, 0, 120, 0x22D6A1, 0.22).setVisible(false).setDepth(9);

    // Groupe de tuyaux physiques
    this.pipes = this.physics.add.group({ allowGravity:false, immovable:true });
    this.physics.add.collider(this.player, this.pipes, ()=>this.onHitPipe());

    // Spawn récurrent
    this.time.addEvent({ delay: SPAWN_EVERY_MS, loop: true, callback: ()=>this.spawnPipePair() });

    // recoller caps + halo
    this.events.on('update', ()=>{
      this.followCaps.forEach(f=>f());
      if(this.auraRing.visible){
        this.auraRing.x = this.player.x; this.auraRing.y = this.player.y;
        this.auraRing.scale = 0.95 + 0.05*Math.sin(this.time.now*0.004);
      }
    });
  }

  // ------- gameplay -------
  flap(){
    if (this.dead) return;
    this.player.setVelocityY(-PROFILE.jump);
  }

  onHitPipe(){
    if(this.dead) return;
    this.dead = true;
    this.clearBonus();

    this.physics.pause();
    this.player.setTint(0xff6666);

    const box = this.add.rectangle(W/2, H/2, 560, 320, 0x123b46, 0.95).setDepth(100);
    const t1  = this.add.text(W/2, H/2-90, 'Game Over', {fontFamily:'monospace', fontSize:'64px', color:'#fff'}).setOrigin(0.5).setDepth(101);
    const t2  = this.add.text(W/2, H/2-15, `Score:  ${this.score}`, {fontFamily:'monospace', fontSize:'46px', color:'#bff'}).setOrigin(0.5).setDepth(101);

    const btnR = this.makeBtn(W/2-120, H/2+80, 'Rejouer', ()=>{ [box,t1,t2,btnR,btnM].forEach(x=>x.destroy()); this.scene.restart(); });
    const btnM = this.makeBtn(W/2+120, H/2+80, 'Menu',    ()=>{ [box,t1,t2,btnR,btnM].forEach(x=>x.destroy()); this.scene.start('Menu'); });
  }

  makeBtn(x,y,label,cb){
    const g = this.add.rectangle(x,y, 220,70, 0x17a88a,1).setDepth(101).setStrokeStyle(6,0x0a3a38).setInteractive({useHandCursor:true});
    const t = this.add.text(x,y, label, {fontFamily:'monospace', fontSize:'36px', color:'#fff'}).setOrigin(0.5).setDepth(102);
    g.on('pointerover', ()=>g.setFillStyle(0x14c4a0));
    g.on('pointerout',  ()=>g.setFillStyle(0x17a88a));
    g.on('pointerup', cb);
    return g;
  }

  spawnPipePair(){
    if(this.dead) return;

    const holeY = Phaser.Math.Between(240, this.scale.height-240);
    const holeH = Phaser.Math.Between(GAP_MIN, GAP_MAX);

    const skin = SKINS[this.pipesSpawned % SKINS.length];
    const x = this.scale.width + 120;
    const pair = this.makePipe(x, holeY, holeH, skin);
    this.pipesSpawned++;

    pair.scored = false;
    this.time.addEvent({
      delay: 50, loop:true,
      callback: ()=>{
        if (!pair || pair.destroyed || pair.scored || this.dead) return;
        const any = pair.topBody || pair.bottomBody;
        if (any && any.x + PIPE_W*0.5 < this.player.x) {
          pair.scored = true;
          this.addScore(1 * this.scoreMultiplier);
        }
      }
    });

    if (this.pipesSpawned % BONUS_EVERY === 0) this.spawnBonus(x+450, holeY);
  }

  makePipe(x, holeY, holeH, skin){
    const bodyKey = `pipe_${skin}`, capKey = `cap_${skin}`;
    const minH = 40;
    const topH = Math.max(minH, holeY - holeH/2);
    const bottomH = Math.max(minH, this.scale.height - (holeY + holeH/2));

    const topBody = this.physics.add.image(x, topH, bodyKey)
      .setOrigin(0.5,1).setDisplaySize(PIPE_W, topH)
      .setImmovable(true).setDepth(5);
    topBody.body.setAllowGravity(false).setVelocityX(PIPE_SPEED);
    this.pipes.add(topBody);

    const bottomBody = this.physics.add.image(x, holeY + holeH/2 + bottomH, bodyKey)
      .setOrigin(0.5,1).setDisplaySize(PIPE_W, bottomH)
      .setFlipY(true)
      .setImmovable(true).setDepth(5);
    bottomBody.body.setAllowGravity(false).setVelocityX(PIPE_SPEED);
    this.pipes.add(bottomBody);

    const topCap    = this.add.image(x, 0, capKey).setOrigin(0.5,1).setDepth(6);
    const bottomCap = this.add.image(x, 0, capKey).setOrigin(0.5,0).setFlipY(true).setDepth(6);

    const f = ()=>{
      if(!topBody.active) return;
      topCap.x = topBody.x;       topCap.y = topBody.y - topBody.displayHeight;
      bottomCap.x = bottomBody.x; bottomCap.y = bottomBody.y - bottomBody.displayHeight;
    };
    this.followCaps.push(f);

    this.time.addEvent({ delay: 12000, callback: ()=>[topBody,bottomBody,topCap,bottomCap].forEach(o=>o && o.destroy()) });
    return { topBody, bottomBody, topCap, bottomCap };
  }

  spawnBonus(x, y){
    const b = this.physics.add.image(x, y, 'sb_token_user').setScale(0.75).setDepth(20);
    b.body.setAllowGravity(false).setVelocityX(PIPE_SPEED);
    this.physics.add.overlap(this.player, b, ()=>{ b.destroy(); this.startBonus(); });
  }

  startBonus(){
    this.multiplierActive = true;
    this.scoreMultiplier = 2;
    this.auraRing.setVisible(true);
    this.updateMultiplierText(BONUS_TIME);

    if(this.bonusTimerEvt) this.bonusTimerEvt.remove(false);
    const t0 = this.time.now;
    this.bonusTimerEvt = this.time.addEvent({
      delay: 100, loop:true, callback: ()=>{
        const left = Math.max(0, BONUS_TIME - (this.time.now - t0));
        this.updateMultiplierText(left);
        if(left<=0) this.clearBonus();
      }
    });
  }

  clearBonus(){
    this.multiplierActive = false; this.scoreMultiplier = 1;
    this.auraRing.setVisible(false); this.multiText.setText('');
    if(this.bonusTimerEvt){ this.bonusTimerEvt.remove(false); this.bonusTimerEvt = null; }
  }

  addScore(n){ this.score += n; this.scoreText.setText(`Score: ${this.score}`); }
  updateMultiplierText(msLeft){ const s = Math.ceil(msLeft/1000); this.multiText.setText(`x2  ${s}s`); }
}

// ---------- Lancement Phaser ----------
const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: W, height: H,
  backgroundColor: '#97d7e6',
  physics: { default:'arcade', arcade:{ gravity:{y:0}, debug:false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, MenuScene, GameScene]
};
new Phaser.Game(config);
