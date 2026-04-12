import type { DialogueTree, DialogueNode, DialogueChoice } from "@data/types/Dialogue";
import { eventBus, GameEvents } from "./EventBus";

export class DialogueManager {
  private dialogueTrees: Map<string, DialogueTree> = new Map();
  private currentTree: DialogueTree | null = null;
  private currentNode: DialogueNode | null = null;
  private isActive: boolean = false;

  loadDialogueTree(tree: DialogueTree): void {
    this.dialogueTrees.set(tree.id, tree);
  }

  startDialogue(treeId: string): DialogueNode | null {
    const tree = this.dialogueTrees.get(treeId);
    if (!tree) return null;

    this.currentTree = tree;
    this.currentNode = tree.nodes[tree.startNodeId];
    this.isActive = true;

    eventBus.emitEvent(GameEvents.INPUT_DISABLED);
    eventBus.emitEvent(GameEvents.DIALOGUE_OPEN, this.currentNode);

    return this.currentNode;
  }

  selectChoice(choiceIndex: number): DialogueNode | null {
    if (!this.currentNode || !this.currentTree) return null;

    const choice = this.currentNode.choices[choiceIndex];
    if (!choice) return null;

    if (choice.action) {
      this.executeAction(choice);
    }

    if (choice.nextNodeId === null) {
      this.endDialogue();
      return null;
    }

    this.currentNode = this.currentTree.nodes[choice.nextNodeId];
    eventBus.emitEvent(GameEvents.DIALOGUE_ADVANCE, this.currentNode);

    return this.currentNode;
  }

  private executeAction(choice: DialogueChoice): void {
    if (!choice.action) return;

    switch (choice.action.type) {
      case "giveXp":
        eventBus.emitEvent(GameEvents.XP_GAINED, choice.action.value);
        break;
      case "heal":
        eventBus.emitEvent(GameEvents.PLAYER_HEALED, choice.action.value);
        break;
      case "startQuest":
        break;
      case "giveItem":
        break;
    }
  }

  endDialogue(): void {
    this.currentTree = null;
    this.currentNode = null;
    this.isActive = false;

    eventBus.emitEvent(GameEvents.DIALOGUE_CLOSE);
    eventBus.emitEvent(GameEvents.INPUT_ENABLED);
  }

  getCurrentNode(): DialogueNode | null {
    return this.currentNode;
  }

  getIsActive(): boolean {
    return this.isActive;
  }
}
