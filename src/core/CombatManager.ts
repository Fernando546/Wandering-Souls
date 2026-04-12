import type { BaseEntityData, DamageType } from "@data/types/Entity";
import type { SkillDefinition } from "@data/types/Skill";

export interface DamageResult {
  damageDealt: number;
  isCritical: boolean;
  damageType: DamageType;
}

export class CombatManager {
  static calculateBasicDamage(attacker: BaseEntityData, defender: BaseEntityData): DamageResult {
    const rawDamage = attacker.stats.strength * 1.0 + 5;
    const defense = defender.stats.armor;
    const finalDamage = Math.max(1, Math.floor(rawDamage - defense * 0.5));
    
    const isCritical = Math.random() < attacker.stats.agility * 0.01;
    const damage = isCritical ? Math.floor(finalDamage * 1.5) : finalDamage;

    return {
      damageDealt: damage,
      isCritical,
      damageType: "physical" as DamageType,
    };
  }

  static calculateSkillDamage(attacker: BaseEntityData, defender: BaseEntityData, skill: SkillDefinition): DamageResult | null {
    if (attacker.stats.mana < skill.manaCost) {
      return null;
    }

    const statValue = attacker.stats[skill.scaling.stat as keyof typeof attacker.stats] as number;
    const rawDamage = skill.baseDamage + statValue * skill.scaling.modifier;

    let defense = 0;
    if (skill.damageType === "physical") {
      defense = defender.stats.armor;
      if (skill.effectType === "armorPierce") {
        defense *= 1 - (skill.effectValue ?? 0) / 100;
      }
    } else if (skill.damageType === "magical") {
      defense = defender.stats.magicResist;
    }

    const finalDamage = Math.max(1, Math.floor(rawDamage - defense * 0.4));

    return {
      damageDealt: finalDamage,
      isCritical: false,
      damageType: skill.damageType,
    };
  }
}
