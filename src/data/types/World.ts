import type { Position } from "./Entity";

export interface MapDefinition {
  id: string;
  name: string;
  width: number;
  height: number;
  tileSize: number;
  layers: MapLayer[];
  transitions: MapTransition[];
  enemySpawns: EnemySpawn[];
  npcPlacements: NpcPlacement[];
  playerSpawn: Position;
}

export interface MapLayer {
  name: string;
  data: number[];
  collides: boolean;
}

export interface MapTransition {
  sourcePosition: Position;
  targetMapId: string;
  targetPosition: Position;
  width: number;
  height: number;
}

export interface EnemySpawn {
  enemyId: string;
  position: Position;
  respawnTimeMs: number;
  patrolRadius: number;
}

export interface NpcPlacement {
  npcId: string;
  name: string;
  position: Position;
  dialogueTreeId: string;
  spriteKey: string;
}

export interface TileProperties {
  walkable: boolean;
  interactable: boolean;
  transitionTarget?: string;
}
