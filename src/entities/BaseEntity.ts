import Phaser from "phaser";
import type { BaseEntityData, Position } from "@data/types/Entity";

export abstract class BaseEntity {
  protected sprite: Phaser.GameObjects.Sprite;
  protected data: BaseEntityData;
  protected scene: Phaser.Scene;
  protected nameText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, data: BaseEntityData) {
    this.scene = scene;
    this.data = data;

    this.sprite = scene.add.sprite(
      data.position.x * 32 + 16,
      data.position.y * 32 + 16,
      data.spriteKey
    );
    this.sprite.setDepth(10);
    this.sprite.setData("entityId", data.id);
    this.sprite.setData("entityType", data.type);

    this.nameText = scene.add.text(
      this.sprite.x,
      this.sprite.y - 24,
      data.name,
      {
        fontFamily: "'Press Start 2P'",
        fontSize: "7px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 2,
        align: "center",
      }
    );
    this.nameText.setOrigin(0.5, 1);
    this.nameText.setDepth(11);
  }

  getData(): BaseEntityData {
    return this.data;
  }

  getSprite(): Phaser.GameObjects.Sprite {
    return this.sprite;
  }

  getPosition(): Position {
    return this.data.position;
  }

  setPosition(x: number, y: number): void {
    this.data.position.x = x;
    this.data.position.y = y;
    this.sprite.setPosition(x * 32 + 16, y * 32 + 16);
    this.nameText.setPosition(this.sprite.x, this.sprite.y - 24);
  }

  updateSpritePosition(): void {
    this.sprite.setPosition(
      this.data.position.x * 32 + 16,
      this.data.position.y * 32 + 16
    );
    this.nameText.setPosition(this.sprite.x, this.sprite.y - 24);
  }

  isAlive(): boolean {
    return this.data.stats.hp > 0;
  }

  destroy(): void {
    this.sprite.destroy();
    this.nameText.destroy();
  }

  abstract update(delta: number): void;
}
