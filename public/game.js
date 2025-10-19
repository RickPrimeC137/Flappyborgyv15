// Jeu de type Flappy Bird - Personnage : Borgy le chien ailé
//
// Description : 
// Jeu où Borgy doit voler entre des paires de tuyaux sans les toucher.
// Les tuyaux apparaissent automatiquement à intervalles réguliers. 
// Chaque passage réussi augmente le score. 
// Le style des tuyaux (clair ou foncé) change toutes les 50 points. 
// Aucun son n'est intégré.

class SceneJeu extends Phaser.Scene {
    constructor() {
        super({ key: 'SceneJeu' });
    }

    preload() {
        // Chargement des images nécessaires (adapter les chemins selon l'emplacement des fichiers)
        this.load.image('borgy', 'assets/borgy.png');                       // sprite du chien ailé
        this.load.image('pipe_light_top', 'assets/pipe_light_top.png');     // tuyau clair (haut)
        this.load.image('pipe_light_bottom', 'assets/pipe_light_bottom.png'); // tuyau clair (bas)
        this.load.image('pipe_dark_top', 'assets/pipe_dark_top.png');       // tuyau foncé (haut)
        this.load.image('pipe_dark_bottom', 'assets/pipe_dark_bottom.png'); // tuyau foncé (bas)
    }

    create() {
        // Initialisation des variables de jeu
        this.score = 0;
        this.jeuTermine = false;
        // Dimensions du jeu (pour usage pratique)
        this.largeurJeu = this.game.config.width;
        this.hauteurJeu = this.game.config.height;

        // Création du personnage Borgy avec physique et gravité
        this.borgy = this.physics.add.sprite(100, this.hauteurJeu / 2, 'borgy');
        this.borgy.body.gravity.y = 800;          // gravité appliquée à Borgy (le fait tomber)
        this.borgy.setCollideWorldBounds(false);  // pas de collision automatique avec les bords (gestion manuelle du game over)

        // Groupes de tuyaux (haut et bas) pour collisions et scoring
        this.groupeTuyauxHaut = this.physics.add.group();
        this.groupeTuyauxBas = this.physics.add.group();

        // Génération des tuyaux à intervalle régulier (toutes les 1.5 secondes)
        this.minuteurTuyaux = this.time.addEvent({
            delay: 1500,
            callback: this.spawnPipe,
            callbackScope: this,
            loop: true
        });

        // Affichage du score à l'écran
        this.texteScore = this.add.text(20, 20, 'Score : 0', {
            fontSize: '32px',
            fill: '#000'
        });

        // Contrôles : clic ou appui sur Espace pour faire sauter Borgy
        this.input.on('pointerdown', this.sauter, this);
        this.input.keyboard.on('keydown-SPACE', this.sauter, this);

        // Détection des collisions entre Borgy et les tuyaux -> fin de jeu
        this.physics.add.overlap(this.borgy, this.groupeTuyauxHaut, this.collisionTuyau, null, this);
        this.physics.add.overlap(this.borgy, this.groupeTuyauxBas, this.collisionTuyau, null, this);
    }

    // Création d'une paire de tuyaux
    spawnPipe() {
        // Choix du style de tuyaux en fonction du score (alterne toutes les 50 points)
        let prefix = (Math.floor(this.score / 50) % 2 === 0) ? 'pipe_light' : 'pipe_dark';
        let topKey = prefix + '_top';
        let bottomKey = prefix + '_bottom';

        // Position verticale aléatoire pour le gap entre les deux tuyaux
        const gapHeight = 150;                         // taille de l'espace entre les tuyaux
        const minGapY = 50;                            // position minimale du début du gap (depuis le haut)
        const maxGapY = this.hauteurJeu - gapHeight - 50; // position maximale du début du gap (depuis le haut)
        let gapY = Phaser.Math.Between(minGapY, maxGapY);

        // Création des deux tuyaux (haut et bas)
        let pipeX = this.largeurJeu + 50;  // position X de génération (juste à droite de l'écran)
        let tuyauHaut = this.physics.add.sprite(pipeX, gapY, topKey).setOrigin(0, 1);
        let tuyauBas = this.physics.add.sprite(pipeX, gapY + gapHeight, bottomKey).setOrigin(0, 0);

        // Configuration des tuyaux (vitesse horizontale et désactivation de la gravité)
        tuyauHaut.body.velocity.x = -200;
        tuyauBas.body.velocity.x = -200;
        tuyauHaut.body.allowGravity = false;
        tuyauBas.body.allowGravity = false;
        tuyauHaut.body.immovable = true;
        tuyauBas.body.immovable = true;

        // Marqueur de score (le joueur n'a pas encore passé ces tuyaux)
        tuyauHaut.pointCompte = false;
        // Référence au tuyau du bas pour destruction groupée
        tuyauHaut.tuyauBasAssocie = tuyauBas;

        // Ajout des tuyaux aux groupes de gestion
        this.groupeTuyauxHaut.add(tuyauHaut);
        this.groupeTuyauxBas.add(tuyauBas);
    }

    // Fait sauter Borgy (appelé à chaque clic ou appui sur Espace)
    sauter() {
        if (this.jeuTermine) {
            return; // désactive le saut si la partie est terminée
        }
        // Impulsion vers le haut (vitesse négative en Y)
        this.borgy.setVelocityY(-350);
    }

    // Gère la collision entre Borgy et un tuyau
    collisionTuyau() {
        this.finDeJeu();
    }

    // Gère la fin de la partie (Game Over)
    finDeJeu() {
        if (this.jeuTermine) {
            return;
        }
        this.jeuTermine = true;

        // Arrêt de la génération de tuyaux
        if (this.minuteurTuyaux) {
            this.time.removeEvent(this.minuteurTuyaux);
            this.minuteurTuyaux = undefined;
        }

        // Mise en pause de la physique (arrête le déplacement de tous les objets)
        this.physics.pause();

        // Effet visuel sur Borgy pour indiquer la collision (teinte en rouge)
        this.borgy.setTint(0xff0000);

        // Affichage du texte de fin de partie et des instructions pour rejouer
        this.add.text(this.largeurJeu / 2, this.hauteurJeu / 2 - 20, 'Fin de partie', {
            fontSize: '48px',
            fill: '#000'
        }).setOrigin(0.5);
        this.add.text(this.largeurJeu / 2, this.hauteurJeu / 2 + 40, 'Cliquez ou appuyez sur Espace pour recommencer', {
            fontSize: '24px',
            fill: '#000'
        }).setOrigin(0.5);

        // Clic ou appui sur Espace pour redémarrer le jeu
        this.input.once('pointerdown', () => {
            this.scene.restart();
        }, this);
        this.input.keyboard.once('keydown-SPACE', () => {
            this.scene.restart();
        }, this);
    }

    update() {
        if (this.jeuTermine) {
            return;  // ne rien faire si la partie est terminée
        }

        // Fin de jeu si Borgy sort de l'écran par le haut ou le bas
        if (this.borgy.y < 0 || this.borgy.y > this.hauteurJeu) {
            this.finDeJeu();
        }

        // Mise à jour des tuyaux (gestion du score et suppression des anciens)
        this.groupeTuyauxHaut.getChildren().forEach(tuyauHaut => {
            // Incrémente le score une fois que Borgy a dépassé la paire de tuyaux
            if (!tuyauHaut.pointCompte && tuyauHaut.x + tuyauHaut.width < this.borgy.x) {
                tuyauHaut.pointCompte = true;
                this.score += 1;
                this.texteScore.setText('Score : ' + this.score);
            }
            // Supprime les tuyaux une fois qu'ils sont complètement sortis de l'écran
            if (tuyauHaut.x + tuyauHaut.width < 0) {
                tuyauHaut.tuyauBasAssocie.destroy();
                tuyauHaut.destroy();
            }
        });
    }
}

// Configuration du jeu Phaser
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 }, // gravité globale à 0 (on applique la gravité individuellement sur Borgy)
            debug: false
        }
    },
    scene: SceneJeu
};

// Initialisation du jeu avec la configuration ci-dessus
const game = new Phaser.Game(config);
