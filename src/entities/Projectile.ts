import Phaser from "phaser";
export interface ProjectileData {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  damage: number;
  isEnemy: boolean;
  spriteKey: string;
  creatorId: string;
  lifespanMs: number;
}

export class Projectile {
  private sprite: Phaser.GameObjects.Sprite;
  private body: Phaser.Physics.Arcade.Body;
  private data: ProjectileData;
  private isDead: boolean = false;
  private timer: number = 0;

  constructor(scene: Phaser.Scene, data: ProjectileData) {
    this.data = data;
    this.sprite = scene.add.sprite(data.x, data.y, data.spriteKey);
    this.sprite.setDepth(15);
    
    scene.physics.add.existing(this.sprite);
    this.body = this.sprite.body as Phaser.Physics.Arcade.Body;
    this.body.setSize(12, 12);

    // Calculate velocity
    const dx = data.targetX - data.x;
    const dy = data.targetY - data.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0) {
      this.body.setVelocity((dx / dist) * data.speed, (dy / dist) * data.speed);
      this.sprite.setRotation(Math.atan2(dy, dx));
    }
  }

  update(delta: number): void {
    if (this.isDead) return;
    this.timer += delta;
    if (this.timer >= this.data.lifespanMs) {
      this.destroy();
    }
  }

  getData(): ProjectileData {
    return this.data;
  }

  getSprite(): Phaser.GameObjects.Sprite {
    return this.sprite;
  }

  destroy(): void {
    if (this.isDead) return;
    this.isDead = true;
    this.sprite.destroy();
  }
  
  getIsDead(): boolean {
    return this.isDead;
  }
}
