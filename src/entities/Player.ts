import Phaser from "phaser";
import type { BaseEntityData } from "@data/types/Entity";
import type { MapManager } from "@core/MapManager";
import type { InputState } from "@core/InputManager";
import { BaseEntity } from "./BaseEntity";
import { eventBus, GameEvents } from "@core/EventBus";

export class Player extends BaseEntity {
  private baseSpeed: number = 120;
  private mapManager: MapManager;
  private body: Phaser.Physics.Arcade.Body | null = null;
  private lastDirection: string = "down";
  private isMoving: boolean = false;

  private primaryCooldown: number = 0;
  private primaryCooldownMax: number = 600; // ms
  private skill1Cooldown: number = 0;
  private skill2Cooldown: number = 0;

  private attackHaltTimer: number = 0;
  private attackHaltDuration: number = 250; // slowdown duration on attack

  constructor(scene: Phaser.Scene, data: BaseEntityData, mapManager: MapManager) {
    super(scene, data);
    this.mapManager = mapManager;

    scene.physics.add.existing(this.sprite);
    this.body = this.sprite.body as Phaser.Physics.Arcade.Body;
    if (this.body) {
      this.body.setSize(24, 24);
      this.body.setOffset(4, 8);
      this.body.setCollideWorldBounds(true);
      this.body.pushable = false;
    }

    this.nameText.setStyle({
      color: "#00ff88",
      fontFamily: "'Press Start 2P'",
      fontSize: "7px",
      stroke: "#000000",
      strokeThickness: 2,
    });
  }

  handleInput(inputState: InputState): void {
    if (!this.body) return;

    if (inputState.attackPrimary && this.primaryCooldown <= 0) {
      this.primaryCooldown = this.primaryCooldownMax;
      this.attackHaltTimer = this.attackHaltDuration;
      eventBus.emitEvent(GameEvents.PLAYER_ACTION_PRIMARY, {
        targetX: inputState.pointerWorldX,
        targetY: inputState.pointerWorldY
      });
    }

    if (inputState.skill1 && this.skill1Cooldown <= 0) {
      this.skill1Cooldown = 3000;
      this.attackHaltTimer = this.attackHaltDuration;
      eventBus.emitEvent(GameEvents.PLAYER_ACTION_SKILL1, {
        targetX: inputState.pointerWorldX,
        targetY: inputState.pointerWorldY
      });
    }

    if (inputState.skill2 && this.skill2Cooldown <= 0) {
      this.skill2Cooldown = 5000;
      this.attackHaltTimer = this.attackHaltDuration;
      eventBus.emitEvent(GameEvents.PLAYER_ACTION_SKILL2, {
        targetX: inputState.pointerWorldX,
        targetY: inputState.pointerWorldY
      });
    }

    let vx = 0;
    let vy = 0;
    this.isMoving = false;

    // Movement speed halved during attack
    const speed = this.attackHaltTimer > 0 ? this.baseSpeed * 0.1 : this.baseSpeed;

    if (inputState.up) {
      vy = -speed;
      this.lastDirection = "up";
      this.isMoving = true;
    } else if (inputState.down) {
      vy = speed;
      this.lastDirection = "down";
      this.isMoving = true;
    }

    if (inputState.left) {
      vx = -speed;
      this.lastDirection = "left";
      this.isMoving = true;
    } else if (inputState.right) {
      vx = speed;
      this.lastDirection = "right";
      this.isMoving = true;
    }

    if (vx !== 0 && vy !== 0) {
      const diag = Math.SQRT1_2;
      vx *= diag;
      vy *= diag;
    }

    const nextPixelX = this.sprite.x + vx * (1 / 60);
    const nextPixelY = this.sprite.y + vy * (1 / 60);
    const nextTileX = Math.floor(nextPixelX / 32);
    const nextTileY = Math.floor(nextPixelY / 32);

    if (vx !== 0 && this.mapManager.getCollisionAt(Math.floor((this.sprite.x + vx * (1 / 60) + (vx > 0 ? 12 : -12)) / 32), Math.floor(this.sprite.y / 32))) {
      vx = 0;
    }
    if (vy !== 0 && this.mapManager.getCollisionAt(Math.floor(this.sprite.x / 32), Math.floor((this.sprite.y + vy * (1 / 60) + (vy > 0 ? 12 : -12)) / 32))) {
      vy = 0;
    }

    this.body.setVelocity(vx, vy);

    this.data.position.x = nextTileX;
    this.data.position.y = nextTileY;
    this.nameText.setPosition(this.sprite.x, this.sprite.y - 24);

    this.updateAnimation();
  }

  forceStopMovement(): void {
    if (!this.body) return;
    this.body.setVelocity(0, 0);
    this.isMoving = false;
    this.updateAnimation();
  }

  private updateAnimation(): void {
    const animKey = this.isMoving ? `player_walk_${this.lastDirection}` : `player_idle_${this.lastDirection}`;

    if (this.sprite.anims.currentAnim?.key !== animKey && this.scene.anims.exists(animKey)) {
      this.sprite.play(animKey);
    }

    // Only tint during attack, otherwise keep natural colors
    if (this.attackHaltTimer > 0) {
      this.sprite.setTint(0xffcccc);
    } else {
      this.sprite.clearTint();
    }
  }

  stopMovement(): void {
    if (this.body) {
      this.body.setVelocity(0, 0);
      this.isMoving = false;
      this.updateAnimation();
    }
  }

  getTilePosition(): { x: number; y: number } {
    return {
      x: Math.floor(this.sprite.x / 32),
      y: Math.floor(this.sprite.y / 32),
    };
  }

  getPixelPosition(): { x: number; y: number } {
    return { x: this.sprite.x, y: this.sprite.y };
  }

  getLastDirection(): string {
    return this.lastDirection;
  }

  getCooldowns() {
    return {
      primary: this.primaryCooldown,
      primaryMax: this.primaryCooldownMax,
      skill1: this.skill1Cooldown,
      skill1Max: 3000,
      skill2: this.skill2Cooldown,
      skill2Max: 5000
    };
  }

  update(delta: number): void {
    if (this.primaryCooldown > 0) this.primaryCooldown -= delta;
    if (this.skill1Cooldown > 0) this.skill1Cooldown -= delta;
    if (this.skill2Cooldown > 0) this.skill2Cooldown -= delta;
    if (this.attackHaltTimer > 0) this.attackHaltTimer -= delta;

    this.nameText.setPosition(this.sprite.x, this.sprite.y - 24);
  }
}
