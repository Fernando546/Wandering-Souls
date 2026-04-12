// Replaced old turn-based types with real-time effects

export interface ActiveEffect {
  type: "stun" | "slow" | "armorPierce";
  value: number;
  durationMs: number;
  timeLeftMs: number;
}
