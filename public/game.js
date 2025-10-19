/* FlappyBorgy – v16
   - Menu démarrer / Quêtes (placeholder)
   - Tuyaux 2 skins (clair/sombre) qui alternent toutes les 50 paires
   - Défilement fluide des tuyaux (Arcade Physics, vitesse négative)
   - Capteurs de score dynamiques
   - Son "woof" à chaque tuyau passé (désactivable)
   - Correctif halo noir sur les caps (crop) + option filtre NEAREST
*/

const GAME_W = 768, GAME_H = 1366;         // portrait logique
const PROFILE = {
  gravity: 1400,
  jump: -380,
  speed: -220,
  gap: 260,
  spawnDelay: 1450,                         // ms entre paires
  pipeWidth: 180
};
const BORGY_SCALE = 0.22;

// alternance skins toutes les 50 paires
const SWITCH_EVERY = 50;
const SKINS = [
  { top: 'pipe_light_top', bottom: 'pipe_light_bottom' },
  { top: 'pipe_dark_top',  bottom: 'pipe_dark_bottom'  }
];

let game;

/* --------------------------------------------------------- */
/* Boot / Preload                                            */
/* --------------------------------------------------------- */
class BootScene extends Phaser.Scene {
  constructor(){ super('boot'); }

  preload(){
    const w = this.scale.width, h = this.scale.height;

    // barre de chargement
    const bg = this.add.rectangle(w/2, h*0.55, w*0.55, 10, 0x000000, 0.12).setOrigin(0.5);
    const fg = this.add.rectangle(bg.x - bg.width/2, bg.y, 1, 10, 0x00a67e).setOrigin(0,0.5);
    const pct = this.add.text(bg.x, bg.y+24, '0%', {fontFamily:'monospace', fontSize: 18, color:'#044'}).setOrigin(0.5);
    this.load.on('progress', p => { fg.width = bg.width*p; pct.setText(Math.round(p*100)+'%'); });

    // ASSETS (dossier public/assets)
    this.load.setPath('assets');
    this.load.image('borgy', 'borgy_ingame.png');

    this.load.image('pipe_light_top',    'pipe_light_top.png');
    this.load.image('pipe_light_bottom', 'pipe_light_bottom.png');
    this.load.image('pipe_dark_top',     'pipe_dark_top.png');
    this.load.image('pipe_dark_bottom',  'pipe_dark_bottom.png');

    this.load.image('token', 'sb_token_user.png');

    // Son : on tente le woof; fallback beep si besoin
    this.load.audio('single-dog-woof-sound', ['single-dog-woof-sound.ogg','beep.ogg']);
  }

  create(){
    // Anti halo : filtre NEAREST (optionnel)
    ['pipe_light_top','pipe_light_bottom','pipe_dark_top','pipe_dark_bottom'].forEach(k=>{
      if (this.textures.exists(k)) this.textures.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST);
    });

    this.scene.start('menu');
  }
}

/* --------------------------------------------------------- */
/* Menu                                                      */
/* --------------------------------------------------------- */
class MenuScene extends Phaser.Scene {
  constructor(){ super('menu'); }
  create(){
    const W = this.scale.width, H = this.scale.height;

    this.add.text(W/2, H*0.18, 'FlappyBorgy', {
      fontFamily:'Georgia, serif', fontSize:64, color:'#104a3e'
    }).setOrigin(0.5);

    const playBtn = this.makeBtn(W/2, H*0.32, 'Jouer', () => this.scene.start('game'));
    const questsBtn = this.makeBtn(W/2, H*0.40, 'Quêtes', () => this.scene.start('quests'));
    const soundBtn = this.makeBtn(W/2, H*0.48, `Son : ${localStorage.getItem('fb_sound')==='0'?'OFF':'ON'}`, () => {
      const now = localStorage.getItem('fb_sound')==='0' ? '1':'0';
      localStorage.setItem('fb_sound', now);
      soundBtn.setText(`Son : ${now==='0'?'OFF':'ON'}`);
    });

    this.add.text(W/2, H*0.86, 'Tap/Espace pour sauter\nÉvitez les tuyaux', {
      fontFamily:'monospace', fontSize:24, color:'#104a3e', align:'center'
    }).setOrigin(0.5);
  }

  makeBtn(x,y,label,cb){
    const t = this.add.text(x,y,label,{
      fontFamily:'monospace', fontSize:34, color:'#fff', backgroundColor:'#11a88a', padding:{left:16,right:16,top:8,bottom:8}
    }).setOrigin(0.5).setInteractive({useHandCursor:true});
    t.on('pointerdown', cb);
    return t;
  }
}

/* --------------------------------------------------------- */
/* Quêtes (placeholder visuel simple)                        */
/* --------------------------------------------------------- */
class QuestsScene extends Phaser.Scene {
  constructor(){ super('quests'); }
  create(){
    const W=this.scale.width, H=this.scale.height;
    this.add.text(W/2, H*0.12, 'Quêtes journalières', {fontFamily:'Georgia,serif', fontSize:48, color:'#133'}).setOrigin(0.5);
    const list = [
      '• Faire 10 points (0/10)',
      '• Passer 3 tuyaux d’affilée (0/3)',
      '• Jouer 3 parties (0/3)'
    ];
    this.add.text(W/2, H*0.22, list.join('\n'), {fontFamily:'monospace', fontSize:28, color:'#155', lineSpacing:12}).setOrigin(0.5,0);
    this.add.text(W/2, H*0.85, 'Retour', {fontFamily:'monospace', fontSize:34, color:'#fff', backgroundColor:'#11a88a', padding:{left:18,right:18,top:8,bottom:8}})
      .setOrigin(0.5).setInteractive({useHandCursor:true}).on('pointerdown', ()=>this.scene.start('menu'));
  }
}

/* --------------------------------------------------------- */
/* Jeu                                                       */
/* --------------------------------------------------------- */
class GameScene extends Phaser.Scene {
  constructor(){ super('game'); }

  init(){
    this.score = 0;
    this.passed = 0;              // paires passées
    this.skinIndex = 0;           // 0 clair / 1 sombre
    this.followFns = [];          // MAJ visuelle des caps/bodies
    this.soundOn = (localStorage.getItem('fb_sound')!=='0');
  }

  create(){
    const W = this.scale.width, H = this.scale.height;
    this.cameras.main.setBackgroundColor('#aee5f2');

    // texte score
    this.scoreText = this.add.text(24, 20, 'Score: 0', {
      fontFamily:'monospace', fontSize:48, color:'#ffffff', stroke:'#0a3a38', strokeThickness:8
    }).setDepth(50);

    // joueur
    this.player = this.physics.add.sprite(W*0.24, H*0.5, 'borgy')
      .setScale(BORGY_SCALE).setDepth(10).setCollideWorldBounds(true);
    this.player.body.setGravityY(PROFILE.gravity);
    this.player.body.setSize(this.player.width*0.55, this.player.height*0.55, true)
                    .setOffset(this.player.width*0.225, this.player.height*0.25);

    // groupe de colliders “tuyaux”
    this.pipeColliders = this.physics.add.group({ allowGravity:false, immovable:true });

    // collisions
    this.physics.add.overlap(this.player, this.pipeColliders, () => this.gameOver(), null, this);

    // input
    this.input.on('pointerdown', ()=>this.flap());
    this.input.keyboard.on('keydown-SPACE', ()=>this.flap());

    // son
    this.woof = this.sound.add('woof', { volume: 0.5 });

    // 2 premières paires pour remplir l’écran
    this.spawnPair(W + 120);
    this.time.delayedCall(PROFILE.spawnDelay*0.7, ()=>this.spawnPair(W + 120 + 380));

    // spawner régulier
    this.timer = this.time.addEvent({
      delay: PROFILE.spawnDelay, loop: true, callback: ()=> this.spawnPair()
    });
  }

  flap(){
    if (!this.player.active) return;
    this.player.setVelocityY(PROFILE.jump);
  }

  update(time, dt){
    // look / tilt
    const vy = this.player.body.velocity.y;
    this.player.setAngle(Phaser.Math.Clamp(Phaser.Math.Linear(-25, 35, (vy+400)/800), -25, 35));

    // MAJ des éléments “visuels” qui suivent les colliders
    this.followFns.forEach(fn=>fn());

    // nettoyage colliders hors écran
    this.pipeColliders.children.iterate((c)=>{
      if (!c) return;
      if (c.active && c.x < -PROFILE.pipeWidth*2) c.destroy();
    });
  }

  /* ------------ Génération de paires de tuyaux ----------------- */
  spawnPair(startX){
    const W = this.scale.width, H = this.scale.height;
    const x = (startX !== undefined) ? startX : (W + 40);

    // trou
    const gap = PROFILE.gap;
    const minTop = 120;
    const maxTop = H - (gap + 160);
    const topH = Phaser.Math.Between(minTop, maxTop);
    const holeCenter = topH + gap/2;

    // skin (switch toutes les 50)
    const effectiveIndex = Math.floor(this.passed / SWITCH_EVERY) % SKINS.length;
    const skin = SKINS[effectiveIndex];

    // corps + caps haut
    const top = this.makePipe(x, topH, true, skin);
    // corps + caps bas
    const bottomHeight = H - (holeCenter + gap/2);
    const bottom = this.makePipe(x, holeCenter + gap/2 + bottomHeight, false, skin, bottomHeight);

    // capteur de score (physique, transparent, dynamique)
    const sensor = this.physics.add.image(x + PROFILE.pipeWidth*0.6, H/2)
      .setScale(1, H/(this.player.height)).setAlpha(0.0001);
    sensor.setImmovable(true);
    sensor.body.allowGravity = false;
    sensor.setVelocityX(PROFILE.speed);

    this.physics.add.overlap(this.player, sensor, ()=>{
      if (!sensor.active) return;
      sensor.destroy();
      this.passed++;
      this.score++;
      this.scoreText.setText('Score: ' + this.score);
      if (this.soundOn && this.woof) this.woof.play();
    });

    // collision bodies (dynamiques immobiles, vitesse négative)
    [top.collider, bottom.collider].forEach(c=>{
      c.setImmovable(true);
      c.body.allowGravity = false;
      c.setVelocityX(PROFILE.speed);
      this.pipeColliders.add(c);
    });
  }

  /* Fabrique un tuyau (haut ou bas)
     - Crée un collider invisible (physics Image)
     - Crée le visuel: tileSprite + cap
     - Enregistre une followFn pour coller visuel au collider
  */
  makePipe(x, endY, isTop, skin, forcedBodyH){
    const keyTop = skin.top;
    const keyBottom = skin.bottom;
    const bodyHeight = forcedBodyH ?? endY;           // si top: endY est la hauteur du corps
    const bodyY = isTop ? bodyHeight : endY;          // position du collider
    const halfW = PROFILE.pipeWidth/2;

    // collider : rectangle invisible
    const collider = this.physics.add.image(x, bodyY, undefined).setVisible(false);
    collider.body.setSize(PROFILE.pipeWidth, bodyHeight);
    collider.setOrigin(0.5, isTop ? 1 : 1);           // pivot en bas (on place par y “base”)
    collider.body.setOffset(-halfW, -bodyHeight);     // ancrage manuel

    // VISUEL corps : on génère une bande (tileSprite) à partir du PNG top/bottom “body”
    const bodyTexKey = this.makePipeBodyTexture(isTop ? keyBottom : keyTop); // on prend la partie “fût”
    const bodySprite = this.add.tileSprite(x, bodyY - (isTop? bodyHeight/2 : bodyHeight/2),
                                           PROFILE.pipeWidth, bodyHeight, bodyTexKey)
                                .setOrigin(0.5, 0.5).setDepth(5);
    if (!isTop) bodySprite.setFlipY(true);

    // VISUEL cap (haut ou bas) + CORRECTIF HALO (crop latéral)
    const capKey = isTop ? keyBottom : keyTop;
    const cap = this.add.image(x, isTop ? endY : (endY - bodyHeight), capKey)
                        .setDepth(6)
                        .setOrigin(0.5, isTop ? 1 : 0)
                        .setFlipY(!isTop);

    // --- anti halo : on recadre quelques pixels à gauche/droite du cap
    const src = this.textures.get(capKey).getSourceImage();
    const pad = Math.round(src.width * 0.06); // ajuste 0.05–0.08 si nécessaire
    cap.setCrop(pad, 0, src.width - pad*2, src.height);

    // fonction de suivi (coller visuels au collider)
    const follow = ()=>{
      bodySprite.x = collider.x;
      cap.x = collider.x;
      if (isTop){
        bodySprite.y = collider.y - bodyHeight/2;
        cap.y = collider.y; // base du haut
      }else{
        bodySprite.y = collider.y - bodyHeight/2;
        cap.y = collider.y - bodyHeight; // sommet du bas
      }
    };
    this.followFns.push(follow);

    return { collider, bodySprite, cap };
  }

  // Crée/retourne une texture répétable (key) depuis le PNG cap/bottom/top en rognant les bords sombres
  makePipeBodyTexture(fromKey){
    const key = `body_${fromKey}`;
    if (this.textures.exists(key)) return key;

    const src = this.textures.get(fromKey).getSourceImage();
    // on coupe 6% gauche/droite et 18% top/bottom pour ne garder que le fût
    const cx = Math.round(src.width * 0.06);
    const cy = Math.round(src.height * 0.18);
    const cw = src.width - cx*2;
    const ch = src.height - cy*2;

    const rt = this.textures.createCanvas(key, cw, ch);
    const ctx = rt.getContext();
    ctx.drawImage(src, cx, cy, cw, ch, 0, 0, cw, ch);
    rt.refresh();

    // filtre NEAREST aussi sur le body
    this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    return key;
  }

  gameOver(){
    if (!this.player.active) return;
    this.player.disableBody(true,false);
    this.player.setTint(0xff6b6b);
    this.timer && this.timer.remove(false);

    const W=this.scale.width, H=this.scale.height;
    const panel = this.add.rectangle(W/2, H/2, W*0.8, 360, 0x163945, 0.92).setDepth(100);
    this.add.text(W/2, H/2-110, 'Game Over', {fontFamily:'Georgia,serif', fontSize:70, color:'#fff'}).setOrigin(0.5).setDepth(101);
    this.add.text(W/2, H/2-30, `Score : ${this.score}`, {fontFamily:'monospace', fontSize:54, color:'#c9fff4'}).setOrigin(0.5).setDepth(101);

    const btn = this.add.text(W/2, H/2+70, 'Rejouer', {
      fontFamily:'monospace', fontSize:46, color:'#fff', backgroundColor:'#0db187',
      padding:{left:20,right:20,top:10,bottom:10}
    }).setOrigin(0.5).setDepth(101).setInteractive({useHandCursor:true});
    btn.on('pointerdown', ()=> this.scene.restart());
  }
}

/* --------------------------------------------------------- */
/* Lancement                                                 */
/* --------------------------------------------------------- */
window.addEventListener('load', () => {
  game = new Phaser.Game({
    type: Phaser.AUTO,
    backgroundColor: '#aee5f2',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_W,
      height: GAME_H
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { y: 0 },   // la gravité est appliquée UNIQUEMENT au player
        debug: false
      }
    },
    scene: [BootScene, MenuScene, QuestsScene, GameScene],
    parent: 'game-root'
  });
});
