import Phaser from "phaser";
import type { BaseEntityData } from "@data/types/Entity";
import { BaseEntity } from "./BaseEntity";

export class NPC extends BaseEntity {
  private dialogueTreeId: string;
  private interactionRadius: number = 48;
  private interactionIndicator: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, data: BaseEntityData, dialogueTreeId: string) {
    super(scene, data);
    this.dialogueTreeId = dialogueTreeId;

    this.nameText.setStyle({
      color: "#ffdd44",
      fontFamily: "'Press Start 2P'",
      fontSize: "7px",
      stroke: "#000000",
      strokeThickness: 2,
    });

    this.interactionIndicator = scene.add.text(
      this.sprite.x,
      this.sprite.y - 36,
      "[E]",
      {
        fontFamily: "'Press Start 2P'",
        fontSize: "8px",
        color: "#ffdd44",
        stroke: "#000000",
        strokeThickness: 3,
      }
    );
    this.interactionIndicator.setOrigin(0.5, 1);
    this.interactionIndicator.setDepth(12);
    this.interactionIndicator.setVisible(false);
  }

  isPlayerInRange(playerX: number, playerY: number): boolean {
    const dx = this.sprite.x - playerX;
    const dy = this.sprite.y - playerY;
    return Math.sqrt(dx * dx + dy * dy) <= this.interactionRadius;
  }

  showInteractionPrompt(visible: boolean): void {
    this.interactionIndicator.setVisible(visible);

    if (visible) {
      const bounce = Math.sin(Date.now() * 0.005) * 3;
      this.interactionIndicator.setPosition(this.sprite.x, this.sprite.y - 36 + bounce);
    }
  }

  getDialogueTreeId(): string {
    return this.dialogueTreeId;
  }

  update(_delta: number): void {
    this.nameText.setPosition(this.sprite.x, this.sprite.y - 24);
  }

  destroy(): void {
    this.interactionIndicator.destroy();
    super.destroy();
  }
}
