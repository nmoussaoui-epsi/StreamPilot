# StreamPilot

Extension Chrome qui offre une boîte à outils complète pour améliorer votre expérience vidéo sur le web.

## Description

StreamPilot est une extension de navigateur qui permet de contrôler facilement les vidéos web avec des fonctionnalités avancées comme le Picture-in-Picture, le contrôle de la vitesse de lecture, et la gestion du son.

## Fonctionnalités

- **Picture-in-Picture** : Regardez vos vidéos dans une fenêtre flottante
- **Contrôle de la vitesse** : Accélérez ou ralentissez la lecture vidéo
- **Gestion du son** : Coupez ou remettez le son facilement
- **Interface intuitive** : Popup simple et accessible
- **Raccourcis clavier** : Contrôles rapides via des combinaisons de touches
- **Sauvegarde des préférences** : Vos paramètres sont conservés entre les sessions

## Raccourcis clavier

- `Ctrl+Shift+P` : Basculer en mode Picture-in-Picture
- `Ctrl+Shift+M` : Couper/Remettre le son
- `Ctrl+Shift+.` : Augmenter la vitesse de lecture
- `Ctrl+Shift+,` : Diminuer la vitesse de lecture

## Structure du projet

```
StreamPilot/
├── manifest.json          # Configuration de l'extension
├── popup.html             # Interface utilisateur
├── popup.css              # Styles de l'interface
├── popup.js               # Logique du popup
├── content.js             # Script injecté dans les pages web
├── background.js          # Script de service en arrière-plan
└── icons/                 # Icônes de l'extension
```

## Technologies utilisées

- **Manifest V3** : Dernière version du format d'extension Chrome
- **JavaScript ES6+** : Code moderne et performant
- **Chrome Extensions API** : Intégration native avec le navigateur
- **CSS3** : Interface utilisateur responsive

## Compatibilité

- Chrome 88+
- Navigateurs basés sur Chromium (Edge, Opera, etc.)

## Développement

Le projet utilise l'architecture standard des extensions Chrome avec :

- Un service worker pour les tâches en arrière-plan
- Un content script pour interagir avec les pages web
- Un popup pour l'interface utilisateur

## Licence

Ce projet est sous licence MIT. Voir le fichier LICENSE pour plus de détails.
