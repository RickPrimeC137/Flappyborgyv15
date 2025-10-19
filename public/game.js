/*  FlappyBorgy v15.8
 *  - Corps physiques des tuyaux & capteurs en sprites (texture 'px') => setVelocityX OK
 *  - Visuels des tuyaux = tileSprite (zéro halo) + caps
 *  - Gravité active, menu, quêtes quotidiennes, woof à chaque point
 */

const VERSION = 'v15.8';

/* ---------------- Profil de jeu ---------------- */
const PROFILE = { gravity: 1400, jump: -380, pipeSpeed: -220, gap: 230 };
const BORGY_SCALE = 0.22;
const PIPE_W = 140;
const SPAWN_DELAY = 1600;
const HOLE_MIN = 90;
const HOLE_MAX_MARGIN = 160;

/* ---------------- Styles UI ---------------- */
const btnPrimary = { fontFamily:'monospace', fontSize:52, color:'#fff', backgroundColor:'#0db187',
  padding:{left:22,right:22,top:10,bottom:10} };
const btnSecondary = { fontFamily:'monospace', fontSize:40, color:'#0b3a32', backgroundColor:'#bdf4e7',
  padding:{left:18,right:18,top:8,bottom:8} };

/* ---------------- Quêtes quotidiennes ---------------- */
const QUEST_KEY='fbv15_daily_quests', QUEST_DATE='fbv15_daily_date';
const today = ()=>{ const d=new Date(); return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; };
const newQuests = ()=>[
  {id:'pipes', title:'Passer 60 tuyaux', target:60, progress:0, done:false},
  {id:'score', title:'Atteindre 30 points', target:30, progress:0, done:false},
  {id:'bonus', title:'Prendre 1 bonus', target:1, progress:0, done:false}
];
function loadQuests(){
  const t=today(), last=localStorage.getItem(QUEST_DATE);
  if(last!==t){ const q=newQuests(); localStorage.setItem(QUEST_KEY, JSON.stringify(q)); localStorage.setItem(QUEST_DATE,t); return q; }
  try{ const q=JSON.parse(localStorage.getItem(QUEST_KEY)||'[]'); return Array.isArray(q)?q:newQuests(); }
  catch{ const q=newQuests(); localStorage.setItem(QUEST_KEY, JSON.stringify(q)); return q; }
}
function saveQuests(q){ localStorage.setItem(QUEST_KEY, JSON.stringify(q)); }
function bumpQuest(id, n=1){ const q=loadQuests(); let ch=false; q.forEach(k=>{ if(k.id===id && !k.done){ k.progress=Math.min(k.target,(k.progress||0)+n); if(k.progress>=k.target) k.done=true; ch=true; } }); if(ch) saveQuests(q); }
function best(){ return Number(localStorage.getItem('fbv15_best')||0); }
function setBest(s){ if(s>best()) localStorage.setItem('fbv15_best', String(s)); }

/* ---------------- Utilitaires images tuyaux ---------------- */
function makePipeBodyTexture(scene, srcKey, outKey) {
  if (scene.textures.exists(outKey)) return outKey;
  const img = scene.textures.get(srcKey).getSourceImage();
  const w = img.width, h = img.height;

  const sliceW = Math.max(16, Math.floor(w * 0.14));
  const sx = Math.floor((w - sliceW) / 2);
  const sy = Math.floor(h * 0.18);
  const sh = Math.max(120, h - sy - Math.floor(h * 0.20));

  const tex = scene.textures.createCanvas(outKey, sliceW, sh);
  const ctx = tex.getContext();
  ctx.clearRect(0,0,sliceW,sh);
  ctx.drawImage(img, sx, sy, sliceW, sh, 0, 0, sliceW, sh);
  tex.refresh();
  return outKey;
}

/* ---------------- Scenes ---------------- */
class PreloadScene extends Phaser.Scene {
  constructor(){ super('preload'); }
  preload(){
    const W=this.scale.width,H=this.scale.height;
    const bg=this.add.rectangle(W/2,H/2,420,10,0x000,0.12).setOrigin(0.5);
    const bar=this.add.rectangle(W/2-210,H/2,1,10,0x0aa67e).setOrigin(0,0.5);
    const pct=this.add.text(W/2,H/2+22,'0%',{fontFamily:'monospace',fontSize:16,color:'#044'}).setOrigin(0.5);
    this.load.on('progress',p=>{bar.width=420*p;pct.setText(`${Math.round(p*100)}%`);});

    this.load.setPath('assets');
    const v=f=>`${f}?${VERSION}`;
    this.load.image('borgy',             v('borgy_ingame.png'));
    this.load.image('pipe_light_top',    v('pipe_light_top.png'));
    this.load.image('pipe_light_bottom', v('pipe_light_bottom.png'));
    this.load.image('pipe_dark_top',     v('pipe_dark_top.png'));
    this.load.image('pipe_dark_bottom',  v('pipe_dark_bottom.png'));
    this.load.image('sb_token',          v('sb_token_user.png')); // optionnel
    this.load.audio('woof',              [v('woof.ogg')]);

    this.load.once('complete',()=> this.scene.start('boot'));
  }
}
class BootScene extends Phaser.Scene {
  constructor(){ super('boot'); }
  create(){
    // Génère une mini texture blanche 'px' pour les corps physiques invisibles
    const g=this.add.graphics(); g.fillStyle(0xffffff,1); g.fillRect(0,0,2,2); g.generateTexture('px',2,2); g.destroy();
    this.scene.start('menu');
  }
}
class MenuScene extends Phaser.Scene {
  constructor(){ super('menu'); }
  create(){
    const W=this.scale.width,H=this.scale.height;
    this.add.text(W/2,H*0.22,'FlappyBorgy',{fontFamily:'Georgia,serif',fontSize:72,color:'#0b3a32',stroke:'#bdf4e7',strokeThickness:10}).setOrigin(0.5);
    const play=this.add.text(W/2,H*0.42,'Jouer',btnPrimary).setOrigin(0.5).setInteractive({useHandCursor:true});
    play.on('pointerdown',()=> this.scene.start('game'));
    const quests=this.add.text(W/2,H*0.54,'Quêtes',btnSecondary).setOrigin(0.5).setInteractive({useHandCursor:true});
    quests.on('pointerdown',()=> this.scene.start('quests'));
    this.add.text(W/2,H*0.78,'Tap/Space pour sauter\nÉvite les tuyaux',{fontFamily:'monospace',fontSize:26,color:'#0b3a32',align:'center'}).setOrigin(0.5);
  }
}
class QuestScene extends Phaser.Scene {
  constructor(){ super('quests'); }
  create(){
    const W=this.scale.width,H=this.scale.height;
    this.add.text(W/2,80,'Quêtes du jour',{fontFamily:'Georgia,serif',fontSize:56,color:'#0b3a32'}).setOrigin(0.5);
    const q=loadQuests(); let y=180;
    q.forEach(it=>{ const t=`${it.title}  –  ${it.progress}/${it.target}  ${it.done?'✅':'⬜'}`; this.add.text(60,y,t,{fontFamily:'monospace',fontSize:28,color:it.done?'#0a7a56':'#083b43'}); y+=60; });
    const back=this.add.text(W/2,H*0.88,'← Retour',btnSecondary).setOrigin(0.5).setInteractive({useHandCursor:true});
    back.on('pointerdown',()=> this.scene.start('menu'));
  }
}

class GameScene extends Phaser.Scene {
  constructor(){ super('game'); }
  init(){
    this.score=0;
    this.pipesPassed=0;
    this.started=false;
    this.followFns=[];
  }
  create(){
    const W=this.scale.width,H=this.scale.height;

    // Score
    this.scoreText=this.add.text(24,20,'Score: 0',{fontFamily:'monospace',fontSize:48,color:'#fff',stroke:'#0a3a38',strokeThickness:8}).setDepth(50);

    // Joueur (gravité ON)
    this.player=this.physics.add.sprite(W*0.22,H*0.5,'borgy').setScale(BORGY_SCALE).setDepth(10).setCollideWorldBounds(true);
    this.player.body.setAllowGravity(true);
    this.player.body.setGravityY(PROFILE.gravity);
    this.player.body.setSize(this.player.width*0.55,this.player.height*0.55,true)
                    .setOffset(this.player.width*0.225,this.player.height*0.25);

    // Son
    this.sndWoof=this.sound.add('woof',{volume:0.45});

    // Groupe des corps (sprites physiques invisibles)
    this.pipeBodies=this.physics.add.group();

    // Input
    this.input.on('pointerdown',()=> this.onTap());
    this.input.keyboard.on('keydown-SPACE',()=> this.onTap());

    // Msg start
    this.startMsg=this.add.text(W/2,H*0.55,'TAP pour démarrer',{fontFamily:'monospace',fontSize:36,color:'#0b3a32',backgroundColor:'#cffff3'}).setOrigin(0.5).setDepth(20);

    // Timer spawn (PAUSÉ)
    this.spawnTimer=this.time.addEvent({delay:SPAWN_DELAY,loop:true,paused:true,callback:()=> this.spawnPair()});

    // Collisions
    this.physics.add.overlap(this.player,this.pipeBodies,()=> this.gameOver(),null,this);
  }
  onTap(){
    if(!this.started){
      this.started=true;
      this.startMsg?.destroy();
      this.spawnPair();                 // première paire instant
      this.spawnTimer.paused=false;     // puis boucle
    }
    this.player.setVelocityY(PROFILE.jump);
  }
  update(){
    if(!this.player.active) return;
    const vy=this.player.body.velocity.y;
    this.player.setAngle(Phaser.Math.Clamp(vy*0.06,-18,22));

    this.followFns.forEach(f=>f());

    if(this.started){
      const H=this.scale.height;
      if(this.player.y<=0 || this.player.y>=H) this.gameOver();
    }
  }

  /* --------- Spawn d'une paire (physique = sprites 'px') --------- */
  spawnPair(){
    const W=this.scale.width,H=this.scale.height;
    const gap=PROFILE.gap, minTop=HOLE_MIN, maxTop=H-(gap+HOLE_MAX_MARGIN);

    if(this._lastTopY===undefined) this._lastTopY=(minTop+maxTop)/2;
    const jitter=Phaser.Math.Between(-110,110);
    const topY=Phaser.Math.Clamp(this._lastTopY+jitter,minTop,maxTop);
    this._lastTopY=topY;

    const holeCenter=topY+gap/2;
    const x=W+60;

    const useDark=(Math.floor(this.pipesPassed/50)%2)===1;
    const variant=useDark?'dark':'light';

    this.makePipes(x,holeCenter,gap,variant);

    // Capteur de score (sprite dynamique immovable)
    const sensor=this.physics.add.sprite(x+PIPE_W/2+10, H/2, 'px')
      .setVisible(false).setDepth(1);
    sensor.body.setAllowGravity(false).setImmovable(true).setVelocityX(PROFILE.pipeSpeed);
    sensor.body.setSize(10,H,true);

    this.physics.add.overlap(this.player,sensor,()=>{
      if(!sensor.active) return;
      sensor.destroy();
      this.pipesPassed++;
      this.incrementScore();
      if(this.pipesPassed%50===0){
        this.spawnBonus(this.player.x+520, Phaser.Math.Between(220,this.scale.height-260));
      }
    });
  }

  makePipes(x, holeCenter, holeSize, variant){
    const H=this.scale.height;
    const topH=Math.max(40, holeCenter-holeSize/2);
    const bottomH=Math.max(40, H-(holeCenter+holeSize/2));

    const keyTop    = `pipe_${variant}_top`;
    const keyBottom = `pipe_${variant}_bottom`;
    const bodyKey   = makePipeBodyTexture(this, keyBottom, `body_${variant}`);

    // VISUELS (tileSprites + caps)
    const topBodyVis = this.add.tileSprite(x, topH, PIPE_W, topH, bodyKey).setOrigin(0.5,1).setDepth(5);
    const botBodyVis = this.add.tileSprite(x, holeCenter+holeSize/2+bottomH, PIPE_W, bottomH, bodyKey).setOrigin(0.5,1).setFlipY(true).setDepth(5);
    const capTop     = this.add.image(x, topH, keyBottom).setOrigin(0.5,1).setDepth(6);
    const capBottom  = this.add.image(x, holeCenter+holeSize/2, keyTop).setOrigin(0.5,0).setDepth(6);

    // PHYSIQUES : sprites invisibles 'px' (dynamiques + immovables)
    const topPhys = this.physics.add.sprite(x, topH - topH/2, 'px').setVisible(false);
    const botPhys = this.physics.add.sprite(x, holeCenter+holeSize/2 + bottomH - bottomH/2, 'px').setVisible(false);

    topPhys.body.setAllowGravity(false).setImmovable(true).setVelocityX(PROFILE.pipeSpeed);
    botPhys.body.setAllowGravity(false).setImmovable(true).setVelocityX(PROFILE.pipeSpeed);
    topPhys.body.setSize(PIPE_W, topH, true);
    botPhys.body.setSize(PIPE_W, bottomH, true);

    this.pipeBodies.add(topPhys);
    this.pipeBodies.add(botPhys);
    this.physics.add.overlap(this.player, topPhys, ()=> this.gameOver(), null, this);
    this.physics.add.overlap(this.player, botPhys, ()=> this.gameOver(), null, this);

    // Suivi visuel + petit scroll
    const follow = ()=>{
      if(!topPhys.active){ this.events.off('update', follow); return; }
      topBodyVis.x=topPhys.x; topBodyVis.y=topPhys.y + topH/2;
      botBodyVis.x=botPhys.x; botBodyVis.y=botPhys.y + bottomH/2;
      capTop.x=topBodyVis.x; capTop.y=topBodyVis.y;
      capBottom.x=botBodyVis.x; capBottom.y=botBodyVis.y - bottomH;
      topBodyVis.tilePositionY += 0.4;
      botBodyVis.tilePositionY += 0.4;

      if(topBodyVis.x < -PIPE_W*2){
        [topBodyVis,botBodyVis,capTop,capBottom,topPhys,botPhys].forEach(o=>o&&o.destroy());
        this.events.off('update', follow);
      }
    };
    this.events.on('update', follow);

    // Kill de sécurité
    this.time.delayedCall(15000, ()=>{
      [topBodyVis,botBodyVis,capTop,capBottom,topPhys,botPhys].forEach(o=>o&&o.destroy());
      this.events.off('update', follow);
    });
  }

  spawnBonus(x,y){
    if(!this.textures.exists('sb_token')) return;
    const b=this.physics.add.image(x,y,'sb_token').setScale(0.55).setDepth(9).setImmovable(true);
    b.body.setAllowGravity(false).setVelocityX(PROFILE.pipeSpeed);
    this.physics.add.overlap(this.player,b,()=>{
      if(!b.active) return;
      b.destroy();
      this.sound.play('woof',{volume:0.6,detune:300});
      this.incrementScore(5);
      bumpQuest('bonus',1);
    });
    this.time.delayedCall(12000,()=> b.destroy());
  }

  incrementScore(n=1){
    this.score += n;
    this.scoreText.setText('Score: '+this.score);
    this.sound.play('woof',{volume:0.4});
    bumpQuest('pipes',1);
    bumpQuest('score',n);
  }

  gameOver(){
    if(!this.player.active) return;
    this.player.disableBody(true,false);
    this.spawnTimer && (this.spawnTimer.paused=true);
    setBest(this.score);

    const W=this.scale.width,H=this.scale.height;
    this.add.rectangle(W/2,H/2,W*0.82,360,0x163945,0.92).setDepth(100);
    this.add.text(W/2,H/2-110,'Game Over',{fontFamily:'Georgia,serif',fontSize:72,color:'#fff'}).setOrigin(0.5).setDepth(101);
    this.add.text(W/2,H/2-30,`Score : ${this.score}   |   Best : ${best()}`,{fontFamily:'monospace',fontSize:40,color:'#c9fff4'}).setOrigin(0.5).setDepth(101);
    const btn=this.add.text(W/2,H/2+70,'Rejouer',btnPrimary).setOrigin(0.5).setDepth(101).setInteractive({useHandCursor:true});
    btn.on('pointerdown',()=> this.scene.restart());
  }
}

/* ---------------- Boot Phaser ---------------- */
window.addEventListener('load',()=>{
  const config={
    type:Phaser.AUTO,
    parent:'game-root',
    backgroundColor:'#9edff1',
    scale:{ mode:Phaser.Scale.FIT, autoCenter:Phaser.Scale.CENTER_BOTH, width:768, height:1366 },
    physics:{ default:'arcade', arcade:{ gravity:{y:0}, debug:false } },
    scene:[PreloadScene,BootScene,MenuScene,GameScene,QuestScene]
  };
  new Phaser.Game(config);
});
