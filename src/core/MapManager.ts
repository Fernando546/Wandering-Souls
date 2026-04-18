import Phaser from "phaser";

export interface TransitionZone {
  x: number;
  y: number;
  width: number;
  height: number;
  targetMapId: string;
  targetX: number;
  targetY: number;
}

export interface InteractableZone {
  x: number;
  y: number;
  width: number;
  height: number;
  message: string;
}

export interface SpawnPoint {
  enemyId: string;
  x: number;
  y: number;
  patrolRadius: number;
  respawnTimeMs: number;
}

export interface NpcSpawn {
  npcId: string;
  name: string;
  x: number;
  y: number;
  dialogueTreeId: string;
}

export interface ExtractedMapData {
  id: string;
  name: string;
  width: number; // in tiles
  height: number; // in tiles
  tileSize: number;
  transitions: TransitionZone[];
  enemySpawns: SpawnPoint[];
  npcSpawns: NpcSpawn[];
  playerSpawn: { x: number; y: number }; // Pixel coordinates from Tiled! Wait, Tiled x,y are pixels
  collisionBoxes: Phaser.Geom.Rectangle[];
  interactables: InteractableZone[];
}

export class MapManager {
  private currentMapId: string = "";
  private tilemap: Phaser.Tilemaps.Tilemap | null = null;
  private tileLayers: Phaser.Tilemaps.TilemapLayer[] = [];
  private extractedData: ExtractedMapData | null = null;
  private collisionBoxes: Phaser.Geom.Rectangle[] = [];
  private decorSprites: Phaser.GameObjects.Sprite[] = [];

  getCurrentMapId(): string {
    return this.currentMapId;
  }

  /** Call before loading a new map to clean up old decor sprites */
  cleanup(): void {
    this.tileLayers.forEach((layer) => layer.destroy());
    this.tileLayers = [];
    this.decorSprites.forEach(s => s.destroy());
    this.decorSprites = [];
    this.tilemap = null;
    this.extractedData = null;
    this.collisionBoxes = [];
  }

  buildTilemap(scene: Phaser.Scene, mapId: string, tilesetKey: string): ExtractedMapData | null {
    console.log("[MapManager] Building tilemap for", mapId, "with texture key", tilesetKey);
    this.currentMapId = mapId;
    try {
      console.log("[MapManager] Available texture keys:", scene.textures.getTextureKeys());
      this.tilemap = scene.make.tilemap({ key: mapId });
      if (!this.tilemap) {
        console.error("[MapManager] Failed to make tilemap for key:", mapId);
        return null;
      }
      console.log("[MapManager] Tilemap created. Size:", this.tilemap.width, "x", this.tilemap.height);
      console.log("[MapManager] Tilesets in JSON:", this.tilemap.tilesets.map(t => t.name));

      const tileset = this.tilemap.addTilesetImage("tileset", tilesetKey);
      if (!tileset) {
        console.error("[MapManager] addTilesetImage failed. JSON tilesets:", this.tilemap.tilesets);
        return null;
      }
      console.log("[MapManager] Tileset added. Total tiles:", tileset.total);

      const groundLayer = this.tilemap.getLayer("Ground");
      console.log("[MapManager] Ground layer exists:", !!groundLayer);
      if (groundLayer) {
        const layer = this.tilemap.createLayer("Ground", tileset, 0, 0);
        console.log("[MapManager] Ground layer created:", !!layer);
        layer?.setDepth(0);
        if (layer) {
          this.tileLayers.push(layer);
        }
      }
      
      const decorLayer = this.tilemap.getLayer("Decor");
      console.log("[MapManager] Decor layer exists:", !!decorLayer);
      if (decorLayer) {
        // Instead of creating a flat layer, we create individual sprites per
        // non-empty decor tile so they can be Y-sorted with entities (2.5D occlusion).
        this.decorSprites = [];
        const tw = tileset.tileWidth;
        const th = tileset.tileHeight;

        for (let y = 0; y < this.tilemap.height; y++) {
          for (let x = 0; x < this.tilemap.width; x++) {
            const tile = decorLayer.data[y]?.[x];
            if (tile && tile.index > 0) {
              const tileIndex = tile.index - tileset.firstgid;
              const sprite = scene.add.sprite(
                x * tw + tw / 2,
                y * th + th / 2,
                "tileset_sprites",
                tileIndex
              );
              // Depth = bottom of the tile (y + 1) so player behind it gets occluded
              sprite.setDepth(y * th + th);
              this.decorSprites.push(sprite);
            }
          }
        }
        console.log("[MapManager] Decor sprites created:", this.decorSprites.length);
      }

      this.extractData();
      console.log("[MapManager] Data extracted. Player spawn:", this.extractedData?.playerSpawn);
      return this.extractedData;
    } catch (e: any) {
      console.error("[MapManager] Crash during tilemap build:", e.message, e);
      return null;
    }
  }

  getTilemap(): Phaser.Tilemaps.Tilemap | null {
    return this.tilemap;
  }

  getExtractedData(): ExtractedMapData | null {
    return this.extractedData;
  }

  private extractData(): void {
    if (!this.tilemap) return;

    this.collisionBoxes = [];
    const mapName = this.tilemap.properties ? (this.tilemap.properties as any).name || this.currentMapId : this.currentMapId;
    
    this.extractedData = {
      id: this.currentMapId,
      name: mapName,
      width: this.tilemap.width,
      height: this.tilemap.height,
      tileSize: this.tilemap.tileWidth,
      transitions: [],
      enemySpawns: [],
      npcSpawns: [],
      playerSpawn: { x: 0, y: 0 },
      collisionBoxes: this.collisionBoxes,
      interactables: []
    };

    // Parse Collisions ObjectGroup
    const collisionLayer = this.tilemap.getObjectLayer("Collisions");
    const decorLayer = this.tilemap.getLayer("Decor");
    const firstGid = this.tilemap.tilesets[0]?.firstgid || 1;

    if (collisionLayer && collisionLayer.objects) {
      collisionLayer.objects.forEach(obj => {
        if (obj.x !== undefined && obj.y !== undefined && obj.width && obj.height) {
          let box = new Phaser.Geom.Rectangle(obj.x, obj.y, obj.width, obj.height);
          
          if (obj.width === 32 && obj.height === 32 && decorLayer) {
            const tileX = Math.floor(obj.x / 32);
            const tileY = Math.floor(obj.y / 32);
            const tile = decorLayer.data[tileY]?.[tileX];
            
            // Tile index 6 corresponds to tree decor/bush
            if (tile && tile.index - firstGid === 6) {
              box = new Phaser.Geom.Rectangle(obj.x + 8, obj.y + 16, 16, 14);
            }
          }
          this.collisionBoxes.push(box);
        }
      });
    }

    // Parse Spawns ObjectGroup
    const spawnLayer = this.tilemap.getObjectLayer("Spawns");
    if (spawnLayer && spawnLayer.objects) {
      spawnLayer.objects.forEach(obj => {
        const px = obj.x ?? 0;
        const py = obj.y ?? 0;
        const props = this.getCustomProperties(obj);

        if (obj.type === "player") {
          // Store pixel coords, but usually WorldScene wants tile coords for playerSpawn, actually pixel / tileSize
          this.extractedData!.playerSpawn = { x: Math.floor(px / 32), y: Math.floor(py / 32) };
        } else if (obj.type === "enemy") {
          this.extractedData!.enemySpawns.push({
            enemyId: props.enemyId || "slime",
            x: Math.floor(px / 32),
            y: Math.floor(py / 32),
            patrolRadius: props.patrolRadius || 0,
            respawnTimeMs: props.respawnTimeMs || 10000,
          });
        } else if (obj.type === "npc") {
          this.extractedData!.npcSpawns.push({
            npcId: props.npcId || "unknown",
            name: props.npcName || "NPC",
            x: Math.floor(px / 32),
            y: Math.floor(py / 32),
            dialogueTreeId: props.dialogueTreeId || "elder"
          });
        } else if (obj.type === "transition") {
          this.extractedData!.transitions.push({
            x: Math.floor(px / 32),
            y: Math.floor(py / 32),
            width: obj.width ? Math.floor(obj.width / 32) : 1,
            height: obj.height ? Math.floor(obj.height / 32) : 1,
            targetMapId: props.targetMapId,
            targetX: props.targetX,
            targetY: props.targetY
          });
        } else if (obj.type === "interact" || obj.type === "interactable") {
          this.extractedData!.interactables.push({
            x: Math.floor(px / 32),
            y: Math.floor(py / 32),
            width: obj.width ? Math.floor(obj.width / 32) : 1,
            height: obj.height ? Math.floor(obj.height / 32) : 1,
            message: props.message || "You examine the object. It reveals nothing."
          });
        }
      });
    }
  }

  private getCustomProperties(obj: any): any {
    const props: any = {};
    if (obj.properties && Array.isArray(obj.properties)) {
      obj.properties.forEach((p: any) => {
        props[p.name] = p.value;
      });
    }
    return props;
  }

  getCollisionAt(tileX: number, tileY: number): boolean {
    if (!this.tilemap) return true;
    if (tileX < 0 || tileY < 0 || tileX >= this.tilemap.width || tileY >= this.tilemap.height) return true;
    // Check if pixel center overlaps any strict collision boxes.
    const px = tileX * 32 + 16;
    const py = tileY * 32 + 16;
    return this.isPixelBlocked(px, py);
  }

  isPixelBlocked(pixelX: number, pixelY: number): boolean {
    if (!this.tilemap) return true;

    if (pixelX < 0 || pixelY < 0 || pixelX >= this.tilemap.widthInPixels || pixelY >= this.tilemap.heightInPixels) {
      return true;
    }

    for (const box of this.collisionBoxes) {
      if (box.contains(pixelX, pixelY)) return true;
    }

    return false;
  }

  getWorldSizePixels(): { width: number; height: number } | null {
    if (!this.tilemap) return null;
    return { width: this.tilemap.widthInPixels, height: this.tilemap.heightInPixels };
  }

  getTransitionAt(tileX: number, tileY: number): TransitionZone | null {
    if (!this.extractedData) return null;
    for (const t of this.extractedData.transitions) {
      if (tileX >= t.x && tileX < t.x + t.width && tileY >= t.y && tileY < t.y + t.height) {
        return t;
      }
    }
    return null;
  }
}
