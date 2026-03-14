# Dashboard Claude Code Teammates

Dashboard interactif temps réel pour monitorer les sous-agents et teams du teammate mode de Claude Code.

## Fonctionnalités

- **Détection automatique** des sessions Claude en cours via `~/.claude/`
- **Graphe d'interactions** : visualisation des agents et de leurs communications (React Flow + dagre)
- **Grille d'agents** : vue carte avec type, status, dernière action en temps réel, outils utilisés
- **Kanban de tâches** : 3 colonnes (En attente, En cours, Terminé)
- **Timeline** : feed chronologique des événements (spawn, messages, tools)
- **Panel détail** : slide-in avec informations complètes d'un agent
- **Temps réel** : WebSocket avec reconnexion automatique
- **Hooks Claude Code** : auto-installés dans `~/.claude/settings.json`
- **Monitoring tmux** : visualisation en temps réel du contenu des terminaux tmux des agents
- **Écran d'attente** : affiché quand aucune session n'est active

## Prérequis

- Node.js 22+
- npm 10+
- Claude Code installé (les fichiers `~/.claude/` doivent exister)

## Installation

```bash
git clone <repo-url> Dashboard-Claude
cd Dashboard-Claude
npm install
```

## Utilisation

```bash
npm run dev
```

Cela lance :
- **Server** sur `http://localhost:3002` (API REST + WebSocket)
- **Client** sur `http://localhost:5173` (React + Vite)

Ouvrez `http://localhost:5173` dans votre navigateur.

### Port personnalisé

```bash
DASHBOARD_PORT=4000 npm run dev
```

> Note : changer le port du serveur met à jour automatiquement les hooks Claude Code.

## Fonctionnement

### Sources de données

1. **Hooks Claude Code** : Le serveur installe automatiquement des hooks dans `~/.claude/settings.json` qui envoient des HTTP POST à chaque événement (SessionStart, SubagentStart, Stop, etc.)
2. **File watching** : chokidar surveille les répertoires `~/.claude/sessions/`, `projects/`, `tasks/`, `teams/` pour capter l'état initial et les changements fichiers

### Écrans

| Condition | Écran |
|-----------|-------|
| Aucune session Claude | Écran d'attente avec indicateur WS |
| Session active | Dashboard principal avec 5 vues |

### Vues du dashboard

- **Graphe** : Nœuds = agents, edges = interactions. Layout hiérarchique dagre. Edges animées pour l'activité récente.
- **Agents** : Grille responsive de cartes. Clic → panel détail.
- **Tâches** : Kanban 3 colonnes avec assignation et blocages.
- **Chronologie** : Feed vertical trié par timestamp.
- **Monitoring** : Grille de terminaux tmux en lecture seule, mise à jour toutes les 2s.

### Monitoring tmux

L'onglet Monitoring affiche en temps réel le contenu des sessions tmux détectées sur la machine. Utile pour observer les terminaux des agents Claude Code exécutés dans tmux sans quitter le dashboard.

**Prérequis** : tmux doit être installé sur la machine. Si tmux n'est pas disponible, l'onglet affiche un message explicatif.

**Fonctionnement** : Le serveur poll `tmux capture-pane` toutes les 2 secondes et envoie les mises à jour via WebSocket. Seuls les changements de contenu sont transmis au client.

## Build production

```bash
npm run build
```

## Stack technique

- **Backend** : Node.js, Express 5, ws, chokidar 4, TypeScript
- **Frontend** : React 19, Vite 6, Tailwind CSS 4, Zustand 5, React Flow 12, dagre
- **Monorepo** : npm workspaces

Voir [CHOICES.md](CHOICES.md) pour le détail des choix et alternatives.

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — Structure du projet et flux de données
- [DECISIONS.md](DECISIONS.md) — Décisions techniques et justifications
- [CHOICES.md](CHOICES.md) — Choix de stack et alternatives considérées
- [CLAUDE.md](CLAUDE.md) — Instructions pour Claude Code
