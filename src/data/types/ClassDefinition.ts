import type { EntityStats } from "./Entity";

export enum PlayerClass {
  Warrior = "warrior",
  Archer = "archer",
  Mage = "mage",
}

export interface StatGrowth {
  hp: number;
  mana: number;
  strength: number;
  agility: number;
  intelligence: number;
  armor: number;
  magicResist: number;
}

export interface ClassDefinition {
  id: PlayerClass;
  name: string;
  description: string;
  baseStats: EntityStats;
  statGrowth: StatGrowth;
  startingSkillIds: string[];
}

export interface PlayerState {
  classId: PlayerClass;
  xp: number;
  xpToNextLevel: number;
  skillPoints: number;
  equippedSkillIds: string[];
  unlockedSkillIds: string[];
}
