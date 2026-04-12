import Phaser from "phaser";
import { InventoryManager } from "@core/InventoryManager";
import { eventBus, GameEvents } from "@core/EventBus";
import type { EquipmentSlot, InventoryState } from "@data/types/Item";

export class UIScene extends Phaser.Scene {
  private inventoryManager!: InventoryManager;
  private statusTimeoutId: number | null = null;
  private chatInitialized: boolean = false;

  private readonly equipmentLabels: Record<EquipmentSlot, string> = {
    weapon: "Weapon",
    helmet: "Helmet",
    chest: "Armor",
    gloves: "Gloves",
    boots: "Boots",
    ring: "Ring",
  };

  constructor() {
    super({ key: "UIScene" });
  }

  create(): void {
    this.scene.bringToTop();
    this.inventoryManager = InventoryManager.getInstance();

    this.setupInventoryDOM();
    this.setupChatDOM();
    this.renderInventory(this.inventoryManager.getState());

    eventBus.onEvent(GameEvents.INVENTORY_UPDATED, (payload: unknown) => {
      this.renderInventory(payload as InventoryState);
    });
  }

  private setupInventoryDOM(): void {
    const bagTabs = document.querySelectorAll<HTMLButtonElement>(".bag-tab");
    bagTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const index = Number(tab.dataset.bagIndex ?? "0");
        this.inventoryManager.setActiveBag(index);
      });
    });

    const equipSlots = document.getElementById("equipment-slots");
    if (!equipSlots) return;

    equipSlots.innerHTML = "";
    this.inventoryManager.getEquipmentSlots().forEach((slotName) => {
      const slotEl = document.createElement("div");
      slotEl.className = `equipment-slot inventory-cell equip-slot-${slotName}`;
      slotEl.dataset.slotType = "equipment";
      slotEl.dataset.equipmentSlot = slotName;

      slotEl.addEventListener("dragover", (event) => {
        event.preventDefault();
      });

      slotEl.addEventListener("drop", (event) => {
        event.preventDefault();
        const payload = this.readDragPayload(event);
        if (!payload) return;

        const result = payload.sourceType === "bag"
          ? this.inventoryManager.equipFromBag(payload.bagIndex, payload.slotIndex, slotName)
          : this.inventoryManager.swapEquipmentSlots(payload.equipmentSlot, slotName);

        if (!result.success && result.message) {
          this.showStatus(result.message, true);
        }
      });

      slotEl.addEventListener("dblclick", () => {
        const result = this.inventoryManager.unequipToFirstAvailable(slotName);
        if (!result.success && result.message) {
          this.showStatus(result.message, true);
        }
      });

      equipSlots.appendChild(slotEl);
    });
  }

  private setupChatDOM(): void {
    if (this.chatInitialized) return;

    const chatToggleButton = document.getElementById("chat-toggle-btn") as HTMLButtonElement | null;
    const chatCollapseButton = document.getElementById("chat-collapse-btn") as HTMLButtonElement | null;
    const chatPanel = document.getElementById("chat-panel");
    const chatInput = document.getElementById("chat-input") as HTMLInputElement | null;
    const sendButton = document.getElementById("chat-send-btn") as HTMLButtonElement | null;

    if (!chatToggleButton || !chatCollapseButton || !chatPanel || !chatInput || !sendButton) {
      return;
    }

    const openChat = () => {
      chatPanel.classList.remove("collapsed");
      chatInput.focus();
    };

    const closeChat = () => {
      chatPanel.classList.add("collapsed");
    };

    const sendMessage = () => {
      const text = chatInput.value.trim();
      if (!text) return;
      this.appendChatMessage("You", text, "player");
      chatInput.value = "";
    };

    chatToggleButton.addEventListener("click", () => {
      if (chatPanel.classList.contains("collapsed")) {
        openChat();
      } else {
        closeChat();
      }
    });

    chatCollapseButton.addEventListener("click", closeChat);
    sendButton.addEventListener("click", sendMessage);

    chatInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        sendMessage();
      }
    });

    this.appendChatMessage("Trade", "WTS Wolf Fang x20", "system");
    this.appendChatMessage("Party", "Anyone for cave run?", "system");
    this.chatInitialized = true;
  }

  private appendChatMessage(author: string, message: string, type: "system" | "player"): void {
    const container = document.getElementById("chat-messages");
    if (!container) return;

    const line = document.createElement("div");
    line.className = `chat-message ${type}`;
    line.textContent = `[${author}] ${message}`;
    container.appendChild(line);

    while (container.children.length > 60) {
      container.removeChild(container.firstChild as Node);
    }

    container.scrollTop = container.scrollHeight;
  }

  private renderInventory(state: InventoryState): void {
    this.renderEquipmentSlots(state);
    this.renderBagTabs(state.activeBagIndex);
    this.renderBagSlots(state);
  }

  private renderEquipmentSlots(state: InventoryState): void {
    const equipmentSlots = document.querySelectorAll<HTMLElement>(".equipment-slot");
    equipmentSlots.forEach((slotEl) => {
      const slotName = slotEl.dataset.equipmentSlot as EquipmentSlot;
      this.renderSlotContent(slotEl, state.equipment[slotName], 1, this.equipmentLabels[slotName]);

      const itemId = state.equipment[slotName];
      slotEl.draggable = Boolean(itemId);
      slotEl.ondragstart = itemId
        ? (event: DragEvent) => {
            if (!event.dataTransfer) return;
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData(
              "application/json",
              JSON.stringify({ sourceType: "equipment", equipmentSlot: slotName })
            );
          }
        : null;
    });
  }

  private renderBagTabs(activeBagIndex: number): void {
    const tabs = document.querySelectorAll<HTMLButtonElement>(".bag-tab");
    tabs.forEach((tab) => {
      const index = Number(tab.dataset.bagIndex ?? "0");
      tab.classList.toggle("active", index === activeBagIndex);
    });
  }

  private renderBagSlots(state: InventoryState): void {
    const bagGrid = document.getElementById("bag-grid");
    if (!bagGrid) return;

    bagGrid.innerHTML = "";

    const activeBagIndex = state.activeBagIndex;
    const activeBag = state.bags[activeBagIndex];

    activeBag.slots.forEach((slot, slotIndex) => {
      const slotEl = document.createElement("div");
      slotEl.className = "inventory-slot inventory-cell";
      slotEl.dataset.slotType = "bag";
      slotEl.dataset.bagIndex = activeBagIndex.toString();
      slotEl.dataset.slotIndex = slotIndex.toString();

      this.renderSlotContent(slotEl, slot.itemId, slot.quantity, `Slot ${slotIndex + 1}`);

      slotEl.draggable = Boolean(slot.itemId);
      slotEl.ondragstart = slot.itemId
        ? (event: DragEvent) => {
            if (!event.dataTransfer) return;
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData(
              "application/json",
              JSON.stringify({ sourceType: "bag", bagIndex: activeBagIndex, slotIndex })
            );
          }
        : null;

      slotEl.addEventListener("dragover", (event) => {
        event.preventDefault();
      });

      slotEl.addEventListener("drop", (event) => {
        event.preventDefault();
        const payload = this.readDragPayload(event);
        if (!payload) return;

        const result = payload.sourceType === "bag"
          ? this.inventoryManager.moveBagItem(payload.bagIndex, payload.slotIndex, activeBagIndex, slotIndex)
          : this.inventoryManager.moveEquipmentToBag(payload.equipmentSlot, activeBagIndex, slotIndex);

        if (!result.success && result.message) {
          this.showStatus(result.message, true);
        }
      });

      bagGrid.appendChild(slotEl);
    });
  }

  private renderSlotContent(slotEl: HTMLElement, itemId: string | null, quantity: number, emptyLabel: string): void {
    slotEl.innerHTML = "";
    slotEl.title = "";
    slotEl.classList.remove("rarity-common", "rarity-rare", "rarity-legendary", "rarity-mythic");

    if (!itemId) {
      const label = document.createElement("span");
      label.className = "slot-empty-label";
      label.textContent = emptyLabel;
      slotEl.appendChild(label);
      return;
    }

    const definition = this.inventoryManager.getItemDefinition(itemId);
    if (!definition) {
      const unknown = document.createElement("span");
      unknown.className = "slot-empty-label";
      unknown.textContent = "Unknown";
      slotEl.appendChild(unknown);
      return;
    }

    slotEl.classList.add(`rarity-${definition.rarity}`);
    slotEl.title = `${definition.name}\n${definition.description}`;

    const icon = document.createElement("span");
    icon.className = `item-icon item-icon-${definition.id}`;

    const glyph = document.createElement("span");
    glyph.className = "item-glyph";
    glyph.textContent = definition.icon;
    icon.appendChild(glyph);

    const name = document.createElement("span");
    name.className = "item-name";
    name.textContent = definition.name;

    slotEl.appendChild(icon);
    slotEl.appendChild(name);

    if (quantity > 1) {
      const qty = document.createElement("span");
      qty.className = "item-qty";
      qty.textContent = quantity.toString();
      slotEl.appendChild(qty);
    }
  }

  private readDragPayload(event: DragEvent):
    | { sourceType: "bag"; bagIndex: number; slotIndex: number }
    | { sourceType: "equipment"; equipmentSlot: EquipmentSlot }
    | null {
    const rawPayload = event.dataTransfer?.getData("application/json");
    if (!rawPayload) return null;

    try {
      const parsed = JSON.parse(rawPayload) as
        | { sourceType: "bag"; bagIndex: number; slotIndex: number }
        | { sourceType: "equipment"; equipmentSlot: EquipmentSlot };
      return parsed;
    } catch {
      return null;
    }
  }

  private showStatus(message: string, isError: boolean): void {
    const statusEl = document.getElementById("inventory-status");
    if (!statusEl) return;

    statusEl.textContent = message;
    statusEl.classList.toggle("error", isError);

    if (this.statusTimeoutId !== null) {
      window.clearTimeout(this.statusTimeoutId);
    }

    this.statusTimeoutId = window.setTimeout(() => {
      statusEl.textContent = "Tip: Drag items from your bags onto equipment slots.";
      statusEl.classList.remove("error");
      this.statusTimeoutId = null;
    }, 1800);
  }
}
