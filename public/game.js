const W = 768, H = 1366;
const PROFILE = { gravity: 1400, jump: 380, pipeSpeed: -220, gap: 230 };
const INGAME_BORGY_KEY = 'borgy_ingame';
const PIPE_STYLES = ['graphite','hexghost','mintglass','neonedge','porcelain','brushed','dualband','frosted'];

let scene, player, pipes, caps, styleIdx = 0;

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: W, height: H,
  backgroundColor: '#8dd0e1',
  physics: { default: 'arcade', arcade: { debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }
};

new Phaser.Game(Object.assign(config, { scene: { preload, create, update } }));

function preload() {
  this.load.image(INGAME_BORGY_KEY, 'assets/borgy_ingame.png?v=2');
  this.load.image('tokenSB', 'assets/sb_token_user.png');
  PIPE_STYLES.forEach(s => {
    this.load.image(`pipe_${s}`, `assets/pipe_v2_${s}.png`);
    this.load.image(`cap_${s}`,  `assets/cap_v2_${s}.png`);
  });
}

function create() {
  scene = this;
  player = this.physics.add.image(W*0.28, H*0.5, INGAME_BORGY_KEY).setOrigin(0.5, 0.5).setScale(0.42);
  player.body.setGravityY(PROFILE.gravity);
  player.setDepth(50);

  pipes = this.physics.add.group({ immovable: true, allowGravity: false });
  caps  = this.add.group();

  this.time.addEvent({ delay: 1200, loop: true, callback: () => spawnPipePair(this) });

  this.input.on('pointerdown', () => { player.setVelocityY(-PROFILE.jump); });
}

function spawnPipePair(s) {
  const gap = PROFILE.gap;
  const minTop = 80;
  const maxTop = H - gap - 160;
  const topY = Phaser.Math.Between(minTop, maxTop);

  const style = PIPE_STYLES[styleIdx++ % PIPE_STYLES.length];
  const pipeKey = `pipe_${style}`;
  const capKey  = `cap_${style}`;

  const x = W + 80;
  const speed = PROFILE.pipeSpeed;

  const top = s.physics.add.image(x, topY, pipeKey).setOrigin(0.5, 1).setDepth(20).setVelocityX(speed);
  top.body.allowGravity = false;

  const bot = s.physics.add.image(x, topY + gap, pipeKey).setOrigin(0.5, 0).setFlipY(true).setDepth(20).setVelocityX(speed);
  bot.body.allowGravity = false;

  pipes.addMultiple([top, bot]);

  const capTop = s.add.image(x, topY, capKey).setOrigin(0.5, 1).setDepth(21);
  const capBot = s.add.image(x, topY + gap, capKey).setOrigin(0.5, 0).setFlipY(true).setDepth(21);
  const duration = ((W + 160) / Math.abs(speed)) * 1000;
  s.tweens.add({ targets: [capTop, capBot], x: -120, duration, ease: 'Linear', onComplete: () => { capTop.destroy(); capBot.destroy(); } });

  top.setData('cleanup', true);
  bot.setData('cleanup', true);
}

function update() {
  pipes.children.iterate(p => { if (p && p.x < -80) p.destroy(); });
}
