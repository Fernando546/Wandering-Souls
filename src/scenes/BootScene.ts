import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload(): void {
    this.createLoadingBar();
    this.generatePlaceholderAssets();
    this.load.tilemapTiledJSON('meadow', '/maps/meadow.json');
    this.load.tilemapTiledJSON('cave', '/maps/cave.json');
  }

  private createLoadingBar(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const title = this.add.text(width / 2, height / 2 - 60, "WANDERING SOULS", {
      fontFamily: "'Press Start 2P'",
      fontSize: "20px",
      color: "#c8a852",
      stroke: "#2a1a0a",
      strokeThickness: 4,
    });
    title.setOrigin(0.5);

    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x1a1a2e, 0.8);
    progressBox.fillRoundedRect(width / 2 - 160, height / 2 - 12, 320, 24, 4);

    const loadingText = this.add.text(width / 2, height / 2 + 30, "Loading...", {
      fontFamily: "'Press Start 2P'",
      fontSize: "10px",
      color: "#cccccc",
    });
    loadingText.setOrigin(0.5);

    this.load.on("progress", (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0xc8a852, 1);
      progressBar.fillRoundedRect(width / 2 - 156, height / 2 - 8, 312 * value, 16, 3);
    });

    this.load.on("complete", () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
      title.destroy();
    });
  }

  private generatePlaceholderAssets(): void {
    this.generateTileset();
    this.generatePlayerSprite();
    this.generateEnemySprites();
    this.generateNpcSprite();
    this.generateCombatBackground();
    this.generateCombatEffects();
  }

  // ─── 3/4 Perspective Tileset ─────────────────────────────────
  private generateTileset(): void {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 32;
    const ctx = canvas.getContext("2d")!;

    // Tileset layout (canvas index → GID = index + 1):
    // 0→GID1: Void   1→GID2: Grass   2→GID3: Path   3→GID4: Edge/Wall
    // 4→GID5: Water  5→GID6: Cave floor  6→GID7: Tree decor
    // 7→GID8: Cave wall  8→GID9: Cave floor alt  9: Spare

    // --- Tile 0: Void ---
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, 32, 32);

    // --- Tile 1: Grass (3/4 view — subtle texture with depth gradient) ---
    const grassGrad = ctx.createLinearGradient(32, 0, 32, 32);
    grassGrad.addColorStop(0, "#5a9a4a");
    grassGrad.addColorStop(1, "#4a8a3a");
    ctx.fillStyle = grassGrad;
    ctx.fillRect(32, 0, 32, 32);
    // Grass blades
    for (let j = 0; j < 12; j++) {
      const bx = 32 + Math.random() * 30;
      const by = Math.random() * 30;
      ctx.fillStyle = Math.random() > 0.5 ? "#3a7a2a" : "#6aaa5a";
      ctx.fillRect(bx, by, 1, 2);
    }
    // Subtle shadow on bottom edge for depth
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(32, 28, 32, 4);

    // --- Tile 2: Path (worn dirt with 3/4 depth) ---
    const pathGrad = ctx.createLinearGradient(64, 0, 64, 32);
    pathGrad.addColorStop(0, "#d4b070");
    pathGrad.addColorStop(0.7, "#c4a060");
    pathGrad.addColorStop(1, "#a08040");
    ctx.fillStyle = pathGrad;
    ctx.fillRect(64, 0, 32, 32);
    // Pebbles
    for (let j = 0; j < 6; j++) {
      ctx.fillStyle = "#b09050";
      ctx.fillRect(64 + Math.random() * 28, Math.random() * 28, 2, 2);
    }
    ctx.fillStyle = "rgba(0,0,0,0.1)";
    ctx.fillRect(64, 29, 32, 3);

    // --- Tile 3: Edge/Border (stone wall from 3/4 view — shows front face) ---
    // Top face (lighter)
    ctx.fillStyle = "#6a6a7a";
    ctx.fillRect(96, 0, 32, 14);
    // Front face (darker — this creates the 3/4 depth illusion)
    ctx.fillStyle = "#4a4a5a";
    ctx.fillRect(96, 14, 32, 18);
    // Mortar lines on front face
    ctx.strokeStyle = "#3a3a4a";
    ctx.lineWidth = 1;
    for (let row = 0; row < 3; row++) {
      const ry = 14 + row * 6;
      ctx.beginPath();
      ctx.moveTo(96, ry);
      ctx.lineTo(128, ry);
      ctx.stroke();
      const offset = row % 2 === 0 ? 0 : 8;
      for (let col = 0; col < 4; col++) {
        ctx.beginPath();
        ctx.moveTo(96 + col * 8 + offset, ry);
        ctx.lineTo(96 + col * 8 + offset, ry + 6);
        ctx.stroke();
      }
    }
    // Rim highlight
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(96, 0, 32, 2);

    // --- Tile 4: Water (animated-look with depth gradient) ---
    const waterGrad = ctx.createLinearGradient(128, 0, 128, 32);
    waterGrad.addColorStop(0, "#3878c8");
    waterGrad.addColorStop(0.5, "#2868b8");
    waterGrad.addColorStop(1, "#1858a8");
    ctx.fillStyle = waterGrad;
    ctx.fillRect(128, 0, 32, 32);
    // Ripple highlights
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    for (let j = 0; j < 4; j++) {
      const wy = 4 + j * 7;
      ctx.beginPath();
      ctx.moveTo(128 + 2, wy);
      ctx.quadraticCurveTo(128 + 16, wy - 2, 128 + 30, wy);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.fillRect(128, 28, 32, 4);

    // --- Tile 5: Cave floor / entrance (GID 6) ---
    const caveFloorGrad = ctx.createLinearGradient(160, 0, 160, 32);
    caveFloorGrad.addColorStop(0, "#5a4a3a");
    caveFloorGrad.addColorStop(1, "#4a3a2a");
    ctx.fillStyle = caveFloorGrad;
    ctx.fillRect(160, 0, 32, 32);
    for (let j = 0; j < 5; j++) {
      ctx.fillStyle = "#3a2a1a";
      ctx.fillRect(160 + Math.random() * 28, Math.random() * 28, 3, 2);
    }
    ctx.fillStyle = "rgba(0,0,0,0.1)";
    ctx.fillRect(160, 29, 32, 3);

    // --- Tile 6: Tree/bush decor (GID 7) — sits on grass ---
    // Tree trunk (3/4 — you see the front)
    ctx.fillStyle = "#5a3a1a";
    ctx.fillRect(192 + 12, 16, 8, 16);
    ctx.fillStyle = "#4a2a10";
    ctx.fillRect(192 + 12, 16, 2, 16); // shadow side
    // Canopy (elliptical, overlapping from above)
    ctx.fillStyle = "#2a6a1a";
    ctx.beginPath();
    ctx.ellipse(192 + 16, 12, 14, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a5a0a";
    ctx.beginPath();
    ctx.ellipse(192 + 14, 14, 10, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Canopy highlight
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.ellipse(192 + 18, 8, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // --- Tile 7: Cave wall (GID 8) — dark rock with 3/4 front face ---
    // Top surface
    ctx.fillStyle = "#4a4a5a";
    ctx.fillRect(224, 0, 32, 12);
    // Front face (darker)
    ctx.fillStyle = "#2a2a3a";
    ctx.fillRect(224, 12, 32, 20);
    // Subtle rocky texture
    for (let j = 0; j < 6; j++) {
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.fillRect(224 + Math.random() * 28, 12 + Math.random() * 16, 4, 3);
    }
    // Edge highlight
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(224, 12, 32, 1);
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(224, 30, 32, 2);

    // --- Tile 8: Cave floor alt (GID 9) ---
    const cf2 = ctx.createLinearGradient(256, 0, 256, 32);
    cf2.addColorStop(0, "#504438");
    cf2.addColorStop(1, "#403428");
    ctx.fillStyle = cf2;
    ctx.fillRect(256, 0, 32, 32);
    for (let j = 0; j < 4; j++) {
      ctx.fillStyle = "#3a2a1a";
      ctx.fillRect(256 + Math.random() * 28, Math.random() * 28, 2, 2);
    }
    ctx.fillStyle = "rgba(0,0,0,0.1)";
    ctx.fillRect(256, 29, 32, 3);

    // --- Tile 9: Spare (unused) ---
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(288, 0, 32, 32);

    this.textures.addCanvas("tileset", canvas);
    this.textures.addSpriteSheet("tileset_sprites", canvas as any, { frameWidth: 32, frameHeight: 32 });
  }

  // ─── 3/4 Perspective Player Sprites ──────────────────────────
  private generatePlayerSprite(): void {
    const classes: { key: string; tunic: string; trim: string; hair: string; accessory?: (ctx: CanvasRenderingContext2D) => void }[] = [
      {
        key: "player_warrior", tunic: "#3366aa", trim: "#225588", hair: "#5a3a1a",
        accessory: (ctx) => {
          // Sword on back
          ctx.fillStyle = "#aaaacc";
          ctx.fillRect(24, 4, 2, 18);
          ctx.fillStyle = "#887744";
          ctx.fillRect(23, 18, 4, 3);
        }
      },
      {
        key: "player_archer", tunic: "#448833", trim: "#336622", hair: "#cc9944",
        accessory: (ctx) => {
          // Bow
          ctx.strokeStyle = "#8B5A2B";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(26, 14, 8, -Math.PI * 0.4, Math.PI * 0.4);
          ctx.stroke();
          ctx.strokeStyle = "#cccccc";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(26, 6);
          ctx.lineTo(26, 22);
          ctx.stroke();
        }
      },
      {
        key: "player_mage", tunic: "#6633aa", trim: "#552299", hair: "#222244",
        accessory: (ctx) => {
          // Staff orb
          ctx.fillStyle = "#44ccff";
          ctx.beginPath();
          ctx.arc(26, 6, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#6a4a2a";
          ctx.fillRect(25, 8, 2, 16);
        }
      }
    ];

    for (const cls of classes) {
      const canvas = document.createElement("canvas");
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext("2d")!;

      // Drop shadow on ground
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.beginPath();
      ctx.ellipse(16, 30, 8, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Boots
      ctx.fillStyle = "#553322";
      ctx.fillRect(10, 26, 5, 4);
      ctx.fillRect(17, 26, 5, 4);

      // Legs / pants
      ctx.fillStyle = "#444466";
      ctx.fillRect(10, 20, 5, 7);
      ctx.fillRect(17, 20, 5, 7);

      // Tunic body (front face visible in 3/4)
      ctx.fillStyle = cls.tunic;
      ctx.fillRect(9, 10, 14, 11);
      // Light side
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fillRect(9, 10, 3, 11);
      // Dark side
      ctx.fillStyle = "rgba(0,0,0,0.1)";
      ctx.fillRect(20, 10, 3, 11);
      // Belt
      ctx.fillStyle = "#8B6914";
      ctx.fillRect(9, 18, 14, 2);

      // Arms (slightly in front)
      ctx.fillStyle = "#ffcc88";
      ctx.fillRect(6, 12, 4, 8);
      ctx.fillRect(22, 12, 4, 8);

      // Head (seen from slight angle — oval, not circle)
      ctx.fillStyle = "#ffcc88";
      ctx.beginPath();
      ctx.ellipse(16, 6, 6, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Hair
      ctx.fillStyle = cls.hair;
      ctx.beginPath();
      ctx.ellipse(16, 4, 7, 4, 0, Math.PI, Math.PI * 2);
      ctx.fill();

      // Eyes (looking slightly down — 3/4 view!)
      ctx.fillStyle = "#000000";
      ctx.fillRect(13, 6, 2, 2);
      ctx.fillRect(18, 6, 2, 2);

      // Accessory
      cls.accessory?.(ctx);

      this.textures.addCanvas(cls.key, canvas);
    }
  }

  // ─── 3/4 Perspective Enemy Sprites ──────────────────────────
  private generateEnemySprites(): void {
    this.generateEnemySprite("enemy_slime", "#44cc44", "slime");
    this.generateEnemySprite("enemy_wolf", "#888888", "wolf");
    this.generateEnemySprite("enemy_bandit", "#cc6644", "bandit");
    this.generateEnemySprite("enemy_spirit", "#88aaff", "spirit");
  }

  private generateEnemySprite(key: string, color: string, type: string): void {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d")!;

    // Ground shadow for all enemies
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.ellipse(16, 29, 9, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    if (type === "slime") {
      // 3/4 slime — dome with front face shading
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(16, 22, 12, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      // Dome highlight (top = lit from above-left)
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.beginPath();
      ctx.ellipse(13, 18, 5, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      // Bottom shadow (front-face depth)
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.beginPath();
      ctx.ellipse(16, 26, 10, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      // Eyes look at us (3/4)
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(11, 19, 4, 4);
      ctx.fillRect(19, 19, 4, 4);
      ctx.fillStyle = "#111111";
      ctx.fillRect(12, 20, 2, 2);
      ctx.fillRect(20, 20, 2, 2);
      // Mouth
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(14, 24, 5, 2);

    } else if (type === "wolf") {
      // 3/4 wolf — body seen from side-above
      // Body
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(16, 18, 12, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      // Head (front-facing, slightly left)
      ctx.fillStyle = "#777777";
      ctx.beginPath();
      ctx.ellipse(8, 12, 7, 6, -0.2, 0, Math.PI * 2);
      ctx.fill();
      // Ears
      ctx.fillStyle = "#666666";
      ctx.beginPath();
      ctx.moveTo(4, 6);
      ctx.lineTo(6, 10);
      ctx.lineTo(8, 6);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(9, 6);
      ctx.lineTo(11, 10);
      ctx.lineTo(13, 6);
      ctx.fill();
      // Eyes (fierce)
      ctx.fillStyle = "#ffcc00";
      ctx.fillRect(5, 11, 3, 2);
      ctx.fillRect(10, 11, 3, 2);
      ctx.fillStyle = "#000";
      ctx.fillRect(6, 11, 1, 2);
      ctx.fillRect(11, 11, 1, 2);
      // Snout
      ctx.fillStyle = "#555555";
      ctx.fillRect(3, 14, 5, 3);
      ctx.fillStyle = "#111";
      ctx.fillRect(3, 14, 2, 2);
      // Legs (visible in 3/4)
      ctx.fillStyle = "#777777";
      ctx.fillRect(7, 24, 3, 6);
      ctx.fillRect(14, 24, 3, 6);
      ctx.fillRect(20, 24, 3, 6);
      ctx.fillRect(25, 23, 3, 5);
      // Tail
      ctx.fillStyle = "#999999";
      ctx.fillRect(26, 14, 4, 3);

    } else if (type === "bandit") {
      // 3/4 humanoid bandit — standing upright
      // Boots
      ctx.fillStyle = "#443322";
      ctx.fillRect(10, 26, 5, 4);
      ctx.fillRect(17, 26, 5, 4);
      // Pants
      ctx.fillStyle = "#555544";
      ctx.fillRect(10, 20, 5, 7);
      ctx.fillRect(17, 20, 5, 7);
      // Leather tunic
      ctx.fillStyle = color;
      ctx.fillRect(9, 10, 14, 11);
      ctx.fillStyle = "rgba(0,0,0,0.1)";
      ctx.fillRect(20, 10, 3, 11);
      // Belt
      ctx.fillStyle = "#444444";
      ctx.fillRect(9, 18, 14, 2);
      // Arms
      ctx.fillStyle = "#cc9977";
      ctx.fillRect(6, 12, 4, 8);
      ctx.fillRect(22, 12, 4, 8);
      // Head
      ctx.fillStyle = "#cc9977";
      ctx.beginPath();
      ctx.ellipse(16, 6, 6, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      // Hood/bandana
      ctx.fillStyle = "#333333";
      ctx.beginPath();
      ctx.ellipse(16, 3, 7, 4, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(9, 3, 14, 2);
      // Eyes (menacing)
      ctx.fillStyle = "#000000";
      ctx.fillRect(13, 6, 2, 2);
      ctx.fillRect(18, 6, 2, 2);
      // Dagger
      ctx.fillStyle = "#ccccdd";
      ctx.fillRect(25, 14, 2, 8);
      ctx.fillStyle = "#887744";
      ctx.fillRect(24, 13, 4, 2);

    } else if (type === "spirit") {
      // 3/4 ghost — floating ethereal form
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(16, 14, 10, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      // Wispy bottom
      ctx.beginPath();
      ctx.moveTo(6, 18);
      ctx.quadraticCurveTo(10, 30, 16, 26);
      ctx.quadraticCurveTo(22, 30, 26, 18);
      ctx.fill();
      // Internal glow
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(16, 12, 6, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
      // Eyes (hollow)
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(12, 12, 3, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(20, 12, 3, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3355cc";
      ctx.beginPath();
      ctx.ellipse(12, 12, 1.5, 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(20, 12, 1.5, 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    this.textures.addCanvas(key, canvas);
  }

  // ─── 3/4 NPC Sprite ─────────────────────────────────────────
  private generateNpcSprite(): void {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d")!;

    // Ground shadow
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.ellipse(16, 30, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sandals
    ctx.fillStyle = "#8B6914";
    ctx.fillRect(10, 27, 5, 3);
    ctx.fillRect(17, 27, 5, 3);

    // Robe (long, flowing — 3/4 with front visible)
    const robeGrad = ctx.createLinearGradient(0, 10, 0, 28);
    robeGrad.addColorStop(0, "#7744aa");
    robeGrad.addColorStop(1, "#552288");
    ctx.fillStyle = robeGrad;
    ctx.fillRect(8, 10, 16, 18);
    // Robe trim
    ctx.fillStyle = "#c8a852";
    ctx.fillRect(8, 10, 16, 2);
    ctx.fillRect(8, 26, 16, 2);
    // Robe depth shading
    ctx.fillStyle = "rgba(0,0,0,0.1)";
    ctx.fillRect(8, 10, 3, 18);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(21, 10, 3, 18);

    // Hands (holding staff)
    ctx.fillStyle = "#ffcc88";
    ctx.fillRect(5, 14, 4, 4);
    ctx.fillRect(23, 14, 4, 4);

    // Staff
    ctx.fillStyle = "#6a4a2a";
    ctx.fillRect(3, 2, 2, 26);
    // Staff crystal
    ctx.fillStyle = "#c8a852";
    ctx.beginPath();
    ctx.arc(4, 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffe888";
    ctx.beginPath();
    ctx.arc(4, 2, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = "#ffcc88";
    ctx.beginPath();
    ctx.ellipse(16, 6, 6, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // White beard
    ctx.fillStyle = "#dddddd";
    ctx.beginPath();
    ctx.moveTo(12, 8);
    ctx.quadraticCurveTo(16, 16, 20, 8);
    ctx.fill();

    // Wizard hat (pointed)
    ctx.fillStyle = "#552288";
    ctx.beginPath();
    ctx.moveTo(16, -4);
    ctx.lineTo(8, 5);
    ctx.lineTo(24, 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#c8a852";
    ctx.fillRect(8, 4, 16, 2);

    // Eyes (wise)
    ctx.fillStyle = "#000000";
    ctx.fillRect(13, 5, 2, 2);
    ctx.fillRect(18, 5, 2, 2);

    this.textures.addCanvas("npc_elder", canvas);
  }

  // ─── Combat Background (unused but kept) ────────────────────
  private generateCombatBackground(): void {
    const canvas = document.createElement("canvas");
    canvas.width = 960;
    canvas.height = 640;
    const ctx = canvas.getContext("2d")!;

    const gradient = ctx.createLinearGradient(0, 0, 0, 640);
    gradient.addColorStop(0, "#1a1a2e");
    gradient.addColorStop(0.5, "#16213e");
    gradient.addColorStop(1, "#0f3460");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 960, 640);

    ctx.fillStyle = "#2a2a3e";
    ctx.fillRect(0, 480, 960, 160);
    ctx.fillStyle = "#222238";
    for (let i = 0; i < 48; i++) {
      ctx.fillRect(i * 20, 480, 18, 2);
    }

    this.textures.addCanvas("combat_bg", canvas);
  }

  // ─── Combat VFX ─────────────────────────────────────────────
  private generateCombatEffects(): void {
    // Melee Swoosh (brighter arc)
    const swooshCanvas = document.createElement("canvas");
    swooshCanvas.width = 48;
    swooshCanvas.height = 48;
    const sCtx = swooshCanvas.getContext("2d")!;
    sCtx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    sCtx.lineWidth = 3;
    sCtx.beginPath();
    sCtx.arc(24, 24, 20, Math.PI * -0.3, Math.PI * 0.3);
    sCtx.stroke();
    sCtx.strokeStyle = "rgba(200, 220, 255, 0.4)";
    sCtx.lineWidth = 8;
    sCtx.beginPath();
    sCtx.arc(24, 24, 16, Math.PI * -0.25, Math.PI * 0.25);
    sCtx.stroke();
    this.textures.addCanvas("effect_swoosh", swooshCanvas);

    // Projectile (glowing orb with trail)
    const projCanvas = document.createElement("canvas");
    projCanvas.width = 16;
    projCanvas.height = 16;
    const pCtx = projCanvas.getContext("2d")!;
    // Outer glow
    const projGlow = pCtx.createRadialGradient(8, 8, 0, 8, 8, 8);
    projGlow.addColorStop(0, "rgba(255,200,50,1)");
    projGlow.addColorStop(0.4, "rgba(255,150,20,0.8)");
    projGlow.addColorStop(1, "rgba(255,100,0,0)");
    pCtx.fillStyle = projGlow;
    pCtx.fillRect(0, 0, 16, 16);
    // Core
    pCtx.fillStyle = "#ffffcc";
    pCtx.beginPath();
    pCtx.arc(8, 8, 3, 0, Math.PI * 2);
    pCtx.fill();
    this.textures.addCanvas("effect_projectile", projCanvas);
  }

  create(): void {
    this.time.delayedCall(500, () => {
      this.scene.start("WorldScene", { mapId: "meadow", playerClass: "warrior" });
    });
  }
}
