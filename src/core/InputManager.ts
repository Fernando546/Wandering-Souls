import Phaser from "phaser";
import { eventBus, GameEvents } from "./EventBus";

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  interact: boolean;
  escape: boolean;
  quickMenu: boolean;
  attackPrimary: boolean;
  skill1: boolean;
  skill2: boolean;
  pointerWorldX: number;
  pointerWorldY: number;
}

export class InputManager {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private wasd: Record<string, Phaser.Input.Keyboard.Key> = {};
  private interactKey: Phaser.Input.Keyboard.Key | null = null;
  private escapeKey: Phaser.Input.Keyboard.Key | null = null;
  private quickMenuKey: Phaser.Input.Keyboard.Key | null = null;
  private skill1Key: Phaser.Input.Keyboard.Key | null = null;
  private skill2Key: Phaser.Input.Keyboard.Key | null = null;
  private enabled: boolean = true;
  private scene: Phaser.Scene | null = null;

  init(scene: Phaser.Scene): void {
    this.scene = scene;
    if (!scene.input.keyboard) return;

    this.cursors = scene.input.keyboard.createCursorKeys();
    this.wasd = {
      W: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.interactKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E); 
    this.escapeKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.quickMenuKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    this.skill1Key = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
    this.skill2Key = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);

    eventBus.onEvent(GameEvents.INPUT_DISABLED, () => {
      this.enabled = false;
      this.resetKeyStates();
    });
    eventBus.onEvent(GameEvents.INPUT_ENABLED, () => {
      this.enabled = true;
      this.resetKeyStates();
    });

    scene.game.events.on(Phaser.Core.Events.BLUR, this.handleGameBlur, this);
  }

  getState(): InputState {
    const defaultState: InputState = { 
      up: false, down: false, left: false,      right: false, 
      interact: false, 
      escape: false,
      quickMenu: false,
      attackPrimary: false, 
      skill1: false, skill2: false, pointerWorldX: 0, pointerWorldY: 0 
    };

    if (!this.enabled || !this.cursors || !this.scene) {
      return defaultState;
    }

    const pointer = this.scene.input.activePointer;

    return {
      up: this.cursors.up.isDown || this.wasd["W"]?.isDown || false,
      down: this.cursors.down.isDown || this.wasd["S"]?.isDown || false,
      left: this.cursors.left.isDown || this.wasd["A"]?.isDown || false,
      right: this.cursors.right.isDown || this.wasd["D"]?.isDown || false,
      interact: Phaser.Input.Keyboard.JustDown(this.interactKey!),
      escape: Phaser.Input.Keyboard.JustDown(this.escapeKey!),
      quickMenu: Phaser.Input.Keyboard.JustDown(this.quickMenuKey!),
      attackPrimary: pointer.leftButtonDown(),
      skill1: this.skill1Key?.isDown || false,
      skill2: this.skill2Key?.isDown || false,
      pointerWorldX: pointer.worldX,
      pointerWorldY: pointer.worldY,
    };
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(value: boolean): void {
    this.enabled = value;
    if (!value) {
      this.resetKeyStates();
    }
  }

  private handleGameBlur(): void {
    this.resetKeyStates();
  }

  private resetKeyStates(): void {
    if (!this.scene?.input.keyboard) return;
    this.scene.input.keyboard.resetKeys();
  }
}
