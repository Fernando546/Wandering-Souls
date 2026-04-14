export type ItemRarity = "common" | "rare" | "legendary" | "mythic";

export type ItemCategory = "weapon" | "armor" | "consumable" | "material" | "trinket";

export type EquipmentSlot = "weapon" | "helmet" | "chest" | "gloves" | "boots" | "ring";

export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  rarity: ItemRarity;
  maxStack: number;
  icon: string;
  healAmount?: number;
  buyPrice?: number;
  sellPrice?: number;
  equipSlot?: EquipmentSlot;
  attackBonus?: number;
  defenseBonus?: number;
}

export interface InventorySlot {
  itemId: string | null;
  quantity: number;
}

export interface BagState {
  id: string;
  name: string;
  slots: InventorySlot[];
}

export type EquipmentState = Record<EquipmentSlot, string | null>;

export interface InventoryState {
  bags: BagState[];
  activeBagIndex: number;
  equipment: EquipmentState;
  currency: number;
}

export interface LootTableEntry {
  itemId: string;
  chance: number;
  min: number;
  max: number;
}

export type LootTable = Record<string, LootTableEntry[]>;

export interface LootRollResult {
  itemId: string;
  quantity: number;
}
