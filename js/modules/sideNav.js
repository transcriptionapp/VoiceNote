export class SideNavManager {
    constructor() {
      this.sideNav = document.getElementById("sideNav");
      this.overlay = document.getElementById("sideNavOverlay");
      this.menuButton = document.getElementById("menuButton");
  
      if (!this.sideNav || !this.overlay || !this.menuButton) {
        console.warn("⚠️ SideNavManager: Missing required DOM elements.");
        return;
      }
  
      this.setupEvents();
    }
  
    setupEvents() {
      // At this point, we assume all elements exist
      this.menuButton.addEventListener("click", () => this.toggleNav());
      this.overlay.addEventListener("click", () => this.closeNav());
    }
  
    toggleNav() {
      this.sideNav.classList.toggle("translate-x-0");
      this.sideNav.classList.toggle("-translate-x-full");
      this.overlay.classList.toggle("hidden");
    }
  
    closeNav() {
      this.sideNav.classList.add("-translate-x-full");
      this.sideNav.classList.remove("translate-x-0");
      this.overlay.classList.add("hidden");
    }
  }