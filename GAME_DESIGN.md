# Wandering Souls — Game Design Document

> **Genre:** 2D Top-Down Action RPG (2.5D perspective)  
> **Inspiration:** Margonem, Tibia, classic browser MMORPGs  
> **Platform:** Desktop (standalone .exe via Tauri/Electron)  
> **Engine:** Phaser 3 + TypeScript + Vite  
> **Multiplayer:** Planned for future phases

---

## 🎮 Core Vision

Wandering Souls is a **2.5D top-down action RPG** with real-time combat, open-world exploration, and deep character progression. The game draws heavy inspiration from classic Polish browser MMORPG **Margonem** — featuring class-based builds, loot-driven progression, boss encounters, and an interconnected world of maps linked by transitions.

The long-term goal is to ship a **standalone desktop client** with future **multiplayer support**.

---

## ⚔️ Hero Classes

Each class has a distinct playstyle, primary attack range, and skill tree.

### 1. Warrior (Melee)
- **Primary Attack:** Sword slash (close-range arc)
- **Range:** ~48px (melee)
- **Playstyle:** Tanky frontline fighter. High HP, high armor.
- **Skill 1 — Shield Bash:** Stuns nearby enemies for 1.5s. Short cooldown.
- **Skill 2 — Whirlwind:** AoE spin attack damaging all enemies in radius.
- **Passive:** *Fortitude* — Reduces incoming damage by 10%.

### 2. Archer (Ranged)
- **Primary Attack:** Arrow shot (long-range projectile)
- **Range:** ~200px (ranged)
- **Playstyle:** High DPS glass cannon. Kiting and positioning are key.
- **Skill 1 — Multi-Shot:** Fires 3 arrows in a spread.
- **Skill 2 — Trap:** Places an invisible trap that snares and damages enemies.
- **Passive:** *Eagle Eye* — 15% increased critical hit chance.

### 3. Mage (Magic / Ranged)
- **Primary Attack:** Magic bolt (medium-range projectile)
- **Range:** ~160px (ranged)
- **Playstyle:** AoE damage and crowd control. High mana dependency.
- **Skill 1 — Fireball:** Large AoE explosion on impact. High damage, long cooldown.
- **Skill 2 — Frost Nova:** Freezes all enemies in radius for 2s.
- **Passive:** *Arcane Mastery* — Mana regenerates 20% faster.

---

## 🗺️ World Structure

The world is composed of **interconnected maps** defined as Tiled JSON files. Each map contains:

- **Tile Layers:** Ground terrain, decoration overlays
- **Collision Layer:** Walls, water, obstacles (object group)
- **Spawn Points:** Player spawn, enemy spawns with patrol radius, NPC spawns
- **Transitions:** Zones that teleport the player to another map at a specific coordinate
- **Interactables:** Objects the player can examine with `E` (signs, chests, levers, doors)

### Map Types
| Map Type | Description | Examples |
|----------|-------------|---------|
| **Town** | Safe zone, NPCs, shops, quest givers | Eldermoor Village |
| **Field** | Open areas with roaming mobs | Meadow, Dark Forest |
| **Dungeon** | Linear progression, harder mobs, boss at end | Shadow Cave, Crypts |
| **Boss Arena** | Locked encounter zone, special mechanics | Dragon's Lair |

---

## 🎒 Gear & Loot System

### Equipment Slots
- **Weapon** — Defines primary attack type and damage
- **Helmet** — Bonus HP or magic resist
- **Armor** — Main source of defense
- **Boots** — Movement speed bonus
- **Ring** — Stat bonuses (STR, AGI, INT)
- **Amulet** — Special passive effects

### Item Rarity Tiers
| Rarity | Color | Drop Rate | Stat Bonus |
|--------|-------|-----------|------------|
| Common | ⬜ White | 60% | Base stats |
| Uncommon | 🟢 Green | 25% | +10-20% bonus |
| Rare | 🔵 Blue | 10% | +25-40% bonus + 1 special stat |
| Epic | 🟣 Purple | 4% | +50% bonus + unique passive |
| Legendary | 🟡 Gold | 1% | Set bonuses, unique effects |

### Loot Drops
- Enemies drop items on death (rolls against loot table)
- Bosses have guaranteed Epic+ drops
- Chests in dungeons contain random loot
- Shops sell Common/Uncommon gear for gold

---

## 📈 Progression System

### Experience & Leveling
- Kill enemies → gain XP
- Complete quests → gain XP + rewards
- Each level increases base stats and unlocks skill points
- **Max Level:** 100 (stretch goal)

### Stat Points (per level)
Players receive **5 stat points** per level to distribute:
- **Strength (STR)** — Melee damage, HP scaling
- **Agility (AGI)** — Ranged damage, attack speed, crit chance
- **Intelligence (INT)** — Magic damage, mana pool, cooldown reduction
- **Armor** — Damage reduction from physical attacks
- **Magic Resist** — Damage reduction from magic attacks

---

## 🐉 Boss Encounters

Bosses are unique enemies with special attack patterns, multiple phases, and guaranteed loot.

### Design Principles
- **Multi-Phase:** Bosses change behavior at HP thresholds (75%, 50%, 25%)
- **Telegraphed Attacks:** Visual indicators before powerful moves
- **Mechanics:** Dodge zones, add spawns, enrage timers
- **Reward:** Guaranteed Epic+ loot, large XP, achievement unlock

### Planned Bosses
| Boss | Location | Level | Description |
|------|----------|-------|-------------|
| Cave Troll | Shadow Cave | 5 | Slow but devastating AoE strikes |
| Forest Wraith | Dark Woods | 10 | Teleporting spirit, summons minions |
| Bandit King | Thieves' Hold | 15 | Dual-wielding swordsman, parry mechanic |
| Ancient Dragon | Dragon's Lair | 25 | Multi-phase, fire breath, flight |

---

## 🕹️ Controls

| Key | Action |
|-----|--------|
| `W A S D` | Movement |
| `Left Click` | Primary Attack (towards cursor) |
| `1` | Skill 1 |
| `2` | Skill 2 |
| `E` | Interact (NPCs, doors, chests, signs) |
| `Q` | Open Quick Menu (Inventory / Status / Settings) |
| `ESC` | Close menus / Pause |

---

## 🏗️ Technical Architecture

```
src/
├── core/           # Managers (Input, Map, Entity, Combat, Dialogue, Event Bus)
├── data/           # JSON definitions (enemies, skills, classes, dialogue trees)
├── entities/       # Player, Enemy, NPC, Projectile classes
├── scenes/         # Phaser scenes (Boot, World, UI)
├── ui/             # CSS styles for HTML overlay
└── main.ts         # Phaser game config & entry point
```

### Key Design Patterns
- **Event Bus:** Decoupled communication between systems
- **Entity-Component:** BaseEntity → Player/Enemy/NPC inheritance
- **Tiled JSON Maps:** Standard format, editable in Tiled Map Editor
- **DOM UI Overlay:** HTML/CSS layered over the Phaser canvas for menus/HUD

---

## 🌐 Multiplayer Roadmap (Future)

### Phase 1: Single-Player (Current)
- Core gameplay loop, 3 classes, map transitions, combat, loot

### Phase 2: Local Co-op
- Split or shared screen for 2 players

### Phase 3: Online Multiplayer
- WebSocket server (Node.js)
- Authoritative server model
- Synced player positions, combat, loot instancing
- Party system (up to 4 players)
- PvP zones

### Phase 4: MMO Features
- Persistent world server
- Global chat
- Trading system
- Guilds and guild wars
- Leaderboards

---

## 📋 Development Phases

### ✅ Phase 1 — Foundation (Complete)
- [x] Phaser 3 project setup with TypeScript + Vite
- [x] Procedural developer art (3/4 perspective sprites)
- [x] WASD movement with collision detection
- [x] Real-time action combat (click-to-attack)
- [x] Enemy AI (aggro, chase, attack)
- [x] NPC dialogue system
- [x] HUD (HP, Mana, XP bars)

### ✅ Phase 2 — World Building (Complete)
- [x] Tiled JSON map integration
- [x] Map transitions between zones
- [x] Quick Menu UI (Q) with tab system
- [x] Environmental interactions (E)
- [x] Inventory grid shell
- [x] 2.5D camera perspective

### 🔲 Phase 3 — Content & Polish
- [ ] Implement all 3 hero classes with unique skills
- [ ] Gear/loot drop system
- [ ] Inventory management (equip, drop, use)
- [ ] Character stat screen
- [ ] 5+ maps with distinct themes
- [ ] Quest system (fetch, kill, escort)
- [ ] Sound effects and music

### 🔲 Phase 4 — Bosses & Endgame
- [ ] Boss encounter system with phases
- [ ] 4 unique boss fights
- [ ] Dungeon progression
- [ ] Item rarity and set bonuses
- [ ] Achievement system

### 🔲 Phase 5 — Multiplayer
- [ ] WebSocket server setup
- [ ] Player synchronization
- [ ] Party system
- [ ] PvP zones
- [ ] Trading

---

## 🤝 Contributing

1. Fork the repository
2. Read this document thoroughly
3. Check the `src/` directory structure
4. Maps are in `public/maps/` — edit with [Tiled Map Editor](https://www.mapeditor.org/)
5. All game data (enemies, skills, classes) lives in `src/data/definitions/`
6. Run `npm install` then `npm run dev` to start
7. Submit PRs with clear descriptions

---

*Wandering Souls © 2025 — In active development*
