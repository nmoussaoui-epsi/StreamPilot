/**
 * StreamPilot - Script du popup
 * Gère l'interface utilisateur et la communication avec le content script
 */

class StreamPilotPopup {
  constructor() {
    this.currentTab = null;
    this.videoState = {
      hasVideo: false,
      playbackRate: 1.0,
      isMuted: false,
      isPiP: false,
    };

    this.init();
  }

  async init() {
    await this.getCurrentTab();
    await this.loadSettings();
    this.setupEventListeners();
    this.checkVideoPresence();
  }

  /**
   * Récupère l'onglet actif
   */
  async getCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      this.currentTab = tab;
    } catch (error) {
      console.error("Erreur lors de la récupération de l'onglet:", error);
    }
  }

  /**
   * Vérifie si l'onglet actuel est valide
   */
  async isTabValid() {
    if (!this.currentTab || !this.currentTab.id) {
      return false;
    }

    try {
      // Vérifie si l'onglet existe encore
      await chrome.tabs.get(this.currentTab.id);
      return true;
    } catch (error) {
      console.warn("Onglet fermé ou inaccessible:", error.message);
      return false;
    }
  }

  /**
   * Envoie un message de manière sécurisée
   */
  async sendMessage(message) {
    if (!(await this.isTabValid())) {
      throw new Error("Onglet non disponible");
    }

    try {
      return await chrome.tabs.sendMessage(this.currentTab.id, message);
    } catch (error) {
      if (
        error.message.includes("tab") ||
        error.message.includes("Receiving end does not exist")
      ) {
        throw new Error("Onglet fermé ou script non chargé");
      }
      throw error;
    }
  }

  /**
   * Charge les paramètres sauvegardés
   */
  async loadSettings() {
    try {
      const settings = await chrome.storage.sync.get({
        playbackRate: 1.0,
        isMuted: false,
      });

      this.videoState.playbackRate = settings.playbackRate;
      this.videoState.isMuted = settings.isMuted;

      this.updateUI();
    } catch (error) {
      console.error("Erreur lors du chargement des paramètres:", error);
    }
  }

  /**
   * Sauvegarde les paramètres
   */
  async saveSettings() {
    try {
      await chrome.storage.sync.set({
        playbackRate: this.videoState.playbackRate,
        isMuted: this.videoState.isMuted,
      });
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error);
    }
  }

  /**
   * Configure tous les écouteurs d'événements
   */
  setupEventListeners() {
    // Contrôle de la vitesse
    const speedRange = document.getElementById("speedRange");
    speedRange.addEventListener("input", (e) => {
      this.updatePlaybackRate(parseFloat(e.target.value));
    });

    // Boutons de vitesse prédéfinie
    document.querySelectorAll(".preset-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const speed = parseFloat(e.target.dataset.speed);
        this.updatePlaybackRate(speed);
        speedRange.value = speed;
      });
    });

    // Bouton mute/unmute
    document.getElementById("muteBtn").addEventListener("click", () => {
      this.toggleMute();
    });

    // Bouton Picture-in-Picture
    document.getElementById("pipBtn").addEventListener("click", () => {
      this.togglePiP();
    });

    // Bouton reset
    document.getElementById("resetBtn").addEventListener("click", () => {
      this.resetSettings();
    });

    // Navigation
    document.getElementById("infoBtn").addEventListener("click", () => {
      this.showInfoPage();
    });

    document.getElementById("backBtn").addEventListener("click", () => {
      this.showMainPage();
    });

    // Bouton Buy Me a Coffee
    const coffeeBtn = document.getElementById("coffeeBtn");
    if (coffeeBtn) {
      coffeeBtn.addEventListener("click", () => {
        this.openCoffeeLink();
      });
    }
  }

  /**
   * Vérifie la présence d'une vidéo sur la page
   */
  async checkVideoPresence() {
    try {
      const response = await this.sendMessage({
        action: "checkVideo",
      });

      if (response && response.hasVideo) {
        this.videoState.hasVideo = true;
        this.videoState.playbackRate = response.playbackRate || 1.0;
        this.videoState.isMuted = response.isMuted || false;
        this.videoState.isPiP = response.isPiP || false;
        this.videoState.metadata = response.metadata || {};

        this.showControls();
        this.updateVideoInfo(response);
        this.updateUI();
      } else {
        this.showNoVideoMessage();
      }
    } catch (error) {
      console.error("Erreur lors de la vérification de la vidéo:", error);
      this.showNoVideoMessage();
    }
  }

  /**
   * Met à jour la vitesse de lecture
   */
  async updatePlaybackRate(rate) {
    this.videoState.playbackRate = rate;

    try {
      await this.sendMessage({
        action: "setPlaybackRate",
        value: rate,
      });

      this.updateSpeedDisplay();
      this.updateSpeedPresets();
      await this.saveSettings();
    } catch (error) {
      console.error("Erreur lors de la mise à jour de la vitesse:", error);
    }
  }

  /**
   * Toggle mute/unmute
   */
  async toggleMute() {
    this.videoState.isMuted = !this.videoState.isMuted;

    try {
      await this.sendMessage({
        action: "toggleMute",
        value: this.videoState.isMuted,
      });

      this.updateMuteButton();
      await this.saveSettings();
    } catch (error) {
      console.error("Erreur lors du toggle mute:", error);
    }
  }

  /**
   * Toggle Picture-in-Picture
   */
  async togglePiP() {
    try {
      const response = await this.sendMessage({
        action: "togglePiP",
      });

      if (response) {
        this.videoState.isPiP = response.isPiP;
        this.updatePiPButton();
      }
    } catch (error) {
      console.error("Erreur lors du toggle PiP:", error);
    }
  }

  /**
   * Remet les paramètres par défaut
   */
  async resetSettings() {
    this.videoState.playbackRate = 1.0;
    this.videoState.isMuted = false;

    try {
      await this.sendMessage({
        action: "reset",
      });

      this.updateUI();
      await this.saveSettings();
    } catch (error) {
      console.error("Erreur lors du reset:", error);
    }
  }

  /**
   * Met à jour l'interface utilisateur
   */
  updateUI() {
    document.getElementById("speedRange").value = this.videoState.playbackRate;

    this.updateSpeedDisplay();
    this.updateSpeedPresets();
    this.updateMuteButton();
    this.updatePiPButton();
  }

  /**
   * Met à jour l'affichage de la vitesse
   */
  updateSpeedDisplay() {
    document.getElementById(
      "speedValue"
    ).textContent = `${this.videoState.playbackRate}x`;
  }

  /**
   * Met à jour les boutons de vitesse prédéfinie
   */
  updateSpeedPresets() {
    document.querySelectorAll(".preset-btn").forEach((btn) => {
      const speed = parseFloat(btn.dataset.speed);
      btn.classList.toggle("active", speed === this.videoState.playbackRate);
    });
  }

  /**
   * Met à jour le bouton mute
   */
  updateMuteButton() {
    const muteBtn = document.getElementById("muteBtn");
    const iconContainer = muteBtn.querySelector(".btn-icon");
    const text = muteBtn.querySelector(".btn-text");

    // Vider le conteneur d'icône et ajouter l'image appropriée
    iconContainer.innerHTML = "";
    const img = document.createElement("img");
    img.alt = "";

    if (this.videoState.isMuted) {
      img.src = "icons/sound-off-svgrepo-com.png";
      text.textContent = "Unmute";
      muteBtn.classList.add("muted");
    } else {
      img.src = "icons/sound-volume-2-svgrepo-com.png";
      text.textContent = "Mute";
      muteBtn.classList.remove("muted");
    }

    iconContainer.appendChild(img);
  }

  /**
   * Met à jour le bouton Picture-in-Picture
   */
  updatePiPButton() {
    const pipBtn = document.getElementById("pipBtn");
    pipBtn.classList.toggle("active", this.videoState.isPiP);
  }

  /**
   * Met à jour les informations de la vidéo
   */
  updateVideoInfo(videoData) {
    const videoInfo = document.getElementById("videoInfo");
    const metadata = videoData.metadata || {};

    // Affiche la section d'infos vidéo
    videoInfo.style.display = "block";

    // Met à jour la miniature
    const thumbnail = document.getElementById("videoThumbnail");
    if (metadata.thumbnail) {
      thumbnail.src = metadata.thumbnail;
      thumbnail.style.display = "block";

      // Gère les erreurs de chargement d'image
      thumbnail.onerror = function () {
        this.style.display = "none";
      };
    } else {
      thumbnail.style.display = "none";
    }

    // Met à jour le titre
    const title = document.getElementById("videoTitle");
    title.textContent = metadata.title || "Vidéo détectée";

    // Met à jour la description
    const description = document.getElementById("videoDescription");
    description.textContent =
      metadata.description || metadata.url || "Aucune description";

    // Met à jour les infos périodiquement
    this.startVideoInfoUpdates();
  }

  /**
   * Formate le temps en minutes:secondes
   */
  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "--:--";

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  }

  /**
   * Met à jour le temps actuel
   */
  updateCurrentTime(currentTime) {
    const currentTimeElement = document.getElementById("videoCurrentTime");
    currentTimeElement.textContent = this.formatTime(currentTime);
  }

  /**
   * Démarre les mises à jour périodiques des infos vidéo
   */
  startVideoInfoUpdates() {
    // Pas de timer automatique - juste une mise à jour initiale
    console.log("StreamPilot: Infos vidéo mises à jour");
  }

  /**
   * Affiche les contrôles
   */
  showControls() {
    document.getElementById("controls").style.display = "flex";
    document.getElementById("noVideoMessage").style.display = "none";
  }

  /**
   * Affiche le message "pas de vidéo"
   */
  showNoVideoMessage() {
    document.getElementById("controls").style.display = "none";
    document.getElementById("videoInfo").style.display = "none";
    document.getElementById("noVideoMessage").style.display = "block";
  }

  /**
   * Affiche la page d'informations
   */
  showInfoPage() {
    document.querySelector(".container").style.display = "none";
    document.getElementById("infoPage").style.display = "block";
  }

  /**
   * Affiche la page principale
   */
  showMainPage() {
    document.querySelector(".container").style.display = "block";
    document.getElementById("infoPage").style.display = "none";
  }

  /**
   * Ouvre le lien Buy Me a Coffee
   */
  openCoffeeLink() {
    chrome.tabs.create({
      url: "https://www.buymeacoffee.com/nassimmouso",
    });
  }
}

// Initialise le popup quand le DOM est chargé
document.addEventListener("DOMContentLoaded", () => {
  new StreamPilotPopup();
});
