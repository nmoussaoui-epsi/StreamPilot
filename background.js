/**
 * StreamPilot - Service Worker (Background Script)
 * Gère les événements en arrière-plan et les raccourcis clavier
 */

class StreamPilotBackground {
  constructor() {
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupContextMenus();
    this.clearAllBadges();
  }

  /**
   * Efface tous les badges de l'extension
   */
  clearAllBadges() {
    chrome.action.setBadgeText({ text: "" });
  }

  /**
   * Configure les écouteurs d'événements
   */
  setupEventListeners() {
    // Installation de l'extension
    chrome.runtime.onInstalled.addListener((details) => {
      this.handleInstall(details);
    });

    // Mise à jour de l'onglet
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.handleTabUpdate(tabId, changeInfo, tab);
    });

    // Activation de l'onglet
    chrome.tabs.onActivated.addListener((activeInfo) => {
      this.handleTabActivated(activeInfo);
    });

    // Messages depuis les content scripts ou popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Indique une réponse asynchrone
    });

    // Raccourcis clavier (vérifier que l'API est disponible)
    if (chrome.commands && chrome.commands.onCommand) {
      chrome.commands.onCommand.addListener((command) => {
        this.handleCommand(command);
      });
    }
  }

  /**
   * Configure les menus contextuels
   */
  setupContextMenus() {
    chrome.contextMenus.removeAll(() => {
      // Menu principal
      chrome.contextMenus.create({
        id: "streampilot-main",
        title: "StreamPilot",
        contexts: ["video"],
      });

      // Sous-menus pour la vitesse
      chrome.contextMenus.create({
        id: "speed-0.5",
        parentId: "streampilot-main",
        title: "Vitesse 0.5x",
        contexts: ["video"],
      });

      chrome.contextMenus.create({
        id: "speed-1",
        parentId: "streampilot-main",
        title: "Vitesse normale",
        contexts: ["video"],
      });

      chrome.contextMenus.create({
        id: "speed-1.25",
        parentId: "streampilot-main",
        title: "Vitesse 1.25x",
        contexts: ["video"],
      });

      chrome.contextMenus.create({
        id: "speed-1.5",
        parentId: "streampilot-main",
        title: "Vitesse 1.5x",
        contexts: ["video"],
      });

      chrome.contextMenus.create({
        id: "speed-2",
        parentId: "streampilot-main",
        title: "Vitesse 2x",
        contexts: ["video"],
      });

      // Séparateur
      chrome.contextMenus.create({
        id: "separator1",
        parentId: "streampilot-main",
        type: "separator",
        contexts: ["video"],
      });

      // Picture-in-Picture
      chrome.contextMenus.create({
        id: "toggle-pip",
        parentId: "streampilot-main",
        title: "Picture-in-Picture",
        contexts: ["video"],
      });

      // Mute
      chrome.contextMenus.create({
        id: "toggle-mute",
        parentId: "streampilot-main",
        title: "Mute/Unmute",
        contexts: ["video"],
      });

      // Séparateur
      chrome.contextMenus.create({
        id: "separator2",
        parentId: "streampilot-main",
        type: "separator",
        contexts: ["video"],
      });

      // Reset
      chrome.contextMenus.create({
        id: "reset",
        parentId: "streampilot-main",
        title: "Réinitialiser",
        contexts: ["video"],
      });
    });

    // Gestionnaire de clics sur les menus contextuels
    chrome.contextMenus.onClicked.addListener((info, tab) => {
      this.handleContextMenuClick(info, tab);
    });
  }

  /**
   * Gère l'installation de l'extension
   */
  async handleInstall(details) {
    if (details.reason === "install") {
      console.log("StreamPilot installé avec succès");

      // Initialise les paramètres par défaut
      await chrome.storage.sync.set({
        playbackRate: 1.0,
        volume: 100,
        isMuted: false,
        showWelcome: true,
      });

      // Ouvre la page de bienvenue (optionnel)
      // chrome.tabs.create({ url: 'welcome.html' });
    } else if (details.reason === "update") {
      console.log("StreamPilot mis à jour");
    }
  }

  /**
   * Gère les mises à jour d'onglets
   */
  handleTabUpdate(tabId, changeInfo, tab) {
    // Fonction conservée pour d'éventuels futurs besoins
  }

  /**
   * Gère l'activation d'un onglet
   */
  handleTabActivated(activeInfo) {
    // Fonction conservée pour d'éventuels futurs besoins
  }

  /**
   * Gère les messages reçus
   */
  async handleMessage(message, sender, sendResponse) {
    switch (message.action) {
      case "getStorageData":
        try {
          const data = await chrome.storage.sync.get(message.keys);
          sendResponse({ data });
        } catch (error) {
          sendResponse({ error: error.message });
        }
        break;

      case "setStorageData":
        try {
          await chrome.storage.sync.set(message.data);
          sendResponse({ success: true });
        } catch (error) {
          sendResponse({ error: error.message });
        }
        break;

      default:
        sendResponse({ error: "Action inconnue" });
    }
  }

  /**
   * Gère les raccourcis clavier
   */
  async handleCommand(command) {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      switch (command) {
        case "toggle-pip":
          chrome.tabs.sendMessage(tab.id, { action: "togglePiP" });
          break;

        case "toggle-mute":
          chrome.tabs.sendMessage(tab.id, { action: "toggleMute" });
          break;

        case "speed-up":
          chrome.tabs.sendMessage(tab.id, { action: "speedUp" });
          break;

        case "speed-down":
          chrome.tabs.sendMessage(tab.id, { action: "speedDown" });
          break;

        case "reset":
          chrome.tabs.sendMessage(tab.id, { action: "reset" });
          break;
      }
    } catch (error) {
      console.error("Erreur lors de l'exécution de la commande:", error);
    }
  }

  /**
   * Gère les clics sur les menus contextuels
   */
  async handleContextMenuClick(info, tab) {
    const menuId = info.menuItemId;

    try {
      if (menuId.startsWith("speed-")) {
        const speed = parseFloat(menuId.replace("speed-", ""));
        await chrome.tabs.sendMessage(tab.id, {
          action: "setPlaybackRate",
          value: speed,
        });
      } else {
        switch (menuId) {
          case "toggle-pip":
            await chrome.tabs.sendMessage(tab.id, { action: "togglePiP" });
            break;

          case "toggle-mute":
            await chrome.tabs.sendMessage(tab.id, { action: "toggleMute" });
            break;

          case "reset":
            await chrome.tabs.sendMessage(tab.id, { action: "reset" });
            break;
        }
      }
    } catch (error) {
      console.error("Erreur lors de l'action du menu contextuel:", error);
    }
  }
}

// Initialise le service worker
new StreamPilotBackground();
