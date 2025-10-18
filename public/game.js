/*  FlappyBorgy – v15 (menu + bonus + pipes fix)  */

const PROFILE = { gravity: 1400, jump: -380, pipeSpeed: -220, gap: 230 };
const BORGY_SCALE = 0.18;
const PIPE_W = 100;
const SPAWN_EVERY = 1600;               // ms
const BONUS_EVERY = 50;
const BONUS_DURATION = 10000;
const AURA_SOFT = 0x9FFFE0;

const PIPE_STYLES = [
  { body:'pipe_graphite',  cap:'cap_graphite'  },
  { body:'pipe_hexghost',  cap:'cap_hexghost'  },
  { body:'pipe_mintglass', cap:'cap_mintglass' },
  { body:'pipe_neonedge',  cap:'cap_neonedge'  },
  { body:'pipe_porcelain', cap:'cap_porcelain' },
  { body:'pipe_brushed',   cap:'cap_brushed'   },
  { body:'pipe_dualband',  cap:'cap_dualband'  },
  { body:'pipe_frosted',   cap:'cap_frosted'   },
];

window.addEventListener('load', () => {
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-root',
    backgroundColor: '#9EE1F2',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 768, height: 1366 },
    physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
    scene: [PreloadScene, StartScene, GameScene]
  });
});

/* ---------------- PRELOAD ---------------- */
function PreloadScene(){ Phaser.Scene.call(this,{key:'preload'}); }
PreloadScene.prototype = Object.create(Phaser.Scene.prototype);
PreloadScene.prototype.constructor = PreloadScene;

PreloadScene.prototype.preload = function(){
  const W = this.scale.width, H = this.scale.height;
  const bg = this.add.rectangle(W/2,H/2,360,8,0x000,0.15).setOrigin(0.5);
  const bar= this.add.rectangle(W/2-180,H/2,1,8,0x00a67e).setOrigin(0,0.5);
  const pct= this.add.text(W/2,H/2+24,'0%',{fontFamily:'monospace',fontSize:18,color:'#055'}).setOrigin(0.5);
  this.load.on('progress', v => { bar.width = 360*v; pct.setText((v*100|0)+'%'); });

  this.load.setPath('assets');
  this.load.image('borgy_ingame','borgy_ingame.png');
  this.load.image('sb_token',     'sb_token_user.png');

  // pipes & caps
  this.load.image('pipe_graphite',  'pipe_v2_graphite.png');
  this.load.image('cap_graphite',   'cap_v2_graphite.png');
  this.load.image('pipe_hexghost',  'pipe_v2_hexghost.png');
  this.load.image('cap_hexghost',   'cap_v2_hexghost.png');
  this.load.image('pipe_mintglass', 'pipe_v2_mintglass.png');
  this.load.image('cap_mintglass',  'cap_v2_mintglass.png');
  this.load.image('pipe_neonedge',  'pipe_v2_neonedge.png');
  this.load.image('cap_neonedge',   'cap_v2_neonedge.png');
  this.load.image('pipe_porcelain', 'pipe_v2_porcelain.png');
  this.load.image('cap_porcelain',  'cap_v2_porcelain.png');
  this.load.image('pipe_brushed',   'pipe_v2_brushed.png');
  this.load.image('cap_brushed',    'cap_v2_brushed.png');
  this.load.image('pipe_dualband',  'pipe_v2_dualband.png');
  this.load.image('cap_dualband',   'cap_v2_dualband.png');
  this.load.image('pipe_frosted',   'pipe_v2_frosted.png');
  this.load.image('cap_frosted',    'cap_v2_frosted.png');
};

PreloadScene.prototype.create = function(){ this.scene.start('start'); };

/* ---------------- START (menu) ---------------- */
function StartScene(){ Phaser.Scene.call(this,{key:'start'}); }
StartScene.prototype = Object.create(Phaser.Scene.prototype);
StartScene.prototype.constructor = StartScene;

StartScene.prototype.create = function(){
  const W=this.scale.width,H=this.scale.height;
  this.add.text(W/2,H*0.22,'FlappyBorgy v15',{fontFamily:'monospace',fontSize:'64px',color:'#084',stroke:'#000',strokeThickness:8}).setOrigin(0.5);
  const borgy = this.add.image(W/2,H*0.43,'borgy_ingame').setScale(BORGY_SCALE*1.4);
  this.tweens.add({targets:borgy,y:borgy.y-12,yoyo:true,repeat:-1,duration:900,ease:'sine.inOut'});
  const btn=this.add.text(W/2,H*0.70,'JOUER',{fontFamily:'monospace',fontSize:'60px',color:'#fff',backgroundColor:'#0db187',padding:{left:36,right:36,top:14,bottom:14}})
    .setOrigin(0.5).setInteractive({useHandCursor:true});
  this.add.text(W/2,H*0.78,'Touchez l’écran pour voler',{fontFamily:'monospace',fontSize:'28px',color:'#055'}).setOrigin(0.5);
  btn.on('pointerdown',()=>this.scene.start('game'));
};

/* ---------------- GAME ---------------- */
function GameScene(){ Phaser.Scene.call(this,{key:'game'}); }
GameScene.prototype = Object.create(Phaser.Scene.prototype);
GameScene.prototype.constructor = GameScene;

GameScene.prototype.init = function(){
  this.score=0; this.pipesPassed=0; this.multiplierActive=false;
  this.started=false; this.skinIndex=0; this.spawnCount=0;
  this.followers=[];  // fonctions qui collent les capots aux corps
};

GameScene.prototype.create = function(){
  const W=this.scale.width,H=this.scale.height;

  // Espacement fixe entre paires (cohérent vitesse/délai)
  this.SPACING = Math.round(Math.abs(PROFILE.pipeSpeed) * (SPAWN_EVERY/1000)); // px
  this.nextX   = W + 200; // premier x disponible

  this.scoreTxt = this.add.text(24,24,'Score: 0',{fontFamily:'monospace',fontSize:'44px',color:'#0b4',stroke:'#000',strokeThickness:6}).setDepth(50);
  this.multTxt  = this.add.text(W-24,24,'',{fontFamily:'monospace',fontSize:'40px',color:'#b1ffe6',stroke:'#007a62',strokeThickness:6}).setOrigin(1,0).setDepth(50);

  // Joueur (gravité OFF tant que non démarré)
  this.player = this.physics.add.image(W*0.25,H*0.45,'borgy_ingame').setScale(BORGY_SCALE).setCollideWorldBounds(true).setDepth(10);
  const r=Math.max(this.player.width,this.player.height)*0.22; this.player.setCircle(r,this.player.width/2-r,this.player.height/2-r);
  this.player.body.setAllowGravity(false);

  this.aura = this.add.circle(this.player.x,this.player.y,Math.max(this.player.displayWidth,this.player.displayHeight)*0.65,AURA_SOFT,0.22).setVisible(false).setDepth(9);

  this.pipesTop    = this.physics.add.group({allowGravity:false,immovable:true});
  this.pipesBottom = this.physics.add.group({allowGravity:false,immovable:true});

  this.physics.add.collider(this.player,this.pipesTop,   ()=>this.gameOver());
  this.physics.add.collider(this.player,this.pipesBottom,()=>this.gameOver());

  this.hint=this.add.text(W/2,H*0.58,'TAP TO START',{fontFamily:'monospace',fontSize:'54px',color:'#083'}).setOrigin(0.5).setDepth(60);

  const onInput=()=>this.started?this.flap():this.startGame();
  this.input.on('pointerdown',onInput);
  this.input.keyboard.on('keydown-SPACE',onInput);
};

GameScene.prototype.startGame = function(){
  const W=this.scale.width,H=this.scale.height;
  this.started=true; this.hint?.destroy();
  this.physics.world.gravity.y=PROFILE.gravity;
  this.player.body.setAllowGravity(true);

  // Remplir l’écran de départ proprement
  while(this.nextX < W + 2*this.SPACING){ this.spawnPair(this.nextX); this.nextX += this.SPACING; }

  this.spawnEvt=this.time.addEvent({delay:SPAWN_EVERY,loop:true,callback:()=>{
    this.spawnPair(this.nextX); this.nextX += this.SPACING;
  }});
};

GameScene.prototype.flap = function(){ this.player.setVelocityY(PROFILE.jump); };

GameScene.prototype.update = function(time){
  if(!this.started) return;
  const vy=this.player.body.velocity.y;
  this.player.setAngle(Phaser.Math.Clamp(vy*0.06,-20,25));

  if(this.aura.visible){
    this.aura.setPosition(this.player.x,this.player.y);
    this.aura.alpha = 0.2 + 0.08*Math.sin(time/180);
  }
  // coller les capots aux corps
  this.followers.forEach(f=>f());
  // purge sécurité
  [...this.pipesTop.getChildren(),...this.pipesBottom.getChildren()].forEach(p=>{ if(p.x < -PIPE_W*2) p.destroy(); });
};

/* ---------- génération d’une paire ---------- */
GameScene.prototype.spawnPair = function(x){
  const H=this.scale.height, W=this.scale.width;
  const style = PIPE_STYLES[this.skinIndex]; this.skinIndex=(this.skinIndex+1)%PIPE_STYLES.length;

  const gap = PROFILE.gap;
  const minTop = 90, maxTop = H - 90 - gap;
  const MAX_DELTA = 140; // déplacement vertical max entre 2 trous

  // trou doux (limite d’écart avec le précédent)
  let topY;
  if(this.prevTopY == null) topY = Phaser.Math.Between(minTop,maxTop);
  else {
    const target = Phaser.Math.Between(minTop,maxTop);
    const delta  = Phaser.Math.Clamp(target - this.prevTopY, -MAX_DELTA, MAX_DELTA);
    topY = Phaser.Math.Clamp(this.prevTopY + delta, minTop, maxTop);
  }
  this.prevTopY = topY;

  const bottomH = H - (topY + gap);

  // Corps
  const topBody = this.pipesTop.create(x, topY, style.body)
    .setOrigin(0.5,1).setDisplaySize(PIPE_W, topY).setDepth(5);
  topBody.body.setVelocityX(PROFILE.pipeSpeed);

  const botBody = this.pipesBottom.create(x, topY+gap, style.body)
    .setOrigin(0.5,0).setFlipY(true).setDisplaySize(PIPE_W, bottomH).setDepth(5);
  botBody.body.setVelocityX(PROFILE.pipeSpeed);

  // Capots qui suivent les corps (pas de physique, on les “suit” à l’update)
  const topCap = this.add.image(x, topY, style.cap).setOrigin(0.5,1).setDepth(6).setAlpha(0.98);
  const botCap = this.add.image(x, topY+gap, style.cap).setOrigin(0.5,0).setFlipY(true).setDepth(6).setAlpha(0.98);

  this.followers.push(() => {
    if(!topBody.active){ topCap.destroy(); botCap.destroy(); return; }
    topCap.x = topBody.x; topCap.y = topBody.y - topBody.displayHeight;
    botCap.x = botBody.x; botCap.y = botBody.y + 0; // 0 car origin 0
  });

  // capteur de score
  const sensor = this.add.rectangle(x + PIPE_W/2 + 10, H/2, 10, H, 0x000000, 0);
  this.physics.add.existing(sensor);
  sensor.body.setAllowGravity(false).setImmovable(true).setVelocityX(PROFILE.pipeSpeed);
  this.physics.add.overlap(this.player, sensor, () => {
    if(!sensor.active) return;
    sensor.destroy();
    this.pipesPassed++;
    this.addScore(this.multiplierActive?2:1);

    if(this.pipesPassed>0 && this.pipesPassed%BONUS_EVERY===0){
      this.spawnBonus(x + 420, Phaser.Math.Between(200, H-280));
    }
  });

  // ménage
  this.time.delayedCall(13000, ()=>{ [topBody,botBody,topCap,botCap,sensor].forEach(o=>o&&o.destroy()); });
};

/* ---------- Bonus ---------- */
GameScene.prototype.spawnBonus = function(x,y){
  const bonus = this.physics.add.image(x,y,'sb_token').setScale(0.55).setDepth(7);
  bonus.body.setAllowGravity(false).setVelocityX(PROFILE.pipeSpeed);
  this.physics.add.overlap(this.player,bonus,()=>{ if(!bonus.active) return; bonus.destroy(); this.activateMultiplier(); });
  this.time.delayedCall(12000,()=>bonus.destroy());
};

GameScene.prototype.activateMultiplier = function(){
  if(this.multTimer) this.multTimer.remove(false);
  this.multiplierActive=true; this.aura.setVisible(true);
  let left=BONUS_DURATION/1000|0; this.multTxt.setText('x2 '+left+'s');
  this.multTimer=this.time.addEvent({delay:1000,repeat:left,callback:()=>{
    left--; if(left<=0){ this.multiplierActive=false; this.multTxt.setText(''); this.aura.setVisible(false); }
    else this.multTxt.setText('x2 '+left+'s');
  }});
};

GameScene.prototype.addScore = function(v){ this.score+=v; this.scoreTxt.setText('Score: '+this.score); };

/* ---------- Game Over ---------- */
GameScene.prototype.gameOver = function(){
  if(!this.player.active) return;
  this.player.disableBody(true,false).setTint(0xff6b6b);
  this.spawnEvt && this.spawnEvt.remove(false);
  const W=this.scale.width,H=this.scale.height;

  this.add.rectangle(W/2,H/2,W*0.82,360,0x163945,0.92).setDepth(100);
  this.add.text(W/2,H/2-110,'Game Over',{fontFamily:'Georgia,serif',fontSize:'72px',color:'#fff'}).setOrigin(0.5).setDepth(101);
  this.add.text(W/2,H/2-30,`Score :  ${this.score}`,{fontFamily:'monospace',fontSize:'52px',color:'#c9fff4'}).setOrigin(0.5).setDepth(101);

  const replay=this.add.text(W/2,H/2+70,'Rejouer',{fontFamily:'monospace',fontSize:'48px',color:'#fff',backgroundColor:'#0db187',padding:{left:22,right:22,top:10,bottom:10}})
    .setOrigin(0.5).setInteractive({useHandCursor:true}).setDepth(101);
  const home=this.add.text(W/2,H/2+140,'Menu',{fontFamily:'monospace',fontSize:'36px',color:'#fff',backgroundColor:'#0b8266',padding:{left:18,right:18,top:8,bottom:8}})
    .setOrigin(0.5).setInteractive({useHandCursor:true}).setDepth(101);
  replay.on('pointerdown',()=>this.scene.restart());
  home.on('pointerdown',()=>this.scene.start('start'));
};
