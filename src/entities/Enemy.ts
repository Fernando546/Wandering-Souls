import Phaser from "phaser";
import type { BaseEntityData } from "@data/types/Entity";
import type { MapManager } from "@core/MapManager";
import { BaseEntity } from "./BaseEntity";
import { eventBus, GameEvents } from "@core/EventBus";

export class Enemy extends BaseEntity {
  private originX: number;
  private originY: number;
  private speed: number = 40;
  private body: Phaser.Physics.Arcade.Body | null = null;
  private isDead: boolean = false;
  private respawnTimeMs: number = 10000;
  private respawnTimer: number = 0;

  // Real-time AI
  private aggroRadius: number = 200;
  private attackRadius: number = 40;
  private attackCooldown: number = 0;
  private attackCooldownMax: number = 1500;
  private isAttacking: boolean = false;
  private attackDuration: number = 400; // time stopped while attacking
  private attackDurationTimer: number = 0;

  private flashTimer: number = 0;

  constructor(scene: Phaser.Scene, data: BaseEntityData, _mapManager: MapManager, _patrolRadius: number) {
    super(scene, data);
    this.originX = data.position.x;
    this.originY = data.position.y;
    // We could use patrolRadius for roaming, but we'll focus on aggro for now.

    scene.physics.add.existing(this.sprite);
    this.body = this.sprite.body as Phaser.Physics.Arcade.Body;

    if (this.body) {
      this.body.setSize(24, 24);
      this.body.setOffset(4, 4);
      this.body.setImmovable(true);
    }

    this.nameText.setStyle({
      color: "#ff4444",
      fontFamily: "'Press Start 2P'",
      fontSize: "7px",
      stroke: "#000000",
      strokeThickness: 2,
    });
  }

  updateAI(delta: number, playerX: number, playerY: number, playerDead: boolean): void {
    if (this.isDead) {
      this.respawnTimer -= delta;
      if (this.respawnTimer <= 0) {
        this.respawn();
      }
      return;
    }

    if (this.flashTimer > 0) {
      this.flashTimer -= delta;
      if (this.flashTimer <= 0) {
        this.sprite.setTint(0xffffff);
      }
    }

    if (this.attackCooldown > 0) this.attackCooldown -= delta;
    if (this.attackDurationTimer > 0) {
      this.attackDurationTimer -= delta;
      if (this.attackDurationTimer <= 0) {
        this.isAttacking = false;
      }
    }

    if (!this.body) return;

    if (playerDead) {
      this.body.setVelocity(0, 0);
      return;
    }

    const dx = playerX - this.sprite.x;
    const dy = playerY - this.sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= this.attackRadius && this.attackCooldown <= 0 && !this.isAttacking) {
      // Attack!
      this.isAttacking = true;
      this.attackDurationTimer = this.attackDuration;
      this.attackCooldown = this.attackCooldownMax;
      this.body.setVelocity(0, 0);
      eventBus.emitEvent(GameEvents.ENEMY_ACTION_ATTACK, {
        enemyId: this.data.id,
        targetX: playerX,
        targetY: playerY
      });
    } else if (dist <= this.aggroRadius && !this.isAttacking) {
      // Chase
      this.body.setVelocity((dx / dist) * this.speed, (dy / dist) * this.speed);
    } else if (!this.isAttacking) {
      // Idle / Stop
      this.body.setVelocity(0, 0);
    }

    this.nameText.setPosition(this.sprite.x, this.sprite.y - 24);
  }

  takeDamage(amount: number): void {
    if (this.isDead) return;
    this.data.stats.hp -= amount;
    this.sprite.setTint(0xff0000);
    this.flashTimer = 200;

    if (this.data.stats.hp <= 0) {
      this.kill();
    }
  }

  kill(): void {
    this.isDead = true;
    this.sprite.setVisible(false);
    this.nameText.setVisible(false);
    if (this.body) {
      this.body.setEnable(false);
      this.body.setVelocity(0, 0);
    }
    this.respawnTimer = this.respawnTimeMs;
  }

  private respawn(): void {
    this.isDead = false;
    this.data.stats.hp = this.data.stats.maxHp;
    this.data.stats.mana = this.data.stats.maxMana;
    this.setPosition(this.originX, this.originY);
    this.sprite.setPosition(this.originX * 32 + 16, this.originY * 32 + 16);
    this.sprite.setVisible(true);
    this.nameText.setVisible(true);
    this.sprite.setTint(0xffffff);
    if (this.body) {
      this.body.setEnable(true);
    }
  }

  getIsDead(): boolean {
    return this.isDead;
  }

  getBody(): Phaser.Physics.Arcade.Body | null {
    return this.body;
  }

  // To interface with old implementation temporarily
  update(_delta: number): void {}
}
