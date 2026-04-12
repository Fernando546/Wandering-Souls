import type { DamageType } from "./Entity";
import type { PlayerClass } from "./ClassDefinition";

export interface SkillScaling {
  stat: "strength" | "agility" | "intelligence";
  modifier: number;
}

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  damageType: DamageType;
  baseDamage: number;
  manaCost: number;
  cooldown: number;
  scaling: SkillScaling;
  requiredLevel: number;
  classRestriction: PlayerClass;
  effectType?: "stun" | "slow" | "armorPierce" | "none";
  effectValue?: number;
}

export interface SkillInstance {
  definitionId: string;
  currentCooldown: number;
}
