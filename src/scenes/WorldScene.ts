import Phaser from "phaser";
import { MapManager } from "@core/MapManager";
import { EntityManager } from "@core/EntityManager";
import { InputManager } from "@core/InputManager";
import { DialogueManager } from "@core/DialogueManager";
import { eventBus, GameEvents } from "@core/EventBus";
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

export class WorldScene extends Phaser.Scene {
  private mapManager!: MapManager;
  private entityManager!: EntityManager;
  private inputManager!: InputManager;
  private dialogueManager!: DialogueManager;
  private player!: Player;
  private enemies: Enemy[] = [];
  private npcs: NPC[] = [];
  private projectiles: Projectile[] = [];
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
    this.enemies = [];
    this.npcs = [];
    this.projectiles = [];

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

    // Pass input to Quick Menu UI as toggle event is handled in UIScene 
    // or by checking here, but we implemented keydown-Q natively in UIScene.
    // Pause handled by UIScene so we don't worry about it here

    if (!this.dialogueManager.getIsActive() && !this.playerDead) {
      this.player?.handleInput(input);
    }

    const pPos = this.player.getPixelPosition();
    this.enemies.forEach((e) => {
      // Instead of update(delta), we call updateAI
      if((e as any).updateAI) {
        (e as any).updateAI(delta, pPos.x, pPos.y, this.playerDead);
      }
    });
    
    this.npcs.forEach((n) => n.update(delta));
    this.player.update(delta);
    
    // Projectiles
    this.projectiles = this.projectiles.filter(p => !p.getIsDead());
    this.projectiles.forEach(p => p.update(delta));

    if (!this.playerDead) {
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
