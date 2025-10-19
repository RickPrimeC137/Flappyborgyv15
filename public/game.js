// FlappyBorgy game.js - Code principal
// Contient le menu, le système de quêtes et le jeu sans audio

// Variables globales
let lastScore = 0;
let quests = [
    { description: "Atteindre un score de 10", type: 'score', target: 10, completed: false },
    { description: "Survivre 15 secondes", type: 'time', target: 15, completed: false },
    { description: "Atteindre un score de 20", type: 'score', target: 20, completed: false }
];

// Scène du menu principal
class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'Menu' });
    }
    preload() {
        // Chargement des assets du jeu
        this.load.image('bird', 'assets/bird.png');
        this.load.image('pipe', 'assets/pipe.png');
        this.load.image('ground', 'assets/ground.png');
        // Chargement des images de boutons (si disponibles)
        this.load.image('playButton', 'assets/play.png');
        this.load.image('questsButton', 'assets/quests.png');
    }
    create(data) {
        // Affichage du dernier score dans le menu
        if (data && data.score !== undefined) {
            lastScore = data.score;
        }
        let scoreText = "Score : " + lastScore;
        this.menuScoreText = this.add.text(this.scale.width/2, 50, scoreText,
            { font: "32px Arial", fill: "#000" }
        ).setOrigin(0.5, 0.5);
        // Bouton "Jouer"
        let playX = this.scale.width / 2;
        let playY = this.scale.height * 0.45;
        if (this.textures.exists('playButton')) {
            this.playButton = this.add.image(playX, playY, 'playButton').setOrigin(0.5, 0.5);
        } else {
            this.playButton = this.add.text(playX, playY, "Jouer",
                { font: "28px Arial", fill: "#000", backgroundColor: "#fff" }
            ).setOrigin(0.5, 0.5).setPadding(10);
        }
        this.playButton.setInteractive();
        this.playButton.on('pointerdown', () => {
            this.scene.start('Game');
        });
        // Bouton "Quêtes"
        let questsX = this.scale.width / 2;
        let questsY = this.scale.height * 0.55;
        if (this.textures.exists('questsButton')) {
            this.questsButton = this.add.image(questsX, questsY, 'questsButton').setOrigin(0.5, 0.5);
        } else {
            this.questsButton = this.add.text(questsX, questsY, "Quêtes",
                { font: "28px Arial", fill: "#000", backgroundColor: "#fff" }
            ).setOrigin(0.5, 0.5).setPadding(10);
        }
        this.questsButton.setInteractive();
        this.questsButton.on('pointerdown', () => {
            this.scene.start('Quests');
        });
        // (Pas de bouton Son, fonctionnalité supprimée)
    }
}

// Scène de jeu (FlappyBorgy)
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'Game' });
    }
    create() {
        // Initialisation du score
        this.score = 0;
        this.scoreText = this.add.text(20, 20, "Score : 0",
            { font: "20px Arial", fill: "#fff", stroke: "#000", strokeThickness: 3 }
        );
        // Ajout du sol (statique) en bas de l'écran pour les collisions
        this.ground = this.physics.add.staticImage(this.scale.width/2, this.scale.height, 'ground')
            .setOrigin(0.5, 1);
        this.ground.refreshBody();
        // Création de l'oiseau (joueur)
        this.bird = this.physics.add.sprite(100, this.scale.height/2, 'bird');
        this.bird.body.setGravityY(1000);  // gravité appliquée au joueur
        // Réduction optionnelle de la zone de collision du bird
        this.bird.body.setSize(this.bird.width - 4, this.bird.height - 4);
        // Empêche le joueur de sortir par le bas et le haut (monde)
        this.bird.setCollideWorldBounds(true);
        // Groupe pour les tuyaux
        this.pipes = this.physics.add.group();
        // Paramètres de génération des tuyaux
        this.pipeSpeed = 200;
        this.pipeInterval = 1500;
        this.gapHeight = 120;
        // Limites verticales pour le centre de la trouée (espace entre tuyaux)
        let groundHeight = this.ground.displayHeight;
        this.minGapY = 130;
        this.maxGapY = this.scale.height - groundHeight - 20 - this.gapHeight/2;
        this.lastGapY = 300;  // position de la dernière trouée générée
        this.pipeDirection = -50;  // direction initiale du déplacement vertical (vers le haut)
        this.pipeColorToggle = false;  // alternance clair/foncé initiale
        // Timer de génération continue des paires de tuyaux
        this.pipeTimer = this.time.addEvent({
            delay: this.pipeInterval,
            callback: this.spawnPipe,
            callbackScope: this,
            loop: true
        });
        // Enregistrement du temps de début (pour les quêtes de survie)
        this.startTime = Date.now();
        // Contrôles: clic/souris ou barre d'espace pour faire sauter l'oiseau
        this.input.on('pointerdown', this.flap, this);
        this.input.keyboard.on('keydown-SPACE', this.flap, this);
        // Vérification des collisions (oiseau avec tuyaux ou sol)
        this.physics.add.overlap(this.bird, this.pipes, this.endGame, null, this);
        this.physics.add.overlap(this.bird, this.ground, this.endGame, null, this);
        // Indicateur de fin de partie pour éviter les répétitions
        this.gameOverFlag = false;
    }
    update() {
        // Effet de rotation de l'oiseau selon sa vitesse verticale
        if (this.bird.body.velocity.y > 0 && this.bird.angle < 90) {
            this.bird.angle += 2;
        }
        if (this.bird.body.velocity.y < 0 && this.bird.angle > -30) {
            this.bird.angle = -30;
        }
        // Empêche l'oiseau de sortir de l'écran par le haut
        if (this.bird.y < 0) {
            this.bird.y = 0;
            this.bird.body.velocity.y = 0;
        }
        // Mise à jour du score quand un tuyau est passé
        this.pipes.getChildren().forEach(pipe => {
            if (!pipe.scored && pipe.x + pipe.displayWidth/2 < this.bird.x - this.bird.displayWidth/2) {
                pipe.scored = true;
                this.score += 1;
                this.scoreText.setText("Score : " + this.score);
            }
        });
    }
    // Fait sauter (voler) l'oiseau
    flap() {
        if (!this.gameOverFlag) {
            this.bird.body.velocity.y = -350;
            this.bird.angle = -30;
        }
    }
    // Génère une nouvelle paire de tuyaux (haut et bas)
    spawnPipe() {
        // Ajuste la direction de la trouée si les limites sont atteintes
        if (this.lastGapY <= this.minGapY) {
            this.pipeDirection = 50;
        } else if (this.lastGapY >= this.maxGapY) {
            this.pipeDirection = -50;
        }
        // Nouvelle position verticale du centre de la trouée
        this.lastGapY += this.pipeDirection;
        let gapY = this.lastGapY;
        // Détermine la couleur du tuyau (alternance clair/foncé)
        let pipeTint = 0xFFFFFF;
        if (this.pipeColorToggle) {
            pipeTint = 0x888888;
        }
        this.pipeColorToggle = !this.pipeColorToggle;
        // Position de départ à droite du jeu
        let pipeX = this.scale.width + 40;
        // Position verticale des tuyaux bas et haut
        let bottomY = gapY + this.gapHeight/2;
        let topY = gapY - this.gapHeight/2;
        // Création du tuyau du bas
        let pipeBottom = this.physics.add.sprite(pipeX, bottomY, 'pipe');
        pipeBottom.body.allowGravity = false;
        pipeBottom.body.immovable = true;
        pipeBottom.setVelocityX(-this.pipeSpeed);
        pipeBottom.setTint(pipeTint);
        pipeBottom.scored = false;  // utilisera le tuyau du bas pour le score
        this.pipes.add(pipeBottom);
        // Création du tuyau du haut (retourné)
        let pipeTop = this.physics.add.sprite(pipeX, topY, 'pipe');
        pipeTop.body.allowGravity = false;
        pipeTop.body.immovable = true;
        pipeTop.setVelocityX(-this.pipeSpeed);
        pipeTop.setTint(pipeTint);
        pipeTop.setFlipY(true);
        pipeTop.scored = true;  // pour ignorer ce tuyau dans le comptage de score
        this.pipes.add(pipeTop);
    }
    // Gère la fin de la partie
    endGame() {
        if (this.gameOverFlag) return;
        this.gameOverFlag = true;
        // Arrête la génération de tuyaux
        this.pipeTimer.remove(false);
        // Désactive les contrôles
        this.input.off('pointerdown', this.flap, this);
        this.input.keyboard.off('keydown-SPACE', this.flap, this);
        // Durée de survie du joueur en secondes
        let survivedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
        // Mise à jour des quêtes selon la performance du joueur
        quests.forEach(q => {
            if (!q.completed) {
                if (q.type === 'score' && this.score >= q.target) {
                    q.completed = true;
                }
                if (q.type === 'time' && survivedSeconds >= q.target) {
                    q.completed = true;
                }
            }
        });
        // Retour au menu principal en passant le score actuel
        this.scene.start('Menu', { score: this.score });
    }
}

// Scène d'affichage des quêtes journalières
class QuestsScene extends Phaser.Scene {
    constructor() {
        super({ key: 'Quests' });
    }
    create() {
        // Titre des quêtes
        this.add.text(this.scale.width/2, 60, "Quêtes journalières",
            { font: "26px Arial", fill: "#000" }
        ).setOrigin(0.5, 0.5);
        // Liste des quêtes et statut
        let startY = 120;
        quests.forEach((q, i) => {
            let status = q.completed ? " \u2713" : "";
            let text = (i+1) + ". " + q.description + status;
            this.add.text(50, startY + i * 40, text, { font: "22px Arial", fill: "#000" });
        });
        // Bouton de retour au menu
        this.backText = this.add.text(20, 20, "< Retour", { font: "20px Arial", fill: "#000" });
        this.backText.setInteractive();
        this.backText.on('pointerdown', () => {
            this.scene.start('Menu');
        });
    }
}

// Configuration du jeu Phaser
const config = {
    type: Phaser.AUTO,
    width: 400,
    height: 600,
    backgroundColor: "#87CEEB",
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false }
    },
    scene: [MenuScene, GameScene, QuestsScene]
};
// Création du jeu
const game = new Phaser.Game(config);
