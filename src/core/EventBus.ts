import Phaser from "phaser";

export enum GameEvents {
  COMBAT_START = "combat:start",
  COMBAT_END = "combat:end",
  COMBAT_TURN = "combat:turn",
  COMBAT_ACTION = "combat:action",
  PLAYER_LEVEL_UP = "player:levelUp",
  PLAYER_DIED = "player:died",
  PLAYER_HEALED = "player:healed",
  XP_GAINED = "player:xpGained",
  STATS_CHANGED = "player:statsChanged",
  MAP_TRANSITION = "map:transition",
  MAP_LOADED = "map:loaded",
  DIALOGUE_OPEN = "dialogue:open",
  DIALOGUE_CLOSE = "dialogue:close",
  DIALOGUE_ADVANCE = "dialogue:advance",
  DIALOGUE_ACTION = "dialogue:action",
  ENTITY_DIED = "entity:died",
  ENEMY_CONTACT = "enemy:contact",
  NPC_INTERACT = "npc:interact",
  INPUT_DISABLED = "input:disabled",
  INPUT_ENABLED = "input:enabled",
  PLAYER_ACTION_PRIMARY = "player:actionPrimary",
  PLAYER_ACTION_SKILL1 = "player:actionSkill1",
  PLAYER_ACTION_SKILL2 = "player:actionSkill2",
  ENEMY_ACTION_ATTACK = "enemy:actionAttack",
  INVENTORY_UPDATED = "inventory:updated",
  INVENTORY_USE_ITEM = "inventory:useItem",
  QUEST_LOG_UPDATED = "quest:logUpdated",
}

class EventBus extends Phaser.Events.EventEmitter {
  private static instance: EventBus;

  private constructor() {
    super();
  }

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  emitEvent(event: GameEvents, ...args: unknown[]): void {
    this.emit(event, ...args);
  }

  onEvent(event: GameEvents, callback: (...args: unknown[]) => void, context?: unknown): void {
    this.on(event, callback, context);
  }

  offEvent(event: GameEvents, callback: (...args: unknown[]) => void, context?: unknown): void {
    this.off(event, callback, context);
  }
}

export const eventBus = EventBus.getInstance();
