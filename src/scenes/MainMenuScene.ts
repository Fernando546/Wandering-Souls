import Phaser from "phaser";

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: "MainMenuScene" });
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Background Color
    this.cameras.main.setBackgroundColor("#0a0a1a");

    // Title
    const title = this.add.text(width / 2, height / 2 - 100, "WANDERING SOULS", {
      fontFamily: "'Press Start 2P'",
      fontSize: "32px",
      color: "#c8a852",
      stroke: "#2a1a0a",
      strokeThickness: 6,
    });
    title.setOrigin(0.5);

    // Menu Options
    const options = [
      { text: "Single Player", action: () => this.startGame() },
      { text: "Multiplayer (Coming Soon)", action: null, color: "#666666" },
      { text: "Settings", action: () => this.showNotImplemented("Settings") },
      { text: "Credits", action: () => this.showNotImplemented("Credits") },
    ];

    let startY = height / 2;
    const spacing = 40;

    options.forEach((opt, index) => {
      const btn = this.add.text(width / 2, startY + index * spacing, opt.text, {
        fontFamily: "'Press Start 2P'",
        fontSize: "14px",
        color: opt.color || "#cccccc",
        stroke: "#000000",
        strokeThickness: 3,
      });
      btn.setOrigin(0.5);

      if (opt.action) {
        btn.setInteractive({ useHandCursor: true });

        btn.on("pointerover", () => {
          btn.setColor("#ffffff");
          btn.setScale(1.1);
        });

        btn.on("pointerout", () => {
          btn.setColor(opt.color || "#cccccc");
          btn.setScale(1.0);
        });

        btn.on("pointerdown", opt.action);
      }
    });

    // Version text
    const version = this.add.text(width - 10, height - 10, "v0.1.0 Alpha", {
      fontFamily: "'Press Start 2P'",
      fontSize: "8px",
      color: "#555555"
    });
    version.setOrigin(1, 1);
  }

  private startGame(): void {
    // Fade out and transition
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("WorldScene", { mapId: "meadow", playerClass: "warrior" });
    });
  }

  private showNotImplemented(feature: string): void {
    const text = this.add.text(this.cameras.main.width / 2, this.cameras.main.height - 50, `${feature} not yet implemented.`, {
      fontFamily: "'Press Start 2P'",
      fontSize: "10px",
      color: "#ff8888"
    });
    text.setOrigin(0.5);

    this.tweens.add({
      targets: text,
      alpha: 0,
      y: text.y - 20,
      duration: 1500,
      ease: 'Power2',
      onComplete: () => text.destroy()
    });
  }
}
