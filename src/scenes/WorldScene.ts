import Phaser from "phaser";
import { MapManager } from "@core/MapManager";
import { EntityManager } from "@core/EntityManager";
import { InputManager } from "@core/InputManager";
import { DialogueManager } from "@core/DialogueManager";
import { eventBus, GameEvents } from "@core/EventBus";
import { InventoryManager } from "@core/InventoryManager";
import { Player } from "@entities/Player";
import { Enemy } from "@entities/Enemy";
import { NPC } from "@entities/NPC";
import { Projectile } from "@entities/Projectile";
import type { ProjectileData } from "@entities/Projectile";
import { CombatManager } from "@core/CombatManager";
import type { DialogueTree } from "@data/types/Dialogue";
import enemiesData from "@data/definitions/enemies.json";
import elderDialogue from "@data/definitions/dialogues/elder.json";
import { EntityType } from "@data/types/Entity";
import type { ItemRarity, LootRollResult } from "@data/types/Item";

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

    this.loadMap(this.currentMapId, data.playerPosition);
    this.setupEvents();
    this.setupCamera();
    this.updateHUD();

    this.scene.launch("UIScene");
  }

  private loadMap(mapId: string, playerPosition?: { x: number; y: number }): void {
    this.enemies.forEach((e) => e.destroy());
    this.npcs.forEach((n) => n.destroy());
    this.projectiles.forEach((p) => p.destroy());
    this.clearGroundLoot();
    this.enemies = [];
    this.npcs = [];
    this.projectiles = [];
    this.enemyTemplateByRuntimeId.clear();

    this.currentMapId = mapId;
    
    // Clean up old decor sprites from previous map
    this.mapManager.cleanup();
    
    // ExtractedData is obtained straight from the Tiled JSON now
    const mapData = this.mapManager.buildTilemap(this, mapId, "tileset");
    if (!mapData) return;

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
      this.player = new Player(this, playerEntityData, this.mapManager);
    } else {
      this.player.getSprite().setPosition(spawnPos.x * 32 + 16, spawnPos.y * 32 + 16);
    }

    this.spawnEnemies(mapData.enemySpawns);
    this.spawnNpcs(mapData.npcSpawns);

    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.startFollow(this.player.getSprite(), true, 0.08, 0.08);

    this.addMapLabel(mapData.name);
  }

  private spawnEnemies(spawns: { enemyId: string; x: number; y: number; patrolRadius: number }[]): void {
    spawns.forEach((spawn, index) => {
      const id = `enemy_${this.currentMapId}_${index}`;
      const entityData = this.entityManager.createEnemy(
        id,
        spawn.enemyId,
        { x: spawn.x, y: spawn.y },
        enemiesData as unknown as Record<string, unknown>
      );
      const enemy = new Enemy(this, entityData, this.mapManager, spawn.patrolRadius);
      this.enemies.push(enemy);
      this.enemyTemplateByRuntimeId.set(id, spawn.enemyId);

      // Add simple collision with player (no longer launches instanced combat)
      this.physics.add.collider(this.player.getSprite(), enemy.getSprite());
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
    eventBus.onEvent(GameEvents.PLAYER_LEVEL_UP, (level: unknown) => {
      this.showFloatingText(`Level Up! Lv.${level}`, 0xffd700, this.player.getSprite().x, this.player.getSprite().y - 40);
      this.updateHUD();
    });
    eventBus.onEvent(GameEvents.XP_GAINED, () => this.updateHUD());

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
      const auraCore = this.add.circle(0, 0, 12, 0xc946ff, 0.32);
      auraCore.setBlendMode(Phaser.BlendModes.ADD);
      const auraOuter = this.add.circle(0, 0, 18, 0xa13dff, 0.14);
      auraOuter.setBlendMode(Phaser.BlendModes.ADD);
      const runeRing = this.add.circle(0, 0, 17, 0x000000, 0);
      runeRing.setStrokeStyle(2, 0xd96dff, 0.65);
      runeRing.setBlendMode(Phaser.BlendModes.ADD);

      container.addAt(auraOuter, 0);
      container.addAt(runeRing, 1);
      container.addAt(auraCore, 2);

      tweens.push(
        this.tweens.add({
          targets: auraCore,
          scale: { from: 0.85, to: 1.22 },
          alpha: { from: 0.38, to: 0.12 },
          duration: 430,
          yoyo: true,
          repeat: -1,
        })
      );
      tweens.push(
        this.tweens.add({
          targets: auraOuter,
          scale: { from: 0.9, to: 1.28 },
          alpha: { from: 0.2, to: 0.03 },
          duration: 760,
          yoyo: true,
          repeat: -1,
        })
      );
      tweens.push(
        this.tweens.add({
          targets: runeRing,
          angle: 360,
          duration: 1800,
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
      this.checkMapTransition();
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
        this.dialogueManager.startDialogue(npc.getDialogueTreeId());
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

  private checkMapTransition(): void {
    if (this.isTransitioning) return;

    const tilePos = this.player.getTilePosition();
    const transition = this.mapManager.getTransitionAt(tilePos.x, tilePos.y);

    if (transition) {
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
}
