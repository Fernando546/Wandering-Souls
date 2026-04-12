export interface DialogueNode {
  id: string;
  speaker: string;
  text: string;
  choices: DialogueChoice[];
}

export interface DialogueChoice {
  text: string;
  nextNodeId: string | null;
  condition?: DialogueCondition;
  action?: DialogueAction;
}

export interface DialogueCondition {
  type: "level" | "quest" | "item";
  value: string | number;
}

export interface DialogueAction {
  type: "startQuest" | "giveItem" | "giveXp" | "heal";
  value: string | number;
}

export interface DialogueTree {
  id: string;
  startNodeId: string;
  nodes: Record<string, DialogueNode>;
}
