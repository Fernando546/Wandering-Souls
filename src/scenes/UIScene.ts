import Phaser from "phaser";

export class UIScene extends Phaser.Scene {
  private isMenuOpen: boolean = false;

  constructor() {
    super({ key: "UIScene" });
  }

  create(): void {
    this.scene.bringToTop();
    this.setupQuickMenuDOM();
    
    // Setup Q to toggle menu
    this.input.keyboard?.on('keydown-Q', () => {
      this.toggleQuickMenu();
    });

    const closeBtn = document.querySelector('.menu-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        if (this.isMenuOpen) this.toggleQuickMenu();
      });
    }
  }

  private setupQuickMenuDOM(): void {
    // Generate 20 inventory slots
    const grid = document.getElementById('inventory-grid');
    if (grid) {
      grid.innerHTML = "";
      for (let i = 0; i < 20; i++) {
        const slot = document.createElement("div");
        slot.className = "inventory-slot";
        grid.appendChild(slot);
      }
    }

    // Setup tabs
    const tabs = document.querySelectorAll('.menu-tab');
    const contents = document.querySelectorAll('.quick-menu-content');

    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        tabs.forEach(t => t.classList.remove('active'));
        contents.forEach(c => c.classList.add('hidden'));

        const target = e.target as HTMLElement;
        target.classList.add('active');

        const tabName = target.getAttribute('data-tab');
        const activeContent = document.getElementById(`tab-${tabName}`);
        if (activeContent) activeContent.classList.remove('hidden');
      });
    });
  }

  private toggleQuickMenu(): void {
    const container = document.getElementById('quick-menu-container');
    if (!container) return;

    this.isMenuOpen = !this.isMenuOpen;

    if (this.isMenuOpen) {
      container.classList.remove('hidden');
      this.scene.pause("WorldScene");
    } else {
      container.classList.add('hidden');
      this.scene.resume("WorldScene");
    }
  }
}
