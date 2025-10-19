/*  FlappyBorgy v15 — Pipes 4K (2 styles), alternance 50, score ding, leaderboard local
 *  Nécessite Phaser 3 (déjà inclus par index.html)
 */

const PROFILE = { gravity: 1400, jump: -380, pipeSpeed: -220, gap: 230 };
const BORGY_SCALE = 0.22;
const PIPE_W = 132;
const SPAWN_MS = 1600;
const HOLE_MIN = 90, HOLE_MAX_MARGIN = 160;

const BONUS_EVERY = 50;       // à ce seuil on alterne aussi de style
const BONUS_MS = 10000;

let game;

window.addEventListener('load', () => {
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-root',
    backgroundColor: '#9edff1',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 768, height: 1366 },
    physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
    scene: [PreloadScene, MenuScene, GameScene]
  });
});

/* -------- PRELOAD -------- */
function PreloadScene(){ Phaser.Scene.call(this,{key:'preload'}); }
PreloadScene.prototype = Object.create(Phaser.Scene.prototype); PreloadScene.prototype.constructor = PreloadScene;

PreloadScene.prototype.preload = function () {
  const W=this.scale.width,H=this.scale.height;
  const barBg=this.add.rectangle(W/2,H/2,360,8,0x000000,0.15).setOrigin(0.5);
  const bar  =this.add.rectangle(W/2-180,H/2,1,8,0x00a67e).setOrigin(0,0.5);
  const pct  =this.add.text(W/2,H/2+24,'0%',{fontFamily:'monospace',fontSize:18,color:'#055'}).setOrigin(0.5);
  this.load.on('progress',v=>{bar.width=360*v;pct.setText((v*100|0)+'%');});

  this.load.setPath('assets');

  // Joueur & bonus (inchangés)
  this.load.image('borgy','borgy_ingame.png');
  this.load.image('sb_token','sb_token_user.png');

  // Nouvelles images 4K (2 styles clair/dark, caps top & bottom)
  this.load.image('pipeLightTop','pipe_light_top.png');
  this.load.image('pipeLightBottom','pipe_light_bottom.png');
  this.load.image('pipeDarkTop','pipe_dark_top.png');
  this.load.image('pipeDarkBottom','pipe_dark_bottom.png');

  // petit son de secours (beep WebAudio si Assets audio absents)
};

PreloadScene.prototype.create = function () {
  // Fabrique le motif "fût" 64x64 à partir de chaque TOP (zone médiane)
  genBodyTile(this,'pipeLightTop','pipeBodyLight');
  genBodyTile(this,'pipeDarkTop','pipeBodyDark');
  this.scene.start('menu');
};

// extrait un carré 64×64 du centre de l’image pour faire un tile répétable
function genBodyTile(scene, srcKey, outKey){
  const img = scene.textures.get(srcKey).getSourceImage();
  const sW = img.width, sH = img.height;
  const cut = Math.min(64, Math.floor(Math.min(sW,sH)/8)); // 64 ou un peu moins si image fine
  const sx = (sW - cut)>>1, sy = (sH - cut)>>1;

  const cnv = scene.textures.createCanvas(outKey, cut, cut);
  const ctx = cnv.getContext();
  ctx.drawImage(img, sx, sy, cut, cut, 0, 0, cut, cut);
  cnv.refresh();
}

/* -------- MENU -------- */
function MenuScene(){ Phaser.Scene.call(this,{key:'menu'}); }
MenuScene.prototype = Object.create(Phaser.Scene.prototype); MenuScene.prototype.constructor = MenuScene;

MenuScene.prototype.create = function(){
  const W=this.scale.width,H=this.scale.height;

  this.add.text(W/2, H*0.28, 'FlappyBorgy', {
    fontFamily:'Georgia,serif', fontSize:'72px', color:'#083', stroke:'#fff', strokeThickness:6
  }).setOrigin(0.5);

  this.add.text(W/2, H*0.40, 'Touchez pour jouer', {
    fontFamily:'monospace', fontSize:'36px', color:'#034', backgroundColor:'#b9ffe9', padding:{left:12,right:12,top:6,bottom:6}
  }).setOrigin(0.5).setInteractive({useHandCursor:true})
    .on('pointerdown', ()=>this.scene.start('game'));

  // top score local
  const best = (JSON.parse(localStorage.getItem('borgy_best10')||'[]')[0]||{s:0}).s||0;
  this.add.text(W/2, H*0.50, `Meilleur : ${best}`, {fontFamily:'monospace', fontSize:'28px', color:'#073'}).setOrigin(0.5);
};

/* -------- GAME -------- */
function GameScene(){ Phaser.Scene.call(this,{key:'game'}); }
GameScene.prototype = Object.create(Phaser.Scene.prototype); GameScene.prototype.constructor = GameScene;

GameScene.prototype.init=function(){
  this.score=0; this.passed=0; this.style='light'; // alternera tous les 50
  this.followCaps=[]; this.spawnCount=0; this.lastTopY=null;
  this.patterns=['ALT','STAIRS','SINE','RNDJ','RND']; this.pattern='ALT';
};

GameScene.prototype.create=function(){
  const W=this.scale.width,H=this.scale.height;

  // Score UI
  this.scoreText=this.add.text(24,24,'Score: 0',{fontFamily:'monospace',fontSize:'48px',color:'#fff',stroke:'#0a3a38',strokeThickness:8})
    .setDepth(50).setOrigin(0,0);

  // Joueur
  this.player=this.physics.add.sprite(W*0.22,H*0.5,'borgy').setScale(BORGY_SCALE).setDepth(10).setCollideWorldBounds(true);
  this.player.body.setGravityY(PROFILE.gravity);
  this.player.body.setSize(this.player.width*0.55, this.player.height*0.55, true).setOffset(this.player.width*0.225,this.player.height*0.25);

  // Inputs
  const flap=()=>{ if(!this.player.active) return; this.player.setVelocityY(PROFILE.jump); };
  this.input.on('pointerdown', flap); this.input.keyboard.on('keydown-SPACE', flap);

  // Pipes group
  this.pipes=this.physics.add.group();

  // Collisions
  this.physics.add.overlap(this.player,this.pipes,()=>this.gameOver(),null,this);

  // Spawner
  this.spawnEv=this.time.addEvent({delay:SPAWN_MS, loop:true, callback:()=>this.spawnPair()});
  this.spawnPair(); // première tout de suite
};

GameScene.prototype.update=function(t){
  if(this.player.body.velocity.y<-20) this.player.setAngle(-18);
  else if(this.player.body.velocity.y>120) this.player.setAngle(22);
  else this.player.setAngle(0);

  // suivre caps
  this.followCaps.forEach(f=>f());
  // nettoyage
  this.pipes.children.each(p=>{ if(p.active && p.x < -PIPE_W*2) p.destroy(); });
};

/* ---------- Pipes ---------- */
GameScene.prototype.spawnPair=function(){
  const W=this.scale.width,H=this.scale.height;
  // hole Y via pattern stable
  const gap=PROFILE.gap, minTop=HOLE_MIN, maxTop=H-(gap+HOLE_MAX_MARGIN);
  let topY;
  switch(this.pattern){
    case 'ALT': topY=(this.spawnCount%2===0)?(minTop+20):(maxTop-20); break;
    case 'STAIRS': { const steps=5, dh=(maxTop-minTop)/steps; topY=minTop+((this.spawnCount%steps)*dh); break; }
    case 'SINE': { const mid=(minTop+maxTop)/2, amp=(maxTop-minTop)*0.42; topY=mid+Math.sin(this.spawnCount*0.8)*amp; break; }
    case 'RNDJ': { const last=this.lastTopY??((minTop+maxTop)/2); topY=Phaser.Math.Clamp(last+Phaser.Math.Between(-120,120),minTop,maxTop); break; }
    default: topY=Phaser.Math.Between(minTop,maxTop);
  }
  this.lastTopY=topY; this.spawnCount++;

  // style (alterne toutes les 50 paires franchies)
  const newStyle = (Math.floor(this.passed/50)%2===0)?'light':'dark';
  this.style = newStyle;

  const x = this.cameras.main.width + 60;
  const holeY = topY + gap/2;
  this.makePipe(x, holeY, gap, this.style);

  // capteur de score (fin du couple)
  const sensor = this.add.rectangle(x+PIPE_W+20, H*0.5, 10, H, 0x000000, 0);
  this.physics.add.existing(sensor,true);
  sensor.body.setVelocityX(PROFILE.pipeSpeed);
  this.physics.add.overlap(this.player, sensor, ()=>{
    if(!sensor.active) return;
    sensor.destroy(); this.passed++; this.addScore(1);
    // alternance quand on vient d’atteindre un multiple de 50
    if(this.passed>0 && this.passed%50===0){ this.style = (this.style==='light'?'dark':'light'); }
    beep(880,80,0.12); // petit "ding"
  });
};

GameScene.prototype.makePipe=function(x, holeY, holeH, style){
  const H=this.scale.height, bodyKey=(style==='light'?'pipeBodyLight':'pipeBodyDark');
  const topKey =(style==='light'?'pipeLightTop':'pipeDarkTop');
  const botKey =(style==='light'?'pipeLightBottom':'pipeDarkBottom');

  const topH=Math.max(40, holeY - holeH/2);
  const botH=Math.max(40, H - (holeY + holeH/2));

  // Corps en tileSprite
  const topBody = this.add.tileSprite(x, topH, PIPE_W, topH, bodyKey).setOrigin(0.5,1).setDepth(5);
  const botBody = this.add.tileSprite(x, holeY+holeH/2+botH, PIPE_W, botH, bodyKey).setOrigin(0.5,1).setDepth(5);

  this.physics.add.existing(topBody,true); this.physics.add.existing(botBody,true);
  topBody.body.setAllowGravity(false).setImmovable(true).setVelocityX(PROFILE.pipeSpeed);
  botBody.body.setAllowGravity(false).setImmovable(true).setVelocityX(PROFILE.pipeSpeed);

  // Caps (images entières) — suivent les corps
  const capTop = this.add.image(x, 0, topKey).setOrigin(0.5,1).setDepth(6).setScale(PIPE_W / capWidth(this, topKey));
  const capBot = this.add.image(x, 0, botKey).setOrigin(0.5,0).setDepth(6).setScale(PIPE_W / capWidth(this, botKey));

  const follow = ()=>{
    if(!topBody.active) return;
    capTop.x=topBody.x; capTop.y=topBody.y - topBody.displayHeight;
    capBot.x=botBody.x; capBot.y=botBody.y;
  };
  this.followCaps.push(follow);

  this.pipes.add(topBody); this.pipes.add(botBody);

  // Auto-clean
  this.time.delayedCall(12000, ()=>[topBody,botBody,capTop,capBot].forEach(o=>o&&o.destroy()));
};

function capWidth(scene, key){ return scene.textures.get(key).getSourceImage().width || PIPE_W; }

/* ---------- Score & GameOver ---------- */
GameScene.prototype.addScore=function(n){ this.score += n; this.scoreText.setText('Score: '+this.score); };

GameScene.prototype.gameOver=function(){
  if(!this.player.active) return;
  this.player.disableBody(true,false); this.player.setTint(0xff6b6b);
  this.spawnEv && this.spawnEv.remove(false);

  const W=this.scale.width,H=this.scale.height;
  const pane=this.add.rectangle(W/2,H/2,W*0.84,420,0x163945,0.92).setDepth(100);
  this.add.text(W/2,H/2-120,'Game Over',{fontFamily:'Georgia,serif',fontSize:'72px',color:'#fff'}).setOrigin(0.5).setDepth(101);
  this.add.text(W/2,H/2-40,`Score :  ${this.score}`,{fontFamily:'monospace',fontSize:'52px',color:'#c9fff4'}).setOrigin(0.5).setDepth(101);

  // Classement local (top 10)
  const board = JSON.parse(localStorage.getItem('borgy_best10')||'[]');
  board.push({s:this.score,t:Date.now()});
  board.sort((a,b)=>b.s-a.s); while(board.length>10) board.pop();
  localStorage.setItem('borgy_best10', JSON.stringify(board));

  // Liste top 5
  const lines = board.slice(0,5).map((e,i)=>`${i+1}.  ${e.s}`).join('\n');
  this.add.text(W/2, H/2+40, lines, {fontFamily:'monospace',fontSize:'28px',color:'#b1ffe6',align:'center'}).setOrigin(0.5).setDepth(101);

  const btn=this.add.text(W/2,H/2+160,'Rejouer',{fontFamily:'monospace',fontSize:'48px',color:'#fff',backgroundColor:'#0db187',padding:{left:22,right:22,top:10,bottom:12}})
    .setOrigin(0.5).setDepth(101).setInteractive({useHandCursor:true});
  btn.on('pointerdown',()=>this.scene.start('menu'));
};

/* ---------- Beep WebAudio minimal ---------- */
function beep(freq=880, ms=90, vol=0.15){
  try{
    const a = new (window.AudioContext||window.webkitAudioContext)();
    const o = a.createOscillator(); const g = a.createGain();
    o.type='sine'; o.frequency.setValueAtTime(freq,a.currentTime);
    g.gain.setValueAtTime(vol,a.currentTime); g.gain.exponentialRampToValueAtTime(0.0001,a.currentTime+ms/1000);
    o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime+ms/1000+0.02);
  }catch(e){}
}
