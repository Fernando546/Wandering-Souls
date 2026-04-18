import Phaser from "phaser";
import { BootScene } from "@scenes/BootScene";
import { WorldScene } from "@scenes/WorldScene";
import { UIScene } from "@scenes/UIScene";
import { MainMenuScene } from "@scenes/MainMenuScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1024,
  height: 672,
  parent: "game-container",
  pixelArt: true,
  backgroundColor: "#0a0a1a",
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [BootScene, MainMenuScene, WorldScene, UIScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: false,
    roundPixels: true,
  },
};

new Phaser.Game(config);
