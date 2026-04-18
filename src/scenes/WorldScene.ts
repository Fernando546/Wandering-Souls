import Phaser from "phaser";
import { MapManager } from "@core/MapManager";
import type { TransitionZone } from "@core/MapManager";
import { EntityManager } from "@core/EntityManager";
import { InputManager } from "@core/InputManager";
import type { InputState } from "@core/InputManager";
import { DialogueManager } from "@core/DialogueManager";
import { eventBus, GameEvents } from "@core/EventBus";
import { InventoryManager } from "@core/InventoryManager";
import { Player } from "@entities/Player";
import { Enemy } from "@entities/Enemy";
import { NPC } from "@entities/NPC";
import { Projectile } from "@entities/Projectile";
import type { ProjectileData } from "@entities/Projectile";
import { CombatManager } from "@core/CombatManager";
import type { DialogueAction, DialogueTree } from "@data/types/Dialogue";
import enemiesData from "@data/definitions/enemies.json";
import elderDialogue from "@data/definitions/dialogues/elder.json";
import elderProgressDialogue from "@data/definitions/dialogues/elder_progress.json";
import elderTurninDialogue from "@data/definitions/dialogues/elder_turnin.json";
import elderCompletedDialogue from "@data/definitions/dialogues/elder_completed.json";
import merchantDialogue from "@data/definitions/dialogues/merchant.json";
import caveWardenIntroDialogue from "@data/definitions/dialogues/cave_warden_intro.json";
import caveWardenProgressDialogue from "@data/definitions/dialogues/cave_warden_progress.json";
import caveWardenTurninDialogue from "@data/definitions/dialogues/cave_warden_turnin.json";
import caveWardenEliteOfferDialogue from "@data/definitions/dialogues/cave_warden_elite_offer.json";
import caveWardenEliteProgressDialogue from "@data/definitions/dialogues/cave_warden_elite_progress.json";
import caveWardenEliteTurninDialogue from "@data/definitions/dialogues/cave_warden_elite_turnin.json";
import caveWardenDoneDialogue from "@data/definitions/dialogues/cave_warden_done.json";
import ruinsScoutIntroDialogue from "@data/definitions/dialogues/ruins_scout_intro.json";
import ruinsScoutProgressDialogue from "@data/definitions/dialogues/ruins_scout_progress.json";
import ruinsScoutTurninDialogue from "@data/definitions/dialogues/ruins_scout_turnin.json";
import ruinsScoutDoneDialogue from "@data/definitions/dialogues/ruins_scout_done.json";
import { EntityType } from "@data/types/Entity";
import type { ItemRarity, LootRollResult } from "@data/types/Item";
import type { QuestLogEntryView, QuestUiStatus } from "@data/types/Quest";

interface GroundLoot {
  id: string;
  itemId: string;
  quantity: number;
  container: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
  bobTween: Phaser.Tweens.Tween;
  effectTweens: Phaser.Tweens.Tween[];
}

export class WorldScene extends Phaser.Scene {
  private mapManager!: MapManager;
  private entityManager!: EntityManager;
  private inputManager!: InputManager;
  private dialogueManager!: DialogueManager;
  private inventoryManager!: InventoryManager;
  private player!: Player;
  private enemies: Enemy[] = [];
  private npcs: NPC[] = [];
  private projectiles: Projectile[] = [];
  private enemyTemplateByRuntimeId: Map<string, string> = new Map();
  private groundLoot: GroundLoot[] = [];
  private lootSequence: number = 0;
  private currentMapId: string = "meadow";
  private playerClass: string = "warrior";
  private isTransitioning: boolean = false;
  private playerDead: boolean = false;
  private firstQuestStatus: "not-started" | "active" | "ready-to-turn-in" | "completed" = "not-started";
  private firstQuestKills: { slime: number; wolf: number } = { slime: 0, wolf: 0 };
  private readonly firstQuestTargets: { slime: number; wolf: number } = { slime: 5, wolf: 5 };
  private cavePurgeQuestStatus: "not-started" | "active" | "ready-to-turn-in" | "completed" = "not-started";
  private cavePurgeKills: { bandit: number; wolf: number } = { bandit: 0, wolf: 0 };
  private readonly cavePurgeTargets: { bandit: number; wolf: number } = { bandit: 4, wolf: 4 };
  private caveEliteQuestStatus: "not-started" | "active" | "ready-to-turn-in" | "completed" = "not-started";
  private caveEliteKills: number = 0;
  private ruinsEliteQuestStatus: "not-started" | "active" | "ready-to-turn-in" | "completed" = "not-started";
  private ruinsEliteKills: number = 0;
  private blockedTransitionMessageAt: number = -99999;
  private transitionMarkers: Phaser.GameObjects.GameObject[] = [];
  private mapColliders!: Phaser.Physics.Arcade.StaticGroup;

  constructor() {
    super({ key: "WorldScene" });
  }

  init(data: { mapId?: string; playerClass?: string; playerPosition?: { x: number; y: number } }): void {
    this.currentMapId = data.mapId ?? "meadow";
    this.playerClass = data.playerClass ?? "warrior";
  }

  create(data: { mapId?: string; playerClass?: string; playerPosition?: { x: number; y: number } }): void {
    this.mapManager = new MapManager();
    this.entityManager = new EntityManager();
    this.inputManager = new InputManager();
    this.dialogueManager = new DialogueManager();
    this.inventoryManager = InventoryManager.getInstance();

    this.inputManager.init(this);
    this.dialogueManager.loadDialogueTree(elderDialogue as unknown as DialogueTree);
    this.dialogueManager.loadDialogueTree(elderProgressDialogue as unknown as DialogueTree);
    this.dialogueManager.loadDialogueTree(elderTurninDialogue as unknown as DialogueTree);
    this.dialogueManager.loadDialogueTree(elderCompletedDialogue as unknown as DialogueTree);
    this.dialogueManager.loadDialogueTree(merchantDialogue as unknown as DialogueTree);
    this.dialogueManager.loadDialogueTree(caveWardenIntroDialogue as unknown as DialogueTree);
    this.dialogueManager.loadDialogueTree(caveWardenProgressDialogue as unknown as DialogueTree);
    this.dialogueManager.loadDialogueTree(caveWardenTurninDialogue as unknown as DialogueTree);
    this.dialogueManager.loadDialogueTree(caveWardenEliteOfferDialogue as unknown as DialogueTree);
    this.dialogueManager.loadDialogueTree(caveWardenEliteProgressDialogue as unknown as DialogueTree);
    this.dialogueManager.loadDialogueTree(caveWardenEliteTurninDialogue as unknown as DialogueTree);
    this.dialogueManager.loadDialogueTree(caveWardenDoneDialogue as unknown as DialogueTree);
    this.dialogueManager.loadDialogueTree(ruinsScoutIntroDialogue as unknown as DialogueTree);
    this.dialogueManager.loadDialogueTree(ruinsScoutProgressDialogue as unknown as DialogueTree);
    this.dialogueManager.loadDialogueTree(ruinsScoutTurninDialogue as unknown as DialogueTree);
    this.dialogueManager.loadDialogueTree(ruinsScoutDoneDialogue as unknown as DialogueTree);

    this.loadMap(this.currentMapId, data.playerPosition);
    this.setupEvents();
    this.setupCamera();
    this.updateHUD();
    this.updateQuestTrackerUI();

    this.scene.launch("UIScene");
    this.time.delayedCall(0, () => this.emitQuestLogUpdated());
  }

  private loadMap(mapId: string, playerPosition?: { x: number; y: number }): void {
    this.enemies.forEach((e) => e.destroy());
    this.npcs.forEach((n) => n.destroy());
    this.projectiles.forEach((p) => p.destroy());
    this.clearGroundLoot();
    this.clearTransitionMarkers();
    this.enemies = [];
    this.npcs = [];
    this.projectiles = [];
    this.enemyTemplateByRuntimeId.clear();

    this.currentMapId = mapId;
    
    // Clean up old decor sprites from previous map
    this.mapManager.cleanup();
    if (this.mapColliders) {
      this.mapColliders.clear(true, true);
    } else {
      this.mapColliders = this.physics.add.staticGroup();
    }
    
    // ExtractedData is obtained straight from the Tiled JSON now
    const mapData = this.mapManager.buildTilemap(this, mapId, "tileset");
    if (!mapData) return;

    mapData.collisionBoxes.forEach(box => {
      const zone = this.add.zone(box.x + box.width / 2, box.y + box.height / 2, box.width, box.height);
      this.physics.add.existing(zone, true);
      this.mapColliders.add(zone);
    });

    const worldWidth = mapData.width * mapData.tileSize;
    const worldHeight = mapData.height * mapData.tileSize;
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    const spawnPos = playerPosition ?? mapData.playerSpawn;

    if (!this.player) {
      const playerEntityData = this.entityManager.createPlayer(
        "player_1",
        "Hero",
        this.playerClass,
        spawnPos
      );
      this.player = new Player(this, playerEntityData);
    } else {
      this.player.getSprite().setPosition(spawnPos.x * 32 + 16, spawnPos.y * 32 + 16);
    }

    this.physics.add.collider(this.player.getSprite(), this.mapColliders);

    this.spawnEnemies(mapData.enemySpawns);
    this.spawnNpcs(mapData.npcSpawns);

    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.startFollow(this.player.getSprite(), true, 0.08, 0.08);

    this.addMapLabel(mapData.name);
    this.createTransitionMarkers();
  }

  private clearTransitionMarkers(): void {
    this.transitionMarkers.forEach((marker) => marker.destroy());
    this.transitionMarkers = [];
  }

  private createTransitionMarkers(): void {
    const data = this.mapManager.getExtractedData();
    if (!data) return;

    for (const transition of data.transitions) {
      const shouldRenderMarker =
        (this.currentMapId === "meadow" && transition.targetMapId === "cave")
        || (this.currentMapId === "cave" && transition.targetMapId === "ruins");

      if (shouldRenderMarker) {
        const markerX = (transition.x + transition.width / 2) * 32;
        const markerY = transition.y * 32 + 16;
        const marker = this.add.image(markerX, markerY, "marker_cave_entrance");
        marker.setDepth(transition.y * 32 + 28);
        this.transitionMarkers.push(marker);
      }
    }
  }

  private spawnEnemies(spawns: { enemyId: string; x: number; y: number; patrolRadius: number; respawnTimeMs: number }[]): void {
    spawns.forEach((spawn, index) => {
      const id = `enemy_${this.currentMapId}_${index}`;
      const entityData = this.entityManager.createEnemy(
        id,
        spawn.enemyId,
        { x: spawn.x, y: spawn.y },
        enemiesData as unknown as Record<string, unknown>
      );

      let respawnTimeMs = spawn.respawnTimeMs;
      if (this.currentMapId === "cave") {
        respawnTimeMs = spawn.enemyId === "cave_overseer" ? 22000 : 15000;
      }

      const enemy = new Enemy(this, entityData, spawn.patrolRadius, respawnTimeMs);
      this.enemies.push(enemy);
      this.enemyTemplateByRuntimeId.set(id, spawn.enemyId);

      // Add simple collision with player (no longer launches instanced combat)
      this.physics.add.collider(this.player.getSprite(), enemy.getSprite());
      this.physics.add.collider(enemy.getSprite(), this.mapColliders);
    });
  }

  private spawnNpcs(spawns: { npcId: string; name: string; x: number; y: number; dialogueTreeId: string }[]): void {
    spawns.forEach((spawn) => {
      const entityData = {
        id: spawn.npcId,
        name: spawn.name,
        type: EntityType.NPC,
        stats: {
          hp: 999, maxHp: 999, mana: 0, maxMana: 0,
          strength: 0, agility: 0, intelligence: 0,
          armor: 0, magicResist: 0,
        },
        level: 1,
        position: { x: spawn.x, y: spawn.y },
        spriteKey: `npc_${spawn.npcId}`,
      };

      const npc = new NPC(this, entityData, spawn.dialogueTreeId);
      this.npcs.push(npc);
    });
  }

  private setupEvents(): void {
    // UI Events
    eventBus.onEvent(GameEvents.DIALOGUE_OPEN, () => this.updateDialogueUI());
    eventBus.onEvent(GameEvents.DIALOGUE_ADVANCE, () => this.updateDialogueUI());
    eventBus.onEvent(GameEvents.DIALOGUE_CLOSE, () => this.hideDialogueUI());
    eventBus.onEvent(GameEvents.DIALOGUE_ACTION, (payload: unknown) => {
      this.handleDialogueAction(payload as DialogueAction);
    });
    eventBus.onEvent(GameEvents.PLAYER_LEVEL_UP, (level: unknown) => {
      this.showFloatingText(`Level Up! Lv.${level}`, 0xffd700, this.player.getSprite().x, this.player.getSprite().y - 40);
      this.updateHUD();
    });
    eventBus.onEvent(GameEvents.XP_GAINED, () => this.updateHUD());
    eventBus.onEvent(GameEvents.PLAYER_HEALED, (amount: unknown) => {
      this.handlePlayerHeal(Number(amount) || 0);
    });
    eventBus.onEvent(GameEvents.INVENTORY_USE_ITEM, (payload: unknown) => {
      this.handleInventoryUseItem(payload as { bagIndex: number; slotIndex: number });
    });

    // Combat Events
    eventBus.onEvent(GameEvents.PLAYER_ACTION_PRIMARY, (payload: unknown) => {
      const p = payload as { targetX: number, targetY: number };
      this.handlePlayerAttack(p.targetX, p.targetY, "primary");
    });
    
    eventBus.onEvent(GameEvents.ENEMY_ACTION_ATTACK, (payload: unknown) => {
      const p = payload as { enemyId: string, targetX: number, targetY: number };
      this.handleEnemyAttack(p.enemyId);
    });
  }

  private handlePlayerAttack(targetX: number, targetY: number, _type: string) {
    if (this.playerDead || this.dialogueManager.getIsActive()) return;

    const pPos = this.player.getPixelPosition();
    
    if (this.playerClass === "warrior") {
      // Melee attack
      const dx = targetX - pPos.x;
      const dy = targetY - pPos.y;
      const angle = Math.atan2(dy, dx);
      
      const swoosh = this.add.sprite(pPos.x + Math.cos(angle) * 20, pPos.y + Math.sin(angle) * 20, "effect_swoosh");
      swoosh.setRotation(angle);
      swoosh.setDepth(20);
      this.tweens.add({
        targets: swoosh,
        alpha: { from: 1, to: 0 },
        scale: { from: 0.8, to: 1.2 },
        duration: 150,
        onComplete: () => swoosh.destroy()
      });

      // Hit detection
      const hitRadius = 35;
      this.enemies.forEach(enemy => {
        if (enemy.getIsDead()) return;
        const ePos = { x: enemy.getSprite().x, y: enemy.getSprite().y };
        const dist = Phaser.Math.Distance.Between(pPos.x, pPos.y, ePos.x, ePos.y);
        if (dist <= hitRadius) {
          // Check if roughly in front
          const eAngle = Math.atan2(ePos.y - pPos.y, ePos.x - pPos.x);
          let angleDiff = Math.abs(Phaser.Math.Angle.Wrap(eAngle - angle));
          if (angleDiff < Math.PI / 2.5) {
            this.dealDamageToEnemy(enemy);
          }
        }
      });
    } else {
      // Ranged Projectile
      const projData: ProjectileData = {
        x: pPos.x, y: pPos.y, targetX, targetY,
        speed: 300, damage: 0, isEnemy: false, 
        spriteKey: "effect_projectile", creatorId: "player", lifespanMs: 1500
      };
      
      const projectile = new Projectile(this, projData);
      this.projectiles.push(projectile);
      
      this.enemies.forEach(enemy => {
        if (enemy.getIsDead() || !enemy.getBody()) return;
        this.physics.add.overlap(projectile.getSprite(), enemy.getSprite(), () => {
          if (projectile.getIsDead()) return;
          projectile.destroy();
          this.dealDamageToEnemy(enemy);
        });
      });
    }
  }

  private dealDamageToEnemy(enemy: Enemy) {
    const pData = this.entityManager.getPlayer()!;
    const eData = enemy.getData();
    const templateId = this.enemyTemplateByRuntimeId.get(eData.id);
    
    const damageResult = CombatManager.calculateBasicDamage(pData, eData);
    enemy.takeDamage(damageResult.damageDealt);
    
    this.showFloatingText(
      damageResult.damageDealt.toString() + (damageResult.isCritical ? "!" : ""),
      damageResult.isCritical ? 0xffbb00 : 0xffffff,
      enemy.getSprite().x,
      enemy.getSprite().y - 20
    );

    if (enemy.getIsDead()) {
      const xpGiven = eData.level * 15 + 10;
      this.entityManager.addXp(xpGiven);
      this.showFloatingText(`+${xpGiven} XP`, 0xc8a852, enemy.getSprite().x, enemy.getSprite().y);
      this.spawnLootForEnemy(enemy);
      this.registerQuestKill(templateId);
    }
  }

  private spawnLootForEnemy(enemy: Enemy): void {
    const templateId = this.enemyTemplateByRuntimeId.get(enemy.getData().id);
    if (!templateId) return;

    const lootEntries = this.inventoryManager.rollLoot(templateId);
    if (lootEntries.length === 0) return;

    lootEntries.forEach((entry, index) => {
      const spreadX = Phaser.Math.Between(-18, 18) + index * 8;
      const spreadY = Phaser.Math.Between(-10, 10);
      this.createGroundLoot(entry, enemy.getSprite().x + spreadX, enemy.getSprite().y + spreadY);
    });
  }

  private createGroundLoot(entry: LootRollResult, x: number, y: number): void {
    const item = this.inventoryManager.getItemDefinition(entry.itemId);
    if (!item) return;

    const container = this.add.container(x, y);
    container.setDepth(y + 20);

    const bg = this.add.rectangle(0, 0, 18, 18, this.getRarityColor(item.rarity), 0.95);
    bg.setStrokeStyle(2, 0x111111, 0.95);

    const effectTweens = this.addRarityDropEffects(container, item.rarity);

    const icon = this.add.text(0, -0.5, item.icon, {
      fontFamily: "'Press Start 2P'",
      fontSize: "8px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 2,
    });
    icon.setOrigin(0.5);

    const label = this.add.text(0, 14, `${item.name} x${entry.quantity}`, {
      fontFamily: "'Press Start 2P'",
      fontSize: "7px",
      color: this.getRarityLabelColor(item.rarity),
      stroke: "#000000",
      strokeThickness: 2,
    });
    label.setOrigin(0.5, 0);

    container.add([bg, icon, label]);

    const bobTween = this.tweens.add({
      targets: container,
      y: container.y - 3,
      duration: 850,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.groundLoot.push({
      id: `loot_${this.currentMapId}_${this.lootSequence++}`,
      itemId: entry.itemId,
      quantity: entry.quantity,
      container,
      label,
      bobTween,
      effectTweens,
    });

    if (item.rarity === "mythic") {
      this.showFloatingText("MYTHIC DROP!", 0xff57ff, x, y - 28);
    }
  }

  private addRarityDropEffects(container: Phaser.GameObjects.Container, rarity: ItemRarity): Phaser.Tweens.Tween[] {
    const tweens: Phaser.Tweens.Tween[] = [];

    if (rarity === "legendary") {
      const aura = this.add.circle(0, 0, 13, 0xff6633, 0.25);
      aura.setBlendMode(Phaser.BlendModes.ADD);
      container.addAt(aura, 0);

      tweens.push(
        this.tweens.add({
          targets: aura,
          scale: { from: 0.85, to: 1.35 },
          alpha: { from: 0.3, to: 0.06 },
          duration: 580,
          yoyo: true,
          repeat: -1,
        })
      );
    }

    if (rarity === "mythic") {
      const auraCore = this.add.circle(0, 0, 13, 0xda54ff, 0.38);
      auraCore.setBlendMode(Phaser.BlendModes.ADD);
      const auraOuter = this.add.circle(0, 0, 20, 0xa13dff, 0.2);
      auraOuter.setBlendMode(Phaser.BlendModes.ADD);
      const runeRing = this.add.circle(0, 0, 17, 0x000000, 0);
      runeRing.setStrokeStyle(2, 0xe485ff, 0.78);
      runeRing.setBlendMode(Phaser.BlendModes.ADD);
      const spikeRing = this.add.star(0, 0, 8, 12, 18, 0xc95bff, 0.15);
      spikeRing.setBlendMode(Phaser.BlendModes.ADD);
      const flash = this.add.circle(0, 0, 10, 0xffffff, 0.12);
      flash.setBlendMode(Phaser.BlendModes.ADD);

      container.addAt(auraOuter, 0);
      container.addAt(runeRing, 1);
      container.addAt(auraCore, 2);
      container.addAt(spikeRing, 3);
      container.addAt(flash, 4);

      tweens.push(
        this.tweens.add({
          targets: auraCore,
          scale: { from: 0.82, to: 1.3 },
          alpha: { from: 0.45, to: 0.14 },
          duration: 360,
          yoyo: true,
          repeat: -1,
        })
      );
      tweens.push(
        this.tweens.add({
          targets: auraOuter,
          scale: { from: 0.88, to: 1.38 },
          alpha: { from: 0.24, to: 0.04 },
          duration: 620,
          yoyo: true,
          repeat: -1,
        })
      );
      tweens.push(
        this.tweens.add({
          targets: runeRing,
          angle: 360,
          duration: 1250,
          repeat: -1,
        })
      );
      tweens.push(
        this.tweens.add({
          targets: spikeRing,
          angle: -360,
          duration: 2100,
          repeat: -1,
        })
      );
      tweens.push(
        this.tweens.add({
          targets: flash,
          alpha: { from: 0.2, to: 0.02 },
          scale: { from: 0.8, to: 1.55 },
          duration: 520,
          yoyo: true,
          repeat: -1,
        })
      );
    }

    return tweens;
  }

  private tryPickupNearbyLoot(): void {
    const playerPos = this.player.getPixelPosition();

    for (let i = this.groundLoot.length - 1; i >= 0; i--) {
      const loot = this.groundLoot[i];
      const distance = Phaser.Math.Distance.Between(playerPos.x, playerPos.y, loot.container.x, loot.container.y);
      if (distance > 24) continue;

      const item = this.inventoryManager.getItemDefinition(loot.itemId);
      const result = this.inventoryManager.addItem(loot.itemId, loot.quantity);

      if (result.added > 0 && item) {
        this.showFloatingText(`+ ${item.name}${result.added > 1 ? ` x${result.added}` : ""}`, 0x7fd7ff, loot.container.x, loot.container.y - 14);
      }

      if (result.remaining <= 0) {
        this.destroyLootEntry(i);
      } else {
        loot.quantity = result.remaining;
        if (item) {
          loot.label.setText(`${item.name} x${loot.quantity}`);
        }
        this.showFloatingText("Inventory Full", 0xff7777, playerPos.x, playerPos.y - 30);
      }
    }
  }

  private destroyLootEntry(index: number): void {
    const loot = this.groundLoot[index];
    if (!loot) return;
    loot.bobTween.stop();
    loot.effectTweens.forEach((effect) => effect.stop());
    loot.container.destroy();
    this.groundLoot.splice(index, 1);
  }

  private clearGroundLoot(): void {
    for (let i = this.groundLoot.length - 1; i >= 0; i--) {
      this.destroyLootEntry(i);
    }
  }

  private getRarityColor(rarity: ItemRarity): number {
    switch (rarity) {
      case "rare":
        return 0x3f87e0;
      case "legendary":
        return 0xef6a2f;
      case "mythic":
        return 0xbf43f2;
      default:
        return 0x7f8e9a;
    }
  }

  private getRarityLabelColor(rarity: ItemRarity): string {
    switch (rarity) {
      case "rare":
        return "#8fbaff";
      case "legendary":
        return "#ff9f72";
      case "mythic":
        return "#e48cff";
      default:
        return "#f2e4be";
    }
  }

  private handleEnemyAttack(enemyId: string) {
    if (this.playerDead) return;
    
    const enemy = this.enemies.find(e => e.getData().id === enemyId);
    if (!enemy || enemy.getIsDead()) return;

    const pData = this.entityManager.getPlayer()!;
    const damageResult = CombatManager.calculateBasicDamage(enemy.getData(), pData);
    
    pData.stats.hp -= damageResult.damageDealt;
    
    this.player.getSprite().setTint(0xff0000);
    this.time.delayedCall(150, () => {
      this.player.getSprite().setTint(0xffffff);
    });

    this.showFloatingText(
      "-" + damageResult.damageDealt.toString(),
      0xff4444,
      this.player.getSprite().x,
      this.player.getSprite().y - 20
    );

    this.updateHUD();

    if (pData.stats.hp <= 0) {
      pData.stats.hp = 0;
      this.playerDead = true;
      this.inputManager.setEnabled(false);
      this.player.getSprite().setTint(0x555555);
      this.player.getSprite().setAlpha(0.5);
      this.showFloatingText("YOU DIED", 0xff0000, this.cameras.main.centerX, this.cameras.main.centerY);
    }
  }

  private handleInventoryUseItem(payload: { bagIndex: number; slotIndex: number }): void {
    if (this.playerDead) return;

    const player = this.entityManager.getPlayer();
    if (!player) return;

    const state = this.inventoryManager.getState();
    const bag = state.bags[payload.bagIndex];
    const slot = bag?.slots[payload.slotIndex];
    if (!slot?.itemId) return;

    const definition = this.inventoryManager.getItemDefinition(slot.itemId);
    if (!definition || definition.category !== "consumable" || !definition.healAmount || definition.healAmount <= 0) {
      this.showFloatingText("This item cannot be used.", 0xff9f9f, this.player.getSprite().x, this.player.getSprite().y - 28);
      return;
    }

    if (player.stats.hp >= player.stats.maxHp) {
      this.showFloatingText("HP is already full.", 0xffc56b, this.player.getSprite().x, this.player.getSprite().y - 28);
      return;
    }

    const consumeResult = this.inventoryManager.consumeBagItem(payload.bagIndex, payload.slotIndex, 1);
    if (!consumeResult.success) {
      this.showFloatingText(consumeResult.message, 0xff9f9f, this.player.getSprite().x, this.player.getSprite().y - 28);
      return;
    }

    this.handlePlayerHeal(definition.healAmount);
  }

  private handlePlayerHeal(amount: number): void {
    if (this.playerDead || amount <= 0) return;

    const player = this.entityManager.getPlayer();
    if (!player) return;

    const hpBefore = player.stats.hp;
    this.entityManager.healEntity(player.id, amount);
    const healedAmount = Math.max(0, Math.floor(player.stats.hp - hpBefore));

    if (healedAmount > 0) {
      this.showFloatingText(`+${healedAmount} HP`, 0x78f0a8, this.player.getSprite().x, this.player.getSprite().y - 30);
      this.updateHUD();
    }
  }

  private setupCamera(): void {
    this.cameras.main.setBackgroundColor("#1a1a2e");
    this.cameras.main.setRoundPixels(true);
  }

  private addMapLabel(name: string): void {
    const label = this.add.text(this.cameras.main.centerX, 40, name, {
      fontFamily: "'Press Start 2P'", fontSize: "14px", color: "#c8a852", stroke: "#000000", strokeThickness: 4,
    });
    label.setOrigin(0.5).setScrollFactor(0).setDepth(100).setAlpha(0);
    this.tweens.add({ targets: label, alpha: { from: 0, to: 1 }, duration: 800, hold: 2000, yoyo: true, onComplete: () => label.destroy() });
  }

  private showFloatingText(text: string, color: number, x: number, y: number): void {
    const floatText = this.add.text(x, y, text, {
      fontFamily: "'Press Start 2P'", fontSize: "9px", color: `#${color.toString(16).padStart(6, "0")}`, stroke: "#000000", strokeThickness: 3,
    });
    floatText.setOrigin(0.5).setDepth(200);
    this.tweens.add({
      targets: floatText, y: floatText.y - 30, alpha: { from: 1, to: 0 }, duration: 1200, ease: "Cubic.easeOut", onComplete: () => floatText.destroy(),
    });
  }

  private updateHUD(): void {
    const player = this.entityManager.getPlayer();
    const state = this.entityManager.getPlayerState();
    if (!player || !state) return;

    document.getElementById("hp-bar-fill")!.style.width = `${(player.stats.hp / player.stats.maxHp) * 100}%`;
    document.getElementById("hp-bar-text")!.textContent = `${Math.floor(player.stats.hp)} / ${Math.floor(player.stats.maxHp)}`;
    document.getElementById("mana-bar-fill")!.style.width = `${(player.stats.mana / player.stats.maxMana) * 100}%`;
    document.getElementById("mana-bar-text")!.textContent = `${Math.floor(player.stats.mana)} / ${Math.floor(player.stats.maxMana)}`;
    document.getElementById("hud-level")!.textContent = `Lv. ${player.level}`;
    document.getElementById("xp-bar-fill")!.style.width = `${(state.xp / state.xpToNextLevel) * 100}%`;
    document.getElementById("xp-bar-text")!.textContent = `${state.xp} / ${state.xpToNextLevel} XP`;
  }

  private updateDialogueUI(): void {
    const node = this.dialogueManager.getCurrentNode();
    if (!node) return;

    document.getElementById("dialogue-container")?.classList.remove("hidden");
    document.getElementById("dialogue-speaker")!.textContent = node.speaker;
    document.getElementById("dialogue-text")!.textContent = node.text;
    
    const choicesEl = document.getElementById("dialogue-choices")!;
    choicesEl.innerHTML = "";
    node.choices.forEach((choice, index) => {
      const btn = document.createElement("button");
      btn.className = "dialogue-choice-btn";
      btn.textContent = choice.text;
      btn.addEventListener("click", () => this.dialogueManager.selectChoice(index));
      choicesEl.appendChild(btn);
    });
  }

  private hideDialogueUI(): void {
    document.getElementById("dialogue-container")?.classList.add("hidden");
  }

  update(_time: number, delta: number): void {
    if (this.isTransitioning) return;

    const input = this.inputManager.getState();

    if (!this.dialogueManager.getIsActive() && !this.playerDead) {
      this.player?.handleInput(input);
    } else {
      this.player?.forceStopMovement();
    }

    const pPos = this.player.getPixelPosition();
    this.enemies.forEach((e) => {
      e.updateAI(delta, pPos.x, pPos.y, this.playerDead);
    });
    
    this.npcs.forEach((n) => n.update(delta));
    this.player.update(delta);
    
    // Projectiles
    this.projectiles = this.projectiles.filter(p => !p.getIsDead());
    this.projectiles.forEach(p => p.update(delta));

    if (!this.playerDead) {
      this.tryPickupNearbyLoot();
      this.checkInteractions(input);
      this.checkMapTransition(input);
    }
    
    // Y-based depth sorting — entities render behind/in-front-of decor (2.5D occlusion)
    this.updateDepthSorting();
    
    this.updateActionUI();
  }

  private updateDepthSorting(): void {
    // Player depth = bottom of sprite (Y position)
    if (this.player) {
      this.player.getSprite().setDepth(this.player.getSprite().y + 16);
    }
    // Enemies
    this.enemies.forEach(e => {
      e.getSprite().setDepth(e.getSprite().y + 16);
    });
    // NPCs
    this.npcs.forEach(n => {
      n.getSprite().setDepth(n.getSprite().y + 16);
    });
    // Projectiles always on top
    this.projectiles.forEach(p => {
      p.getSprite().setDepth(9999);
    });

    this.groundLoot.forEach((loot) => {
      loot.container.setDepth(loot.container.y + 20);
    });
  }

  private updateActionUI(): void {
    if (!this.player) return;
    const cds = this.player.getCooldowns();
    
    const pCd = document.getElementById("cd-primary");
    if (pCd) pCd.style.height = `${(cds.primary / cds.primaryMax) * 100}%`;

    const qCd = document.getElementById("cd-q");
    if (qCd) qCd.style.height = `${(cds.skill1 / cds.skill1Max) * 100}%`;

    const eCd = document.getElementById("cd-e");
    if (eCd) eCd.style.height = `${(cds.skill2 / cds.skill2Max) * 100}%`;
  }

  private checkInteractions(input: { interact: boolean }): void {
    if (this.dialogueManager.getIsActive()) return;

    const pPos = this.player.getPixelPosition();
    let interacted = false;

    // Check NPCs
    for (const npc of this.npcs) {
      const inRange = npc.isPlayerInRange(pPos.x, pPos.y);
      npc.showInteractionPrompt(inRange);

      if (inRange && input.interact && !interacted) {
        this.player.stopMovement();
        this.dialogueManager.startDialogue(this.resolveDialogueTreeId(npc));
        interacted = true;
      }
    }

    // Check Objects
    if (input.interact && !interacted) {
      const data = this.mapManager.getExtractedData();
      if (!data) return;

      const pTile = this.player.getTilePosition();
      for (const obj of data.interactables) {
        if (pTile.x >= obj.x && pTile.x < obj.x + obj.width && pTile.y >= obj.y && pTile.y < obj.y + obj.height) {
          this.player.stopMovement();
          // Trigger dialogue UI with message
          document.getElementById("dialogue-container")?.classList.remove("hidden");
          document.getElementById("dialogue-speaker")!.textContent = "System";
          document.getElementById("dialogue-text")!.textContent = obj.message;
          const choicesEl = document.getElementById("dialogue-choices")!;
          choicesEl.innerHTML = "";
          
          const btn = document.createElement("button");
          btn.className = "dialogue-choice-btn";
          btn.textContent = "[Close]";
          btn.addEventListener("click", () => {
            document.getElementById("dialogue-container")?.classList.add("hidden");
          });
          choicesEl.appendChild(btn);
          interacted = true;
          break;
        }
      }
    }
  }

  private checkMapTransition(input: InputState): void {
    if (this.isTransitioning) return;

    const tilePos = this.player.getTilePosition();
    const transition = this.findAvailableTransition(tilePos, input);

    if (transition) {
      if (transition.targetMapId === "cave" && this.firstQuestStatus !== "completed") {
        if (this.time.now - this.blockedTransitionMessageAt > 1200) {
          this.showFloatingText("The cave path is still sealed.", 0xffc56b, this.player.getSprite().x, this.player.getSprite().y - 30);
          this.blockedTransitionMessageAt = this.time.now;
        }
        return;
      }

      if (transition.targetMapId === "ruins" && this.caveEliteQuestStatus !== "completed") {
        if (this.time.now - this.blockedTransitionMessageAt > 1200) {
          this.showFloatingText("A heavy barrier blocks the sanctum gate.", 0xffc56b, this.player.getSprite().x, this.player.getSprite().y - 30);
          this.blockedTransitionMessageAt = this.time.now;
        }
        return;
      }

      if (!this.canActivateTransition(tilePos, transition, input)) {
        if (this.isTransitionAdjacent(tilePos, transition) && this.time.now - this.blockedTransitionMessageAt > 1200) {
          const hint = transition.targetMapId === "cave"
            ? "Press E or move into the cave entrance."
            : "Press E to enter.";
          this.showFloatingText(hint, 0x9ad8ff, this.player.getSprite().x, this.player.getSprite().y - 30);
          this.blockedTransitionMessageAt = this.time.now;
        }
        return;
      }

      this.isTransitioning = true;
      this.cameras.main.fadeOut(400, 0, 0, 0);

      this.cameras.main.once("camerafadeoutcomplete", () => {
        this.loadMap(transition.targetMapId, { x: transition.targetX, y: transition.targetY });
        this.cameras.main.fadeIn(400, 0, 0, 0);
        this.cameras.main.once("camerafadeincomplete", () => {
          this.isTransitioning = false;
        });
      });
    }
  }

  private findAvailableTransition(tilePos: { x: number; y: number }, input: InputState): TransitionZone | null {
    const onTile = this.mapManager.getTransitionAt(tilePos.x, tilePos.y);
    if (onTile) return onTile;

    const data = this.mapManager.getExtractedData();
    if (!data) return null;

    for (const transition of data.transitions) {
      if (this.isPushingIntoTransition(tilePos, transition, input)) {
        return transition;
      }

      if (input.interact && this.isTransitionAdjacent(tilePos, transition)) {
        return transition;
      }
    }

    return null;
  }

  private canActivateTransition(tilePos: { x: number; y: number }, transition: TransitionZone, input: InputState): boolean {
    if (this.isTileInsideTransition(tilePos, transition)) {
      return true;
    }

    if (this.isPushingIntoTransition(tilePos, transition, input)) {
      return true;
    }

    if (input.interact && this.isTransitionAdjacent(tilePos, transition)) {
      return true;
    }

    return false;
  }

  private isTileInsideTransition(tilePos: { x: number; y: number }, transition: TransitionZone): boolean {
    return tilePos.x >= transition.x
      && tilePos.x < transition.x + transition.width
      && tilePos.y >= transition.y
      && tilePos.y < transition.y + transition.height;
  }

  private isTransitionAdjacent(tilePos: { x: number; y: number }, transition: TransitionZone): boolean {
    const verticalTouch = tilePos.x >= transition.x
      && tilePos.x < transition.x + transition.width
      && (tilePos.y === transition.y - 1 || tilePos.y === transition.y + transition.height);

    const horizontalTouch = tilePos.y >= transition.y
      && tilePos.y < transition.y + transition.height
      && (tilePos.x === transition.x - 1 || tilePos.x === transition.x + transition.width);

    return verticalTouch || horizontalTouch;
  }

  private isPushingIntoTransition(
    tilePos: { x: number; y: number },
    transition: TransitionZone,
    input: InputState
  ): boolean {
    const pushUp = input.up
      && tilePos.x >= transition.x
      && tilePos.x < transition.x + transition.width
      && tilePos.y === transition.y + transition.height;

    const pushDown = input.down
      && tilePos.x >= transition.x
      && tilePos.x < transition.x + transition.width
      && tilePos.y === transition.y - 1;

    const pushLeft = input.left
      && tilePos.y >= transition.y
      && tilePos.y < transition.y + transition.height
      && tilePos.x === transition.x + transition.width;

    const pushRight = input.right
      && tilePos.y >= transition.y
      && tilePos.y < transition.y + transition.height
      && tilePos.x === transition.x - 1;

    return pushUp || pushDown || pushLeft || pushRight;
  }

  private handleDialogueAction(action: DialogueAction): void {
    if (action.type === "startQuest" && typeof action.value === "string") {
      switch (action.value) {
        case "elder_hunt":
          this.startFirstQuest();
          return;
        case "cave_purge":
          this.startCavePurgeQuest();
          return;
        case "cave_elite_hunt":
          this.startCaveEliteQuest();
          return;
        case "ruins_overlord_hunt":
          this.startRuinsEliteQuest();
          return;
        default:
          break;
      }
    }

    if (action.type === "completeQuest" && typeof action.value === "string") {
      switch (action.value) {
        case "elder_hunt":
          this.completeFirstQuest();
          return;
        case "cave_purge":
          this.completeCavePurgeQuest();
          return;
        case "cave_elite_hunt":
          this.completeCaveEliteQuest();
          return;
        case "ruins_overlord_hunt":
          this.completeRuinsEliteQuest();
          return;
        default:
          break;
      }
    }

    if (action.type === "sellNeutral") {
      const result = this.inventoryManager.sellAllNeutralItems();
      if (result.currencyEarned > 0) {
        this.showFloatingText(`Sold +${result.currencyEarned} coins`, 0x8ee7ff, this.player.getSprite().x, this.player.getSprite().y - 28);
      } else {
        this.showFloatingText("No neutral materials to sell.", 0xff9f9f, this.player.getSprite().x, this.player.getSprite().y - 28);
      }
      return;
    }

    if (action.type === "buyItem" && typeof action.value === "string") {
      const buyResult = this.inventoryManager.buyShopItem(action.value, 1);
      const color = buyResult.success ? 0xa4ff9a : 0xff9f9f;
      this.showFloatingText(buyResult.message, color, this.player.getSprite().x, this.player.getSprite().y - 28);
    }
  }

  private resolveDialogueTreeId(npc: NPC): string {
    const npcId = npc.getData().id;

    if (npcId === "elder") {
      return this.resolveElderDialogueId();
    }

    if (npcId === "cave_warden") {
      if (this.cavePurgeQuestStatus === "not-started") return "cave_warden_intro";
      if (this.cavePurgeQuestStatus === "active") return "cave_warden_progress";
      if (this.cavePurgeQuestStatus === "ready-to-turn-in") return "cave_warden_turnin";
      if (this.caveEliteQuestStatus === "not-started") return "cave_warden_elite_offer";
      if (this.caveEliteQuestStatus === "active") return "cave_warden_elite_progress";
      if (this.caveEliteQuestStatus === "ready-to-turn-in") return "cave_warden_elite_turnin";
      return "cave_warden_done";
    }

    if (npcId === "ruins_scout") {
      if (this.ruinsEliteQuestStatus === "not-started") return "ruins_scout_intro";
      if (this.ruinsEliteQuestStatus === "active") return "ruins_scout_progress";
      if (this.ruinsEliteQuestStatus === "ready-to-turn-in") return "ruins_scout_turnin";
      return "ruins_scout_done";
    }

    return npc.getDialogueTreeId();
  }

  private resolveElderDialogueId(): string {
    switch (this.firstQuestStatus) {
      case "active":
        return "elder_progress";
      case "ready-to-turn-in":
        return "elder_turnin";
      case "completed":
        return "elder_completed";
      default:
        return "elder";
    }
  }

  private startFirstQuest(): void {
    if (this.firstQuestStatus !== "not-started") return;
    this.firstQuestStatus = "active";
    this.firstQuestKills = { slime: 0, wolf: 0 };
    this.refreshQuestUi();
    this.showFloatingText("Quest started: Meadow Hunt", 0xffe38a, this.player.getSprite().x, this.player.getSprite().y - 36);
  }

  private startCavePurgeQuest(): void {
    if (this.cavePurgeQuestStatus !== "not-started") return;
    this.cavePurgeQuestStatus = "active";
    this.cavePurgeKills = { bandit: 0, wolf: 0 };
    this.refreshQuestUi();
    this.showFloatingText("Quest started: Cave Purge", 0xffe38a, this.player.getSprite().x, this.player.getSprite().y - 36);
  }

  private startCaveEliteQuest(): void {
    if (this.cavePurgeQuestStatus !== "completed") return;
    if (this.caveEliteQuestStatus !== "not-started") return;
    this.caveEliteQuestStatus = "active";
    this.caveEliteKills = 0;
    this.refreshQuestUi();
    this.showFloatingText("Quest started: Cave Overseer", 0xffd17a, this.player.getSprite().x, this.player.getSprite().y - 36);
  }

  private startRuinsEliteQuest(): void {
    if (this.caveEliteQuestStatus !== "completed") return;
    if (this.ruinsEliteQuestStatus !== "not-started") return;
    this.ruinsEliteQuestStatus = "active";
    this.ruinsEliteKills = 0;
    this.refreshQuestUi();
    this.showFloatingText("Quest started: Revenant Hunt", 0xffd17a, this.player.getSprite().x, this.player.getSprite().y - 36);
  }

  private registerQuestKill(enemyTemplateId?: string): void {
    if (!enemyTemplateId) return;

    if (this.firstQuestStatus === "active") {
      if (enemyTemplateId === "slime") {
        this.firstQuestKills.slime = Math.min(this.firstQuestTargets.slime, this.firstQuestKills.slime + 1);
      } else if (enemyTemplateId === "wolf") {
        this.firstQuestKills.wolf = Math.min(this.firstQuestTargets.wolf, this.firstQuestKills.wolf + 1);
      }

      if (enemyTemplateId === "slime" || enemyTemplateId === "wolf") {
        this.showFloatingText(
          `Meadow ${this.firstQuestKills.slime}/${this.firstQuestTargets.slime} Slime, ${this.firstQuestKills.wolf}/${this.firstQuestTargets.wolf} Wolf`,
          0x9ad8ff,
          this.player.getSprite().x,
          this.player.getSprite().y - 44
        );

        if (
          this.firstQuestKills.slime >= this.firstQuestTargets.slime
          && this.firstQuestKills.wolf >= this.firstQuestTargets.wolf
        ) {
          this.firstQuestStatus = "ready-to-turn-in";
          this.showFloatingText("Return to the Village Elder.", 0xc8f08a, this.player.getSprite().x, this.player.getSprite().y - 58);
        }
      }
    }

    if (this.cavePurgeQuestStatus === "active") {
      if (enemyTemplateId === "bandit") {
        this.cavePurgeKills.bandit = Math.min(this.cavePurgeTargets.bandit, this.cavePurgeKills.bandit + 1);
      } else if (enemyTemplateId === "wolf") {
        this.cavePurgeKills.wolf = Math.min(this.cavePurgeTargets.wolf, this.cavePurgeKills.wolf + 1);
      }

      if (enemyTemplateId === "bandit" || enemyTemplateId === "wolf") {
        this.showFloatingText(
          `Cave ${this.cavePurgeKills.bandit}/${this.cavePurgeTargets.bandit} Bandit, ${this.cavePurgeKills.wolf}/${this.cavePurgeTargets.wolf} Wolf`,
          0x9ad8ff,
          this.player.getSprite().x,
          this.player.getSprite().y - 44
        );

        if (
          this.cavePurgeKills.bandit >= this.cavePurgeTargets.bandit
          && this.cavePurgeKills.wolf >= this.cavePurgeTargets.wolf
        ) {
          this.cavePurgeQuestStatus = "ready-to-turn-in";
          this.showFloatingText("Report to Cave Warden Lysa.", 0xc8f08a, this.player.getSprite().x, this.player.getSprite().y - 58);
        }
      }
    }

    if (this.caveEliteQuestStatus === "active" && enemyTemplateId === "cave_overseer") {
      this.caveEliteKills = 1;
      this.caveEliteQuestStatus = "ready-to-turn-in";
      this.showFloatingText("Cave Overseer defeated. Report back.", 0xf2c17a, this.player.getSprite().x, this.player.getSprite().y - 58);
    }

    if (this.ruinsEliteQuestStatus === "active" && enemyTemplateId === "void_revenant") {
      this.ruinsEliteKills = 1;
      this.ruinsEliteQuestStatus = "ready-to-turn-in";
      this.showFloatingText("Void Revenant destroyed. Return to Ivar.", 0xff7eff, this.player.getSprite().x, this.player.getSprite().y - 58);
    }

    this.refreshQuestUi();
  }

  private completeFirstQuest(): void {
    if (this.firstQuestStatus !== "ready-to-turn-in") return;

    this.firstQuestStatus = "completed";
    this.inventoryManager.addCurrency(120);
    this.entityManager.addXp(120);
    this.refreshQuestUi();
    this.showFloatingText("Cave unlocked! +120 XP +120 coins", 0xc8f08a, this.player.getSprite().x, this.player.getSprite().y - 44);
  }

  private completeCavePurgeQuest(): void {
    if (this.cavePurgeQuestStatus !== "ready-to-turn-in") return;

    this.cavePurgeQuestStatus = "completed";
    this.inventoryManager.addCurrency(180);
    this.entityManager.addXp(220);
    this.grantRewardItem("cave_hunter_mail", 1, "Reward: Cave Hunter Mail");
    this.refreshQuestUi();
    this.showFloatingText("Cave route secured! +220 XP +180 coins", 0xc8f08a, this.player.getSprite().x, this.player.getSprite().y - 44);
  }

  private completeCaveEliteQuest(): void {
    if (this.caveEliteQuestStatus !== "ready-to-turn-in") return;

    this.caveEliteQuestStatus = "completed";
    this.inventoryManager.addCurrency(320);
    this.entityManager.addXp(380);
    this.grantRewardItem("warden_pike", 1, "Reward: Warden Pike");
    this.refreshQuestUi();
    this.showFloatingText("Sanctum gate unlocked! +380 XP +320 coins", 0xf2d07d, this.player.getSprite().x, this.player.getSprite().y - 44);
  }

  private completeRuinsEliteQuest(): void {
    if (this.ruinsEliteQuestStatus !== "ready-to-turn-in") return;

    this.ruinsEliteQuestStatus = "completed";
    this.inventoryManager.addCurrency(650);
    this.entityManager.addXp(800);
    this.grantRewardItem("duskreaver", 1, "Reward: Duskreaver");
    this.grantRewardItem("crown_of_ashes", 1, "Reward: Crown of Ashes");
    this.refreshQuestUi();
    this.showFloatingText("Sanctum cleared! +800 XP +650 coins", 0xff7eff, this.player.getSprite().x, this.player.getSprite().y - 44);
  }

  private grantRewardItem(itemId: string, quantity: number, rewardText: string): void {
    const result = this.inventoryManager.addItem(itemId, quantity);
    if (result.remaining <= 0) {
      this.showFloatingText(rewardText, 0x8ee7ff, this.player.getSprite().x, this.player.getSprite().y - 62);
      return;
    }

    this.showFloatingText("Reward item dropped: Inventory Full", 0xff9f9f, this.player.getSprite().x, this.player.getSprite().y - 62);
  }

  private refreshQuestUi(): void {
    this.updateQuestTrackerUI();
    this.emitQuestLogUpdated();
  }

  private updateQuestTrackerUI(): void {
    const tracker = document.getElementById("quest-tracker");
    if (!tracker) return;

    if (this.firstQuestStatus !== "completed") {
      if (this.firstQuestStatus === "not-started") {
        tracker.textContent = "Quest: Speak with the Village Elder.";
      } else if (this.firstQuestStatus === "active") {
        tracker.textContent = `Quest: Slimes ${this.firstQuestKills.slime}/${this.firstQuestTargets.slime}, Wolves ${this.firstQuestKills.wolf}/${this.firstQuestTargets.wolf}`;
      } else {
        tracker.textContent = "Quest: Return to Elder to unlock the cave.";
      }
      return;
    }

    if (this.cavePurgeQuestStatus !== "completed") {
      if (this.cavePurgeQuestStatus === "not-started") {
        tracker.textContent = "Quest: Speak with Cave Warden Lysa.";
      } else if (this.cavePurgeQuestStatus === "active") {
        tracker.textContent = `Quest: Cave Bandits ${this.cavePurgeKills.bandit}/${this.cavePurgeTargets.bandit}, Wolves ${this.cavePurgeKills.wolf}/${this.cavePurgeTargets.wolf}`;
      } else {
        tracker.textContent = "Quest: Return to Cave Warden Lysa.";
      }
      return;
    }

    if (this.caveEliteQuestStatus !== "completed") {
      if (this.caveEliteQuestStatus === "not-started") {
        tracker.textContent = "Quest: Accept elite hunt from Cave Warden Lysa.";
      } else if (this.caveEliteQuestStatus === "active") {
        tracker.textContent = `Quest: Cave Overseer ${this.caveEliteKills}/1`;
      } else {
        tracker.textContent = "Quest: Return to Lysa to unlock Sunken Sanctum.";
      }
      return;
    }

    if (this.ruinsEliteQuestStatus !== "completed") {
      if (this.ruinsEliteQuestStatus === "not-started") {
        tracker.textContent = "Quest: Speak with Sanctum Scout Ivar.";
      } else if (this.ruinsEliteQuestStatus === "active") {
        tracker.textContent = `Quest: Void Revenant ${this.ruinsEliteKills}/1`;
      } else {
        tracker.textContent = "Quest: Return to Ivar for final reward.";
      }
      return;
    }

    tracker.textContent = "Questline complete: Eldermoor, Cave and Sanctum secured.";
  }

  private emitQuestLogUpdated(): void {
    eventBus.emitEvent(GameEvents.QUEST_LOG_UPDATED, this.buildQuestLogEntries());
  }

  private buildQuestLogEntries(): QuestLogEntryView[] {
    return [
      {
        id: "elder_hunt",
        title: "Meadow Hunt",
        description: "Hunt 5 slimes and 5 wolves in Eldermoor Meadow, then report to the Village Elder to unlock the cave route.",
        status: this.toQuestUiStatus(this.firstQuestStatus),
        objectives: [
          {
            id: "kill_slimes",
            label: "Defeat Green Slimes",
            current: this.firstQuestKills.slime,
            target: this.firstQuestTargets.slime,
            isComplete: this.firstQuestKills.slime >= this.firstQuestTargets.slime,
          },
          {
            id: "kill_wolves",
            label: "Defeat Shadow Wolves",
            current: this.firstQuestKills.wolf,
            target: this.firstQuestTargets.wolf,
            isComplete: this.firstQuestKills.wolf >= this.firstQuestTargets.wolf,
          },
        ],
      },
      {
        id: "cave_purge",
        title: "Cave Purge",
        description: "Inside the cave, eliminate 4 bandits and 4 wolves to secure the tunnel entrance.",
        status: this.toQuestUiStatus(this.cavePurgeQuestStatus),
        objectives: [
          {
            id: "kill_bandits",
            label: "Defeat Cave Bandits",
            current: this.cavePurgeKills.bandit,
            target: this.cavePurgeTargets.bandit,
            isComplete: this.cavePurgeKills.bandit >= this.cavePurgeTargets.bandit,
          },
          {
            id: "kill_cave_wolves",
            label: "Defeat Cave Wolves",
            current: this.cavePurgeKills.wolf,
            target: this.cavePurgeTargets.wolf,
            isComplete: this.cavePurgeKills.wolf >= this.cavePurgeTargets.wolf,
          },
        ],
      },
      {
        id: "cave_elite_hunt",
        title: "Cave Overseer",
        description: "Track and defeat the elite Cave Overseer in the northern chamber.",
        status: this.toQuestUiStatus(this.caveEliteQuestStatus),
        objectives: [
          {
            id: "kill_cave_overseer",
            label: "Defeat Cave Overseer",
            current: this.caveEliteKills,
            target: 1,
            isComplete: this.caveEliteKills >= 1,
          },
        ],
      },
      {
        id: "ruins_overlord_hunt",
        title: "Void Revenant",
        description: "In the Sunken Sanctum, reach the shrine and destroy the Void Revenant elite.",
        status: this.toQuestUiStatus(this.ruinsEliteQuestStatus),
        objectives: [
          {
            id: "kill_void_revenant",
            label: "Defeat Void Revenant",
            current: this.ruinsEliteKills,
            target: 1,
            isComplete: this.ruinsEliteKills >= 1,
          },
        ],
      },
    ];
  }

  private toQuestUiStatus(status: "not-started" | "active" | "ready-to-turn-in" | "completed"): QuestUiStatus {
    switch (status) {
      case "active":
        return "active";
      case "ready-to-turn-in":
        return "ready";
      case "completed":
        return "completed";
      default:
        return "available";
    }
  }
}
