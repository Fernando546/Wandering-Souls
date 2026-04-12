import itemsData from "@data/definitions/items.json";
import lootTablesData from "@data/definitions/lootTables.json";
import type {
  BagState,
  EquipmentSlot,
  EquipmentState,
  InventorySlot,
  InventoryState,
  ItemDefinition,
  LootRollResult,
  LootTable,
} from "@data/types/Item";
import { eventBus, GameEvents } from "./EventBus";

interface AddItemResult {
  added: number;
  remaining: number;
}

interface InventoryActionResult {
  success: boolean;
  message?: string;
}

const BAG_SIZE = 12;

const EQUIPMENT_SLOTS: EquipmentSlot[] = ["weapon", "helmet", "chest", "gloves", "boots", "ring"];

export class InventoryManager {
  private static instance: InventoryManager;

  private readonly itemDefinitions: Record<string, ItemDefinition>;
  private readonly lootTables: LootTable;
  private readonly state: InventoryState;

  private constructor() {
    this.itemDefinitions = itemsData as unknown as Record<string, ItemDefinition>;
    this.lootTables = lootTablesData as unknown as LootTable;

    this.state = {
      bags: this.createDefaultBags(),
      activeBagIndex: 0,
      equipment: this.createDefaultEquipment(),
    };
  }

  static getInstance(): InventoryManager {
    if (!InventoryManager.instance) {
      InventoryManager.instance = new InventoryManager();
    }
    return InventoryManager.instance;
  }

  getItemDefinition(itemId: string): ItemDefinition | undefined {
    return this.itemDefinitions[itemId];
  }

  getState(): InventoryState {
    return {
      activeBagIndex: this.state.activeBagIndex,
      bags: this.state.bags.map((bag) => ({
        id: bag.id,
        name: bag.name,
        slots: bag.slots.map((slot) => ({ ...slot })),
      })),
      equipment: { ...this.state.equipment },
    };
  }

  setActiveBag(index: number): void {
    if (index < 0 || index >= this.state.bags.length) return;
    this.state.activeBagIndex = index;
    this.emitStateChanged();
  }

  addItem(itemId: string, quantity: number): AddItemResult {
    const definition = this.itemDefinitions[itemId];
    if (!definition || quantity <= 0) {
      return { added: 0, remaining: Math.max(quantity, 0) };
    }

    let remaining = quantity;

    for (const bag of this.state.bags) {
      for (const slot of bag.slots) {
        if (remaining <= 0) break;
        if (slot.itemId !== itemId) continue;

        const freeStackSpace = definition.maxStack - slot.quantity;
        if (freeStackSpace <= 0) continue;

        const toAdd = Math.min(remaining, freeStackSpace);
        slot.quantity += toAdd;
        remaining -= toAdd;
      }
    }

    for (const bag of this.state.bags) {
      for (const slot of bag.slots) {
        if (remaining <= 0) break;
        if (slot.itemId !== null) continue;

        const toAdd = Math.min(remaining, definition.maxStack);
        slot.itemId = itemId;
        slot.quantity = toAdd;
        remaining -= toAdd;
      }
    }

    const added = quantity - remaining;
    if (added > 0) {
      this.emitStateChanged();
    }

    return { added, remaining };
  }

  moveBagItem(fromBag: number, fromSlot: number, toBag: number, toSlot: number): InventoryActionResult {
    const source = this.getBagSlot(fromBag, fromSlot);
    const target = this.getBagSlot(toBag, toSlot);

    if (!source || !target || source.itemId === null) {
      return { success: false, message: "Invalid inventory move." };
    }

    if (fromBag === toBag && fromSlot === toSlot) {
      return { success: false, message: "Source and target slot are the same." };
    }

    if (target.itemId === null) {
      target.itemId = source.itemId;
      target.quantity = source.quantity;
      source.itemId = null;
      source.quantity = 0;
      this.emitStateChanged();
      return { success: true };
    }

    if (target.itemId === source.itemId) {
      const definition = this.itemDefinitions[source.itemId];
      if (!definition) return { success: false, message: "Unknown item type." };

      const freeStackSpace = definition.maxStack - target.quantity;
      if (freeStackSpace > 0) {
        const transfer = Math.min(freeStackSpace, source.quantity);
        target.quantity += transfer;
        source.quantity -= transfer;
        if (source.quantity <= 0) {
          source.itemId = null;
          source.quantity = 0;
        }
        this.emitStateChanged();
        return { success: true };
      }
    }

    const tempId = target.itemId;
    const tempQty = target.quantity;
    target.itemId = source.itemId;
    target.quantity = source.quantity;
    source.itemId = tempId;
    source.quantity = tempQty;

    this.emitStateChanged();
    return { success: true };
  }

  equipFromBag(bagIndex: number, slotIndex: number, equipmentSlot: EquipmentSlot): InventoryActionResult {
    const bagSlot = this.getBagSlot(bagIndex, slotIndex);
    if (!bagSlot || bagSlot.itemId === null) {
      return { success: false, message: "No item in selected slot." };
    }

    const definition = this.itemDefinitions[bagSlot.itemId];
    if (!definition || !definition.equipSlot) {
      return { success: false, message: "This item cannot be equipped." };
    }

    if (definition.equipSlot !== equipmentSlot) {
      return { success: false, message: "Item does not fit this equipment slot." };
    }

    if (bagSlot.quantity <= 0) {
      return { success: false, message: "Invalid item quantity." };
    }

    const equippedItem = this.state.equipment[equipmentSlot];
    this.state.equipment[equipmentSlot] = bagSlot.itemId;

    bagSlot.quantity -= 1;
    if (bagSlot.quantity <= 0) {
      bagSlot.itemId = null;
      bagSlot.quantity = 0;
    }

    if (equippedItem) {
      const placedBack = this.tryPlaceIntoSpecificBagSlot(equippedItem, 1, bagSlot);
      if (!placedBack) {
        const backResult = this.addItem(equippedItem, 1);
        if (backResult.remaining > 0) {
          this.state.equipment[equipmentSlot] = equippedItem;
          return { success: false, message: "No room to swap equipped item." };
        }
      }
    }

    this.emitStateChanged();
    return { success: true };
  }

  moveEquipmentToBag(equipmentSlot: EquipmentSlot, bagIndex: number, slotIndex: number): InventoryActionResult {
    const equippedItemId = this.state.equipment[equipmentSlot];
    if (!equippedItemId) {
      return { success: false, message: "No equipped item in this slot." };
    }

    const bagSlot = this.getBagSlot(bagIndex, slotIndex);
    if (!bagSlot) {
      return { success: false, message: "Invalid target slot." };
    }

    if (bagSlot.itemId === null) {
      bagSlot.itemId = equippedItemId;
      bagSlot.quantity = 1;
      this.state.equipment[equipmentSlot] = null;
      this.emitStateChanged();
      return { success: true };
    }

    const bagItemDef = this.itemDefinitions[bagSlot.itemId];
    if (bagItemDef?.equipSlot === equipmentSlot && bagSlot.quantity === 1) {
      this.state.equipment[equipmentSlot] = bagSlot.itemId;
      bagSlot.itemId = equippedItemId;
      bagSlot.quantity = 1;
      this.emitStateChanged();
      return { success: true };
    }

    return { success: false, message: "Target slot is occupied." };
  }

  swapEquipmentSlots(fromSlot: EquipmentSlot, toSlot: EquipmentSlot): InventoryActionResult {
    if (fromSlot === toSlot) {
      return { success: false, message: "Cannot swap the same slot." };
    }

    const fromItem = this.state.equipment[fromSlot];
    const toItem = this.state.equipment[toSlot];
    if (!fromItem) {
      return { success: false, message: "No item equipped in source slot." };
    }

    const fromDef = this.itemDefinitions[fromItem];
    if (fromDef?.equipSlot !== toSlot) {
      return { success: false, message: "Source item does not fit target slot." };
    }

    if (toItem) {
      const toDef = this.itemDefinitions[toItem];
      if (toDef?.equipSlot !== fromSlot) {
        return { success: false, message: "Target item does not fit source slot." };
      }
    }

    this.state.equipment[fromSlot] = toItem ?? null;
    this.state.equipment[toSlot] = fromItem;
    this.emitStateChanged();
    return { success: true };
  }

  unequipToFirstAvailable(equipmentSlot: EquipmentSlot): InventoryActionResult {
    const equippedItemId = this.state.equipment[equipmentSlot];
    if (!equippedItemId) {
      return { success: false, message: "No item equipped in this slot." };
    }

    const destination = this.findFirstEmptySlot();
    if (!destination) {
      return { success: false, message: "All bags are full." };
    }

    destination.itemId = equippedItemId;
    destination.quantity = 1;
    this.state.equipment[equipmentSlot] = null;
    this.emitStateChanged();
    return { success: true };
  }

  rollLoot(enemyTemplateId: string): LootRollResult[] {
    const table = this.lootTables[enemyTemplateId] ?? [];
    const drops: LootRollResult[] = [];

    for (const entry of table) {
      if (Math.random() > entry.chance) continue;
      const quantity = Math.floor(Math.random() * (entry.max - entry.min + 1)) + entry.min;
      if (quantity <= 0) continue;
      drops.push({ itemId: entry.itemId, quantity });
    }

    return drops;
  }

  private createDefaultBags(): BagState[] {
    return [
      { id: "bag-1", name: "Bag I", slots: this.createSlots(BAG_SIZE) },
      { id: "bag-2", name: "Bag II", slots: this.createSlots(BAG_SIZE) },
      { id: "bag-3", name: "Bag III", slots: this.createSlots(BAG_SIZE) },
    ];
  }

  private createDefaultEquipment(): EquipmentState {
    return {
      weapon: null,
      helmet: null,
      chest: null,
      gloves: null,
      boots: null,
      ring: null,
    };
  }

  private createSlots(size: number): InventorySlot[] {
    return Array.from({ length: size }, () => ({ itemId: null, quantity: 0 }));
  }

  private getBagSlot(bagIndex: number, slotIndex: number): InventorySlot | null {
    const bag = this.state.bags[bagIndex];
    if (!bag) return null;
    return bag.slots[slotIndex] ?? null;
  }

  private findFirstEmptySlot(): InventorySlot | null {
    for (const bag of this.state.bags) {
      for (const slot of bag.slots) {
        if (slot.itemId === null) return slot;
      }
    }
    return null;
  }

  private tryPlaceIntoSpecificBagSlot(itemId: string, quantity: number, slot: InventorySlot): boolean {
    if (quantity <= 0) return true;

    if (slot.itemId === null) {
      slot.itemId = itemId;
      slot.quantity = quantity;
      return true;
    }

    if (slot.itemId !== itemId) return false;

    const definition = this.itemDefinitions[itemId];
    if (!definition) return false;

    const freeSpace = definition.maxStack - slot.quantity;
    if (freeSpace < quantity) return false;

    slot.quantity += quantity;
    return true;
  }

  private emitStateChanged(): void {
    eventBus.emitEvent(GameEvents.INVENTORY_UPDATED, this.getState());
  }

  getEquipmentSlots(): EquipmentSlot[] {
    return [...EQUIPMENT_SLOTS];
  }
}
