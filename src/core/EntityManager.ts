import type { BaseEntityData, EntityStats } from "@data/types/Entity";
import type { ClassDefinition, PlayerState, StatGrowth } from "@data/types/ClassDefinition";
import { eventBus, GameEvents } from "./EventBus";
import classesData from "@data/definitions/classes.json";

export class EntityManager {
  private entities: Map<string, BaseEntityData> = new Map();
  private playerState: PlayerState | null = null;
  private classDefinitions: Record<string, ClassDefinition>;

  constructor() {
    this.classDefinitions = classesData as unknown as Record<string, ClassDefinition>;
  }

  createPlayer(id: string, name: string, classId: string, position: { x: number; y: number }): BaseEntityData {
    const classDef = this.classDefinitions[classId];
    if (!classDef) throw new Error(`Unknown class: ${classId}`);

    const entity: BaseEntityData = {
      id,
      name,
      type: "player" as BaseEntityData["type"],
      stats: { ...classDef.baseStats },
      level: 1,
      position: { ...position },
      spriteKey: `player_${classId}`,
    };

    this.playerState = {
      classId: classDef.id,
      xp: 0,
      xpToNextLevel: 100,
      skillPoints: 0,
      equippedSkillIds: [...classDef.startingSkillIds],
      unlockedSkillIds: [...classDef.startingSkillIds],
    };

    this.entities.set(id, entity);
    return entity;
  }

  createEnemy(id: string, templateId: string, position: { x: number; y: number }, enemyTemplates: Record<string, unknown>): BaseEntityData {
    const template = enemyTemplates[templateId] as {
      name: string;
      level: number;
      stats: EntityStats;
      spriteKey: string;
    };
    if (!template) throw new Error(`Unknown enemy template: ${templateId}`);

    const entity: BaseEntityData = {
      id,
      name: template.name,
      type: "enemy" as BaseEntityData["type"],
      stats: { ...template.stats },
      level: template.level,
      position: { ...position },
      spriteKey: template.spriteKey,
    };

    this.entities.set(id, entity);
    return entity;
  }

  getEntity(id: string): BaseEntityData | undefined {
    return this.entities.get(id);
  }

  getPlayer(): BaseEntityData | undefined {
    for (const entity of this.entities.values()) {
      if (entity.type === "player") return entity;
    }
    return undefined;
  }

  getPlayerState(): PlayerState | null {
    return this.playerState;
  }

  removeEntity(id: string): void {
    this.entities.delete(id);
  }

  getAllEnemies(): BaseEntityData[] {
    return Array.from(this.entities.values()).filter((e) => e.type === "enemy");
  }

  addXp(amount: number): void {
    if (!this.playerState) return;
    const player = this.getPlayer();
    if (!player) return;

    this.playerState.xp += amount;
    eventBus.emitEvent(GameEvents.XP_GAINED, amount, this.playerState.xp);

    while (this.playerState.xp >= this.playerState.xpToNextLevel) {
      this.playerState.xp -= this.playerState.xpToNextLevel;
      this.levelUp(player);
    }
  }

  private levelUp(player: BaseEntityData): void {
    if (!this.playerState) return;

    player.level += 1;
    const classDef = this.classDefinitions[this.playerState.classId];
    const growth: StatGrowth = classDef.statGrowth;

    player.stats.maxHp += Math.floor(growth.hp);
    player.stats.hp = player.stats.maxHp;
    player.stats.maxMana += Math.floor(growth.mana);
    player.stats.mana = player.stats.maxMana;
    player.stats.strength += Math.floor(growth.strength * 10) / 10;
    player.stats.agility += Math.floor(growth.agility * 10) / 10;
    player.stats.intelligence += Math.floor(growth.intelligence * 10) / 10;
    player.stats.armor += Math.floor(growth.armor * 10) / 10;
    player.stats.magicResist += Math.floor(growth.magicResist * 10) / 10;

    this.playerState.skillPoints += 1;
    this.playerState.xpToNextLevel = Math.floor(this.playerState.xpToNextLevel * 1.5);

    eventBus.emitEvent(GameEvents.PLAYER_LEVEL_UP, player.level);
    eventBus.emitEvent(GameEvents.STATS_CHANGED, player.stats);
  }

  applyDamage(entityId: string, damage: number): number {
    const entity = this.entities.get(entityId);
    if (!entity) return 0;

    const actualDamage = Math.max(0, Math.floor(damage));
    entity.stats.hp = Math.max(0, entity.stats.hp - actualDamage);

    if (entity.stats.hp <= 0) {
      eventBus.emitEvent(GameEvents.ENTITY_DIED, entity);
    }

    return actualDamage;
  }

  healEntity(entityId: string, amount: number): void {
    const entity = this.entities.get(entityId);
    if (!entity) return;

    entity.stats.hp = Math.min(entity.stats.maxHp, entity.stats.hp + Math.floor(amount));
    entity.stats.mana = Math.min(entity.stats.maxMana, entity.stats.mana + Math.floor(amount * 0.5));
  }

  getClassDefinition(classId: string): ClassDefinition | undefined {
    return this.classDefinitions[classId];
  }
}
