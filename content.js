/**
 * StreamPilot - Content Script
 * Interagit avec les éléments vidéo sur les pages web
 */

class StreamPilotContent {
  constructor() {
    this.video = null;
    this.originalVolume = 1.0;
    this.isObserving = false;

    this.init();
  }

  init() {
    console.log(
      "StreamPilot: Initialisation du content script sur",
      window.location.hostname
    );

    // Délai pour laisser la page se charger complètement
    setTimeout(() => {
      this.findVideo();
    }, 1000);

    this.setupMessageListener();
    this.observeVideoChanges();
    this.setupVisibilityListener();
    this.setupPeriodicCheck();
    this.setupCleanupListeners();

    // Pour YouTube, attendre un peu plus et réessayer
    if (window.location.hostname.includes("youtube.com")) {
      setTimeout(() => {
        if (!this.video) {
          console.log("StreamPilot: Seconde tentative de détection YouTube");
          this.findVideo();
        }
      }, 3000);
    }
  }

  /**
   * Trouve la vidéo principale sur la page
   */
  findVideo() {
    // Cherche toutes les vidéos sur la page
    const videos = Array.from(document.querySelectorAll("video"));
    console.log(
      `StreamPilot: ${videos.length} vidéo(s) trouvée(s) sur la page`
    );

    if (videos.length === 0) {
      this.video = null;
      return;
    }

    // Pour YouTube, privilégier la vidéo avec la classe spécifique
    if (window.location.hostname.includes("youtube.com")) {
      console.log("StreamPilot: Détection spécifique YouTube");

      const selectors = [
        "video.html5-main-video",
        "#movie_player video",
        ".html5-video-player video",
        ".video-stream.html5-main-video",
        "video[src]",
      ];

      for (const selector of selectors) {
        const youtubeVideo = document.querySelector(selector);
        if (youtubeVideo) {
          console.log(
            `StreamPilot: Vidéo YouTube trouvée avec le sélecteur: ${selector}`
          );
          this.video = youtubeVideo;
          this.originalVolume = this.video.volume;
          this.setupVideoListeners();
          return;
        }
      }
    }

    // Priorité : vidéo en cours de lecture, puis la plus grande, puis la première
    let selectedVideo = videos.find((v) => !v.paused && !v.ended);

    if (selectedVideo) {
      console.log("StreamPilot: Vidéo en cours de lecture trouvée");
    }

    if (!selectedVideo) {
      // Trouve la vidéo avec la plus grande surface
      selectedVideo = videos.reduce((largest, current) => {
        const largestArea =
          (largest.videoWidth || 0) * (largest.videoHeight || 0);
        const currentArea =
          (current.videoWidth || 0) * (current.videoHeight || 0);
        return currentArea > largestArea ? current : largest;
      });

      if (selectedVideo && (selectedVideo.videoWidth || 0) > 0) {
        console.log(
          "StreamPilot: Vidéo avec dimensions trouvée:",
          selectedVideo.videoWidth + "x" + selectedVideo.videoHeight
        );
      }
    }

    // Si toujours pas de vidéo avec des dimensions, prend la première
    if (!selectedVideo && videos.length > 0) {
      selectedVideo = videos[0];
      console.log("StreamPilot: Utilisation de la première vidéo trouvée");
    }

    this.video = selectedVideo;

    if (this.video) {
      this.originalVolume = this.video.volume;
      this.setupVideoListeners();
    }
  }

  /**
   * Configure les écouteurs pour la vidéo
   */
  setupVideoListeners() {
    if (!this.video) return;

    // Sauvegarde le volume original quand il change
    this.video.addEventListener("volumechange", () => {
      this.originalVolume = this.video.volume;
    });

    // Réapplique les paramètres si la vidéo est rechargée
    this.video.addEventListener("loadedmetadata", () => {
      this.applyStoredSettings();
    });
  }

  /**
   * Applique les paramètres sauvegardés
   */
  async applyStoredSettings() {
    try {
      const settings = await chrome.storage.sync.get({
        playbackRate: 1.0,
        isMuted: false,
      });

      if (this.video) {
        this.video.playbackRate = settings.playbackRate;
        this.video.muted = settings.isMuted;
      }
    } catch (error) {
      console.error("Erreur lors de l'application des paramètres:", error);
    }
  }

  /**
   * Observe les changements dans le DOM pour détecter de nouvelles vidéos
   */
  observeVideoChanges() {
    if (this.isObserving) return;

    const observer = new MutationObserver((mutations) => {
      let shouldRefind = false;

      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === "VIDEO" || node.querySelector("video")) {
              shouldRefind = true;
            }
          }
        });
      });

      if (shouldRefind || !this.video || !document.contains(this.video)) {
        // Délai pour laisser le temps aux éléments de se charger
        setTimeout(() => {
          this.findVideo();
        }, 500);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Pour YouTube, observe aussi les changements d'URL
    if (window.location.hostname.includes("youtube.com")) {
      let lastUrl = location.href;
      new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
          lastUrl = url;
          // Délai plus long pour YouTube car il charge le contenu dynamiquement
          setTimeout(() => {
            this.findVideo();
          }, 2000);
        }
      }).observe(document, { subtree: true, childList: true });
    }

    this.isObserving = true;

    // Vérifie périodiquement s'il y a une vidéo (fallback)
    this.periodicCheck = setInterval(() => {
      if (!this.video) {
        this.findVideo();
      }
    }, 3000);
  }

  /**
   * Configure l'écouteur de messages depuis le popup
   */
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sendResponse);
      return true; // Indique une réponse asynchrone
    });
  }

  /**
   * Surveille les changements de visibilité de l'onglet
   */
  setupVisibilityListener() {
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        // L'onglet devient visible, revérifier la vidéo
        console.log(
          "StreamPilot: Onglet redevenu visible, vérification vidéo..."
        );
        setTimeout(() => {
          this.findVideo();
        }, 500);
      }
    });

    // Écoute aussi les événements de focus de la fenêtre
    window.addEventListener("focus", () => {
      console.log("StreamPilot: Fenêtre focus, vérification vidéo...");
      setTimeout(() => {
        this.findVideo();
      }, 500);
    });
  }

  /**
   * Surveillance périodique plus agressive
   */
  setupPeriodicCheck() {
    // Vérification rapide toutes les 2 secondes si pas de vidéo
    this.quickCheck = setInterval(() => {
      if (!this.video || !document.contains(this.video)) {
        this.findVideo();
      }
    }, 2000);

    // Vérification approfondie toutes les 10 secondes
    this.deepCheck = setInterval(() => {
      this.findVideo();
    }, 10000);
  }

  /**
   * Configure les écouteurs de nettoyage
   */
  setupCleanupListeners() {
    // Nettoie quand la page se décharge
    window.addEventListener("beforeunload", () => {
      this.cleanup();
    });

    // Nettoie quand l'onglet devient inactif trop longtemps
    let inactivityTimer;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        // Démarrer un timer d'inactivité
        inactivityTimer = setTimeout(() => {
          console.log("StreamPilot: Inactivité prolongée");
        }, 60000); // 1 minute d'inactivité
      } else {
        // Annuler le timer si on revient
        if (inactivityTimer) {
          clearTimeout(inactivityTimer);
          inactivityTimer = null;
        }
      }
    });
  }

  /**
   * Gère les messages reçus du popup
   */
  async handleMessage(message, sendResponse) {
    try {
      switch (message.action) {
        case "checkVideo":
          sendResponse(this.getVideoState());
          break;

        case "setPlaybackRate":
          this.setPlaybackRate(message.value);
          sendResponse({ success: true });
          break;

        case "toggleMute":
          this.toggleMute(message.value);
          sendResponse({ success: true });
          break;

        case "togglePiP":
          const pipResult = await this.togglePictureInPicture();
          sendResponse(pipResult);
          break;

        case "reset":
          this.resetVideo();
          sendResponse({ success: true });
          break;

        case "speedUp":
          this.adjustSpeed(0.25);
          sendResponse({ success: true });
          break;

        case "speedDown":
          this.adjustSpeed(-0.25);
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ error: "Action inconnue" });
      }
    } catch (error) {
      console.error("Erreur lors du traitement du message:", error);
      sendResponse({ error: "Erreur interne" });
    }
  }

  /**
   * Ajuste la vitesse de manière relative
   */
  adjustSpeed(delta) {
    if (!this.video) return;

    const newRate = Math.max(
      0.25,
      Math.min(3.0, this.video.playbackRate + delta)
    );
    this.setPlaybackRate(newRate);
  }

  /**
   * Retourne l'état actuel de la vidéo
   */
  getVideoState() {
    if (!this.video) {
      return { hasVideo: false };
    }

    const metadata = this.getVideoMetadata();

    return {
      hasVideo: true,
      playbackRate: this.video.playbackRate,
      isMuted: this.video.muted,
      isPiP: document.pictureInPictureElement === this.video,
      paused: this.video.paused,
      metadata: metadata,
    };
  }

  /**
   * Récupère les métadonnées de la vidéo
   */
  getVideoMetadata() {
    let metadata = {
      title: "",
      description: "",
      thumbnail: "",
      resolution: "",
      url: window.location.href,
    };

    // Récupère le titre de la page
    metadata.title = document.title || "Vidéo sans titre";

    // Récupère la résolution de la vidéo
    if (this.video.videoWidth && this.video.videoHeight) {
      metadata.resolution = `${this.video.videoWidth}x${this.video.videoHeight}`;
    }

    // Essaie de récupérer les métadonnées depuis Media Session API
    if (navigator.mediaSession && navigator.mediaSession.metadata) {
      const mediaMetadata = navigator.mediaSession.metadata;
      if (mediaMetadata.title) metadata.title = mediaMetadata.title;
      if (mediaMetadata.artist) metadata.description = mediaMetadata.artist;
      if (mediaMetadata.artwork && mediaMetadata.artwork.length > 0) {
        metadata.thumbnail = mediaMetadata.artwork[0].src;
      }
    }

    // Essaie de récupérer la miniature depuis l'attribut poster
    if (!metadata.thumbnail && this.video.poster) {
      metadata.thumbnail = this.video.poster;
    }

    // Essaie de récupérer depuis les meta tags de la page
    if (!metadata.thumbnail) {
      const ogImage = document.querySelector('meta[property="og:image"]');
      const twitterImage = document.querySelector('meta[name="twitter:image"]');

      if (ogImage && ogImage.content) {
        metadata.thumbnail = ogImage.content;
      } else if (twitterImage && twitterImage.content) {
        metadata.thumbnail = twitterImage.content;
      }
    }

    // Pour YouTube, essaie de récupérer des métadonnées spécifiques
    if (window.location.hostname.includes("youtube.com")) {
      metadata = this.getYouTubeMetadata(metadata);
    }

    // Pour autres plateformes vidéo
    if (window.location.hostname.includes("vimeo.com")) {
      metadata = this.getVimeoMetadata(metadata);
    }

    return metadata;
  }

  /**
   * Récupère les métadonnées spécifiques à YouTube
   */
  getYouTubeMetadata(metadata) {
    // Titre depuis YouTube
    const titleElement = document.querySelector(
      "h1.ytd-video-primary-info-renderer yt-formatted-string"
    );
    if (titleElement) {
      metadata.title = titleElement.textContent.trim();
    }

    // Description depuis YouTube
    const descElement = document.querySelector("#description-text");
    if (descElement) {
      metadata.description =
        descElement.textContent.trim().substring(0, 100) + "...";
    }

    // Miniature YouTube (utilise l'ID de la vidéo)
    const videoId = new URLSearchParams(window.location.search).get("v");
    if (videoId) {
      metadata.thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    }

    return metadata;
  }

  /**
   * Récupère les métadonnées spécifiques à Vimeo
   */
  getVimeoMetadata(metadata) {
    // Titre depuis Vimeo
    const titleElement = document.querySelector('[data-test-id="video-title"]');
    if (titleElement) {
      metadata.title = titleElement.textContent.trim();
    }

    // Description depuis Vimeo
    const descElement = document.querySelector(
      '[data-test-id="video-description"]'
    );
    if (descElement) {
      metadata.description =
        descElement.textContent.trim().substring(0, 100) + "...";
    }

    return metadata;
  }

  /**
   * Modifie la vitesse de lecture
   */
  setPlaybackRate(rate) {
    if (!this.video) return;

    this.video.playbackRate = Math.max(0.1, Math.min(4.0, rate));
  }

  /**
   * Nettoie tous les timers et observateurs
   */
  cleanup() {
    // Nettoie les timers
    if (this.periodicCheck) {
      clearInterval(this.periodicCheck);
      this.periodicCheck = null;
    }
    if (this.quickCheck) {
      clearInterval(this.quickCheck);
      this.quickCheck = null;
    }
    if (this.deepCheck) {
      clearInterval(this.deepCheck);
      this.deepCheck = null;
    }

    console.log("StreamPilot: Nettoyage complet effectué");
  }

  /**
   * Toggle mute/unmute
   */
  toggleMute(shouldMute) {
    if (!this.video) return;

    this.video.muted = shouldMute;
  }

  /**
   * Toggle Picture-in-Picture
   */
  async togglePictureInPicture() {
    if (!this.video) {
      return { error: "Aucune vidéo trouvée" };
    }

    try {
      // Vérifier si PiP est supporté
      if (!document.pictureInPictureEnabled) {
        return { error: "Picture-in-Picture non supporté" };
      }

      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        return { isPiP: false };
      } else {
        // Vérifier si la vidéo est prête
        if (this.video.readyState < 2) {
          return { error: "La vidéo n'est pas encore prête" };
        }

        await this.video.requestPictureInPicture();
        return { isPiP: true };
      }
    } catch (error) {
      console.error("Erreur Picture-in-Picture:", error);
      let errorMessage = "Erreur Picture-in-Picture";

      if (error.name === "InvalidStateError") {
        errorMessage = "La vidéo n'est pas dans un état valide";
      } else if (error.name === "NotSupportedError") {
        errorMessage = "Picture-in-Picture non supporté";
      } else if (error.name === "NotAllowedError") {
        errorMessage = "Picture-in-Picture non autorisé";
      }

      return { error: errorMessage };
    }
  }

  /**
   * Remet la vidéo aux paramètres par défaut
   */
  resetVideo() {
    if (!this.video) return;

    // Remet les paramètres de base
    this.video.playbackRate = 1.0;
    this.video.muted = false;
    this.video.volume = this.originalVolume;
  }

  /**
   * Nettoie les ressources
   */
  cleanup() {
    if (this.periodicCheck) {
      clearInterval(this.periodicCheck);
      this.periodicCheck = null;
    }
  }

  /**
   * Saute dans le temps (en secondes)
   */
  jumpTime(seconds) {
    if (!this.video) return;

    const currentTime = this.video.currentTime;
    const newTime = Math.max(
      0,
      Math.min(this.video.duration, currentTime + seconds)
    );
    this.video.currentTime = newTime;

    console.log(
      `StreamPilot: Saut de ${seconds}s - Temps: ${this.formatTime(newTime)}`
    );
  }

  /**
   * Définit un point de boucle (A ou B)
   */
  setLoopPoint(point) {
    if (!this.video) return { success: false, error: "Aucune vidéo trouvée" };

    const currentTime = this.video.currentTime;

    if (point === "A") {
      this.loopPointA = currentTime;
      console.log(
        `StreamPilot: Point A défini à ${this.formatTime(currentTime)}`
      );
    } else if (point === "B") {
      this.loopPointB = currentTime;
      console.log(
        `StreamPilot: Point B défini à ${this.formatTime(currentTime)}`
      );
    }

    return {
      success: true,
      time: currentTime,
      point: point,
    };
  }

  /**
   * Active/désactive la boucle A-B
   */
  toggleLoop(pointA, pointB) {
    if (!this.video) return { success: false, error: "Aucune vidéo trouvée" };

    if (pointA === null || pointB === null) {
      return { success: false, error: "Points A et B requis" };
    }

    // S'assurer que le point A est avant le point B
    if (pointA > pointB) {
      [pointA, pointB] = [pointB, pointA];
      this.loopPointA = pointA;
      this.loopPointB = pointB;
    }

    this.isLooping = !this.isLooping;

    if (this.isLooping) {
      this.startLoop();
      console.log(
        `StreamPilot: Boucle activée - A: ${this.formatTime(
          pointA
        )} B: ${this.formatTime(pointB)}`
      );
    } else {
      this.stopLoop();
      console.log("StreamPilot: Boucle désactivée");
    }

    return {
      success: true,
      isLooping: this.isLooping,
    };
  }

  /**
   * Démarre la boucle A-B
   */
  startLoop() {
    if (this.loopCheckInterval) {
      clearInterval(this.loopCheckInterval);
    }

    // Aller au point A
    if (
      this.video.currentTime < this.loopPointA ||
      this.video.currentTime > this.loopPointB
    ) {
      this.video.currentTime = this.loopPointA;
    }

    // Vérifier toutes les 100ms si on dépasse le point B
    this.loopCheckInterval = setInterval(() => {
      if (
        this.video &&
        this.isLooping &&
        this.video.currentTime >= this.loopPointB
      ) {
        this.video.currentTime = this.loopPointA;
      }
    }, 100);
  }

  /**
   * Arrête la boucle A-B
   */
  stopLoop() {
    if (this.loopCheckInterval) {
      clearInterval(this.loopCheckInterval);
      this.loopCheckInterval = null;
    }
  }

  /**
   * Efface la boucle A-B
   */
  clearLoop() {
    this.stopLoop();
    this.loopPointA = null;
    this.loopPointB = null;
    this.isLooping = false;
    console.log("StreamPilot: Boucle effacée");
  }

  /**
   * Formate le temps en MM:SS
   */
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }
}

// Initialise le content script avec retry pour YouTube
function initStreamPilot() {
  console.log("StreamPilot: Tentative d'initialisation");
  new StreamPilotContent();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initStreamPilot);
} else {
  initStreamPilot();
}

// Pour YouTube, qui charge de manière asynchrone, on réessaie après un délai
if (window.location.hostname.includes("youtube.com")) {
  setTimeout(() => {
    console.log("StreamPilot: Initialisation différée pour YouTube");
    initStreamPilot();
  }, 2000);
}
