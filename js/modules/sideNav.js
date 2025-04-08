import { supabase } from "../config.js";

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
      if (!this.menuButton || !this.sideNav || !this.overlay) {
        console.warn("⚠️ SideNavManager: Missing required DOM elements.");
        return;
      }
      this.menuButton.addEventListener("click", () => this.toggleNav());
      this.overlay.addEventListener("click", () => this.closeNav());

      const logoutBtn = document.getElementById("logoutBtn");
      if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
          try {
            const { error } = await supabase.auth.signOut();
            if (error) {
              console.error("Logout error:", error);
              alert("Failed to log out. Please try again.");
            } else {
              window.location.href = "index.html";
            }
          } catch (err) {
            console.error("Unexpected logout error:", err);
            alert("Failed to log out. Please try again.");
          }
        });
      }
    }

    toggleNav() {
      this.sideNav.classList.toggle("hidden");
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