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

      const deleteBtn = document.getElementById("deleteDataBtn");
      if (deleteBtn) {
        deleteBtn.addEventListener("click", async () => {
          const confirmed = confirm("⚠️ This will permanently delete all your data. Are you sure?");
          if (!confirmed) return;

          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            alert("You must be logged in to delete data.");
            return;
          }

          const userId = user.id;
          const tables = [
            "follow_ups",
            "free_transcription_usage",
            "recordings",
            "transcriptions",
            "user_profiles",
            "users"
          ];

          try {
            for (const table of tables) {
              const { error } = await supabase.from(table).delete().eq("user_id", userId);
              if (error) {
                console.error(`Failed to delete from ${table}:`, error.message);
              }
            }
            alert("✅ Your data has been deleted.");
            await supabase.auth.signOut();
            window.location.href = "index.html";
          } catch (err) {
            console.error("Deletion failed:", err);
            alert("Failed to delete all data.");
          }
        });
      }
    }

    toggleNav() {
      const isOpen = this.sideNav.classList.contains("translate-x-0");

      if (isOpen) {
        this.closeNav();
      } else {
        this.openNav();
      }
    }

    openNav() {
      this.sideNav.classList.remove("hidden");
      this.overlay.classList.remove("hidden");

      // Trigger reflow before changing transform to ensure transition runs
      requestAnimationFrame(() => {
        this.sideNav.classList.remove("-translate-x-full");
        this.sideNav.classList.add("translate-x-0");
      });
    }

    closeNav() {
      this.sideNav.classList.remove("translate-x-0");
      this.sideNav.classList.add("-translate-x-full");
      this.overlay.classList.add("hidden");

      setTimeout(() => {
        this.sideNav.classList.add("hidden");
      }, 300); // duration should match your CSS transition time
    }
}