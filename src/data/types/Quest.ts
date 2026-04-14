export type QuestUiStatus = "available" | "active" | "ready" | "completed";

export interface QuestObjectiveView {
  id: string;
  label: string;
  current: number;
  target: number;
  isComplete: boolean;
}

export interface QuestLogEntryView {
  id: string;
  title: string;
  description: string;
  status: QuestUiStatus;
  objectives: QuestObjectiveView[];
}
