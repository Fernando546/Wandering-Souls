export enum EntityType {
  Player = "player",
  Enemy = "enemy",
  NPC = "npc",
}

export enum DamageType {
  Physical = "physical",
  Magical = "magical",
  True = "true",
}

export interface EntityStats {
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  strength: number;
  agility: number;
  intelligence: number;
  armor: number;
  magicResist: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface BaseEntityData {
  id: string;
  name: string;
  type: EntityType;
  stats: EntityStats;
  level: number;
  position: Position;
  spriteKey: string;
}
