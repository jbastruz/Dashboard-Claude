# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Description

Dashboard interactif temps réel pour monitorer les sous-agents et teams du teammate mode de Claude Code. Se connecte à la session Claude en cours via file watching (`~/.claude/`) et hooks HTTP, affiche les agents spawnés avec leur rôle, tâche et interactions.

## Project Status

MVP fonctionnel. Le serveur détecte les sessions, agents (avec types et dernière action), tâches et équipes. Monitoring tmux intégré. Le client React affiche un dashboard avec graphe d'interactions, grille d'agents, kanban de tâches, timeline et monitoring tmux.

## Commands

- `npm run dev` — Lance server (port 3002) + client Vite (port 5173) via concurrently
- `npm run build` — Build server (tsc) puis client (vite build)
- `npx -w server tsc --noEmit` — Type-check server uniquement
- `npx -w client tsc --noEmit` — Type-check client uniquement

## Architecture

Monorepo npm workspaces : `server/` (Node.js + Express + WS + chokidar) et `client/` (React 19 + Vite 6 + Tailwind CSS 4 + Zustand 5 + React Flow v12).

Voir [ARCHITECTURE.md](ARCHITECTURE.md) pour le détail complet.

## Key Conventions

- **Langue UI** : Tout le texte affiché est en français, centralisé dans `client/src/lib/fr.ts`
- **Dark theme** : bg-gray-950 / bg-[#12121a] / border-[#1e1e2e], accent #e07a3a (claude-orange)
- **Server imports** : Utiliser extensions `.js` (Node16 module resolution)
- **Client imports** : Sans extension `.js` (Vite/bundler resolution)
- **Port serveur** : 3002 (configurable via `DASHBOARD_PORT` env var) — le 3001 est souvent occupé
- **Chokidar v4** : Ne supporte PAS les glob patterns dans `watch()`, utiliser des chemins de répertoires et filtrer manuellement
- **Types agents** : Le champ dans les fichiers meta.json est `agentType` (pas `type` ni `agent_type`)
- **Session startedAt** : Peut être un nombre (epoch ms) ou une string ISO — toujours gérer les deux
- **Agent lastAction** : Objet `{ type, detail, timestamp }` ou null — peuplé par les hooks, pas par le file scanning
- **TmuxMonitor** : Polling 2s, dégradation gracieuse si tmux absent. Timer `.unref()` obligatoire
- **Stores Zustand** : Un store par domaine — `tmuxStore` ajouté pour l'état tmux

## Documentation

Toute modification significative doit être documentée dans les fichiers suivants :

- [ARCHITECTURE.md](ARCHITECTURE.md) — Structure du projet, flux de données, composants principaux
- [DECISIONS.md](DECISIONS.md) — Décisions techniques et leur justification (ADR léger)
- [CHOICES.md](CHOICES.md) — Choix de stack, librairies, patterns et alternatives considérées
- [README.md](README.md) — Guide d'installation, utilisation et contribution

Mettre à jour ces fichiers à chaque changement d'architecture, ajout de dépendance, ou modification de convention.
