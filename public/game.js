/*  FlappyBorgy v15.5
 *  - Préloader robuste (anti-blocage + cache-buster)
 *  - Tuyaux 4K light/dark (alternance toutes les 50 paires)
 *  - Son "woof" à chaque tuyau passé + woof aigu sur bonus
 *  - Menu + Quêtes journalières (localStorage)
 *
 *  Assets requis dans /public/assets :
 *   - borgy_ingame.png
 *   - pipe_light_top.png,    pipe_light_bottom.png
 *   - pipe_dark_top.png,     pipe_dark_bottom.png
 *   - woof.ogg   (ton son de chien mignon en OGG)
 *   - (facultatif) sb_token_user.png
 */

const VERSION = 'v15.5'; // incrémente à chaque déploiement pour casser le cache

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

/* ------------------ Scènes ------------------ */
class PreloadScene extends Phaser.Scene {
  constructor() { super('preload'); }

  preload() {
    const W = this.scale.width, H = this.scale.height;

    // UI chargement
    const bg = this.add.rectangle(W/2, H/2, 420, 10, 0x000000, 0.12).setOrigin(0.5);
    const bar = this.add.rectangle(W/2 - 210, H/2, 1, 10, 0x0aa67e).setOrigin(0, 0.5);
    const pct = this.add.text(W/2, H/2 + 22, '0%', { fontFamily: 'monospace', fontSize: 16, color: '#044' }).setOrigin(0.5);
    this.load.on('progress', p => { bar.width = 420 * p; pct.setText(`${Math.round(p*100)}%`); });

    const missing = [];
    this.load.on('fileerror', f => {
      const name = (f && (f.src || f.key)) ? (f.src || f.key) : 'unknown';
      missing.push(name);
      console.warn('[Loader] File error:', name);
    });

    // Watchdog : démarre quand même si un fetch reste pendu
    let completed = false;
    this.time.delayedCall(8000, () => {
      if (!completed) {
        console.warn('[Loader] Watchdog: start anyway');
        this.scene.start('boot');
      }
    });

    // Chemin + cache-buster
    this.load.setPath('assets');
    const v = f => `${f}?${VERSION}`;

    // Images
    this.load.image('borgy',             v('borgy_ingame.png'));
    this.load.image('pipe_light_top',    v('pipe_light_top.png'));
    this.load.image('pipe_light_bottom', v('pipe_light_bottom.png'));
    this.load.image('pipe_dark_top',     v('pipe_dark_top.png'));
    this.load.image('pipe_dark_bottom',  v('pipe_dark_bottom.png'));
    this.load.image('sb_token',          v('sb_token_user.png')); // facultatif

    // Audio (remplace l’ancien beep par 'woof')
    this.load.audio('woof', [ v('woof.ogg') ]);

    this.load.once('complete', () => {
      completed = true;
      if (missing.length) {
        this.add.text(W/2, H/2 + 60,
          'Fichiers manquants :\n' + missing.map(s => s.split('/').slice(-1)[0]).join('\n'),
          { fontFamily: 'monospace', fontSize: 14, color: '#a00', align: 'center' }
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
    q.forEach((quest) => {
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
    this.started = false;
  }

  create(){
    const W = this.scale.width, H = this.scale.height;

    // Score
    this.scoreText = this.add.text(24, 20, 'Score: 0', {
      fontFamily: 'monospace', fontSize: 48, color: '#ffffff', stroke:'#0a3a38', strokeThickness:8
    }).setDepth(50);

    // Joueur (gravité OFF tant que pas démarré)
    this.player = this.physics.add.sprite(W*0.22, H*0.5, 'borgy')
      .setScale(BORGY_SCALE).setDepth(10).setCollideWorldBounds(true);
    this.player.body.setAllowGravity(false);
    this.player.body.setSize(this.player.width * 0.55, this.player.height * 0.55, true);
    this.player.body.setOffset(this.player.width * 0.225, this.player.height * 0.25);

    // Groupe pour collisions
    this.pipes = this.physics.add.group();

    // Son
    this.sfxWoof = this.sound.add('woof', { volume: 0.5 });

    // Inputs
    this.input.on('pointerdown', () => this.handleInput());
    this.input.keyboard.on('keydown-SPACE', () => this.handleInput());

    // “Tap to start”
    this.startMsg = this.add.text(W/2, H*0.55, 'TAP pour démarrer', {
      fontFamily:'monospace', fontSize: 36, color:'#0b3a32', backgroundColor:'#cffff3'
    }).setOrigin(0.5).setDepth(20);

    // Timer spawn (pausé tant que pas démarré)
    this.spawnTimer = this.time.addEvent({
      delay: SPAWN_DELAY, loop: true, paused: true, callback: () => this.spawnPair()
    });
  }

  handleInput(){
    if (!this.started){
      this.started = true;
      this.startMsg.destroy();
      this.player.body.setAllowGravity(true);
      this.spawnPair();            // une première paire immédiate
      this.spawnTimer.paused = false;
    }
    this.player.setVelocityY(PROFILE.jump);
  }

  update(){
    if (!this.player.active) return;
    // Tilt léger
    const vy = this.player.body.velocity.y;
    this.player.setAngle(Phaser.Math.Clamp(vy * 0.06, -18, 22));

    // Nettoyage hors-écran
    this.pipes.children.each(p => { if (p.active && p.x < -PIPE_W*2) p.destroy(); });
  }

  spawnPair(){
    const W = this.scale.width, H = this.scale.height;
    const gap = PROFILE.gap;
    const minTop = HOLE_MIN;
    const maxTop = H - (gap + HOLE_MAX_MARGIN);

    // Y du trou (aléatoire “raisonnable”)
    const topY = Phaser.Math.Between(minTop, maxTop);
    const holeCenter = topY + gap/2;
    const x = W + 60;

    // Variante claire/sombre : alterne toutes les 50 paires franchies
    const useDark = (Math.floor(this.pipesPassed / 50) % 2) === 1;
    const keyTop    = useDark ? 'pipe_dark_top'    : 'pipe_light_top';
    const keyBottom = useDark ? 'pipe_dark_bottom' : 'pipe_light_bottom';

    // ---------- Tuyau du HAUT ----------
    const topH = Math.max(40, holeCenter - gap/2);
    const topPipe = this.physics.add.image(x, topH, keyBottom)
      .setOrigin(0.5, 1)
      .setDisplaySize(PIPE_W, topH)
      .setImmovable(true).setDepth(5);
    topPipe.body.setAllowGravity(false).setVelocityX(PROFILE.pipeSpeed);
    this.pipes.add(topPipe);

    // ---------- Tuyau du BAS ----------
    const bottomH = Math.max(40, H - (holeCenter + gap/2));
    const bottomY = holeCenter + gap/2;
    const bottomPipe = this.physics.add.image(x, bottomY, keyTop)
      .setOrigin(0.5, 0)
      .setDisplaySize(PIPE_W, bottomH)
      .setImmovable(true).setDepth(5);
    bottomPipe.body.setAllowGravity(false).setVelocityX(PROFILE.pipeSpeed);
    this.pipes.add(bottomPipe);

    // Capteur de score (rectangle invisible)
    const sensor = this.add.rectangle(x + PIPE_W/2 + 10, H/2, 10, H, 0x000000, 0);
    this.physics.add.existing(sensor, true);
    sensor.body.setVelocityX(PROFILE.pipeSpeed);

    this.physics.add.overlap(this.player, sensor, () => {
      if (!sensor.active) return;
      sensor.destroy();
      this.pipesPassed++;
      this.incrementScore();

      // Bonus toutes les 50 paires
      if (this.pipesPassed % 50 === 0) {
        this.spawnBonus(this.player.x + 520, Phaser.Math.Between(220, H - 260));
      }
    });
  }

  spawnBonus(x, y){
    if (!this.textures.exists('sb_token')) return; // bonus facultatif
    const b = this.physics.add.image(x, y, 'sb_token').setScale(0.55).setDepth(9).setImmovable(true);
    b.body.setAllowGravity(false).setVelocityX(PROFILE.pipeSpeed);
    this.physics.add.overlap(this.player, b, ()=>{
      if (!b.active) return;
      b.destroy();
      // woof aigu quand bonus pris
      this.sound.play('woof', { volume: 0.6, detune: 300 });
      this.incrementScore(5); // petit boost
      bumpQuest('bonus', 1);
    });
    this.time.delayedCall(12000, ()=> b.destroy());
  }

  incrementScore(n = 1){
    this.score += n;
    this.scoreText.setText('Score: ' + this.score);
    // "woof" à chaque passage
    this.sound.play('woof', { volume: 0.4 });

    // quêtes
    bumpQuest('pipes', 1);
    bumpQuest('score', n);
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

/* ------------------ UI helpers ------------------ */
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
    { id:'pipes',   title:'Passer 60 tuyaux',     target:60, progress:0, done:false },
    { id:'score',   title:'Atteindre 30 points',  target:30, progress:0, done:false },
    { id:'bonus',   title:'Prendre 1 bonus',      target:1,  progress:0, done:false }
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
    if (quest.id === kind && !quest.done){
      quest.progress = Math.min(quest.target, (quest.progress||0) + amount);
      if (quest.progress >= quest.target) quest.done = true;
      changed = true;
    }
  });
  if (changed) saveDailyQuests(q);
}
function saveBestScore(s){
  const k='fbv15_best'; const best = Number(localStorage.getItem(k)||0);
  if (s>best) localStorage.setItem(k, String(s));
}
function loadBestScore(){ return Number(localStorage.getItem('fbv15_best')||0); }

/* ------------------ Boot Phaser ------------------ */
window.addEventListener('load', () => {
  const config = {
    type: Phaser.AUTO,
    parent: 'game-root',
    backgroundColor: '#9edff1',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 768, height: 1366 },
    physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug:false } },
    scene: [PreloadScene, BootScene, MenuScene, GameScene, QuestScene]
  };
  new Phaser.Game(config);
});
