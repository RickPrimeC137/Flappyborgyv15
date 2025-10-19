/*  FlappyBorgy v15.6
 *  - Gravité active dès le début (le joueur tombe)
 *  - Spawn des tuyaux PAUSÉ jusqu'au premier tap
 *  - Tuyaux propres: caps seules + corps tileSprite sans halo
 *  - Collisions robustes (rectangles physiques invisibles)
 *  - Woof à chaque point, bonus optionnel, menu & quêtes
 */

const VERSION = 'v15.6'; // change à chaque déploiement pour casser le cache

/* ------------------ Profil jeu ------------------ */
const PROFILE = { gravity: 1400, jump: -380, pipeSpeed: -220, gap: 230 };
const BORGY_SCALE = 0.22;
const PIPE_W = 140;
const SPAWN_DELAY = 1600;
const HOLE_MIN = 90;
const HOLE_MAX_MARGIN = 160;

/* ------------------ Helpers UI ------------------ */
function btnStyle(){
  return { fontFamily:'monospace', fontSize: 52, color:'#ffffff', backgroundColor:'#0db187',
           padding:{left:22,right:22,top:10,bottom:10} };
}
function btnStyleSecondary(){
  return { fontFamily:'monospace', fontSize: 40, color:'#0b3a32', backgroundColor:'#bdf4e7',
           padding:{left:18,right:18,top:8,bottom:8} };
}

/* ------------------ Quêtes (localStorage) ------------------ */
const QUEST_KEY = 'fbv15_daily_quests';
const QUEST_DATE_KEY = 'fbv15_daily_date';
function todayStr(){ const d=new Date(); return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; }
function generateQuests(){
  return [
    { id:'pipes', title:'Passer 60 tuyaux', target:60, progress:0, done:false },
    { id:'score', title:'Atteindre 30 points', target:30, progress:0, done:false },
    { id:'bonus', title:'Prendre 1 bonus', target:1, progress:0, done:false }
  ];
}
function loadDailyQuests(){
  const t = todayStr(), last = localStorage.getItem(QUEST_DATE_KEY);
  if (last !== t){ const q = generateQuests(); localStorage.setItem(QUEST_KEY, JSON.stringify(q)); localStorage.setItem(QUEST_DATE_KEY, t); return q; }
  try{ const q = JSON.parse(localStorage.getItem(QUEST_KEY)||'[]'); return Array.isArray(q)?q:generateQuests(); }
  catch{ const q=generateQuests(); localStorage.setItem(QUEST_KEY, JSON.stringify(q)); return q; }
}
function saveDailyQuests(q){ localStorage.setItem(QUEST_KEY, JSON.stringify(q)); }
function bumpQuest(kind, amount){
  const q = loadDailyQuests(); let changed = false;
  q.forEach(quest => { if (quest.id===kind && !quest.done){ quest.progress = Math.min(quest.target, (quest.progress||0)+amount); if (quest.progress>=quest.target) quest.done = true; changed = true; } });
  if (changed) saveDailyQuests(q);
}
function saveBestScore(s){ const k='fbv15_best', best=Number(localStorage.getItem(k)||0); if (s>best) localStorage.setItem(k, String(s)); }
function loadBestScore(){ return Number(localStorage.getItem('fbv15_best')||0); }

/* ------------------ Texture corps tuyau (anti halo) ------------------ */
/** Crée une texture tileable à partir d'une bande verticale du PNG `srcKey` */
function makePipeBodyTexture(scene, srcKey, outKey) {
  if (scene.textures.exists(outKey)) return outKey;
  const img = scene.textures.get(srcKey).getSourceImage();
  const w = img.width, h = img.height;

  // Bande centrale (loin des bords et de la bague pour éviter tout matte)
  const sliceW = Math.max(16, Math.floor(w * 0.14));
  const sx = Math.floor((w - sliceW) / 2);
  const sy = Math.floor(h * 0.18);
  const sh = Math.max(120, h - sy - Math.floor(h * 0.20));

  const canvasTex = scene.textures.createCanvas(outKey, sliceW, sh);
  const ctx = canvasTex.getContext();
  ctx.clearRect(0,0,sliceW,sh);
  ctx.drawImage(img, sx, sy, sliceW, sh, 0, 0, sliceW, sh);
  canvasTex.refresh();
  return outKey;
}

/* ------------------ PRELOAD ------------------ */
class PreloadScene extends Phaser.Scene {
  constructor(){ super('preload'); }
  preload(){
    const W = this.scale.width, H = this.scale.height;
    const bg = this.add.rectangle(W/2, H/2, 420, 10, 0x000000, 0.12).setOrigin(0.5);
    const bar = this.add.rectangle(W/2 - 210, H/2, 1, 10, 0x0aa67e).setOrigin(0, 0.5);
    const pct = this.add.text(W/2, H/2 + 22, '0%', { fontFamily:'monospace', fontSize:16, color:'#044' }).setOrigin(0.5);
    this.load.on('progress', p => { bar.width = 420*p; pct.setText(`${Math.round(p*100)}%`); });

    const missing = [];
    this.load.on('fileerror', f => { const name=(f&&(f.src||f.key))?(f.src||f.key):'unknown'; missing.push(name); console.warn('[Loader] error:', name); });

    let completed=false; this.time.delayedCall(8000, ()=>{ if(!completed){ console.warn('[Loader] watchdog start'); this.scene.start('boot'); } });

    this.load.setPath('assets'); const v=f=>`${f}?${VERSION}`;
    this.load.image('borgy',             v('borgy_ingame.png'));
    this.load.image('pipe_light_top',    v('pipe_light_top.png'));
    this.load.image('pipe_light_bottom', v('pipe_light_bottom.png'));
    this.load.image('pipe_dark_top',     v('pipe_dark_top.png'));
    this.load.image('pipe_dark_bottom',  v('pipe_dark_bottom.png'));
    this.load.image('sb_token',          v('sb_token_user.png')); // optionnel
    this.load.audio('woof',              [v('woof.ogg')]);

    this.load.once('complete', ()=>{ completed=true; if(missing.length){ this.add.text(W/2, H/2+60, 'Fichiers manquants:\n'+missing.map(s=>s.split('/').pop()).join('\n'), {fontFamily:'monospace', fontSize:14, color:'#a00', align:'center'}).setOrigin(0.5); } this.scene.start('boot'); });
  }
}
class BootScene extends Phaser.Scene { constructor(){ super('boot'); } create(){ this.scene.start('menu'); } }

/* ------------------ MENU ------------------ */
class MenuScene extends Phaser.Scene {
  constructor(){ super('menu'); }
  create(){
    const W=this.scale.width, H=this.scale.height;
    this.add.text(W/2, H*0.22, 'FlappyBorgy', { fontFamily:'Georgia,serif', fontSize:72, color:'#0b3a32', stroke:'#bdf4e7', strokeThickness:10 }).setOrigin(0.5);
    const play = this.add.text(W/2, H*0.42, 'Jouer', btnStyle()).setOrigin(0.5).setInteractive({useHandCursor:true});
    play.on('pointerdown', ()=> this.scene.start('game'));
    const quests = this.add.text(W/2, H*0.54, 'Quêtes', btnStyleSecondary()).setOrigin(0.5).setInteractive({useHandCursor:true});
    quests.on('pointerdown', ()=> this.scene.start('quests'));
    this.add.text(W/2, H*0.78, 'Tap/Space pour sauter\nÉvite les tuyaux', { fontFamily:'monospace', fontSize:26, color:'#0b3a32', align:'center' }).setOrigin(0.5);
  }
}

/* ------------------ QUÊTES ------------------ */
class QuestScene extends Phaser.Scene {
  constructor(){ super('quests'); }
  create(){
    const W=this.scale.width, H=this.scale.height;
    this.add.text(W/2, 80, 'Quêtes du jour', { fontFamily:'Georgia,serif', fontSize:56, color:'#0b3a32' }).setOrigin(0.5);
    const q = loadDailyQuests(); let y = 180;
    q.forEach(quest => { const line=`${quest.title}  –  ${quest.progress}/${quest.target}  ${quest.done?'✅':'⬜'}`; this.add.text(60, y, line, { fontFamily:'monospace', fontSize:28, color: quest.done ? '#0a7a56' : '#083b43' }); y+=60; });
    const back = this.add.text(W/2, H*0.88, '← Retour', btnStyleSecondary()).setOrigin(0.5).setInteractive({useHandCursor:true});
    back.on('pointerdown', ()=> this.scene.start('menu'));
  }
}

/* ------------------ GAME ------------------ */
class GameScene extends Phaser.Scene {
  constructor(){ super('game'); }
  init(){
    this.score = 0;
    this.pipesPassed = 0;
    this.started = false;
    this.followers = [];
  }

  create(){
    const W=this.scale.width, H=this.scale.height;

    // Score
    this.scoreText = this.add.text(24, 20, 'Score: 0', { fontFamily:'monospace', fontSize:48, color:'#fff', stroke:'#0a3a38', strokeThickness:8 }).setDepth(50);

    // Joueur — GRAVITÉ ACTIVE dès le début
    this.player = this.physics.add.sprite(W*0.22, H*0.5, 'borgy')
      .setScale(BORGY_SCALE).setDepth(10).setCollideWorldBounds(true);
    this.player.body.setAllowGravity(true);                 // <-- gravité ON
    this.player.body.setGravityY(PROFILE.gravity);          // chute naturelle
    this.player.body.setSize(this.player.width*0.55, this.player.height*0.55, true)
                    .setOffset(this.player.width*0.225, this.player.height*0.25);

    // Son
    this.sndWoof = this.sound.add('woof', { volume: 0.45 });

    // Groupe collisions (rectangles physiques)
    this.pipeBodies = this.physics.add.group();

    // Inputs
    this.input.on('pointerdown', ()=> this.handleInput());
    this.input.keyboard.on('keydown-SPACE', ()=> this.handleInput());

    // Overlay "tap"
    this.startMsg = this.add.text(W/2, H*0.55, 'TAP pour démarrer', { fontFamily:'monospace', fontSize:36, color:'#0b3a32', backgroundColor:'#cffff3' }).setOrigin(0.5).setDepth(20);

    // Timer spawn PAUSÉ jusqu’au premier tap
    this.spawnTimer = this.time.addEvent({ delay: SPAWN_DELAY, loop:true, paused:true, callback: ()=> this.spawnPair() });

    // Collisions joueur ↔ tuyaux
    this.physics.add.overlap(this.player, this.pipeBodies, ()=> this.gameOver(), null, this);
  }

  handleInput(){
    if (!this.started){
      this.started = true;
      this.startMsg?.destroy();
      // première paire immédiate + on lance le timer
      this.spawnPair();
      this.spawnTimer.paused = false;
    }
    this.player.setVelocityY(PROFILE.jump);
  }

  update(){
    if (!this.player.active) return;

    // Tilt visuel
    const vy = this.player.body.velocity.y;
    this.player.setAngle(Phaser.Math.Clamp(vy * 0.06, -18, 22));

    // Suivi visuels (caps/bodies)
    this.followers.forEach(fn => fn());

    // Game over si on touche le haut/bas uniquement APRES démarrage
    if (this.started){
      const H=this.scale.height;
      if (this.player.y <= 0 || this.player.y >= H) this.gameOver();
    }
  }

  spawnPair(){
    const W=this.scale.width, H=this.scale.height;
    const gap = PROFILE.gap;
    const minTop = HOLE_MIN;
    const maxTop = H - (gap + HOLE_MAX_MARGIN);

    // placement "random-jitter" propre
    if (this._lastTopY === undefined) this._lastTopY = (minTop + maxTop)/2;
    const jitter = Phaser.Math.Between(-110, 110);
    const topY = Phaser.Math.Clamp(this._lastTopY + jitter, minTop, maxTop);
    this._lastTopY = topY;

    const holeCenter = topY + gap/2;
    const x = W + 60;

    // Alternance clair/dark toutes les 50 paires franchies
    const useDark = (Math.floor(this.pipesPassed / 50) % 2) === 1;
    const variant = useDark ? 'dark' : 'light';
    this.makePipes(x, holeCenter, gap, variant);

    // Capteur de score
    const sensor = this.add.rectangle(x + PIPE_W/2 + 10, H/2, 10, H, 0x000000, 0);
    this.physics.add.existing(sensor, true);
    sensor.body.setAllowGravity(false);
    sensor.body.setVelocityX(PROFILE.pipeSpeed);

    this.physics.add.overlap(this.player, sensor, ()=>{
      if (!sensor.active) return;
      sensor.destroy();
      this.pipesPassed++;
      this.incrementScore();

      // Bonus toutes les 50 paires
      if (this.pipesPassed % 50 === 0) this.spawnBonus(this.player.x + 520, Phaser.Math.Between(220, H-260));
    });
  }

  makePipes(x, holeCenter, holeSize, variant){
    const H = this.scale.height;
    const topH = Math.max(40, holeCenter - holeSize/2);
    const bottomH = Math.max(40, H - (holeCenter + holeSize/2));

    const keyTop    = `pipe_${variant}_top`;     // cap "top"
    const keyBottom = `pipe_${variant}_bottom`;  // cap "bottom"

    // Texture tileable pour le corps (depuis le PNG bottom) — zéro halo
    const bodyKey = makePipeBodyTexture(this, keyBottom, `body_${variant}`);

    // VISUELS: tileSprite pour corps (pas d'étirement des caps)
    const topBodyVis = this.add.tileSprite(x, topH, PIPE_W, topH, bodyKey).setOrigin(0.5,1).setDepth(5);
    const botBodyVis = this.add.tileSprite(x, holeCenter + holeSize/2 + bottomH, PIPE_W, bottomH, bodyKey).setOrigin(0.5,1).setFlipY(true).setDepth(5);
    const capTop     = this.add.image(x, topH, keyBottom).setOrigin(0.5,1).setDepth(6);
    const capBottom  = this.add.image(x, holeCenter + holeSize/2, keyTop).setOrigin(0.5,0).setDepth(6);

    // PHYSIQUE: rectangles invisibles
    const topPhys = this.add.rectangle(topBodyVis.x, topBodyVis.y - topH/2, PIPE_W, topH, 0x000000, 0);
    const botPhys = this.add.rectangle(botBodyVis.x, botBodyVis.y - bottomH/2, PIPE_W, bottomH, 0x000000, 0);
    this.physics.add.existing(topPhys, true);
    this.physics.add.existing(botPhys, true);
    topPhys.body.setAllowGravity(false).setVelocityX(PROFILE.pipeSpeed);
    botPhys.body.setAllowGravity(false).setVelocityX(PROFILE.pipeSpeed);
    this.pipeBodies.add(topPhys);
    this.pipeBodies.add(botPhys);

    // Collisions
    this.physics.add.overlap(this.player, topPhys, ()=> this.gameOver(), null, this);
    this.physics.add.overlap(this.player, botPhys, ()=> this.gameOver(), null, this);

    // Suivi visuel + scroll doux
    const follow = ()=>{
      if (!topPhys.active) return;
      topBodyVis.x = topPhys.x; topBodyVis.y = topPhys.y + topH/2;
      botBodyVis.x = botPhys.x; botBodyVis.y = botPhys.y + bottomH/2;
      capTop.x = topBodyVis.x; capTop.y = topBodyVis.y;
      capBottom.x = botBodyVis.x; capBottom.y = botBodyVis.y - bottomH;

      topBodyVis.tilePositionY += 0.4;
      botBodyVis.tilePositionY += 0.4;

      // cleanup hors écran
      if (topBodyVis.x < -PIPE_W*2) {
        [topBodyVis, botBodyVis, capTop, capBottom, topPhys, botPhys].forEach(o=>o&&o.destroy());
        this.events.off('update', follow);
      }
    };
    this.events.on('update', follow);

    // Sécurité: kill dur
    this.time.delayedCall(15000, ()=>{
      [topBodyVis, botBodyVis, capTop, capBottom, topPhys, botPhys].forEach(o=>o&&o.destroy());
      this.events.off('update', follow);
    });
  }

  spawnBonus(x, y){
    if (!this.textures.exists('sb_token')) return; // bonus facultatif
    const b = this.physics.add.image(x, y, 'sb_token').setScale(0.55).setDepth(9).setImmovable(true);
    b.body.setAllowGravity(false).setVelocityX(PROFILE.pipeSpeed);
    this.physics.add.overlap(this.player, b, ()=>{
      if (!b.active) return;
      b.destroy();
      // Woof plus aigu pour feedback bonus
      this.sound.play('woof', { volume: 0.6, detune: 300 });
      this.incrementScore(5);
      bumpQuest('bonus', 1);
    });
    this.time.delayedCall(12000, ()=> b.destroy());
  }

  incrementScore(n=1){
    this.score += n;
    this.scoreText.setText('Score: ' + this.score);
    this.sound.play('woof', { volume: 0.4 });
    bumpQuest('pipes', 1);
    bumpQuest('score', n);
  }

  gameOver(){
    if (!this.player.active) return;
    this.player.disableBody(true, false);
    this.spawnTimer && (this.spawnTimer.paused = true);
    saveBestScore(this.score);

    const W=this.scale.width, H=this.scale.height;
    const panel = this.add.rectangle(W/2, H/2, W*0.82, 360, 0x163945, 0.92).setDepth(100);
    this.add.text(W/2, H/2 - 110, 'Game Over', { fontFamily:'Georgia,serif', fontSize:72, color:'#fff' }).setOrigin(0.5).setDepth(101);
    this.add.text(W/2, H/2 - 30, `Score : ${this.score}   |   Best : ${loadBestScore()}`, { fontFamily:'monospace', fontSize:40, color:'#c9fff4' }).setOrigin(0.5).setDepth(101);
    const btn = this.add.text(W/2, H/2 + 70, 'Rejouer', btnStyle()).setOrigin(0.5).setDepth(101).setInteractive({useHandCursor:true});
    btn.on('pointerdown', ()=> this.scene.restart());
  }
}

/* ------------------ Boot Phaser ------------------ */
window.addEventListener('load', ()=>{
  const config = {
    type: Phaser.AUTO,
    parent: 'game-root',
    backgroundColor: '#9edff1',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 768, height: 1366 },
    physics: { default: 'arcade', arcade: { gravity:{ y:0 }, debug:false } },
    scene: [PreloadScene, BootScene, MenuScene, GameScene, QuestScene]
  };
  new Phaser.Game(config);
});
