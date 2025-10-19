/*  FlappyBorgy v15.4
 *  - Preloader anti-blocage + cache-buster
 *  - Tuyaux transparents (light/dark), alternance toutes les 50 paires
 *  - Bip à chaque passage
 *  - Menu + mini Quêtes (localStorage)
 */

const VERSION = 'v15.4'; // change la valeur à chaque déploiement pour forcer le refresh des assets

/* ------------------ Profil jeu ------------------ */
const PROFILE = {
  gravity: 1400,
  jump: -380,
  pipeSpeed: -220,
  gap: 230
};
const BORGY_SCALE = 0.22;
const PIPE_W = 140;
const SPAWN_DELAY = 1600;
const HOLE_MIN = 90;
const HOLE_MAX_MARGIN = 160;

/* ------------- Scenes: Preload / Boot / Menu / Game / Quests ------------- */

class PreloadScene extends Phaser.Scene {
  constructor() { super('preload'); }

  preload() {
    const W = this.scale.width, H = this.scale.height;

    // Barre de chargement
    const bg = this.add.rectangle(W/2, H/2, 420, 10, 0x000000, 0.12).setOrigin(0.5);
    const bar = this.add.rectangle(W/2 - 210, H/2, 1, 10, 0x0aa67e).setOrigin(0, 0.5);
    const pct = this.add.text(W/2, H/2 + 22, '0%', { fontFamily: 'MonoScore, monospace', fontSize: 16, color: '#044' }).setOrigin(0.5);

    this.load.on('progress', p => { bar.width = 420 * p; pct.setText(`${Math.round(p*100)}%`); });

    const missing = [];
    this.load.on('fileerror', file => {
      const name = (file && (file.src || file.key)) ? (file.src || file.key) : 'unknown';
      missing.push(name);
      console.warn('[Loader] File error:', name);
    });

    // lance quand même au bout de 8s si un asset traîne
    let completed = false;
    this.time.delayedCall(8000, () => {
      if (!completed) {
        console.warn('[Loader] Watchdog: start anyway');
        this.scene.start('boot');
      }
    });

    // Chemin et cache-buster
    this.load.setPath('assets');
    const v = f => `${f}?${VERSION}`;

    // Images
    this.load.image('borgy',           v('borgy_ingame.png'));
    this.load.image('pipe_light_top',    v('pipe_light_top.png'));
    this.load.image('pipe_light_bottom', v('pipe_light_bottom.png'));
    this.load.image('pipe_dark_top',     v('pipe_dark_top.png'));
    this.load.image('pipe_dark_bottom',  v('pipe_dark_bottom.png'));
    this.load.image('sb_token',        v('sb_token_user.png')); // facultatif

    // Audio
    this.load.audio('beep', [ v('beep.ogg') ]);

    this.load.once('complete', () => {
      completed = true;
      if (missing.length) {
        this.add.text(W/2, H/2 + 60,
          'Fichiers manquants :\n' + missing.map(s => s.split('/').slice(-1)[0]).join('\n'),
          { fontFamily: 'MonoScore, monospace', fontSize: 14, color: '#a00', align: 'center' }
        ).setOrigin(0.5);
      }
      this.scene.start('boot');
    });
  }
}

class BootScene extends Phaser.Scene {
  constructor(){ super('boot'); }
  create(){ this.scene.start('menu'); }
}

class MenuScene extends Phaser.Scene {
  constructor(){ super('menu'); }

  create(){
    const W = this.scale.width, H = this.scale.height;
    this.add.text(W/2, H*0.22, 'FlappyBorgy', {
      fontFamily: 'Georgia, serif', fontSize: 72, color: '#0b3a32', stroke: '#bdf4e7', strokeThickness: 10
    }).setOrigin(0.5);

    const play = this.add.text(W/2, H*0.42, 'Jouer', btnStyle())
      .setOrigin(0.5).setInteractive({useHandCursor:true});
    play.on('pointerdown', () => this.scene.start('game'));

    const quests = this.add.text(W/2, H*0.52, 'Quêtes', btnStyleSecondary())
      .setOrigin(0.5).setInteractive({useHandCursor:true});
    quests.on('pointerdown', () => this.scene.start('quests'));

    const mute = this.add.text(W/2, H*0.62, this.sound.mute ? 'Son : OFF' : 'Son : ON', smallBtn())
      .setOrigin(0.5).setInteractive({useHandCursor:true});
    mute.on('pointerdown', () => {
      this.sound.mute = !this.sound.mute;
      mute.setText(this.sound.mute ? 'Son : OFF' : 'Son : ON');
    });

    this.add.text(W/2, H*0.80, 'Tap/Space pour sauter\nÉvitez les tuyaux', {
      fontFamily: 'monospace', fontSize: 26, color: '#0b3a32', align: 'center'
    }).setOrigin(0.5);
  }
}

class QuestScene extends Phaser.Scene {
  constructor(){ super('quests'); }

  create(){
    const W = this.scale.width, H = this.scale.height;
    this.add.text(W/2, 80, 'Quêtes du jour', { fontFamily:'Georgia,serif', fontSize: 56, color:'#0b3a32' }).setOrigin(0.5);

    const q = loadDailyQuests();
    let y = 180;
    q.forEach((quest, i) => {
      const line = `${quest.title}  –  ${quest.progress}/${quest.target}  ${quest.done?'✅':'⬜'}`;
      this.add.text(60, y, line, { fontFamily:'monospace', fontSize: 28, color: quest.done ? '#0a7a56' : '#083b43' });
      y += 60;
    });

    const back = this.add.text(W/2, H*0.88, '← Retour', btnStyleSecondary()).setOrigin(0.5).setInteractive({useHandCursor:true});
    back.on('pointerdown', () => this.scene.start('menu'));
  }
}

class GameScene extends Phaser.Scene {
  constructor(){ super('game'); }

  init(){
    this.score = 0;
    this.pipesPassed = 0;
    this.currentVariant = 'light'; // alterne toutes les 50 paires
    this.started = false;
    this.followUpdaters = [];
  }

  create(){
    const W = this.scale.width, H = this.scale.height;

    // Score
    this.scoreText = this.add.text(24, 20, 'Score: 0', {
      fontFamily: 'monospace', fontSize: 48, color: '#ffffff', stroke:'#0a3a38', strokeThickness:8
    }).setDepth(50);

    // Joueur
    this.player = this.physics.add.sprite(W*0.22, H*0.5, 'borgy')
      .setScale(BORGY_SCALE).setDepth(10).setCollideWorldBounds(true);
    this.player.body.setAllowGravity(false); // ne tombe pas tant que pas démarré

    // Groupe tuyaux
    this.pipes = this.physics.add.group();

    // Collision
    this.physics.add.overlap(this.player, this.pipes, () => this.gameOver(), null, this);

    // Son
    this.sndBeep = this.sound.add('beep', { volume: 0.5 });

    // Input
    this.input.on('pointerdown', () => this.handleInput());
    this.input.keyboard.on('keydown-SPACE', () => this.handleInput());

    // Message “Tap to start”
    this.startMsg = this.add.text(W/2, H*0.55, 'TAP pour démarrer', {
      fontFamily:'monospace', fontSize: 36, color:'#0b3a32', backgroundColor:'#cffff3'
    }).setOrigin(0.5).setDepth(20);

    // Timer de spawn (commence PAUSÉ)
    this.spawnTimer = this.time.addEvent({
      delay: SPAWN_DELAY, loop: true, paused: true, callback: () => this.spawnPair()
    });

    // Première paire immédiatement quand on démarre (voir handleInput)
  }

  handleInput(){
    if (!this.started){
      this.started = true;
      this.startMsg.destroy();
      this.player.body.setAllowGravity(true);
      this.spawnPair();        // première paire instantanée
      this.spawnTimer.paused = false;
    }
    this.player.setVelocityY(PROFILE.jump);
  }

  update(t){
    // tilt visuel
    if (!this.player.active) return;
    const vy = this.player.body.velocity.y;
    this.player.setAngle(Phaser.Math.Clamp(vy*0.06, -18, 22));

    // MAJ des caps (si besoin)
    this.followUpdaters.forEach(fn => fn());

    // nettoyage offscreen
    this.pipes.children.each(p => { if (p.active && p.x < -PIPE_W*2) p.destroy(); });
  }

  spawnPair(){
    const H = this.scale.height;
    const gap = PROFILE.gap;
    const minTop = HOLE_MIN;
    const maxTop = H - (gap + HOLE_MAX_MARGIN);
    const topY = Phaser.Math.Between(minTop, maxTop);
    const holeCenter = topY + gap/2;

    // variante light/dark : change toutes les 50 paires
    const variant = (Math.floor(this.pipesPassed / 50) % 2 === 0) ? 'light' : 'dark';
    this.makePipes(this.scale.width + 60, holeCenter, gap, variant);

    // capteur de score
    const sensor = this.add.rectangle(this.scale.width + 60 + PIPE_W/2 + 10, H/2, 10, H, 0x000000, 0);
    this.physics.add.existing(sensor, true);
    sensor.body.setVelocityX(PROFILE.pipeSpeed);
    sensor.passed = false;

    this.physics.add.overlap(this.player, sensor, () => {
      if (sensor.passed) return;
      sensor.passed = true;
      sensor.destroy();
      this.pipesPassed++;
      this.incrementScore();
    });
  }

  makePipes(x, holeCenter, holeSize, variant){
    const H = this.scale.height;
    const topHeight = Math.max(40, holeCenter - holeSize/2);                   // distance du haut au bord supérieur du trou
    const bottomHeight = Math.max(40, H - (holeCenter + holeSize/2));          // distance du bord inférieur du trou au bas

    const keyTop    = `pipe_${variant}_top`;     // cap en haut (pour le bas de l’écran)
    const keyBottom = `pipe_${variant}_bottom`;  // cap en bas (pour le haut de l’écran)

    // -------- Tuyau du HAUT (cap au niveau du trou) --------
    const topPipe = this.physics.add.image(x, topHeight, keyBottom) // cap au bas du sprite
      .setOrigin(0.5, 1)
      .setDisplaySize(PIPE_W, topHeight)
      .setImmovable(true).setDepth(5);
    topPipe.body.setAllowGravity(false).setVelocityX(PROFILE.pipeSpeed);
    this.pipes.add(topPipe);

    // -------- Tuyau du BAS (cap au niveau du trou) --------
    const bottomY = holeCenter + holeSize/2; // bord inférieur du trou
    const bottomPipe = this.physics.add.image(x, bottomY, keyTop)   // cap en haut du sprite
      .setOrigin(0.5, 0)
      .setDisplaySize(PIPE_W, bottomHeight)
      .setImmovable(true).setDepth(5);
    bottomPipe.body.setAllowGravity(false).setVelocityX(PROFILE.pipeSpeed);
    this.pipes.add(bottomPipe);
  }

  incrementScore(){
    this.score += 1;
    this.scoreText.setText('Score: ' + this.score);
    if (this.sndBeep) this.sndBeep.play();

    // quêtes
    bumpQuest('pipes', 1);
    bumpQuest('score', 1);
  }

  gameOver(){
    if (!this.player.active) return;
    this.player.disableBody(true, false);
    this.spawnTimer && (this.spawnTimer.paused = true);

    saveBestScore(this.score);

    const W = this.scale.width, H = this.scale.height;
    const panel = this.add.rectangle(W/2, H/2, W*0.82, 360, 0x163945, 0.92).setDepth(100);
    this.add.text(W/2, H/2 - 110, 'Game Over', { fontFamily:'Georgia,serif', fontSize: 72, color:'#fff' })
      .setOrigin(0.5).setDepth(101);
    this.add.text(W/2, H/2 - 30, `Score : ${this.score}   |   Best : ${loadBestScore()}`, {
      fontFamily:'monospace', fontSize: 40, color:'#c9fff4'
    }).setOrigin(0.5).setDepth(101);

    const btn = this.add.text(W/2, H/2 + 70, 'Rejouer', btnStyle())
      .setOrigin(0.5).setDepth(101).setInteractive({useHandCursor:true});
    btn.on('pointerdown', () => this.scene.restart());
  }
}

/* ------------------ UI Helpers ------------------ */
function btnStyle(){
  return { fontFamily:'monospace', fontSize: 52, color:'#ffffff', backgroundColor:'#0db187',
           padding:{left:22,right:22,top:10,bottom:10} };
}
function btnStyleSecondary(){
  return { fontFamily:'monospace', fontSize: 40, color:'#0b3a32', backgroundColor:'#bdf4e7',
           padding:{left:18,right:18,top:8,bottom:8} };
}
function smallBtn(){
  return { fontFamily:'monospace', fontSize: 30, color:'#ffffff', backgroundColor:'#0db187',
           padding:{left:14,right:14,top:6,bottom:6} };
}

/* ------------------ Quêtes (localStorage) ------------------ */
const QUEST_KEY = 'fbv15_daily_quests';
const QUEST_DATE_KEY = 'fbv15_daily_date';

function todayStr(){
  const d = new Date(); return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}
function generateQuests(){
  return [
    { id:'pipes', title:'Passer 60 tuyaux', target:60, progress:0, done:false },
    { id:'score', title:'Atteindre un score de 30', target:30, progress:0, done:false },
    { id:'session', title:'Jouer 3 parties', target:3, progress:0, done:false }
  ];
}
function loadDailyQuests(){
  const t = todayStr();
  const last = localStorage.getItem(QUEST_DATE_KEY);
  if (last !== t){
    const q = generateQuests();
    localStorage.setItem(QUEST_KEY, JSON.stringify(q));
    localStorage.setItem(QUEST_DATE_KEY, t);
    return q;
  }
  try {
    const q = JSON.parse(localStorage.getItem(QUEST_KEY) || '[]');
    return Array.isArray(q) ? q : generateQuests();
  } catch {
    const q = generateQuests();
    localStorage.setItem(QUEST_KEY, JSON.stringify(q));
    return q;
  }
}
function saveDailyQuests(q){ localStorage.setItem(QUEST_KEY, JSON.stringify(q)); }
function bumpQuest(kind, amount){
  const q = loadDailyQuests();
  let changed = false;
  q.forEach(quest => {
    if (quest.id === kind || (kind==='score' && quest.id==='session' && amount===0)) return; // no-op
    if (quest.id === kind && !quest.done){
      quest.progress = Math.min(quest.target, (quest.progress||0) + amount);
      if (quest.progress >= quest.target) quest.done = true;
      changed = true;
    }
  });
  if (changed) saveDailyQuests(q);
}
function bumpSessionQuest(){
  const q = loadDailyQuests();
  q.forEach(quest => {
    if (quest.id==='session' && !quest.done){
      quest.progress = Math.min(quest.target, (quest.progress||0) + 1);
      if (quest.progress >= quest.target) quest.done = true;
    }
  });
  saveDailyQuests(q);
}
function saveBestScore(s){
  const k='fbv15_best'; const best = Number(localStorage.getItem(k)||0);
  if (s>best) localStorage.setItem(k, String(s));
}
function loadBestScore(){ return Number(localStorage.getItem('fbv15_best')||0); }

/* ------------------ Boot du jeu ------------------ */
window.addEventListener('load', () => {
  const config = {
    type: Phaser.AUTO,
    parent: 'game-root',
    backgroundColor: '#9edff1',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 768, height: 1366 },
    physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug:false } },
    scene: [PreloadScene, BootScene, MenuScene, GameScene, QuestScene]
  };
  const game = new Phaser.Game(config);

  // Compter une partie pour la quête “session”
  const orgStart = GameScene.prototype.create;
  GameScene.prototype.create = function(){
    bumpSessionQuest();
    return orgStart.apply(this, arguments);
  };
});
